import { describe, it, expect } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { criarCargaDeUnidades, pedidosDeUnidade, tiposPresentes } from '../src/render/carregamento-de-unidades';
import { criarPonte } from '../src/render/ponte';
import { texturasParaCarregar } from '../src/render/sprites';
import type { Manifesto } from '../src/render/manifesto';
import { completarObra, createInitialState, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/depuracao/manifesto.json', 'utf8')) as Manifesto;

describe('D-TELA-05d - carga inicial e tardia', () => {
  it('filtra tipos presentes e resolve atlas/poses somente com arquivos conhecidos', () => {
    const m: Manifesto = { ...manifesto, assets: manifesto.assets.map(a => ({ ...a, estados: { parado: `${a.id}.png` } })) };
    const tipos = new Set(['militia']);
    const atlases = ['serf', 'militia'].map(id => ({ chave: `unidade:${id}:atlas`, url: `${id}-atlas.png`, dados: {} }));
    const pedidos = pedidosDeUnidade(m, tipos, { 'militia.png': '/militia.png', 'serf.png': '/serf.png' }, atlases);
    expect(pedidos.map(p => p.chave)).toEqual(['unidade:militia:parado', 'unidade:militia:atlas']);
    expect(texturasParaCarregar(m, { 'serf.png': '/serf.png' }, undefined, tipos)).toEqual([]);
    expect(pedidosDeUnidade(m, new Set(['desconhecida']), {}, [])).toEqual([]);
    expect(tiposPresentes(null).size).toBe(0);
    const s = createInitialState(1);
    expect(tiposPresentes(s)).toEqual(new Set(s.unidades.ordem.map(id => s.unidades.porId[id]!.tipo)));
    const base = s.unidades.porId[s.unidades.ordem[0]!]!;
    const escondida = { ...base, id: 'escondida', tipo: 'woodcutter', fsm: 'comendo', lado: LADO_DA_IA };
    const ambosOsLados: GameState = { ...s, unidades: {
      ordem: [...s.unidades.ordem, escondida.id],
      porId: { ...s.unidades.porId, [escondida.id]: escondida },
    } };
    expect(tiposPresentes(ambosOsLados).has('woodcutter')).toBe(true);
  });

  it('deduplica carga ocupada, pronta e falha; nao tenta novamente por quadro', () => {
    const enfileirados: string[] = [];
    const carga = criarCargaDeUnidades(k => k === 'pronta', p => enfileirados.push(p.chave));
    const pedidos = ['nova', 'nova', 'pronta', 'erro'].map(chave => ({ chave, url: `${chave}.png` }));
    expect(carga.solicitar(pedidos)).toBe(2);
    for (let i = 0; i < 20; i++) expect(carga.solicitar(pedidos)).toBe(0);
    carga.concluir('nova'); carga.falhar('erro');
    expect(carga.solicitar(pedidos)).toBe(0);
    expect(enfileirados).toEqual(['nova', 'erro']);
    expect(carga.estados).toEqual({ nova: { estado: 'carregada', pedidos: 1 }, pronta: { estado: 'carregada', pedidos: 0 }, erro: { estado: 'falhou', pedidos: 1 } });
    gravarEvidencia('D-TELA-05d-fila', carga.estados);
  });

  it('identidade explicita distingue load no mesmo tick ou tick seguinte; passo nao reseta', () => {
    const ponte = criarPonte();
    const s = createInitialState(1);
    ponte.atual = s;
    ponte.atual = step(s, []);
    expect(ponte.identidadePartida).toBe(0);
    ponte.reiniciar?.(); ponte.atual = { ...s, tick: ponte.atual.tick };
    expect(ponte.identidadePartida).toBe(1);
    ponte.reiniciar?.(); ponte.atual = { ...s, tick: ponte.atual.tick + 1 };
    expect(ponte.identidadePartida).toBe(2);
    const repetido = ponte.atual;
    ponte.atual = repetido;
    expect(ponte.identidadePartida).toBe(2);
  });

  it('treino real introduz militia ausente e gera save para prova no navegador', () => {
    let s: GameState = createInitialState(1);
    let lugar: { gx: number; gy: number } | undefined;
    const busca = { ...s, tiposJaConstruidos: [...s.tiposJaConstruidos, 'sawmill'] };
    for (let r = 4; r < 30 && !lugar; r++) for (let d = -r; d <= r && !lugar; d++) {
      const p = naVila(d, r);
      if (canPlace(busca, 'barracks', p.gx, p.gy, gameData).ok) lugar = p;
    }
    if (!lugar) throw new Error('Quartel nao cabe na fixture');
    let q = completarObra({ lado: LADO_DO_JOGADOR, id: 'quartel-carga', tipo: 'barracks', ...lugar, estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData) as PredioCompleto;
    q = { ...q, recrutas: 1, estoque: { ...q.estoque, entrada: { hand_axe: 1 } } };
    s = { ...s, predios: { porId: { ...s.predios.porId, [q.id]: q }, ordem: [...s.predios.ordem, q.id] } };
    expect(tiposPresentes(s).has('militia')).toBe(false);
    mkdirSync('test-output', { recursive: true });
    writeFileSync('test-output/D-TELA-05d-inicio.save.txt', salvar(s));
    const depois = step(s, [{ type: 'TrainSoldier', predio: q.id, tipo: 'militia' }]);
    expect(tiposPresentes(depois).has('militia')).toBe(true);
    const militar = depois.unidades.ordem.map(id => depois.unidades.porId[id]!).find(u => u.tipo === 'militia')!;
    writeFileSync('test-output/D-TELA-05d-treino.save.txt', salvar(depois));
    gravarEvidencia('D-TELA-05d', { quartel: q, militar, antes: [...tiposPresentes(s)], depois: [...tiposPresentes(depois)] });
  });
});
