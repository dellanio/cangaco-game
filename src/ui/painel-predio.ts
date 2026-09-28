// Painel de selecao de predio (F16b). UM painel para todo predio: ele junta o
// que cinco features deixaram prontas e NAO cria mecanismo novo de nada —
// `selecao` e `predioNoTile` vem da F13b, `DemolishBuilding` da F16a,
// `SetBuildingPaused` da F16c, estoque e producao da F15, ocupante da F14.
//
// Le o estado pelo seletor puro `painelDoPredio` e emite comando. Nao muta
// GameState, nao importa phaser, nao varre predios (CLAUDE.md §3, §10).
//
// Desde a UI-barra-a (docs/propostas/barra-lateral-unica.md) o painel mora no
// CORPO DA ABA da barra lateral, no lugar da grade de construir, e se desenha em
// BLOCOS empilhados: identidade (nome, vida ou obra, estoque), gente (quem
// trabalha, o que resta ao alcance), a escola (fila e tipos) e as acoes. Os nos
// de cada bloco sao os mesmos de antes, com os mesmos `data-`: mudou onde ficam,
// nao o que dizem — e e por isso que os roteiros da F13b, F16b e F22 continuam
// lendo.
//
// A fila de treino da escola virou uma SECAO deste painel
// (`desenharSecaoDaEscola`), nao um segundo painel: dois paineis disputando o
// mesmo canto da tela seria o mecanismo duplicado que a nota do item proibe.
//
// Todo rotulo vem do tema. O nome do predio sai de `predios.<id>.nome`, que ja
// existia — o painel nao inventa um segundo lugar para o mesmo nome.
import type { GameState } from '../sim/state';
import type { Command } from '../sim/commands';
import { opcoesDoMenuBuild, painelDaEscola, painelDoPredio } from '../sim/selectors';
import type { ItemDeEstoque, PainelDoPredio } from '../sim/selectors';
import type { Selecao } from '../input/selecao';
import { desenharSecaoDaEscola, nomeDoCivil } from './painel-escola';
// A MESMA aritmetica que a cena desenha no mapa (F17b). O arquivo nao tem
// import nenhum — nem phaser, nem `sim/data` —, entao trazer ele para ca nao
// abre o caminho que `menu-build.ts` fechou de proposito: `ui/` continua sem
// ler `sim/data`. Duas contas para o mesmo numero acabariam divergindo.
import { medidorDaObra } from '../render/medidor-obra';
// F-TA — a MESMA frase que a planta fantasma escreve sob o cursor (F-TP). O
// modulo le so o tema: ele saiu de `alcance-de-colheita.ts` justamente porque
// aquele arquivo le `sim/data` pelo funil `render/mapa.ts`, e `ui/` nao le
// `sim/data`. Dois textos para o mesmo numero sugeririam dois numeros.
import { rotuloDoAlcance } from '../render/rotulo-de-alcance';
import { canteiroDaObra } from '../render/nivelamento-obra';
import temaSertao from '../../data/theme-sertao.json';

export interface PainelPredio {
  atualizar(estado: GameState): void;
}

const rotulos = temaSertao.painelPredio;
type TemaDePredios = Readonly<Record<string, { readonly nome: string } | undefined>>;
type TemaDeMercadorias = Readonly<Record<string, string | undefined>>;
const temaDePredios = temaSertao.predios as TemaDePredios;
const temaDeMercadorias = temaSertao.mercadorias as TemaDeMercadorias;

/** F35 — o nome de uma mercadoria no tema, ou o id neutro quando falta. */
function nomeDaMercadoria(id: string): string {
  return temaDeMercadorias[id] ?? id;
}

function nomeDoPredio(tipo: string): string {
  return temaDePredios[tipo]?.nome ?? tipo;
}

/** Um bloco do painel. Vazio, nao entra no DOM: bloco sem nada seria uma
 *  regua de tinta separando nada de nada. */
function bloco(classe: string): HTMLElement {
  const div = document.createElement('div');
  div.className = `bloco ${classe}`;
  div.dataset.bloco = classe;
  return div;
}

function linha(classe: string, rotulo: string, valor: string): HTMLElement {
  const div = document.createElement('div');
  div.className = `linha ${classe}`;
  const r = document.createElement('span');
  r.className = 'rotulo';
  r.textContent = rotulo;
  const v = document.createElement('span');
  v.className = 'valor';
  v.textContent = valor;
  div.append(r, v);
  return div;
}

/** Uma gaveta. A ORDEM ja vem resolvida do seletor (`economia.mercadorias`). */
function gaveta(classe: string, rotulo: string, itens: readonly ItemDeEstoque[]): HTMLElement {
  const div = document.createElement('div');
  div.className = `gaveta ${classe}`;
  div.dataset.gaveta = classe;
  const r = document.createElement('span');
  r.className = 'rotulo';
  r.textContent = rotulo;
  div.append(r);

  if (itens.length === 0) {
    const vazia = document.createElement('span');
    vazia.className = 'vazia';
    vazia.textContent = rotulos.gavetaVazia;
    div.append(vazia);
    return div;
  }
  for (const item of itens) {
    const span = document.createElement('span');
    span.className = 'item';
    span.dataset.mercadoria = item.mercadoria;
    span.textContent = `${temaDeMercadorias[item.mercadoria] ?? item.mercadoria} ${item.quantidade}`;
    div.append(span);
  }
  return div;
}

function desenharObra(
  identidade: HTMLElement, dados: PainelDoPredio, custo: Readonly<Record<string, number>>,
): void {
  // Correcao da F16b: "Em obra 0%" durante todo o nivelamento dizia a mesma
  // coisa para a obra recem-plantada e para a que so espera material —
  // `progresso` e `hp / hpTotal`, e `hp` so sobe com o martelo. Enquanto nivela,
  // o painel diz o que esta REALMENTE acontecendo, na unidade que o mapa mostra:
  // tiles de chao aplainado.
  //
  // F17d: a conta e a MESMA que a cena desenha no mapa. Como `medidor-obra.ts`,
  // `nivelamento-obra.ts` nao tem import nenhum, entao traze-lo para ca nao abre
  // o caminho que `menu-build.ts` fechou de proposito: `ui/` continua sem ler
  // `sim/data`. Os tres numeros vem do seletor justamente por isso.
  const nivelamento = dados.nivelamento;
  const canteiro = nivelamento === null
    ? null
    : canteiroDaObra(nivelamento.feito, nivelamento.alvo, nivelamento.tiles);
  if (canteiro !== null && !canteiro.nivelada) {
    const l = linha('nivelamento', rotulos.nivelando,
      `${canteiro.tilesProntos}/${canteiro.tilesTotais}`);
    l.dataset.tilesProntos = String(canteiro.tilesProntos);
    l.dataset.tilesTotais = String(canteiro.tilesTotais);
    identidade.append(l);
  } else {
    identidade.append(linha('obra', rotulos.emObra, `${Math.round(dados.progresso * 100)}%`));
  }
  const faltam = dados.faltam ?? [];

  // F17b — `chegou/total` por material, INCLUSIVE o que ja completou. Isto
  // SUBSTITUI a gaveta "Falta chegar" da F16b em vez de somar a ela: as duas
  // respondem a mesma pergunta, e lado a lado o painel escrevia "Tabua 0" logo
  // acima de "Tabua 3/3" — duas leituras do mesmo numero, uma delas pior.
  // "Pedra 0/2" diz tudo o que "Pedra 2" dizia, e ainda diz o denominador.
  //
  // A ORDEM sai de `dados.faltam`, que o seletor ja devolve na ordem de
  // `economia.mercadorias` e com uma entrada por material do CUSTO (correcao
  // da F16b, `faltamDaObra`). Derivar dali e o que evita importar a lista de
  // `render/predios.ts` e arrastar `sim/data` para dentro de `ui/`.
  const ordem = faltam.map((i) => i.mercadoria);
  const porMercadoria = Object.fromEntries(faltam.map((i) => [i.mercadoria, i.quantidade]));
  const material = document.createElement('div');
  material.className = 'gaveta material';
  material.dataset.gaveta = 'material';
  const r = document.createElement('span');
  r.className = 'rotulo';
  r.textContent = rotulos.material;
  material.append(r);
  for (const l of medidorDaObra(porMercadoria, custo, ordem)) {
    const span = document.createElement('span');
    span.className = 'item';
    span.dataset.medidor = l.mercadoria;
    span.dataset.entregue = String(l.entregue);
    span.dataset.total = String(l.total);
    span.dataset.cheio = String(l.entregue >= l.total);
    span.textContent = `${temaDeMercadorias[l.mercadoria] ?? l.mercadoria} ${l.entregue}/${l.total}`;
    material.append(span);
  }
  identidade.append(material);
}

function desenharCompleto(
  identidade: HTMLElement, gente: HTMLElement, acoes: HTMLElement,
  dados: PainelDoPredio, emitir: (comando: Command) => void,
): void {
  identidade.append(linha('hp', rotulos.hp, `${dados.hp}/${dados.hpTotal}`));

  // A linha do ocupante so existe em predio que PEDE trabalhador. Escrever "sem
  // trabalhador" num armazem seria acusar falta onde nao cabe ninguem — sao dois
  // campos no seletor justamente para nao juntar as duas causas.
  if (dados.pedeTrabalhador) {
    const l = linha(
      'ocupante', rotulos.ocupante,
      dados.ocupante === null ? rotulos.semTrabalhador : nomeDoCivil(dados.ocupante.tipo),
    );
    l.dataset.ocupante = dados.ocupante === null ? 'vago' : dados.ocupante.unidade;
    gente.append(l);
  }

  // F-TA — o que resta ao alcance. A linha nao tem rotulo separado porque a
  // frase do tema JA se descreve ("Lajedo: 13 ao alcance (195)"): um rotulo
  // "Ao alcance" ao lado dela repetiria a mesma palavra. Os numeros tambem vao
  // em `data-`, para o roteiro de tela afirmar numero em vez de recortar texto.
  // `null` (obra, tipo que nao colhe) nao escreve linha; zero escreve, com a
  // frase propria do tema — e o caso que o operador nao tinha como ver.
  if (dados.colheita !== null) {
    const { recurso, tiles, unidades } = dados.colheita;
    const l = document.createElement('div');
    l.className = 'linha colheita';
    l.dataset.colheita = recurso;
    l.dataset.tiles = String(tiles);
    l.dataset.unidades = String(unidades);
    const v = document.createElement('span');
    v.className = 'valor';
    v.textContent = rotuloDoAlcance(recurso, tiles, unidades);
    l.append(v);
    gente.append(l);
  }

  // F28b — a torre: quantas pedras, e POR QUE nao atira (o aceite pede que o painel
  // diga). Os numeros e o motivo vao em `data-`, para o roteiro afirmar sem recortar texto.
  if (dados.torre !== null) {
    const l = linha('torre', rotulos.pedrasDaTorre, `${dados.torre.pedras}/${dados.torre.maximo}`);
    l.dataset.pedras = String(dados.torre.pedras);
    l.dataset.naoAtira = dados.torre.naoAtira ?? '';
    gente.append(l);
    if (dados.torre.naoAtira !== null) {
      const aviso = document.createElement('div');
      aviso.className = 'linha torre-nao-atira';
      aviso.dataset.motivo = dados.torre.naoAtira;
      aviso.textContent = dados.torre.naoAtira === 'sem-pedra' ? rotulos.torreSemPedra : rotulos.torreSemRecruta;
      gente.append(aviso);
    }
  }

  // F35 — a feira: a ordem (A -> B, feitas/quantidade), quanto de A ja esta la, e POR
  // QUE nao troca (o aceite (c) pede que o painel diga). Numeros e motivo em `data-`.
  if (dados.feira !== null) {
    const f = dados.feira;
    const ordem = f.da === null || f.para === null ? '—'
      : `${f.taxa} ${nomeDaMercadoria(f.da)} → 1 ${nomeDaMercadoria(f.para)} (${f.feitas}/${f.quantidade})`;
    const l = linha('feira', rotulos.troca, ordem);
    l.dataset.feitas = String(f.feitas);
    l.dataset.quantidade = String(f.quantidade);
    l.dataset.naEntrada = String(f.naEntrada);
    gente.append(l);
    if (f.naoTroca !== null) {
      const aviso = document.createElement('div');
      aviso.className = 'linha feira-nao-troca';
      aviso.dataset.motivo = f.naoTroca;
      aviso.textContent = f.naoTroca === 'sem-ordem' ? rotulos.feiraSemOrdem
        : f.naoTroca === 'ordem-cumprida' ? rotulos.feiraCumprida
          : rotulos.feiraSemMercadoria.replace('{da}', f.da === null ? '' : nomeDaMercadoria(f.da));
      gente.append(aviso);
    }
  }

  if (dados.estoque !== null) {
    identidade.append(gaveta('entrada', rotulos.entrada, dados.estoque.entrada));
    identidade.append(gaveta('saida', rotulos.saida, dados.estoque.saida));
  }

  // O botao de pausar so nasce em predio COM producao, como a nota da F16c
  // registrou: pausar um armazem nao quer dizer nada.
  if (dados.temProducao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    // O botao manda o VALOR, nunca "inverta o que estiver ai": se a tela
    // estivesse um tick atrasada, um toggle pausaria o que o jogador acabou de
    // retomar. Mesmo criterio do comando (F16c).
    const alvo = !dados.pausado;
    botao.dataset.pausar = String(alvo);
    botao.textContent = dados.pausado ? rotulos.retomar : rotulos.pausar;
    botao.addEventListener('click', () => {
      emitir({ type: 'SetBuildingPaused', predio: dados.predio, pausado: alvo });
    });
    acoes.append(botao);
    if (dados.pausado) {
      const aviso = document.createElement('span');
      aviso.className = 'pausado';
      aviso.dataset.pausado = 'true';
      aviso.textContent = rotulos.pausado;
      // O carimbo vai no TITULO, ao lado do nome: e a primeira coisa que o
      // jogador tem de ver num predio parado.
      identidade.querySelector('h2')?.append(aviso);
    }
  }
}

export function montarPainelPredio(
  selecao: Selecao, emitir: (comando: Command) => void,
): PainelPredio {
  const encontrado = document.getElementById('painel-predio');
  if (encontrado === null) throw new Error('painel-predio: falta #painel-predio no index.html');
  const raiz: HTMLElement = encontrado;

  // BUG-B — o x da fila da escola nao removia nada com o jogo andando.
  //
  // A causa nao esta no botao nem na sim: `aplicarCancelTraining` nunca recusa,
  // e o listener emite certo. Esta AQUI: `atualizar` faz `replaceChildren()` sem
  // diff e `main.ts` a liga em `sessao.aoMudar`, ou seja, 10 vezes por segundo.
  // O botao que recebeu o `mousedown` e destruido antes do `mouseup`, e o
  // navegador so dispara `click` quando os dois caem no MESMO elemento — entao
  // nenhum `click` nasce. Sonda desta sessao: pausado, 1 -> 0; andando, com um
  // aperto de 150 ms, 1 -> 1; andando, com o clique instantaneo do Playwright,
  // 2 -> 1. Os roteiros nunca acusaram porque `tools/shot.js` abre `/?pausado`.
  //
  // A regra: enquanto houver ponteiro APERTADO dentro do painel, o redesenho
  // espera. O ultimo estado fica guardado e entra ao soltar, entao o painel nao
  // envelhece — ele atrasa o tempo de um aperto, e so.
  let segurando = false;
  let pendente: GameState | null = null;

  raiz.addEventListener('pointerdown', () => {
    segurando = true;
  });
  const soltar = (): void => {
    if (!segurando) return;
    segurando = false;
    const ultimo = pendente;
    pendente = null;
    if (ultimo !== null) atualizar(ultimo);
  };
  // O redesenho espera o PROXIMO turno do laco de eventos: o `click` so e
  // despachado depois do `pointerup`/`mouseup`, e redesenhar dentro do proprio
  // `pointerup` destruiria o botao meio evento antes — o mesmo bug, mais tarde.
  const destravar = (): void => {
    window.setTimeout(soltar, 0);
  };
  // Na JANELA, nao no painel: soltar o botao fora dele, ou o navegador tomar o
  // ponteiro, tem de destravar igual. Sem isto o painel congelaria de vez.
  window.addEventListener('pointerup', destravar);
  window.addEventListener('pointercancel', destravar);

  function atualizar(estado: GameState): void {
    if (segurando) {
      pendente = estado;
      return;
    }
    const id = selecao.predio;
    const dados = id === null ? null : painelDoPredio(estado, id);

    if (dados === null) {
      raiz.replaceChildren();
      raiz.hidden = true;
      raiz.removeAttribute('data-predio-aberto');
      // O predio saiu do estado (demolido) mas a selecao ainda aponta para ele:
      // limpar aqui e o que fecha o painel sozinho. `definir` so avisa quando
      // muda, entao a reentrada para no proximo passo.
      if (id !== null) selecao.limpar();
      return;
    }

    raiz.replaceChildren();
    raiz.hidden = false;
    // `data-predio-aberto`, e nao `data-predio`: este ultimo ja e o item do menu
    // Build (F06), e o mesmo atributo em dois papeis faria seletor de roteiro
    // pegar o elemento errado.
    raiz.dataset.predioAberto = dados.predio;
    raiz.dataset.tipo = dados.tipo;
    raiz.dataset.estadoDoPredio = dados.estado;
    raiz.dataset.pausado = String(dados.pausado);

    // Os blocos, na ordem em que se empilham. Vazio nao entra no DOM.
    const identidade = bloco('identidade');
    const gente = bloco('gente');
    const escola = bloco('escola');
    const acoes = bloco('acoes');

    const titulo = document.createElement('h2');
    titulo.textContent = nomeDoPredio(dados.tipo);
    identidade.append(titulo);

    if (dados.estado === 'obra') {
      // O custo vem do seletor que o menu Build (F06) ja usa, e nao de um import
      // novo para `sim/data`: `ui/` nao le o dado direto, de proposito (topo de
      // `menu-build.ts`). Varredura de lista curta, so quando ha obra aberta.
      const opcao = opcoesDoMenuBuild(estado).find((o) => o.id === dados.tipo);
      desenharObra(identidade, dados, opcao?.custo ?? {});
    } else desenharCompleto(identidade, gente, acoes, dados, emitir);

    // A escola entra como SECAO, e so quando ela existe de fato no estado.
    const dadosDaEscola = dados.estado === 'completo' ? painelDaEscola(estado, dados.predio) : null;
    if (dadosDaEscola !== null) desenharSecaoDaEscola(escola, dadosDaEscola, emitir);

    // Demolir e UM CLIQUE, sem confirmacao — decisao do operador (2026-09-23),
    // registrada com o custo em IDEIAS.md. Fica por ultimo e separado das outras
    // acoes de proposito: e o unico botao daqui que destroi trabalho.
    const derrubar = document.createElement('button');
    derrubar.type = 'button';
    derrubar.className = 'demolir';
    derrubar.dataset.demolir = dados.predio;
    derrubar.textContent = rotulos.demolir;
    derrubar.title = rotulos.demolirDesc;
    derrubar.addEventListener('click', () => {
      emitir({ type: 'DemolishBuilding', predio: dados.predio });
    });
    acoes.append(derrubar);

    for (const b of [identidade, gente, escola, acoes]) {
      if (b.childElementCount > 0) raiz.append(b);
    }
  }

  return { atualizar };
}
