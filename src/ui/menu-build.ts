// A prancha: o menu Construir (F06), desde o Layout 2 uma GRADE DE ICONES por
// grupo com um cartao fixo embaixo (docs/propostas/ui-releitura-rts.md §1-2).
// Num RTS o relogio nao espera: a lista rolante de 28 prédios com texto foi
// trocada por 5 colunas de icones em faixas, tudo visivel de uma vez, e o
// texto (nome, custo, requisito, descricao) foi para UM lugar so, o cartao.
//
// So le o estado (via `opcoesDoMenuBuild`, que e um seletor puro de sim/) e
// escreve DOM; a unica coisa que faz alem de mostrar e dizer a ferramenta qual
// predio o jogador escolheu. Nao emite comando (o PlaceBlueprint e a F07), nao
// importa phaser nem sim/data e nao varre predios por conta propria (CLAUDE.md
// §3, §10). O agrupamento vem de `data/menu-build.json`, lido direto como o
// tema: e dado de interface, validado por `interface/menu-build`.
//
// O ICONE e placeholder por construcao (CLAUDE.md §9): a miniatura do footprint
// (N x M quadradinhos, do `tamanho` que o seletor ja devolve). Distingue 4x4 de
// 2x1 de relance e nao digita letra nenhuma. A arte, quando vier, entra por
// `assets/sprites/<id>/icone.png` e substitui a miniatura, nao o botao.
import type { GameState } from '../sim/state';
import { custoDaEstrada, opcoesDoMenuBuild } from '../sim/selectors';
import type { OpcaoDoMenuBuild } from '../sim/selectors';
import type { Ferramenta, ModoDaFerramenta } from '../input/ferramenta';
import temaSertao from '../../data/theme-sertao.json';
import menuBuild from '../../data/menu-build.json';

export interface MenuBuild {
  atualizar(estado: GameState): void;
}

type TemaDePredios = Readonly<Record<string, { readonly nome: string; readonly desc?: string } | undefined>>;
const temaDePredios = temaSertao.predios as TemaDePredios;
const rotulosDosGrupos = temaSertao.menuBuild.grupos as Readonly<Record<string, string | undefined>>;

function nomeDe(id: string): string {
  return temaDePredios[id]?.nome ?? id;
}

function descricaoDe(id: string): string {
  return temaDePredios[id]?.desc ?? '';
}

function textoDoCusto(opcao: OpcaoDoMenuBuild): string {
  const { timber, stone } = temaSertao.mercadorias;
  const [largura, altura] = opcao.tamanho;
  return `${timber} ${opcao.custo.timber} · ${stone} ${opcao.custo.stone} · ${largura}×${altura}`;
}

/** "Pedra 1 por tile": o numero vem do dado, pelo seletor; os rotulos, do tema. */
function textoDoCustoDaEstrada(): string {
  return `${temaSertao.mercadorias.stone} ${custoDaEstrada().stone} ${temaSertao.menuBuild.porTile}`;
}

/** O ramo `semRequisito` ("ainda nao disponivel") nao tem produtor no dado de
 *  hoje: desde a correcao do BUG-002 nenhum predio tem `desbloqueadoPor` null
 *  (GDD §5.2), e `tools/shots/F06.js` afirma justamente que nenhum item do menu
 *  fica cinza sem dizer do que depende. Fica porque a permissao por fase da
 *  campanha (GDD §5.3) e quem volta a produzi-lo: "existe na arvore, mas esta
 *  missao nao libera". Apagar agora e apagar o rotulo que essa camada vai pedir.
 */
function textoDoRequisito(opcao: OpcaoDoMenuBuild): string {
  const { requer, semRequisito } = temaSertao.menuBuild;
  return opcao.requer === null ? semRequisito : `${requer} ${nomeDe(opcao.requer)}`;
}

/** O que o cartao mostra: uma planta de predio ou uma ferramenta. */
interface Planta {
  readonly id: string;
  readonly nome: string;
  readonly custo: string;
  /** `''` quando liberado: a linha nao existe. */
  readonly requer: string;
  readonly desc: string;
}

function plantaDaOpcao(opcao: OpcaoDoMenuBuild): Planta {
  return {
    id: opcao.id,
    nome: nomeDe(opcao.id),
    custo: textoDoCusto(opcao),
    requer: opcao.desbloqueado ? '' : textoDoRequisito(opcao),
    desc: descricaoDe(opcao.id),
  };
}

/** A miniatura do footprint: `largura` x `altura` celulas. */
function miniaturaDoFootprint(tamanho: readonly number[]): HTMLElement {
  const [largura = 1, altura = 1] = tamanho;
  const caixa = document.createElement('span');
  caixa.className = 'footprint';
  caixa.style.setProperty('--colunas', String(largura));
  caixa.dataset.largura = String(largura);
  caixa.dataset.altura = String(altura);
  for (let i = 0; i < largura * altura; i++) caixa.append(document.createElement('i'));
  return caixa;
}

interface ItemMontado {
  readonly botao: HTMLButtonElement;
  planta: Planta;
}

/** Monta a prancha em `#menu-build` na primeira `atualizar` (e la que se sabe a
 *  lista de predios) e depois so reescreve o que mudou. */
export function montarMenuBuild(ferramenta: Ferramenta): MenuBuild {
  const raiz = document.getElementById('menu-build');
  if (!raiz) throw new Error('menu-build: #menu-build nao existe no index.html');

  const itens = new Map<string, ItemMontado>();
  // As ferramentas que nao sao planta de predio (F08): estrada e demolir estrada.
  const ferramentas = new Map<ModoDaFerramenta, { readonly botao: HTMLButtonElement; readonly planta: Planta }>();

  // O cartao fixo: o que esta sob o mouse; sem mouse, o que esta na mao; sem
  // nada, o texto do tema. Sao tres nos fixos, reescritos — nunca recriados.
  const cartao = document.createElement('div');
  cartao.className = 'cartao';
  cartao.dataset.planta = '';
  const cartaoNome = document.createElement('h3');
  const cartaoCusto = document.createElement('div');
  cartaoCusto.className = 'custo';
  const cartaoRequer = document.createElement('div');
  cartaoRequer.className = 'requer';
  const cartaoDesc = document.createElement('div');
  cartaoDesc.className = 'desc';
  cartao.append(cartaoNome, cartaoCusto, cartaoRequer, cartaoDesc);

  let sobOMouse: string | null = null;

  function plantaAtiva(): Planta | null {
    if (ferramenta.modo === 'predio' && ferramenta.predioAtivo !== null) {
      return itens.get(ferramenta.predioAtivo)?.planta ?? null;
    }
    return ferramentas.get(ferramenta.modo)?.planta ?? null;
  }

  function escreverCartao(): void {
    const planta = (sobOMouse !== null ? itens.get(sobOMouse)?.planta ?? ferramentasPorId.get(sobOMouse)?.planta : null)
      ?? plantaAtiva();
    if (planta === null || planta === undefined) {
      cartao.dataset.planta = '';
      cartaoNome.textContent = '';
      cartaoCusto.textContent = '';
      cartaoRequer.textContent = '';
      cartaoDesc.textContent = temaSertao.menuBuild.cartaoVazio;
      return;
    }
    cartao.dataset.planta = planta.id;
    cartaoNome.textContent = planta.nome;
    cartaoCusto.textContent = planta.custo;
    cartaoRequer.textContent = planta.requer;
    cartaoDesc.textContent = planta.desc;
  }
  const ferramentasPorId = new Map<string, { readonly planta: Planta }>();

  function marcarAtivo(predioAtivo: string | null, modo: ModoDaFerramenta): void {
    for (const [id, item] of itens) {
      item.botao.setAttribute('aria-pressed', String(id === predioAtivo));
    }
    for (const [modoDoBotao, { botao }] of ferramentas) {
      botao.setAttribute('aria-pressed', String(modoDoBotao === modo));
    }
    // Sem ferramenta, nenhum item deve parecer selecionado: o anel de foco que
    // o navegador deixa no ultimo botao clicado (aparece de novo apos o Esc)
    // le como "ainda ativo".
    if (modo === 'nenhum') {
      const focado = document.activeElement;
      if (focado instanceof HTMLElement && raiz?.contains(focado)) focado.blur();
    }
    escreverCartao();
  }

  /** Um botao-icone. Quem passa o mouse por cima manda a planta dele ao cartao. */
  function botaoIcone(id: string, rotulo: string): HTMLButtonElement {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'icone';
    botao.title = rotulo;
    botao.setAttribute('aria-label', rotulo);
    botao.addEventListener('pointerenter', () => {
      sobOMouse = id;
      escreverCartao();
    });
    botao.addEventListener('pointerleave', () => {
      if (sobOMouse === id) sobOMouse = null;
      escreverCartao();
    });
    return botao;
  }

  function montar(opcoes: readonly OpcaoDoMenuBuild[]): void {
    const titulo = document.createElement('h2');
    titulo.textContent = temaSertao.menuBuild.titulo;
    raiz?.append(titulo);

    // As ferramentas, na primeira linha. `alternar`, e nao `selecionar*`:
    // clicar de novo no que ja esta ativo larga a ferramenta (BUG-A). A
    // comparacao mora em `input/ferramenta.ts`; o menu so diz qual botao foi
    // apertado.
    const linhaDeFerramentas = document.createElement('div');
    linhaDeFerramentas.className = 'grade ferramentas';
    montarFerramenta(linhaDeFerramentas, 'estrada', 'estrada', temaSertao.menuBuild.estrada,
      textoDoCustoDaEstrada(), () => {
        ferramenta.alternar('estrada');
      });
    montarFerramenta(linhaDeFerramentas, 'demolir-estrada', 'demolir-estrada', temaSertao.menuBuild.demolirEstrada,
      temaSertao.menuBuild.demolirEstradaDesc, () => {
        ferramenta.alternar('demolir-estrada');
      });
    raiz?.append(linhaDeFerramentas);

    // Uma faixa por grupo, na ordem de `menu-build.json`; dentro do grupo, a
    // ordem e a do seletor (= buildings.json), que a regra do dado exige que o
    // JSON de grupos respeite — a ordem nunca e digitada duas vezes.
    const grupoDe = new Map<string, string>();
    for (const grupo of menuBuild.grupos) for (const id of grupo.predios) grupoDe.set(id, grupo.id);
    const grades = new Map<string, HTMLElement>();
    for (const grupo of menuBuild.grupos) {
      const regua = document.createElement('div');
      regua.className = 'regua';
      regua.dataset.grupo = grupo.id;
      regua.textContent = rotulosDosGrupos[grupo.id] ?? grupo.id;
      const grade = document.createElement('div');
      grade.className = 'grade';
      grade.dataset.grupo = grupo.id;
      raiz?.append(regua, grade);
      grades.set(grupo.id, grade);
    }
    // Predio fora de grupo e erro de dado (`interface/menu-build`), mas a tela
    // nunca esconde um predio por causa disso: ele cai numa faixa sem rotulo.
    let semGrupo: HTMLElement | null = null;

    for (const opcao of opcoes) {
      const botao = botaoIcone(opcao.id, nomeDe(opcao.id));
      botao.dataset.predio = opcao.id;
      botao.append(miniaturaDoFootprint(opcao.tamanho));
      // aria-disabled e nao `disabled`: o item bloqueado continua recebendo o
      // clique, que a ferramenta simplesmente ignora — o jogador nao fica sem
      // resposta e o roteiro consegue provar que clicar nele nao ativa nada.
      botao.addEventListener('click', () => {
        if (botao.getAttribute('aria-disabled') === 'true') return;
        ferramenta.alternar('predio', opcao.id);
      });

      const grade = grades.get(grupoDe.get(opcao.id) ?? '');
      if (grade !== undefined) grade.append(botao);
      else {
        if (semGrupo === null) {
          semGrupo = document.createElement('div');
          semGrupo.className = 'grade';
          semGrupo.dataset.grupo = '';
          raiz?.append(semGrupo);
        }
        semGrupo.append(botao);
      }
      itens.set(opcao.id, { botao, planta: plantaDaOpcao(opcao) });
    }

    raiz?.append(cartao);
    ferramenta.aoMudar(marcarAtivo);
    marcarAtivo(ferramenta.predioAtivo, ferramenta.modo);
  }

  /** Um botao de ferramenta (estrada, demolir estrada), na primeira linha.
   *  Sempre disponivel: nao depende da arvore de desbloqueio. O desenho do
   *  icone e CSS (`.glifo-<id>`), sem letra. */
  function montarFerramenta(
    linha: HTMLElement, modo: ModoDaFerramenta, id: string, nomeDoBotao: string, detalhe: string,
    aoClicar: () => void,
  ): void {
    const botao = botaoIcone(id, nomeDoBotao);
    botao.dataset.ferramenta = id;
    const glifo = document.createElement('span');
    glifo.className = `glifo glifo-${id}`;
    botao.append(glifo);
    botao.addEventListener('click', aoClicar);
    linha.append(botao);
    const planta: Planta = { id, nome: nomeDoBotao, custo: detalhe, requer: '', desc: '' };
    ferramentas.set(modo, { botao, planta });
    ferramentasPorId.set(id, { planta });
  }

  return {
    atualizar(estado) {
      const opcoes = opcoesDoMenuBuild(estado);
      if (itens.size === 0) montar(opcoes);
      let cartaoMudou = false;
      for (const opcao of opcoes) {
        const item = itens.get(opcao.id);
        if (!item) continue;
        const bloqueado = String(!opcao.desbloqueado);
        if (item.botao.getAttribute('aria-disabled') !== bloqueado) {
          item.botao.setAttribute('aria-disabled', bloqueado);
          item.planta = plantaDaOpcao(opcao);
          cartaoMudou = true;
        }
      }
      if (cartaoMudou) escreverCartao();
    },
  };
}
