// C-COMIDA-01d (painel de grupo com o Alimentar; plano em
// docs/planos/2026-09-28-F-FEED-fome-militar.md §4). O painel do GRUPO militar que o
// jogador tem na mao (F26b), no corpo da aba da barra lateral, no lugar da grade — como
// o painel do predio, e nunca junto com ele.
//
// Mostra quantos de cada tipo, a condicao do grupo (a do mais faminto, a `GetCondition`
// do KaM) e quantos esperam comida, e tem UM botao: Alimentar, que envia `FeedUnits`.
// Halt, Split e Link nao entram (plano §4).
//
// C-COMBATE-01c (plano em docs/planos/2026-09-29-C-COMBATE-01c-controles-de-formacao.md): a
// linha "− N por fileira +", que refaz a formacao no lugar e guarda N para a proxima marcha,
// e o botao da investida, que envia `StormAttack`. N volta ao padrao quando a selecao muda.
//
// Le o estado pelo seletor puro `resumoDoGrupo` e emite comando. Nao muta GameState,
// nao importa phaser (CLAUDE.md §3, §10). Os nos nascem UMA vez e `atualizar` so troca
// texto: redesenho que destroi o no sob o dedo foi o BUG-B, e o botao daqui e apertado
// com o laco correndo.
import type { GameEvent, GameState } from '../sim/state';
import type { Command } from '../sim/commands';
import type { GameData } from '../sim/data/types';
import { resumoDoGrupo } from '../sim/selectors';
import type { ResumoDoGrupo } from '../sim/selectors';
import type { SelecaoMilitar } from '../input/selecao-militar';
import { colunasAjustadas, colunasAtuais, ordemDeFormacao, podeCarregar, quemAceitaOrdem } from './formacao';
import temaSertao from '../../data/theme-sertao.json';

type TemaDeTropa = Readonly<Record<string, { readonly nome: string } | undefined>>;
const militares = temaSertao.militares as TemaDeTropa;
const mercenarios = temaSertao.mercenarios as TemaDeTropa;
const rotulos = temaSertao.grupo;

/** O nome que o jogador ve para um tipo militar: o do tema, ou o id se faltar (§9). */
export function nomeDaTropa(tipo: string): string {
  return militares[tipo]?.nome ?? mercenarios[tipo]?.nome ?? tipo;
}

export interface TextoDoGrupo {
  readonly tipos: readonly { readonly tipo: string; readonly texto: string }[];
  readonly condicao: string;
  readonly esperando: string | null;
}

/** O texto do painel, puro — e o que o teste headless prova. A condicao e o minimo do
 *  grupo, arredondado para baixo: arredondar para cima esconderia o soldado a 34,6 %
 *  que ja acendeu o marcador de 35 %. "Esperando" some com zero. */
export function textoDoGrupo(resumo: ResumoDoGrupo): TextoDoGrupo {
  return {
    tipos: Object.entries(resumo.porTipo).map(([tipo, n]) => ({ tipo, texto: `${n} ${nomeDaTropa(tipo)}` })),
    condicao: rotulos.condicao.replace('{n}', String(Math.floor(resumo.condicao * 100))),
    esperando: resumo.esperandoComida > 0 ? rotulos.esperando.replace('{n}', String(resumo.esperandoComida)) : null,
  };
}

/** O Feed deste tick voltou `sem-fome`? E o que acende "Ninguem com fome". */
export function feedSemFome(events: readonly GameEvent[]): boolean {
  return events.some((e) => e.type === 'command-rejected' && e.command === 'FeedUnits' && e.motivo === 'sem-fome');
}

export interface PainelDoGrupo {
  atualizar(estado: GameState): void;
  /** C-COMBATE-01c — as colunas que o jogador escolheu para esta selecao, ou `null` (a sim
   *  usa a padrao). A marcha do botao direito as manda. */
  colunas(): number | null;
}

/**
 * Monta o painel em `#painel-grupo`. `soldados` filtra a selecao pelo estado (morto sai,
 * so os do jogador ficam) — e a mesma funcao que o `main.ts` usa para a marcha.
 */
export function montarPainelGrupo(
  selecao: SelecaoMilitar,
  enviar: (comando: Command) => void,
  soldados: (ids: readonly string[]) => string[],
  dados: GameData,
): PainelDoGrupo {
  const raiz = document.getElementById('painel-grupo');
  if (!raiz) throw new Error('painel-grupo: #painel-grupo nao existe no index.html');

  const titulo = document.createElement('h2');
  titulo.textContent = rotulos.titulo;
  const lista = document.createElement('ul');
  lista.dataset.grupo = 'tipos';
  const condicao = document.createElement('p');
  condicao.dataset.grupo = 'condicao';
  const esperando = document.createElement('p');
  esperando.dataset.grupo = 'esperando';
  esperando.hidden = true;
  const alimentar = document.createElement('button');
  alimentar.type = 'button';
  alimentar.dataset.acao = 'alimentar';
  alimentar.textContent = rotulos.alimentar;
  const ninguem = document.createElement('p');
  ninguem.dataset.grupo = 'ninguem-com-fome';
  ninguem.textContent = rotulos.ninguemComFome;
  ninguem.hidden = true;
  // C-COMBATE-01c — a formacao e a investida
  const linhaDeColunas = document.createElement('p');
  linhaDeColunas.dataset.grupo = 'colunas';
  const menos = document.createElement('button');
  menos.type = 'button';
  menos.dataset.acao = 'menos-colunas';
  menos.textContent = rotulos.menosColunas;
  const textoDeColunas = document.createElement('span');
  const mais = document.createElement('button');
  mais.type = 'button';
  mais.dataset.acao = 'mais-colunas';
  mais.textContent = rotulos.maisColunas;
  linhaDeColunas.append(menos, textoDeColunas, mais);
  const investida = document.createElement('button');
  investida.type = 'button';
  investida.dataset.acao = 'investida';
  investida.textContent = rotulos.investida;
  raiz.append(titulo, lista, condicao, esperando, alimentar, ninguem, linhaDeColunas, investida);

  let ultimo: GameState | null = null;
  let colunasGuardadas: number | null = null;

  function mudarColunas(delta: number): void {
    if (ultimo === null) return;
    const grupo = quemAceitaOrdem(ultimo, soldados(selecao.ids), dados);
    if (grupo.length === 0) return;
    colunasGuardadas = colunasAjustadas(colunasGuardadas, delta, grupo.length, dados);
    const comando = ordemDeFormacao(ultimo, grupo, colunasGuardadas, dados);
    if (comando !== null) enviar(comando);
    desenhar(ultimo);
  }
  menos.addEventListener('click', () => mudarColunas(-1));
  mais.addEventListener('click', () => mudarColunas(1));
  investida.addEventListener('click', () => {
    if (ultimo === null) return;
    const grupo = soldados(selecao.ids);
    if (grupo.length === 0) return;
    enviar({ type: 'StormAttack', unidades: grupo });
  });

  alimentar.addEventListener('click', () => {
    if (ultimo === null) return;
    const grupo = soldados(selecao.ids);
    if (grupo.length === 0) return;
    // um aperto novo apaga o aviso do anterior; a resposta vem no proximo tick
    ninguem.hidden = true;
    enviar({ type: 'FeedUnits', unidades: grupo });
  });
  // outro grupo, outro assunto: o aviso era do grupo anterior
  selecao.aoMudar(() => {
    ninguem.hidden = true;
    colunasGuardadas = null;
    if (ultimo !== null) desenhar(ultimo);
  });

  function desenhar(estado: GameState): void {
    const texto = textoDoGrupo(resumoDoGrupo(estado, soldados(selecao.ids)));
    const chave = texto.tipos.map((t) => t.texto).join('|');
    if (lista.dataset.chave !== chave) {
      // a lista so muda quando o grupo muda de composicao; o botao nao e filho dela
      lista.replaceChildren(...texto.tipos.map((t) => {
        const item = document.createElement('li');
        item.dataset.tipo = t.tipo;
        item.textContent = t.texto;
        return item;
      }));
      lista.dataset.chave = chave;
    }
    if (condicao.textContent !== texto.condicao) condicao.textContent = texto.condicao;
    esperando.hidden = texto.esperando === null;
    if (texto.esperando !== null && esperando.textContent !== texto.esperando) esperando.textContent = texto.esperando;
    if (feedSemFome(estado.events)) ninguem.hidden = false;
    const grupo = soldados(selecao.ids);
    // o numero conta o grupo todo (quem carrega volta a ele); o +/− so vale com quem aceita ordem
    const n = grupo.length;
    const textoDasColunas = rotulos.colunas.replace('{n}', String(n === 0 ? 0 : colunasAtuais(colunasGuardadas, n, dados)));
    if (textoDeColunas.textContent !== textoDasColunas) textoDeColunas.textContent = textoDasColunas;
    const semOrdem = quemAceitaOrdem(estado, grupo, dados).length === 0;
    if (menos.disabled !== semOrdem) menos.disabled = semOrdem;
    if (mais.disabled !== semOrdem) mais.disabled = semOrdem;
    const semCarga = !podeCarregar(estado, grupo, dados);
    if (investida.disabled !== semCarga) investida.disabled = semCarga;
  }

  return {
    atualizar(estado) {
      ultimo = estado;
      desenhar(estado);
    },
    colunas() {
      return colunasGuardadas;
    },
  };
}
