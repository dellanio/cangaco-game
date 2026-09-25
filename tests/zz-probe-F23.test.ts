/**
 * Sonda da F23 (evidencia da sessao, nao cobertura continua — CLAUDE.md 8).
 *
 * A pergunta: o aceite da F23 ACUSA? Uma comparacao entre dois caminhos so vale
 * se o caminho errado reprovar. Aqui o round-trip e sabotado de quatro formas,
 * cada uma modelando uma perda plausivel de save — a semente do rng, o progresso
 * do passo, a carga na mao, e o JobBoard inteiro — e a sonda mede quais delas a
 * comparacao de 500 ticks pega.
 *
 * O achado que importa esta na ultima: apagar o JobBoard no tick do save NAO
 * reprova em 500 ticks. A vila se recompoe — a tarefa e regerada, o contador de
 * id volta ao mesmo lugar, e os dois lados chegam ao mesmo byte. Quem pega essa
 * perda e a OUTRA assercao do aceite, a igualdade no INSTANTE do load. As duas
 * juntas fecham; a de 500 ticks sozinha tem esse ponto cego.
 *
 * Grava test-output/zz-probe-F23.json.
 */
import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/sim/state';
import type { GameData } from '../src/sim/data';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { salvar, carregar } from '../src/sim/save';
import { compararComESemSave } from './helpers/determinism';
import { cenarioDaCadeiaDoOuro } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const DADOS: GameData = gameData;
const CENARIO = (): GameState => cenarioDaCadeiaDoOuro(DADOS);

function tickEmMovimento(): number {
  let s = CENARIO();
  for (let t = 1; t <= 600; t += 1) {
    s = step(s, [], DADOS);
    const voando = Object.values(s.unidades.porId).some((u) => u.fsmData.carga !== undefined
      && (u.fsmData.progresso ?? 0) > 0);
    if (voando) return t;
  }
  throw new Error('sonda: a vila nao andou');
}

const TICK = tickEmMovimento();

const fielmente = (e: GameState): GameState => carregar(salvar(e, DADOS), DADOS);

function comparaCom(roundTrip: (e: GameState) => GameState): boolean {
  const { direto, comSave } = compararComESemSave({
    seed: 1,
    totalTicks: TICK + 500,
    saveAtTick: TICK,
    antesDoStep: (e) => (e.tick === 0 ? CENARIO() : e),
    roundTrip,
  });
  return direto === comSave;
}

/** O outro lado do aceite: o estado volta igual no instante do load? */
function igualNoInstante(sabotagem: (e: GameState) => GameState): boolean {
  let s = CENARIO();
  for (let i = 0; i < TICK; i += 1) s = step(s, [], DADOS);
  return JSON.stringify(sabotagem(s)) === JSON.stringify(s);
}

const semTarefas = (e: GameState): GameState => ({
  ...fielmente(e), jobs: { ...e.jobs, tarefas: { porId: {}, ordem: [] } },
} as GameState);

describe('sonda F23 — quais perdas o aceite pega', () => {
  it('mede as quatro sabotagens nos dois eixos do aceite', () => {
    const fiel = comparaCom(fielmente);

    // (1) o rng volta de outra semente: a sequencia diverge do save em diante.
    const semRng = comparaCom((e) => {
      const revivido = fielmente(e);
      return { ...revivido, rng: { ...revivido.rng, s: 12345 } } as GameState;
    });

    // (2) o passo pela metade volta zerado — o erro silencioso classico.
    const semProgresso = comparaCom((e) => {
      const revivido = fielmente(e);
      const porId = Object.fromEntries(Object.entries(revivido.unidades.porId).map(([id, u]) => [
        id, { ...u, fsmData: { ...u.fsmData, progresso: 0 } },
      ]));
      return { ...revivido, unidades: { ...revivido.unidades, porId } } as GameState;
    });

    // (3) a carga na mao some: o bem em transito evapora.
    const semCarga = comparaCom((e) => {
      const revivido = fielmente(e);
      const porId = Object.fromEntries(Object.entries(revivido.unidades.porId).map(([id, u]) => {
        const fsmData = { ...u.fsmData };
        delete (fsmData as { carga?: string }).carga;
        return [id, { ...u, fsmData }];
      }));
      return { ...revivido, unidades: { ...revivido.unidades, porId } } as GameState;
    });

    // (4) o JobBoard inteiro some. A vila se recompoe: 500 ticks depois os dois
    //     lados batem byte a byte, e este eixo NAO acusa.
    const semJobBoard = comparaCom(semTarefas);

    const resultados = { fiel, semRng, semProgresso, semCarga, semJobBoard };
    const noInstante = {
      fiel: igualNoInstante(fielmente),
      semJobBoard: igualNoInstante(semTarefas),
    };

    gravarEvidencia('zz-probe-F23', {
      pergunta: 'o aceite da F23 acusa, ou passaria com qualquer round-trip?',
      tickDoSave: TICK,
      ticksDepois: 500,
      igualDepoisDe500Ticks: resultados,
      igualNoInstanteDoLoad: noInstante,
      leitura: [
        'fiel = true nos dois eixos: o par salvar/carregar e fiel.',
        'semRng / semProgresso / semCarga = false: a comparacao de 500 ticks tem dentes.',
        'semJobBoard = true em 500 ticks e false no instante: a vila REGENERA a tarefa'
        + ' apagada e reconverge, entao essa perda so e pega pela igualdade no instante'
        + ' do load. E por isso que o teste da F23 afirma as duas coisas, e nao so uma.',
      ].join(' '),
    });

    expect(fiel).toBe(true);
    expect(noInstante.fiel).toBe(true);
    expect(semRng).toBe(false);
    expect(semProgresso).toBe(false);
    expect(semCarga).toBe(false);
    // o ponto cego, medido e nomeado — nao suposto:
    expect(semJobBoard).toBe(true);
    expect(noInstante.semJobBoard).toBe(false);
  });
});
