/**
 * Sonda da F23 (evidencia da sessao, nao cobertura continua — CLAUDE.md 8).
 *
 * A pergunta: o aceite da F23 ACUSA? Uma comparacao entre dois caminhos so vale
 * se o caminho errado reprovar. Aqui o round-trip e sabotado de quatro formas,
 * cada uma modelando uma perda plausivel de save — a semente do rng, o progresso
 * do passo, a carga na mao, e o JobBoard inteiro — e a sonda mede quais delas a
 * comparacao de 500 ticks pega.
 *
 * O achado que importa esta na ultima: apagar o JobBoard no tick do save nao
 * reprovava em 500 ticks. A vila se recompunha — a tarefa era regerada, o contador
 * de id voltava ao mesmo lugar, e os dois lados chegavam ao mesmo byte. Quem pegava
 * essa perda era a OUTRA assercao do aceite, a igualdade no INSTANTE do load.
 *
 * F21b — ESSA PREMISSA CAIU, e o jeito como ela caiu e o proprio recado. A F21b
 * mudou a cadeia do ouro de lugar (`cenarioDaCadeiaDoOuro`), e com outra geografia
 * o eixo de 500 ticks passou a acusar o JobBoard apagado: `semJobBoard` saiu
 * `false` onde saia `true`. Nada mudou no save nem no JobBoard; mudou o cenario.
 * Ou seja: se o eixo de 500 ticks pega essa perda e ACIDENTE DE CENARIO, e quem
 * garante e a igualdade no instante, que acusa nos dois mapas. Por isso o eixo de
 * 500 ticks entra aqui como MEDIDA gravada, e nao como assercao — afirmar o
 * ponto cego era afirmar um numero de cenario, exatamente o que a §8 do CLAUDE.md
 * manda deixar no arquivo de evidencia.
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

/** Timeout do caso lento deste arquivo — ver o comentario junto dele. */
const ORCAMENTO_DO_CASO = 10_000;

describe('sonda F23 — quais perdas o aceite pega', () => {
  // ORCAMENTO de infraestrutura, nao assercao de tempo (CLAUDE.md §8: nenhum `expect`
  // aqui le relogio). Medido 1,7 s na maquina livre em 2026-09-25, e estourou
  // o padrao de 5 s do Vitest com duas sessoes e oito sims em paralelo (calibracao da
  // Fase B). 10 s e ~5x o medido — a mesma regra do caso de carga da F09.
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

    // (4) o JobBoard inteiro some. Se 500 ticks depois os dois lados ainda batem
    //     byte a byte depende do CENARIO (ver o cabecalho): medido, nunca afirmado.
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
        'semJobBoard no instante = false SEMPRE: a igualdade no instante do load pega'
        + ' a perda do JobBoard em qualquer mapa. Ja `igualDepoisDe500Ticks.semJobBoard`'
        + ' e medida de cenario: era true ate a F21b (a vila regenerava a tarefa e'
        + ' reconvergia) e virou false quando a cadeia do ouro mudou de encosta, sem que'
        + ' save ou JobBoard mudassem. E por isso que o teste da F23 afirma as duas'
        + ' coisas, e nao so uma: uma delas nao depende de onde a vila fica.',
      ].join(' '),
    });

    expect(fiel).toBe(true);
    expect(noInstante.fiel).toBe(true);
    expect(semRng).toBe(false);
    expect(semProgresso).toBe(false);
    expect(semCarga).toBe(false);
    // `semJobBoard` no eixo de 500 ticks NAO e afirmado: e numero de cenario, e esta
    // gravado logo acima. O que vale nos dois mapas, e por isso o que se afirma, e a
    // igualdade no instante do load acusando a perda.
    expect(noInstante.semJobBoard).toBe(false);
  }, ORCAMENTO_DO_CASO);
});
