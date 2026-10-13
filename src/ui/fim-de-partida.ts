// F34 — o aviso do fim da escaramuca, sobre o jogo. So LE o estado (`state.partida`,
// gravado pela sim em `sim/partida.ts`) e escreve texto: nunca muda o jogo, nunca
// importa phaser. Os rotulos vem de `data/theme-sertao.json` (`partida`).
//
// I-TELA-MENU-DA-CAMPANHA — numa fase da campanha o aviso diz o lugar e traz os botoes do que vem
// depois: Proxima fase (na vitoria, se houver), Tentar de novo (na derrota) e Voltar ao menu. Quem
// navega e o laco externo (`main.ts`), pelas acoes.
import temaSertao from '../../data/theme-sertao.json';
import type { GameState } from '../sim/state';

export interface FimDePartida {
  atualizar(estado: GameState): void;
}

export interface TextoDoFim {
  readonly titulo: string;
  readonly descricao: string;
}

/** O que o aviso sabe da fase em curso (o laco externo tira do dado da campanha). */
export interface FaseNoFim {
  readonly numero: number;
  readonly local: string;
  /** `null` na ultima fase. */
  readonly proxima: string | null;
}

/** As acoes dos botoes do fim de uma fase. */
export interface AcoesDoFim {
  aoProxima(): void;
  aoTentarDeNovo(): void;
  aoMenu(): void;
}

/** O texto do aviso, ou `null` enquanto a partida corre. Pura: e o que o teste prova. */
export function textoDoFim(estado: GameState, rotulos = temaSertao.partida, fase: FaseNoFim | null = null, campanha = temaSertao.campanha): TextoDoFim | null {
  if (estado.partida === undefined) return null;
  if (fase !== null) {
    const doLugar = (t: string): string => t.replace('{local}', fase.local).replace('{n}', String(fase.numero));
    if (estado.partida.fim === 'derrota') return { titulo: doLugar(campanha.derrota), descricao: doLugar(campanha.derrotaDesc) };
    return { titulo: doLugar(campanha.vitoria), descricao: fase.proxima === null ? campanha.fimDaCampanha : doLugar(campanha.vitoriaDesc) };
  }
  return estado.partida.fim === 'vitoria'
    ? { titulo: rotulos.vitoria, descricao: rotulos.vitoriaDesc }
    : { titulo: rotulos.derrota, descricao: rotulos.derrotaDesc };
}

/** Cria o aviso uma vez, no `body` (fixo sobre a area do jogo, pelo CSS), e so reescreve
 *  quando o fim muda. Com `fase`, os botoes da campanha. */
export function montarFimDePartida(fase: FaseNoFim | null = null, acoes: AcoesDoFim | null = null): FimDePartida {
  const elemento = document.createElement('div');
  elemento.id = 'fim-de-partida';
  elemento.setAttribute('role', 'status');
  elemento.hidden = true;
  const titulo = document.createElement('h2');
  const descricao = document.createElement('p');
  elemento.append(titulo, descricao);
  const botoes = document.createElement('div');
  botoes.className = 'botoes-do-fim';
  const botao = (acao: string, texto: string, aoClicar: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.acao = acao;
    b.textContent = texto;
    b.addEventListener('click', aoClicar);
    return b;
  };
  const textos = temaSertao.campanha;
  const proxima = acoes === null ? null : botao('proxima', textos.proxima, () => { acoes.aoProxima(); });
  const tentar = acoes === null ? null : botao('tentar-de-novo', textos.tentarDeNovo, () => { acoes.aoTentarDeNovo(); });
  const menu = acoes === null ? null : botao('menu', textos.menu, () => { acoes.aoMenu(); });
  if (fase !== null && proxima !== null && tentar !== null && menu !== null) {
    botoes.append(proxima, tentar, menu);
    elemento.append(botoes);
  }
  document.body.append(elemento);
  let ultimo: string | null = null;
  return {
    atualizar(estado) {
      const texto = textoDoFim(estado, temaSertao.partida, fase);
      const chave = estado.partida?.fim ?? null;
      if (chave === ultimo) return;
      ultimo = chave;
      elemento.hidden = texto === null;
      elemento.dataset.fim = chave ?? '';
      titulo.textContent = texto?.titulo ?? '';
      descricao.textContent = texto?.descricao ?? '';
      if (proxima !== null) proxima.hidden = chave !== 'vitoria' || fase?.proxima === null;
      if (tentar !== null) tentar.hidden = chave !== 'derrota';
    },
  };
}
