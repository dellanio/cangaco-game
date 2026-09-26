// A barra lateral unica (UI-barra-a, docs/propostas/barra-lateral-unica.md): uma
// coluna a esquerda, fixa em 260 px, na altura inteira. Substitui a prancha (a
// coluna de construir, a direita) e o balcao (a faixa de contexto, no rodape):
// com os dois, escolher um predio tirava 13,7 pontos de mapa a 1280. Com a barra,
// a area do canvas nao muda com a selecao.
//
// De cima para baixo: logo, a dica do H (quem pendura e `ajuda.ts`), minimapa,
// recursos (`hud.ts`), alertas (`alertas.ts`), abas e o CORPO da aba, que mostra
// UMA coisa de cada vez — a grade de construir, o painel do predio escolhido ou
// as opcoes — e a marca com o lema no pe. Este modulo so monta a moldura, as abas
// e a marca; o conteudo de cada bloco continua com o dono de antes.
//
// A regra do corpo e pura (`corpoDaAba`) e o resultado vai em `data-corpo` no
// <body>, que e o que o CSS le. E estado de interface, irmao da selecao: nunca
// entra no `GameState`.
import type { Selecao } from '../input/selecao';
import temaSertao from '../../data/theme-sertao.json';

/** As abas do GDD §7.1, na ordem da tela. */
export const ABAS = ['construir', 'distribuicao', 'estatisticas', 'opcoes'] as const;
export type Aba = (typeof ABAS)[number];

/** As que ainda nao tem conteudo (F31, F32): cadeado, e o clique nao troca nada. */
export const ABAS_TRANCADAS: readonly Aba[] = ['distribuicao', 'estatisticas'];

export type CorpoDaAba = 'grade' | 'painel' | 'opcoes';

/** A regra, pura — e o que o teste headless prova. Na aba Construir o painel
 *  SUBSTITUI a grade quando ha predio escolhido, nunca as duas coisas juntas. */
export function corpoDaAba(aba: Aba, haSelecao: boolean): CorpoDaAba {
  if (aba === 'opcoes') return 'opcoes';
  return haSelecao ? 'painel' : 'grade';
}

type TemaDeCivis = Readonly<Record<string, { readonly nome: string; readonly curto?: string } | undefined>>;
const temaDeCivis = temaSertao.civis as TemaDeCivis;

/** O rotulo do botao de engajar: o `curto` do tema, se houver, senao o nome.
 *  O slot da fila e o `title` continuam com o nome longo. */
export function rotuloCurtoDoCivil(id: string): string {
  const civil = temaDeCivis[id];
  return civil?.curto ?? civil?.nome ?? id;
}

export interface Barra {
  readonly aba: Aba;
}

const rotulos = temaSertao.barra;

export function montarBarra(selecao: Selecao, abrirAjuda: () => void): Barra {
  const barra = document.getElementById('barra');
  if (!barra) throw new Error('barra: #barra nao existe no index.html');
  const logo = document.getElementById('logo');
  if (!logo) throw new Error('barra: #logo nao existe no index.html');
  const minimapa = document.getElementById('minimapa');
  if (!minimapa) throw new Error('barra: #minimapa nao existe no index.html');
  const abas = document.getElementById('abas');
  if (!abas) throw new Error('barra: #abas nao existe no index.html');
  const opcoes = document.getElementById('opcoes');
  if (!opcoes) throw new Error('barra: #opcoes nao existe no index.html');
  const marca = document.getElementById('marca');
  if (!marca) throw new Error('barra: #marca nao existe no index.html');

  // Logo e minimapa: placeholder com o id escrito ate a arte entrar (§9).
  const textoDaLogo = document.createElement('span');
  textoDaLogo.className = 'placeholder';
  textoDaLogo.textContent = rotulos.logo;
  logo.append(textoDaLogo);

  const mapaVazio = document.createElement('span');
  mapaVazio.className = 'placeholder';
  mapaVazio.textContent = rotulos.minimapa;
  minimapa.prepend(mapaVazio);

  const lema = document.createElement('span');
  lema.className = 'lema';
  lema.textContent = rotulos.lema;
  marca.append(lema);

  const botoes = new Map<Aba, HTMLButtonElement>();
  for (const id of ABAS) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.dataset.aba = id;
    botao.textContent = rotulos.abas[id];
    if (ABAS_TRANCADAS.includes(id)) {
      // aria-disabled e nao `disabled`, como no menu Build (F06): o clique chega
      // e e ignorado, e o botao continua com o mesmo tamanho na regua.
      botao.setAttribute('aria-disabled', 'true');
      botao.title = rotulos.trancada;
    }
    abas.append(botao);
    botoes.set(id, botao);
  }

  const ajuda = document.createElement('button');
  ajuda.type = 'button';
  ajuda.dataset.abrir = 'ajuda';
  ajuda.textContent = rotulos.abrirAjuda;
  ajuda.addEventListener('click', abrirAjuda);
  opcoes.append(ajuda);

  let aba: Aba = 'construir';

  function aplicar(): void {
    document.body.dataset.corpo = corpoDaAba(aba, selecao.predio !== null);
    for (const [id, botao] of botoes) botao.setAttribute('aria-pressed', String(id === aba));
  }

  abas.addEventListener('click', (evento) => {
    const alvo = (evento.target as HTMLElement).closest<HTMLButtonElement>('[data-aba]');
    if (!alvo || alvo.getAttribute('aria-disabled') === 'true') return;
    const id = alvo.dataset.aba as Aba;
    // Construir com algo escolhido volta a grade, como o Esc.
    if (id === 'construir') selecao.limpar();
    aba = id;
    aplicar();
  });

  // Escolher um predio e pedir o detalhe dele: a aba volta para Construir, onde
  // o painel mora.
  selecao.aoMudar(() => {
    if (selecao.predio !== null) aba = 'construir';
    aplicar();
  });

  aplicar();

  return {
    get aba() {
      return aba;
    },
  };
}
