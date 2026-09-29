// C-COMIDA-01d (painel de grupo com o Alimentar; plano em
// docs/planos/2026-09-28-F-FEED-fome-militar.md §4). O painel do GRUPO militar que o
// jogador tem na mao (F26b), no corpo da aba da barra lateral, no lugar da grade — como
// o painel do predio, e nunca junto com ele.
//
// Mostra quantos de cada tipo, a condicao do grupo (a do mais faminto, a `GetCondition`
// do KaM) e quantos esperam comida, e tem UM botao: Alimentar, que envia `FeedUnits`.
// Halt, Split, Link, Formacao e Storm nao entram (plano §4).
//
// Le o estado pelo seletor puro `resumoDoGrupo` e emite comando. Nao muta GameState,
// nao importa phaser (CLAUDE.md §3, §10). Os nos nascem UMA vez e `atualizar` so troca
// texto: redesenho que destroi o no sob o dedo foi o BUG-B, e o botao daqui e apertado
// com o laco correndo.
import type { GameEvent, GameState } from '../sim/state';
import type { Command } from '../sim/commands';
import { resumoDoGrupo } from '../sim/selectors';
import type { ResumoDoGrupo } from '../sim/selectors';
import type { SelecaoMilitar } from '../input/selecao-militar';
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
}

/**
 * Monta o painel em `#painel-grupo`. `soldados` filtra a selecao pelo estado (morto sai,
 * so os do jogador ficam) — e a mesma funcao que o `main.ts` usa para a marcha.
 */
export function montarPainelGrupo(
  selecao: SelecaoMilitar,
  enviar: (comando: Command) => void,
  soldados: (ids: readonly string[]) => string[],
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
  raiz.append(titulo, lista, condicao, esperando, alimentar, ninguem);

  let ultimo: GameState | null = null;

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
  }

  return {
    atualizar(estado) {
      ultimo = estado;
      desenhar(estado);
    },
  };
}
