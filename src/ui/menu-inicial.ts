// E-TELA-MENU-INICIAL — a porta do jogo: Novo jogo (livre ou escaramuca), Continuar, Carregar e
// Ajuda, por cima da pagina, antes de o `Phaser.Game` existir.
//
// So escreve DOM e devolve a escolha por callback: quem transforma a escolha em estado e o laco
// externo (`src/escolha-da-partida.ts`), e quem carrega o jogo e o `inicio.ts`. `ui/` nunca toca
// no estado (CLAUDE.md §3). Os rotulos vem de `data/theme-sertao.json` (`menuInicial`).
import temaSertao from '../../data/theme-sertao.json';
import type { EscolhaDaPartida } from '../escolha-da-partida';

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

/** O rotulo da gaveta na lista do Carregar. */
export function rotuloDaGaveta(situacao: SituacaoDoSave): string {
  return situacao.pronto ? rotulos.gavetaCheia.replace('{tick}', String(situacao.tick)) : (motivoDoContinuar(situacao) ?? '');
}

export interface MenuInicial {
  fechar(): void;
}

/** Monta o menu em `<body>` e chama `aoEscolher` uma vez. `aoAjuda` abre a tela de ajuda. */
export function montarMenuInicial(
  situacao: SituacaoDoSave,
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

  function mostrar(tela: HTMLElement): void {
    for (const t of [principal, novo, carregar]) t.hidden = t !== tela;
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
    botao('escaramuca', rotulos.escaramuca, () => { escolher({ modo: 'escaramuca' }); }),
    botao('voltar', rotulos.voltar, () => { mostrar(principal); }),
  );
  // Hoje ha uma gaveta so (a da F23b); as tres chegam com a E-SAVE-GAVETAS.
  carregar.append(
    botao('gaveta-1', rotuloDaGaveta(situacao), () => { escolher({ modo: 'continuar' }); }, motivo),
    botao('voltar', rotulos.voltar, () => { mostrar(principal); }),
  );

  caixa.append(logo, lema, principal, novo, carregar);
  raiz.append(caixa);
  document.body.append(raiz);

  return {
    fechar() {
      raiz.remove();
      delete document.body.dataset.menu;
    },
  };
}
