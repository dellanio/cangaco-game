/**
 * F-TELA-NEVOA — a parte pura da nevoa na tela (`src/render/nevoa.ts`) e o clique da `ui/`. O que
 * aparece de fato na tela e o roteiro `tools/shots/F-TELA-NEVOA.js` que prova.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { criarEscaramuca } from '../src/sim/cenario';
import { predioNoTile } from '../src/sim/selectors';
import { ehDescoberto, ehVisivel, visaoDe } from '../src/sim/nevoa';
import {
  inimigosForaDaVista, predioClicavel, prediosInimigosForaDaVista, resumoDaNevoa, texturaDaNevoa,
} from '../src/render/nevoa';
import { configDoMapa } from '../src/render/mapa';
import { ordemDoBotaoDireito } from '../src/ui/ordem-militar';
import { comOlheiro } from './helpers/vista';

const s0 = criarEscaramuca(gameData.economia.estadoInicial.semente);
const daIA = (s: GameState): string[] => s.predios.ordem.filter((id) => s.predios.porId[id]?.lado === LADO_DA_IA);
const armazemDaIA = s0.predios.ordem.map((id) => s0.predios.porId[id]).find((p) => p?.lado === LADO_DA_IA && p.tipo === 'storehouse');
if (armazemDaIA === undefined) throw new Error('fixture: o armazem da IA');
const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === 'militia');

describe('F-TELA-NEVOA — o que a tela esconde', () => {
  it('no tick 0, toda unidade e todo predio da IA estao fora da vista; os do jogador nao', () => {
    const unidadesDaIA = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DA_IA);
    expect([...inimigosForaDaVista(s0)].sort()).toEqual([...unidadesDaIA].sort());
    expect([...prediosInimigosForaDaVista(s0)].sort()).toEqual([...daIA(s0)].sort());
  });

  it('o olheiro perto do armazem da IA o tira do escuro', () => {
    const s = comOlheiro(s0, armazemDaIA);
    expect(prediosInimigosForaDaVista(s).has(armazemDaIA.id)).toBe(false);
  });

  it('sem a camada (save de antes da F), nada se esconde e nada escurece', () => {
    const { descoberto: _d, ...semNevoa } = s0;
    expect(inimigosForaDaVista(semNevoa).size).toBe(0);
    expect(prediosInimigosForaDaVista(semNevoa).size).toBe(0);
    const px = texturaDaNevoa(semNevoa, configDoMapa.nevoa, configDoMapa);
    expect(resumoDaNevoa(px, configDoMapa.nevoa).visiveis).toBe(configDoMapa.largura * configDoMapa.altura);
  });
});

describe('F-TELA-NEVOA — a textura', () => {
  it('um pixel por tile: transparente o visivel, escuro o nunca visto, esmaecido o visto fora da vista', () => {
    const px = texturaDaNevoa(s0, configDoMapa.nevoa, configDoMapa);
    const v = visaoDe(s0);
    const alfa = (gx: number, gy: number): number => px[(gy * configDoMapa.largura + gx) * 4 + 3] ?? -1;
    const u = s0.unidades.porId[tropa[0] as string];
    if (u === undefined) throw new Error('fixture');
    expect(ehVisivel(v, u.gx, u.gy)).toBe(true);
    expect(alfa(u.gx, u.gy)).toBe(0);
    expect(ehDescoberto(s0, LADO_DO_JOGADOR, armazemDaIA.gx, armazemDaIA.gy)).toBe(false);
    expect(alfa(armazemDaIA.gx, armazemDaIA.gy)).toBe(Math.round(configDoMapa.nevoa.alfaNaoDescoberto * 255));
    // descoberto e fora da vista: o mesmo estado, com o tile do armazem marcado descoberto
    const i = armazemDaIA.gy * configDoMapa.largura + armazemDaIA.gx;
    const bits = [...(s0.descoberto?.[String(LADO_DO_JOGADOR)] ?? [])];
    bits[Math.floor(i / 32)] = ((bits[Math.floor(i / 32)] ?? 0) | (1 << (i % 32))) >>> 0;
    const visto: GameState = { ...s0, descoberto: { [String(LADO_DO_JOGADOR)]: bits } };
    const px2 = texturaDaNevoa(visto, configDoMapa.nevoa, configDoMapa);
    expect(px2[i * 4 + 3]).toBe(Math.round(configDoMapa.nevoa.alfaForaDaVista * 255));
    const r = resumoDaNevoa(px, configDoMapa.nevoa);
    expect(r.visiveis + r.esmaecidos + r.escuros).toBe(configDoMapa.largura * configDoMapa.altura);
    expect(r.esmaecidos).toBe(0);
  });
});

describe('F-TELA-NEVOA — o clique', () => {
  const noArmazem = { gx: armazemDaIA.gx + 1, gy: armazemDaIA.gy + 1 };

  it('o clique esquerdo no predio inimigo no escuro nao o pega; a vista, pega; o proprio, sempre', () => {
    const id = predioNoTile(s0, noArmazem.gx, noArmazem.gy);
    expect(id).toBe(armazemDaIA.id);
    expect(predioClicavel(s0, id)).toBeNull();
    expect(predioClicavel(comOlheiro(s0, armazemDaIA), id)).toBe(armazemDaIA.id);
    const meu = s0.predios.ordem.find((p) => s0.predios.porId[p]?.lado === LADO_DO_JOGADOR) as string;
    expect(predioClicavel(s0, meu)).toBe(meu);
    expect(predioClicavel(s0, null)).toBeNull();
  });

  it('o botao direito no predio inimigo no escuro e marcha ate o tile; a vista, ataque', () => {
    const semPaz: GameState = { ...s0, pazAteTick: 0 };
    const noEscuro = ordemDoBotaoDireito(semPaz, gameData, LADO_DO_JOGADOR, tropa, noArmazem, []);
    expect(noEscuro.comandos).toEqual([{ type: 'MoveUnits', unidades: tropa, destino: noArmazem }]);
    const aVista = ordemDoBotaoDireito(comOlheiro(semPaz, armazemDaIA), gameData, LADO_DO_JOGADOR, tropa, noArmazem, []);
    expect(aVista.comandos).toEqual([{ type: 'AttackBuilding', unidades: tropa, predio: armazemDaIA.id }]);
  });
});
