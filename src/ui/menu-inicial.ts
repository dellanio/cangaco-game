// E-TELA-MENU-INICIAL — a porta do jogo: Novo jogo (livre ou escaramuca), Continuar, Carregar e
// Ajuda, por cima da pagina, antes de o `Phaser.Game` existir.
//
// So escreve DOM e devolve a escolha por callback: quem transforma a escolha em estado e o laco
// externo (`src/escolha-da-partida.ts`), e quem carrega o jogo e o `inicio.ts`. `ui/` nunca toca
// no estado (CLAUDE.md §3). Os rotulos vem de `data/theme-sertao.json` (`menuInicial`).
import temaSertao from '../../data/theme-sertao.json';
import type { EscolhaDaPartida, OpcaoDePazNaTela } from '../escolha-da-partida';
import type { SituacaoDaGaveta } from '../arquivo-da-partida';
import { textoDaGaveta } from './arquivo';
import { mmss } from './contador-de-paz';

const rotulos = temaSertao.menuInicial;

/** O que o menu sabe do save, ja lido pelo laco externo: so texto e se da para abrir. */
export type SituacaoDoSave =
  | { readonly pronto: true; readonly tick: number }
  | { readonly pronto: false; readonly causa: 'sem-save' | 'recusado' | 'gaveta'; readonly detalhe: string };

/** Por que o Continuar nao abre, ou `null` quando abre. Pura: e o que o teste headless prova. */
export function motivoDoContinuar(situacao: SituacaoDoSave): string | null {
  if (situacao.pronto) return null;
  return rotulos[situacao.causa].replace('{detalhe}', situacao.detalhe);
}

/** E-SAVE-GAVETAS — por que uma gaveta do Carregar nao abre, ou `null` quando abre. Pura. */
export function motivoDaGaveta(g: SituacaoDaGaveta): string | null {
  if (g.situacao === 'pronta') return null;
  if (g.situacao === 'vazia') return rotulos['sem-save'];
  return motivoDoContinuar({ pronto: false, causa: g.causa, detalhe: g.detalhe });
}

/** E-TELA-CONFIGURAR-PARTIDA — o rotulo de uma duracao da paz, em tempo de jogo. Pura. */
export function rotuloDaPaz(opcao: OpcaoDePazNaTela, rotulos: typeof temaSertao.menuInicial.configurar = temaSertao.menuInicial.configurar): string {
  const tempo = opcao.segundos === 0 ? rotulos.semPaz
    : opcao.segundos % 60 === 0 ? rotulos.minutos.replace('{min}', String(opcao.segundos / 60))
      : rotulos.minutos.replace('{min}', mmss(opcao.segundos));
  return opcao.padrao ? rotulos.padrao.replace('{rotulo}', tempo) : tempo;
}

export interface MenuInicial {
  fechar(): void;
}

/** Monta o menu em `<body>` e chama `aoEscolher` uma vez. `aoAjuda` abre a tela de ajuda. O
 *  Continuar abre a gaveta salva por ultimo (`situacao`); o Carregar, a que o jogador escolher. */
export function montarMenuInicial(
  situacao: SituacaoDoSave,
  gavetas: readonly SituacaoDaGaveta[],
  opcoesDePaz: readonly OpcaoDePazNaTela[],
  aoEscolher: (escolha: EscolhaDaPartida) => void,
  aoAjuda: () => void,
): MenuInicial {
  const raiz = document.createElement('section');
  raiz.id = 'menu-inicial';
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-label', rotulos.titulo);
  document.body.dataset.menu = 'aberto';

  const caixa = document.createElement('div');
  caixa.className = 'caixa';
  const logo = document.createElement('div');
  logo.className = 'logo-do-menu';
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', rotulos.titulo);
  const lema = document.createElement('p');
  lema.className = 'lema';
  lema.textContent = temaSertao.barra.lema;

  let escolheu = false;
  function escolher(escolha: EscolhaDaPartida): void {
    if (escolheu) return;
    escolheu = true;
    aoEscolher(escolha);
  }

  function botao(acao: string, rotulo: string, aoClicar: () => void, motivo: string | null = null): HTMLElement {
    const linha = document.createElement('div');
    linha.className = 'opcao';
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.acao = acao;
    b.textContent = rotulo;
    if (motivo !== null) {
      // `aria-disabled`, e nao `disabled`: o botao continua focavel e o leitor de tela le o motivo
      b.setAttribute('aria-disabled', 'true');
      const porque = document.createElement('span');
      porque.className = 'motivo';
      porque.dataset.motivo = acao;
      porque.textContent = motivo;
      b.setAttribute('aria-describedby', `motivo-${acao}`);
      porque.id = `motivo-${acao}`;
      linha.append(b, porque);
    } else {
      linha.append(b);
    }
    b.addEventListener('click', () => {
      if (motivo !== null) return;
      aoClicar();
      b.blur();
    });
    return linha;
  }

  // Novo jogo abre as duas partidas na mesma caixa; Carregar abre a lista das gavetas.
  const principal = document.createElement('div');
  principal.className = 'opcoes';
  const novo = document.createElement('div');
  novo.className = 'opcoes';
  novo.dataset.tela = 'novo';
  novo.hidden = true;
  const carregar = document.createElement('div');
  carregar.className = 'opcoes';
  carregar.dataset.tela = 'carregar';
  carregar.hidden = true;
  // E-TELA-CONFIGURAR-PARTIDA — antes da escaramuca, a duracao da paz
  const configurar = document.createElement('div');
  configurar.className = 'opcoes';
  configurar.dataset.tela = 'configurar';
  configurar.hidden = true;

  function mostrar(tela: HTMLElement): void {
    for (const t of [principal, novo, carregar, configurar]) t.hidden = t !== tela;
  }

  const motivo = motivoDoContinuar(situacao);
  principal.append(
    botao('novo', rotulos.novoJogo, () => { mostrar(novo); }),
    botao('continuar', rotulos.continuar, () => { escolher({ modo: 'continuar' }); }, motivo),
    botao('carregar', rotulos.carregar, () => { mostrar(carregar); }),
    botao('ajuda', rotulos.ajuda, aoAjuda),
  );
  novo.append(
    botao('livre', rotulos.livre, () => { escolher({ modo: 'livre' }); }),
    botao('escaramuca', rotulos.escaramuca, () => { mostrar(configurar); }),
    botao('voltar', rotulos.voltar, () => { mostrar(principal); }),
  );
  // E-SAVE-GAVETAS: as tres gavetas. A que nao abre fica desabilitada, com o motivo embaixo.
  for (const g of gavetas) {
    const motivoDela = motivoDaGaveta(g);
    const rotulo = motivoDela === null ? textoDaGaveta(g) : temaSertao.hud.arquivo.gavetas.nome.replace('{n}', String(g.n));
    carregar.append(botao(`gaveta-${g.n}`, rotulo, () => { escolher({ modo: 'carregar', gaveta: g.n }); }, motivoDela));
  }
  carregar.append(botao('voltar', rotulos.voltar, () => { mostrar(principal); }));

  const rotulosDaPaz = rotulos.configurar;
  const campoDaPaz = document.createElement('label');
  campoDaPaz.className = 'campo';
  const nomeDaPaz = document.createElement('span');
  nomeDaPaz.textContent = rotulosDaPaz.paz;
  const paz = document.createElement('select');
  paz.dataset.campo = 'paz';
  for (const opcao of opcoesDePaz) {
    const item = document.createElement('option');
    item.value = String(opcao.valor);
    item.textContent = rotuloDaPaz(opcao, rotulosDaPaz);
    item.selected = opcao.padrao;
    paz.append(item);
  }
  campoDaPaz.append(nomeDaPaz, paz);
  const tituloDaConfiguracao = document.createElement('h2');
  tituloDaConfiguracao.textContent = rotulosDaPaz.titulo;
  configurar.append(
    tituloDaConfiguracao,
    campoDaPaz,
    botao('comecar', rotulosDaPaz.comecar, () => { escolher({ modo: 'escaramuca', pazMinBase: Number(paz.value) }); }),
    botao('voltar', rotulos.voltar, () => { mostrar(novo); }),
  );

  caixa.append(logo, lema, principal, novo, carregar, configurar);
  raiz.append(caixa);
  document.body.append(raiz);

  return {
    fechar() {
      raiz.remove();
      delete document.body.dataset.menu;
    },
  };
}
