/**
 * BUG-CIVIL-RECUA-NO-DESENHO — serf e obreiro andavam para frente e para tras no desenho (relato do
 * operador, 2026-10-04). Medido: com a colisao civil ligada o desenho recuava 412 vezes em 3 000
 * ticks da vila pronta, contra 140 sem ela. Duas causas em `posicaoDaUnidade`: a divida da permuta
 * (`progresso` negativo) desenhava o civil atras do proprio tile, e o segurado saltava de ~0,8 do
 * passo para a borda.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { carregar } from '../src/sim/save';
import { step } from '../src/sim/tick';
import { gameData, loadGameData } from '../src/sim/data';
import { rawGameData } from '../src/sim/data/raw';
import type { GameData } from '../src/sim/data/types';
import type { GameState, Unidade } from '../src/sim/state';
import { posicaoDaUnidade } from '../src/sim/selectors';
import { gravarEvidencia } from './helpers/evidence';
import { criarMemoriaDaEspera, fracaoNoPasso } from '../src/render/espera-na-fila';

const VILA = readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8');

/**
 * O recuo DENTRO do passo (mesmo tile, mesmo tile seguinte, a fracao caindo), o tick desenhado atras
 * do proprio tile, e a fracao em que cada recuo terminou. A volta de quem chega ao centro do tile e
 * sai em angulo nao conta: nao e o mesmo passo.
 */
function recuosNoPasso(dados: GameData, ticks: number): { passos: number; recuos: number; atrasDoTile: number; destinos: number[] } {
  let s = carregar(VILA, dados);
  const ant: Record<string, { chave: string; f: number }> = {};
  let passos = 0;
  let recuos = 0;
  let atrasDoTile = 0;
  const destinos: number[] = [];
  for (let t = 0; t < ticks; t++) {
    s = step(s, [], dados);
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id]!;
      if (u.tipo !== 'serf' && u.tipo !== 'laborer') continue;
      const prox = u.fsmData.caminho?.[0];
      if (prox === undefined) { delete ant[id]; continue; }
      const p = posicaoDaUnidade(s, u, dados);
      const dx = prox.gx - u.gx;
      const dy = prox.gy - u.gy;
      const f = ((p.gx - u.gx) * dx + (p.gy - u.gy) * dy) / (dx * dx + dy * dy || 1);
      if (f < -1e-9) atrasDoTile++;
      const chave = `${u.gx},${u.gy}>${prox.gx},${prox.gy}`;
      const a = ant[id];
      if (a !== undefined && a.chave === chave) {
        passos++;
        if (f < a.f - 1e-9) { recuos++; destinos.push(f); }
      }
      ant[id] = { chave, f };
    }
  }
  return { passos, recuos, atrasDoTile, destinos };
}

/** Um estado minimo com dois civis: so o que `posicaoDaUnidade` le. */
function dois(eu: Partial<Unidade> & { fsmData: Unidade['fsmData'] }, outro: Partial<Unidade> & { fsmData: Unidade['fsmData'] } | null): { s: GameState; u: Unidade } {
  const base = { lado: 0, tipo: 'serf', fsm: 'ocioso', direcao: 's' } as unknown as Unidade;
  const u = { ...base, id: 'u', gx: 10, gy: 10, ...eu } as Unidade;
  const porId: Record<string, Unidade> = { u };
  if (outro !== null) porId['o'] = { ...base, id: 'o', gx: 11, gy: 10, ...outro } as Unidade;
  const s = { estradas: {}, unidades: { porId, ordem: Object.keys(porId) } } as unknown as GameState;
  return { s, u };
}

describe('BUG-CIVIL-RECUA-NO-DESENHO', () => {
  const leste = [{ gx: 11, gy: 10 }, { gx: 12, gy: 10 }];

  it('1. por tabela: progresso negativo desenha no tile; quem anda segue o passo (I-MOVIMENTO-FILA-DE-CIVIS: o limite da borda saiu)', () => {
    const fx = (s: GameState, u: Unidade): number => posicaoDaUnidade(s, u, gameData).gx - u.gx;
    // progresso negativo (defeito, a invariante acusa): no tile, nunca atras dele
    const divida = dois({ fsmData: { caminho: leste, progresso: -5 } }, null);
    expect(fx(divida.s, divida.u)).toBe(0);
    // quem espera na fila esta em progresso 0: no centro do proprio tile
    const esperando = dois({ fsmData: { caminho: leste, progresso: 0, bloqueado: 3 } }, { fsmData: {} });
    expect(fx(esperando.s, esperando.u)).toBe(0);
    // quem anda segue o passo, haja ou nao alguem no tile seguinte: o tile ja e dele (a reserva)
    const passo = 3;
    const sozinho = dois({ fsmData: { caminho: leste, progresso: passo } }, null);
    const comOutro = dois({ fsmData: { caminho: leste, progresso: passo } }, { fsmData: {} });
    expect(fx(sozinho.s, sozinho.u)).toBeGreaterThan(0);
    expect(fx(comOutro.s, comOutro.u)).toBe(fx(sozinho.s, sozinho.u));
  });

  it('2. na vila pronta, com a colisao: nada atras do tile, e todo recuo no passo termina na borda', () => {
    const raw = JSON.parse(JSON.stringify(rawGameData)) as typeof rawGameData;
    (raw.units.colisaoCivil as { ligada: boolean }).ligada = false;
    const com = recuosNoPasso(gameData, 3000);
    const sem = recuosNoPasso(loadGameData(raw), 3000);
    gravarEvidencia('BUG-CIVIL-RECUA-NO-DESENHO', {
      comColisao: { passos: com.passos, recuosNoPasso: com.recuos, ticksAtrasDoTile: com.atrasDoTile },
      semColisao: { passos: sem.passos, recuosNoPasso: sem.recuos, ticksAtrasDoTile: sem.atrasDoTile },
      antesDaCorrecao: { recuosNoPasso: 122, ticksAtrasDoTile: 220 },
    });
    expect(com.passos).toBeGreaterThan(5000); // a vila andou de verdade
    expect(sem.recuos).toBe(0); // a regua: sem a colisao o passo so vai para a frente
    expect(com.atrasDoTile).toBe(0);
    // o que sobra e o civil que o tile da frente segurou NAQUELE tick: ele para na borda, nunca alem
    expect(com.destinos.every((f) => Math.abs(f - 0.5) < 1e-9)).toBe(true);
  }, 120_000);

  it('3. decisao do operador, por tabela: dentro do passo o desenho nao cai; passo novo recomeca', () => {
    const m = criarMemoriaDaEspera();
    const passo = { gx: 10, gy: 10, proximo: { gx: 11, gy: 10 } };
    const em = (f: number) => ({ gx: 10 + f, gy: 10 });
    expect(m.semRecuo('u', passo, em(0.3))).toEqual(em(0.3)); // primeira vez
    expect(m.semRecuo('u', passo, em(0.8))).toEqual(em(0.8)); // avancar passa
    expect(m.semRecuo('u', passo, em(0.5))).toEqual(em(0.8)); // cair fica onde estava (o serf espera)
    expect(m.semRecuo('u', passo, em(0.9))).toEqual(em(0.9)); // voltou a andar
    const seguinte = { gx: 11, gy: 10, proximo: { gx: 12, gy: 10 } };
    expect(m.semRecuo('u', seguinte, { gx: 11, gy: 10 })).toEqual({ gx: 11, gy: 10 }); // passo novo aceita o 0
    m.esquecer('u');
    expect(m.semRecuo('u', passo, em(0.2))).toEqual(em(0.2)); // esquecida recomeca
    expect(m.semRecuo('u', { gx: 10, gy: 10, proximo: undefined }, { gx: 10, gy: 10 })).toEqual({ gx: 10, gy: 10 }); // sem caminho
    expect(fracaoNoPasso(passo, em(0.25))).toBeCloseTo(0.25, 9);
  });

  it('4. na vila pronta com a colisao, depois da regra do render: zero recuos dentro do passo', () => {
    let s = carregar(VILA, gameData);
    const m = criarMemoriaDaEspera();
    const ant: Record<string, { chave: string; f: number }> = {};
    let passos = 0;
    let recuos = 0;
    let seguraram = 0;
    for (let t = 0; t < 3000; t++) {
      s = step(s, [], gameData);
      for (const id of s.unidades.ordem) {
        const u = s.unidades.porId[id]!;
        if (u.tipo !== 'serf' && u.tipo !== 'laborer') continue;
        const passo = { gx: u.gx, gy: u.gy, proximo: u.fsmData.caminho?.[0] };
        const bruta = posicaoDaUnidade(s, u, gameData);
        const p = m.semRecuo(id, passo, bruta);
        if (p !== bruta) seguraram++;
        if (passo.proximo === undefined) { delete ant[id]; continue; }
        const f = fracaoNoPasso(passo, p);
        const chave = `${u.gx},${u.gy}>${passo.proximo.gx},${passo.proximo.gy}`;
        const a = ant[id];
        if (a !== undefined && a.chave === chave) { passos++; if (f < a.f - 1e-9) recuos++; }
        ant[id] = { chave, f };
      }
    }
    gravarEvidencia('BUG-CIVIL-RECUA-NO-DESENHO-render', { passos, recuosNoPasso: recuos, ticksEmQueAEsperaSegurou: seguraram, antes: 112 });
    expect(passos).toBeGreaterThan(5000);
    // I-MOVIMENTO-FILA-DE-CIVIS: a sim ja nao recua o passo, e a regra do render e so rede de seguranca
    // (o numero de vezes que ela segurou vai para o test-output, sem asserção)
    expect(recuos).toBe(0);
  }, 120_000);
});
