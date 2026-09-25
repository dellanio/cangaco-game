/**
 * F-CAL-a — A VILA DA CADEIA DA COMIDA SOBE PELA ABERTURA.
 *
 * O aceite: os oito predios plantados completos, os sete que pedem trabalhador
 * ocupados, o campo arado e ZERO recusa de comando — tudo por comando do jogador,
 * a partir da mesma abertura que a F17 usa. Aqui nao se afirma calibracao
 * nenhuma; se os numeros estao certos e pergunta da F-CAL-b.
 *
 * Por que ele existe separado: o aceite da F-CAL pressupoe um cenario que NAO
 * nasce sozinho. Na abertura pura o Moinho e a Padaria nunca desbloqueiam — eles
 * dependem do Rocado e do Moinho CONSTRUIDOS, e o Rocado so abre quando a
 * serraria fica de pe. Sem este arquivo, medir a cadeia na abertura seria medir
 * uma vila que nao existe.
 *
 * O TETO de ticks e MEDIDO, nao chutado: a sonda desta sessao (a mesma geometria,
 * a mesma semente) fechou tudo no tick 7148; 25% de folga = 8935, arredondado
 * para 9000 — e REMEDIDO na F18g, 9465 -> 12 000 (ver a constante). "Fechado"
 * passou a incluir LIGADO. O eixo e TICK, deterministico e byte a byte — nao e a medida de
 * relogio que a §8 do CLAUDE.md proibiu como assercao. O tempo de parede da
 * corrida vai para a evidencia como NUMERO DA CORRIDA, e nada o afirma.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { estoqueDosArmazens } from '../src/sim/selectors';
import { chaveDeTile, ehEstrada, predioLigadoAoArmazem } from '../src/sim/estradas';
import { bordaSul, caixaDeTipo, caixasSeSobrepoem } from '../src/sim/footprint';
import type { GameState, Predio } from '../src/sim/state';
import { TIPOS_DA_ABERTURA } from './helpers/abertura';
import type { VilaDaCalibracao } from './helpers/cal-vila';
import { TIPOS_DA_CADEIA_DA_COMIDA, comandosDaVilaNoTick, vilaDaCalibracao } from './helpers/cal-vila';
import { gravarEvidencia } from './helpers/evidence';

/** Sonda de 2026-09-25: tudo de pe, ocupado e arado no tick 7148; +25% = 9000.
 *  REMEDIDO na F18g (2026-09-25): com a pedra viajando por tile — e a planta so
 *  saindo com o trecho dela DE PE — a vila fecha (agora incluindo "ligado") no tick
 *  **9465**; +25% = 11 831, arredondado para 12 000. O que atrasou foi a ponta: a
 *  Bodega espera a pedra dos tres tiles dela e dos cinco da obra chegarem da
 *  pedreira, um por vez, atras do material de obra na escada. */
const TETO = 12000;

/** O predio cujo CANTO e este tile, ou `null` — a mesma pergunta que o helper faz. */
function predioNoCanto(state: GameState, gx: number, gy: number): Predio | null {
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (p && p.gx === gx && p.gy === gy) return p;
  }
  return null;
}

/** Toda planta do cenario, a da abertura e a da cadeia, no formato do aceite. */
function todasAsPlantas(vila: VilaDaCalibracao): { tipo: string; gx: number; gy: number; civil: string | null }[] {
  return [
    ...vila.abertura.plantas.map((p) => ({ tipo: p.tipo, gx: p.gx, gy: p.gy, civil: p.civil })),
    ...vila.plantas.map((p) => ({ tipo: p.tipo, gx: p.gx, gy: p.gy, civil: p.civil })),
  ];
}

describe('F-CAL-a — a vila da cadeia da comida', () => {
  describe('a geometria, antes de qualquer tick', () => {
    const s = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s);

    it('acrescenta exatamente os quatro predios que o criterio nomeia', () => {
      expect(vila.plantas.map((p) => p.tipo)).toEqual([...TIPOS_DA_CADEIA_DA_COMIDA]);
    });

    it('nenhuma caixa se sobrepoe a outra, nem tapa a porta de ninguem', () => {
      const caixas = todasAsPlantas(vila)
        .map((p) => ({ nome: `${p.tipo}@${p.gx},${p.gy}`, caixa: caixaDeTipo(p.tipo, p.gx, p.gy, gameData) }))
        .concat(s.predios.ordem.map((id) => {
          const p = s.predios.porId[id];
          return { nome: `${p?.tipo}@${id}`, caixa: p ? caixaDeTipo(p.tipo, p.gx, p.gy, gameData) : null };
        }));
      for (const a of caixas) {
        expect(a.caixa, `${a.nome} sem tamanho no dado`).not.toBeNull();
        for (const b of caixas) {
          if (a === b || a.caixa === null || b.caixa === null) continue;
          expect(caixasSeSobrepoem(a.caixa, b.caixa), `${a.nome} sobre ${b.nome}`).toBe(false);
          expect(caixasSeSobrepoem(bordaSul(a.caixa), b.caixa), `${b.nome} tapa a porta de ${a.nome}`).toBe(false);
        }
      }
    });

    it('cada predio novo tem ao menos uma porta na rua do cenario', () => {
      // A rua do cenario e a da abertura MAIS os trechos que cada planta
      // acrescenta. "Porta na rua" e afirmado por PERTINENCIA no conjunto, nao
      // por coordenada: qualquer x que a derivacao escolha continua valendo.
      const rua = new Set<string>([
        ...vila.abertura.rua.map(chaveDeTile),
        ...vila.plantas.flatMap((p) => p.rua.map(chaveDeTile)),
      ]);
      for (const p of vila.plantas) {
        const caixa = caixaDeTipo(p.tipo, p.gx, p.gy, gameData);
        expect(caixa).not.toBeNull();
        if (caixa === null) continue;
        const porta = bordaSul(caixa);
        const tiles: string[] = [];
        for (let gx = porta.x0; gx < porta.x1; gx += 1) tiles.push(chaveDeTile({ gx, gy: porta.y0 }));
        expect(tiles.some((t) => rua.has(t)), `${p.tipo}@${p.gx} nasce com a porta no mato`).toBe(true);
      }
    });

    it('o campo fica ao sul do Rocado, fora da rua, e nao esta vazio', () => {
      const rua = new Set<string>([
        ...vila.abertura.rua.map(chaveDeTile),
        ...vila.plantas.flatMap((p) => p.rua.map(chaveDeTile)),
      ]);
      expect(vila.campo.length).toBeGreaterThan(0);
      const rocado = vila.plantas[0];
      expect(rocado?.tipo).toBe(TIPOS_DA_CADEIA_DA_COMIDA[0]);
      const caixa = rocado === undefined ? null : caixaDeTipo(rocado.tipo, rocado.gx, rocado.gy, gameData);
      expect(caixa).not.toBeNull();
      for (const t of vila.campo) {
        expect(rua.has(chaveDeTile(t)), `o canteiro em ${t.gx},${t.gy} cai na rua`).toBe(false);
        if (caixa === null) continue;
        expect(t.gy, `o canteiro em ${t.gx},${t.gy} nao esta ao sul do Rocado`).toBeGreaterThanOrEqual(caixa.y1);
      }
    });
  });

  it('a vila inteira sobe por comando: oito completos, sete ocupados, campo arado, zero recusa', () => {
    let s = createInitialState(gameData.economia.estadoInicial.semente);
    const vila = vilaDaCalibracao(s);
    const plantas = todasAsPlantas(vila);
    const marcos: Record<string, number | null> = { 'campo-arado': null, 'cenario-fechado': null };
    for (const p of plantas) {
      marcos[`completo:${p.tipo}@${p.gx}`] = null;
      marcos[`ligado:${p.tipo}@${p.gx}`] = null;
      if (p.civil !== null) marcos[`ocupado:${p.tipo}@${p.gx}`] = null;
    }
    const recusas: { tick: number; comando: string; motivo: string }[] = [];
    const marcar = (nome: string, tick: number): void => {
      if (marcos[nome] === null || marcos[nome] === undefined) marcos[nome] = tick;
    };

    const comecou = Date.now();
    for (let i = 0; i < TETO; i += 1) {
      s = step(s, comandosDaVilaNoTick(s, vila, i));
      for (const ev of s.events) {
        if (ev.type === 'command-rejected' && recusas.length < 40) {
          recusas.push({ tick: s.tick, comando: ev.command, motivo: ev.motivo });
        }
      }
      let fechou = true;
      for (const p of plantas) {
        const predio = predioNoCanto(s, p.gx, p.gy);
        const completo = predio !== null && predio.estado === 'completo';
        if (completo) marcar(`completo:${p.tipo}@${p.gx}`, s.tick); else fechou = false;
        // F18g: a rua se assenta tile a tile, atras do material de obra na escada, e
        // um predio pode ficar completo e ocupado antes de a porta dele virar rua de
        // pe. "Fechado" inclui a ligacao — e a assercao 3 la embaixo deixou de ser
        // consequencia do fechamento para ser parte dele.
        if (completo && predioLigadoAoArmazem(s, predio)) marcar(`ligado:${p.tipo}@${p.gx}`, s.tick);
        else fechou = false;
        if (p.civil === null) continue;
        if (completo && predio.estado === 'completo' && predio.ocupante !== null) {
          marcar(`ocupado:${p.tipo}@${p.gx}`, s.tick);
        } else fechou = false;
      }
      if (vila.campo.every((t) => s.recursos[chaveDeTile(t)] !== undefined)) {
        marcar('campo-arado', s.tick);
      } else fechou = false;
      if (fechou) { marcar('cenario-fechado', s.tick); break; }
    }
    const msDeParede = Date.now() - comecou;

    const noEstado = plantas.map((p) => {
      const predio = predioNoCanto(s, p.gx, p.gy);
      return {
        esperado: p.tipo,
        tipo: predio?.tipo ?? null,
        estado: predio?.estado ?? null,
        ocupante: predio !== null && predio.estado === 'completo' ? predio.ocupante : null,
        ligadoAoArmazem: predio === null ? null : predioLigadoAoArmazem(s, predio),
      };
    });

    gravarEvidencia('F-CAL-cenario', {
      feature: 'F-CAL-a — a vila da cadeia da comida sobe pela abertura',
      semente: gameData.economia.estadoInicial.semente,
      tetoDeTicks: TETO,
      plantas: vila.plantas.map((p) => ({
        tipo: p.tipo, gx: p.gx, gy: p.gy, civil: p.civil,
        rua: p.rua.map((t) => chaveDeTile(t)),
      })),
      campo: vila.campo.map((t) => chaveDeTile(t)),
      custos: {
        stoneDaRuaExtra: vila.stoneDaRuaExtra,
        stoneDasPlantas: vila.stoneDasPlantas,
        timberDasPlantas: vila.timberDasPlantas,
      },
      civisDesejados: vila.civisDesejados,
      marcos,
      predios: noEstado,
      recusas,
      ticksRodados: s.tick,
      noArmazem: estoqueDosArmazens(s),
      unidadesPorTipo: s.unidades.ordem.reduce<Record<string, number>>((acc, id) => {
        const t = s.unidades.porId[id]?.tipo ?? '?';
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {}),
      // NUMERO DA CORRIDA, nunca assercao (CLAUDE.md §8): serve para a F-CAL-b
      // saber se as janelas de 24 000 e 36 000 ticks cabem no orcamento dos
      // casos lentos, e nao para dizer que este teste e rapido.
      msDeParedeDaCorrida: msDeParede,
    });

    // 1. OS OITO, cada um do tipo que o cenario nomeia — os quatro da abertura
    //    mais os quatro da cadeia da comida
    expect(plantas.map((p) => p.tipo)).toEqual([...TIPOS_DA_ABERTURA, ...TIPOS_DA_CADEIA_DA_COMIDA]);
    for (const p of plantas) {
      const predio = predioNoCanto(s, p.gx, p.gy);
      expect(predio, `${p.tipo}@${p.gx} nao existe no estado`).not.toBeNull();
      expect(predio?.tipo).toBe(p.tipo);
      expect(predio?.estado, `${p.tipo}@${p.gx} nao ficou completo`).toBe('completo');
    }

    // 2. OCUPADOS: os sete que pedem trabalhador. A bodega tem `trabalhador: null`
    //    no dado e por isso nao entra — e o dado que decide quem conta, nao uma
    //    lista aqui.
    const queOcupam = plantas.filter((p) => p.civil !== null);
    expect(queOcupam).toHaveLength(7);
    for (const p of queOcupam) {
      const predio = predioNoCanto(s, p.gx, p.gy);
      expect(predio?.estado === 'completo' ? predio.ocupante : null, `${p.tipo}@${p.gx} ficou vago`).not.toBeNull();
    }

    // 3. LIGADOS: derivado da rede. Um predio da cadeia com a porta fora da rua
    //    ficaria completo e ocupado e mesmo assim nao escoaria nada — e a F-CAL-b
    //    mediria intervalo de entrega de uma vila que nao entrega.
    for (const p of plantas) {
      const predio = predioNoCanto(s, p.gx, p.gy);
      if (predio === null) continue;
      expect(predioLigadoAoArmazem(s, predio), `${p.tipo}@${p.gx} sem ligacao ao armazem`).toBe(true);
    }

    // 4. O CAMPO ARADO: cada tile do canteiro virou recurso da cultura do Rocado.
    //    E o campo nao caiu na rua — se caisse, a rua e o campo disputariam o
    //    mesmo tile e um dos dois perderia em silencio.
    for (const t of vila.campo) {
      expect(s.recursos[chaveDeTile(t)]?.tipo, `${t.gx},${t.gy} nao virou campo`).toBe(vila.cultura);
      expect(ehEstrada(s.estradas, t), `${t.gx},${t.gy} e rua e campo ao mesmo tempo`).toBe(false);
    }

    // 5. ZERO RECUSA: o caminho do jogador e valido do primeiro ao ultimo clique.
    //    E a assercao mais barata de quebrar e a que mais acusa — foi ela que
    //    pegou o `sem-pedra` de dois trechos de rua no mesmo tick.
    expect(recusas).toEqual([]);
    // O `timeout` NAO e assercao de tempo (CLAUDE.md §8): ele existe para o caso
    // travar. Esta corrida leva ~2 s sozinha, mas reprovou uma vez na suite
    // inteira, com 103 workers disputando a maquina, no teto padrao de 5 s — a sim
    // e deterministica, entao o estado nao pode ter mudado; o que mudou foi a
    // maquina. Mesmo uso e mesmo numero de `tests/F09-sistema.test.ts`.
  }, 20_000);
});
