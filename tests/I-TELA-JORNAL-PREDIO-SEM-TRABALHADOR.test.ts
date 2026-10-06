/**
 * I-TELA-JORNAL-PREDIO-SEM-TRABALHADOR — o jornal avisa o predio parado sem trabalhador (pedido do operador,
 * 2026-10-06): o predio completo do jogador que pede trabalhador, vago e sem ninguem a caminho, por 5 min
 * de jogo. A regra pura, rodada sobre o estado do `step`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, Tarefa } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { MEMORIA_VAZIA, noticiaDoPredioVago, prediosSemTrabalhador } from '../src/ui/jornal';
import type { ConfigDoJornal, MemoriaDosVagos, TextoDaNoticia } from '../src/ui/jornal';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/jornal.json', 'utf8')) as ConfigDoJornal;
const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as {
  jornal: { noticias: Record<string, TextoDaNoticia> }; predios: Record<string, { nome: string }>; civis: Record<string, { nome: string }>;
};
const LIMITE = 40;

/** Um predio completo do tipo, num canto longe da vila (ninguem chega nele no tempo do teste). */
function comPredio(s: GameState, tipo: string, id: string, lado = LADO_DO_JOGADOR): GameState {
  const def = gameData.predios.find((p) => p.id === tipo)!;
  const completo = completarObra({ lado, id, tipo, gx: 4, gy: 4, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, gameData) as Predio;
  return { ...s, predios: { porId: { ...s.predios.porId, [id]: completo }, ordem: [...s.predios.ordem, id] } };
}
/** Roda o `step` e a regra juntos, como o jornal faz a cada passo; devolve em que tick cada aviso saiu. */
function rodar(s: GameState, ticks: number, mexer: (s: GameState, t: number) => GameState = (x) => x) {
  let memoria: MemoriaDosVagos = MEMORIA_VAZIA;
  const avisos: { tick: number; id: string }[] = [];
  for (let t = 0; t < ticks; t++) {
    s = mexer(step(s, []), t);
    const r = prediosSemTrabalhador(s, memoria, LIMITE);
    memoria = r.memoria;
    for (const id of r.novos) avisos.push({ tick: s.tick, id });
  }
  return { avisos, s };
}

describe('I-TELA-JORNAL-PREDIO-SEM-TRABALHADOR', () => {
  const base = createInitialState(gameData.economia.estadoInicial.semente);

  it('(1) o predio vago avisa quando completa o limite, e nao antes; uma vez so enquanto continua vago', () => {
    const s = comPredio(base, 'sawmill', 'serraria');
    const { avisos } = rodar(s, LIMITE * 3);
    expect(avisos).toEqual([{ tick: s.tick + 1 + LIMITE, id: 'serraria' }]);
  });

  it('(2) ocupado antes do limite nao avisa, e vago de novo conta do zero', () => {
    const s = comPredio(base, 'sawmill', 'serraria');
    const ocupar = (x: GameState, t: number): GameState => {
      const p = x.predios.porId['serraria'];
      if (p === undefined || p.estado !== 'completo') return x;
      // ocupado do passo LIMITE/2 ao LIMITE (o relogio zera ai), vago de novo depois
      const ocupante = t >= LIMITE / 2 && t < LIMITE ? 'alguem' : null;
      return { ...x, predios: { ...x.predios, porId: { ...x.predios.porId, serraria: { ...p, ocupante } } } };
    };
    const { avisos } = rodar(s, LIMITE * 3, ocupar);
    // vago de novo no passo LIMITE (tick s.tick + LIMITE + 1): o aviso sai LIMITE ticks depois
    expect(avisos).toEqual([{ tick: s.tick + 1 + LIMITE + LIMITE, id: 'serraria' }]);
  });

  it('(3) a vaga reservada (trabalhador a caminho), o predio da IA e o que nao pede trabalhador nao contam', () => {
    let s = comPredio(comPredio(comPredio(base, 'sawmill', 'serraria'), 'sawmill', 'da-ia', LADO_DO_JOGADOR + 1), 'storehouse', 'armazem2');
    const tarefa = { id: 'oc', tipo: 'ocupar', destino: 'serraria', estado: 'reclamada', unidade: 'u' } as unknown as Tarefa;
    s = { ...s, jobs: { ...s.jobs, tarefas: { porId: { ...s.jobs.tarefas.porId, oc: tarefa }, ordem: [...s.jobs.tarefas.ordem, 'oc'] } } };
    expect(prediosSemTrabalhador({ ...s, tick: s.tick + LIMITE * 2 }, { desde: { serraria: s.tick, 'da-ia': s.tick, armazem2: s.tick }, avisados: [] }, LIMITE).novos)
      .toEqual([]);
    // sem a reserva, a serraria avisa (a guarda acusa)
    expect(prediosSemTrabalhador({ ...comPredio(base, 'sawmill', 'serraria'), tick: base.tick + LIMITE * 2 }, { desde: { serraria: base.tick }, avisados: [] }, LIMITE).novos)
      .toEqual(['serraria']);
  });

  it('(4) o texto traz o nome do predio e do trabalhador pelo tema; o validador recusa minuto <= 0', () => {
    const s = comPredio(base, 'sawmill', 'serraria');
    const n = noticiaDoPredioVago(s, 'serraria', config.predioSemTrabalhador.minutos, tema.jornal.noticias['predioSemTrabalhador']!)!;
    expect(n.manchete).toContain(tema.predios['sawmill']!.nome);
    expect(n.manchete + n.texto).toContain(tema.civis['carpenter']!.nome);
    expect(n.texto).toContain(String(config.predioSemTrabalhador.minutos));
    expect(n.texto).not.toMatch(/\{\w+\}/);
    expect(config.predioSemTrabalhador.minutos).toBe(5);
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    expect(validarInterface(dados, { ...interfaceUi, jornal: { ...config, predioSemTrabalhador: { minutos: 0 } } }))
      .toContain('interface/jornal: predioSemTrabalhador.minutos precisa ser numero > 0');
    gravarEvidencia('I-TELA-JORNAL-PREDIO-SEM-TRABALHADOR', { manchete: n.manchete, texto: n.texto, limiteTicks: Math.round((config.predioSemTrabalhador.minutos * 60 * 1000) / gameData.tempo.tickMs) });
  });
});
