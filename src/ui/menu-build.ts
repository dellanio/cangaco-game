// O menu Construir (F06), no corpo da aba da barra (UI-barra-a), desde o Layout 2 uma GRADE DE ICONES por
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
// O ICONE e o RETRATO do predio quando o manifesto declara um
// (`icones.predios.<id>`, derivado da base por tools/derivar-icones.js) e, se
// nao, a miniatura do footprint (N x M quadradinhos, do `tamanho` que o seletor
// ja devolve) — placeholder por construcao (CLAUDE.md §9): distingue 4x4 de 2x1
// de relance e nao digita letra nenhuma. Quem resolve id -> URL chega por
// parametro (`ui/icones.ts`); este arquivo nao fala com o bundler.
import type { GameState } from '../sim/state';
import { custoDaEstrada, opcoesDoMenuBuild } from '../sim/selectors';
// A lista de culturas araveis vem do DADO, pela funcao que a define (presenca do
// bloco `aradura`). Ler `resources.json` aqui seria uma segunda verdade, e um
// literal `'corn'` em `ui/` seria a terceira.
import { culturasAraveis } from '../sim/campos';
import type { OpcaoDoMenuBuild } from '../sim/selectors';
import type { Ferramenta, ModoDaFerramenta } from '../input/ferramenta';
import type { ResolvedorDeIcone } from './icones';
import temaSertao from '../../data/theme-sertao.json';
import menuBuild from '../../data/menu-build.json';

export interface MenuBuild {
  atualizar(estado: GameState): void;
}

type TemaDePredios = Readonly<Record<string, { readonly nome: string; readonly desc?: string } | undefined>>;
type TemaDeMercadorias = Readonly<Record<string, string | undefined>>;
const temaDePredios = temaSertao.predios as TemaDePredios;
const temaDeMercadorias = temaSertao.mercadorias as TemaDeMercadorias;
/** A cor de cada recurso no mapa — a MESMA que pinta o campo arado. A ferramenta
 *  de arar usa ela nos sulcos: duas culturas com glifo igual faziam o jogador arar
 *  cana achando que arava milho (operador, 2026-09-26). Ate a arte chegar. */
const corDasCulturas = temaSertao.recursos as Readonly<Record<string, string | undefined>>;
const rotulosDosGrupos = temaSertao.menuBuild.grupos as Readonly<Record<string, string | undefined>>;
/** I-TELA-MENU-DA-PROPOSTA — o titulo e a linha de explicacao de cada secao, do tema. */
const secoesDoMenu = temaSertao.menuBuild.secoes as Readonly<Record<string, { readonly titulo: string; readonly sub: string } | undefined>>;
const rotulosCurtos = temaSertao.menuBuild.rotulos as Readonly<Record<string, string | undefined>>;

/** I-TELA-MENU-DA-PROPOSTA — o cabecalho de uma secao: o titulo entre os dois mandacarus da proposta
 *  (CSS) e a linha de explicacao embaixo. */
function tituloDeSecao(chave: string): HTMLElement {
  const secao = secoesDoMenu[chave];
  const caixa = document.createElement('div');
  caixa.className = 'titulo-secao';
  caixa.dataset.secao = chave;
  const titulo = document.createElement('h3');
  titulo.textContent = secao?.titulo ?? chave;
  const sub = document.createElement('p');
  sub.textContent = secao?.sub ?? '';
  caixa.append(titulo, sub);
  return caixa;
}

/** O nome visivel embaixo do icone (a ferramenta e o cartao da construcao). */
function nomeVisivel(texto: string): HTMLElement {
  const nome = document.createElement('span');
  nome.className = 'nome';
  nome.textContent = texto;
  return nome;
}

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

/** "Arar Milho": o verbo e do tema, o nome da cultura tambem, e o id neutro
 *  (`corn`) so aparece no `dataset` e no comando. */
function nomeDaFerramentaDeCampo(recurso: string): string {
  return `${temaSertao.menuBuild.campo} ${temaDeMercadorias[recurso] ?? recurso}`;
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

interface FerramentaMontada {
  readonly botao: HTMLButtonElement;
  readonly modo: ModoDaFerramenta;
  /** A cultura do botao, ou `null` para as ferramentas que nao tem cultura. E o
   *  que separa "Arar Milho" de "Arar Cana" quando as duas existirem. */
  readonly cultura: string | null;
  readonly planta: Planta;
}

/** O retrato: a imagem do predio dentro do botao. `alt` vazio de proposito — o
 *  nome ja esta no `aria-label` do botao, e repetir seria ler duas vezes. */
function retrato(url: string): HTMLElement {
  const img = document.createElement('img');
  img.className = 'retrato';
  img.src = url;
  img.alt = '';
  img.draggable = false;
  return img;
}

/** I-TELA-SUBABAS-DO-CONSTRUIR — a sub-aba de quem nao tem grupo no dado: na duvida, Vila. */
export const GRUPO_PADRAO = 'vila';

/** A sub-aba de um predio: o grupo dele no dado, ou `GRUPO_PADRAO`. */
export function grupoDaOpcao(id: string, grupoDe: ReadonlyMap<string, string>): string {
  return grupoDe.get(id) ?? GRUPO_PADRAO;
}

/** I-TELA-SUBABAS-DO-CONSTRUIR — a sub-aba escolhida, lembrada entre aberturas da aba. */
let subabaEscolhida: string | null = null;

/** Monta a grade em `#menu-build` na primeira `atualizar` (e la que se sabe a
 *  lista de predios) e depois so reescreve o que mudou. */
export function montarMenuBuild(
  ferramenta: Ferramenta, iconeDe: ResolvedorDeIcone = () => null,
): MenuBuild {
  const raiz = document.getElementById('menu-build');
  if (!raiz) throw new Error('menu-build: #menu-build nao existe no index.html');

  const itens = new Map<string, ItemMontado>();
  // As ferramentas que nao sao planta de predio: estrada e demolir estrada (F08),
  // arar e apagar roca (F18i). Indexadas pelo ID do botao, e nao pelo modo, porque
  // a partir da F18i o modo `campo` tem UM botao POR CULTURA: dois botoes no mesmo
  // modo se sobrescreveriam num mapa por modo, e o ativo seria o errado.
  const ferramentas = new Map<string, FerramentaMontada>();

  // O cartao fixo: o que esta sob o mouse; sem mouse, o que esta na mao; sem
  // nada, o texto do tema. Sao quatro nos fixos, reescritos — nunca recriados.
  const cartao = document.createElement('div');
  cartao.className = 'cartao';
  cartao.dataset.planta = '';
  cartao.id = 'detalhe-construcao';
  cartao.setAttribute('role', 'tooltip');
  cartao.hidden = true;
  const cartaoNome = document.createElement('h3');
  const cartaoCusto = document.createElement('div');
  cartaoCusto.className = 'custo';
  const cartaoRequer = document.createElement('div');
  cartaoRequer.className = 'requer';
  const cartaoDesc = document.createElement('div');
  cartaoDesc.className = 'desc';
  // O miolo rola quando o texto passa do teto do cartao (CSS `--cartao-teto`):
  // o tema nao tem limite de comprimento.
  const cartaoMiolo = document.createElement('div');
  cartaoMiolo.className = 'miolo';
  cartaoMiolo.append(cartaoNome, cartaoCusto, cartaoRequer, cartaoDesc);
  cartao.append(cartaoMiolo);
  let sobOMouse: string | null = null;

  function escreverCartao(): void {
    const planta = sobOMouse !== null ? itens.get(sobOMouse)?.planta ?? ferramentas.get(sobOMouse)?.planta : null;
    if (planta === null || planta === undefined) {
      cartao.dataset.planta = '';
      cartaoNome.textContent = '';
      cartaoCusto.textContent = '';
      cartaoRequer.textContent = '';
      cartaoDesc.textContent = '';
      cartao.hidden = true;
      return;
    }
    cartao.dataset.planta = planta.id;
    cartaoNome.textContent = planta.nome;
    cartaoCusto.textContent = planta.custo;
    cartaoRequer.textContent = planta.requer;
    cartaoDesc.textContent = planta.desc;
    cartao.hidden = false;
  }

  function marcarAtivo(
    predioAtivo: string | null, modo: ModoDaFerramenta, culturaAtiva: string | null,
  ): void {
    for (const [id, item] of itens) {
      item.botao.setAttribute('aria-pressed', String(id === predioAtivo));
    }
    for (const ferramentaMontada of ferramentas.values()) {
      const ativo = ferramentaMontada.modo === modo && ferramentaMontada.cultura === culturaAtiva;
      ferramentaMontada.botao.setAttribute('aria-pressed', String(ativo));
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

  function mostrarCartao(botao: HTMLButtonElement, id: string): void {
    sobOMouse = id;
    escreverCartao();
    const retangulo = botao.getBoundingClientRect();
    const largura = 220;
    const altura = Math.min(cartao.getBoundingClientRect().height, 160);
    cartao.style.left = `${Math.min(window.innerWidth - largura - 8, retangulo.right + 10)}px`;
    cartao.style.top = `${Math.max(8, Math.min(window.innerHeight - altura - 8, retangulo.top))}px`;
  }

  function esconderCartao(id: string): void {
    if (sobOMouse !== id) return;
    sobOMouse = null;
    escreverCartao();
  }

  /** Um botao-icone com contexto fora do fluxo da grade. */
  function botaoIcone(id: string, rotulo: string): HTMLButtonElement {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'icone';
    botao.setAttribute('aria-label', rotulo);
    botao.setAttribute('aria-describedby', cartao.id);
    botao.addEventListener('pointerenter', () => mostrarCartao(botao, id));
    botao.addEventListener('focus', () => mostrarCartao(botao, id));
  botao.addEventListener('pointerleave', () => esconderCartao(id));
    botao.addEventListener('blur', () => esconderCartao(id));
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
    // I-TELA-MENU-DA-PROPOSTA: a secao das ruas e da terra, com titulo, separada das construcoes
    raiz?.append(tituloDeSecao('ferramentas'));
    const linhaDeFerramentas = document.createElement('div');
    linhaDeFerramentas.className = 'grade ferramentas';
    montarFerramenta(linhaDeFerramentas, 'estrada', 'estrada', 'estrada', temaSertao.menuBuild.estrada,
      textoDoCustoDaEstrada(), () => {
        ferramenta.alternar('estrada');
      }, null, rotulosCurtos['estrada']);
    montarFerramenta(linhaDeFerramentas, 'demolir-estrada', 'demolir-estrada', 'demolir-estrada',
      temaSertao.menuBuild.demolirEstrada, temaSertao.menuBuild.demolirEstradaDesc, () => {
        ferramenta.alternar('demolir-estrada');
      }, null, rotulosCurtos['demolirEstrada']);
    // F18i — uma ferramenta de terra POR CULTURA aravel, na ordem do dado, e uma
    // borracha para todas. A borracha e unica porque nao precisa saber a cultura:
    // ela tira o tile do canteiro, seja la o que fosse plantar ali.
    for (const recurso of culturasAraveis()) {
      montarFerramenta(linhaDeFerramentas, 'campo', `campo-${recurso}`, 'campo',
        nomeDaFerramentaDeCampo(recurso), temaSertao.menuBuild.campoDesc, () => {
          ferramenta.alternarCampo(recurso);
        }, recurso, temaDeMercadorias[recurso] ?? recurso);
    }
    montarFerramenta(linhaDeFerramentas, 'apagar-campo', 'apagar-campo', 'apagar-campo',
      temaSertao.menuBuild.apagarCampo, temaSertao.menuBuild.apagarCampoDesc, () => {
        ferramenta.alternar('apagar-campo');
      }, null, rotulosCurtos['apagarCampo']);
    raiz?.append(linhaDeFerramentas);

    // I-TELA-SUBABAS-DO-CONSTRUIR (pedido do operador, 2026-10-05): uma SUB-ABA por grupo, na ordem
    // de `menu-build.json`, e so a grade da escolhida a mostra. Dentro do grupo, a ordem e a do
    // seletor (= buildings.json), que a regra do dado exige que o JSON de grupos respeite — a ordem
    // nunca e digitada duas vezes. A escolha fica no fecho: trocar de aba principal e voltar mantem.
    const grupoDe = new Map<string, string>();
    for (const grupo of menuBuild.grupos) for (const id of grupo.predios) grupoDe.set(id, grupo.id);
    const grades = new Map<string, HTMLElement>();
    const titulos = new Map<string, HTMLElement>();
    const subabas = document.createElement('div');
    subabas.className = 'subabas';
    subabas.setAttribute('role', 'tablist');
    raiz?.append(subabas);
    const botoesDeSubaba = new Map<string, HTMLButtonElement>();
    for (const grupo of menuBuild.grupos) {
      const subaba = document.createElement('button');
      subaba.type = 'button';
      subaba.className = 'subaba';
      subaba.dataset.grupo = grupo.id;
      subaba.setAttribute('role', 'tab');
      // o icone e o `::before` da sub-aba (CSS, PNG do manifesto), como nas abas principais
      const rotuloDaSubaba = document.createElement('span');
      rotuloDaSubaba.className = 'rotulo';
      rotuloDaSubaba.textContent = rotulosDosGrupos[grupo.id] ?? grupo.id;
      subaba.append(rotuloDaSubaba);
      subaba.addEventListener('click', () => escolherSubaba(grupo.id));
      subabas.append(subaba);
      botoesDeSubaba.set(grupo.id, subaba);
      const titulo = tituloDeSecao(grupo.id);
      raiz?.append(titulo);
      titulos.set(grupo.id, titulo);
      const grade = document.createElement('div');
      grade.className = 'grade';
      grade.dataset.grupo = grupo.id;
      raiz?.append(grade);
      grades.set(grupo.id, grade);
    }
    function escolherSubaba(id: string): void {
      subabaEscolhida = id;
      for (const [g, grade] of grades) grade.hidden = g !== id;
      for (const [g, titulo] of titulos) titulo.hidden = g !== id;
      for (const [g, botao] of botoesDeSubaba) botao.setAttribute('aria-selected', String(g === id));
    }
    escolherSubaba(subabaEscolhida ?? menuBuild.grupos[0]?.id ?? GRUPO_PADRAO);
    // I-TELA-MENU-DA-PROPOSTA: na proposta as sub-abas vem no alto do corpo, antes das ruas e roçados
    titulo.after(subabas);

    for (const opcao of opcoes) {
      const botao = botaoIcone(opcao.id, nomeDe(opcao.id));
      botao.dataset.predio = opcao.id;
      const url = iconeDe(opcao.id);
      botao.append(url === null ? miniaturaDoFootprint(opcao.tamanho) : retrato(url));
      // I-TELA-MENU-DA-PROPOSTA: a construcao e um cartao com o nome visivel embaixo do retrato
      botao.append(nomeVisivel(nomeDe(opcao.id)));
      // aria-disabled e nao `disabled`: o item bloqueado continua recebendo o
      // clique, que a ferramenta simplesmente ignora — o jogador nao fica sem
      // resposta e o roteiro consegue provar que clicar nele nao ativa nada.
      botao.addEventListener('click', () => {
        if (botao.getAttribute('aria-disabled') === 'true') return;
        ferramenta.alternar('predio', opcao.id);
      });

      // Predio fora de grupo e erro de dado (`interface/menu-build`), mas a tela nunca o esconde:
      // na duvida, ele vai para Vila (pedido do operador, 2026-10-05)
      grades.get(grupoDaOpcao(opcao.id, grupoDe))?.append(botao);
      itens.set(opcao.id, { botao, planta: plantaDaOpcao(opcao) });
    }

    // I-TELA-MENU-DA-PROPOSTA: a cidade do sertao no pe do menu (enfeite do operador, `cidade.png`)
    const cidade = document.createElement('div');
    cidade.className = 'cidade';
    cidade.setAttribute('aria-hidden', 'true');
    raiz?.append(cidade);
    raiz?.append(cartao);
    ferramenta.aoMudar(marcarAtivo);
    marcarAtivo(ferramenta.predioAtivo, ferramenta.modo, ferramenta.culturaAtiva);
  }

  /** Um botao de ferramenta (estrada, demolir estrada, arar, apagar roca), na
   *  primeira linha. Sempre disponivel: nao depende da arvore de desbloqueio. O
   *  desenho do icone e CSS (`.glifo-<glifo>`), sem letra; nome e detalhe vao
   *  ao cartao quando o mouse passa. */
  function montarFerramenta(
    linha: HTMLElement, modo: ModoDaFerramenta, id: string, glifo: string, nomeDoBotao: string,
    detalhe: string, aoClicar: () => void, cultura: string | null = null,
    /** I-TELA-MENU-DA-PROPOSTA — o nome curto visivel embaixo do icone. */
    rotulo: string = nomeDoBotao,
  ): void {
    const botao = botaoIcone(id, nomeDoBotao);
    botao.dataset.ferramenta = id;
    const desenho = document.createElement('span');
    desenho.className = `glifo glifo-${glifo}`;
    const cor = cultura === null ? undefined : corDasCulturas[cultura];
    if (cor !== undefined) desenho.style.setProperty('--cor-cultura', cor);
    botao.append(desenho, nomeVisivel(rotulo));
    botao.addEventListener('click', aoClicar);
    linha.append(botao);
    const planta: Planta = { id, nome: nomeDoBotao, custo: detalhe, requer: '', desc: '' };
    ferramentas.set(id, { botao, modo, cultura, planta });
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
