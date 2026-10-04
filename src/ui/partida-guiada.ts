// I-TELA-PARTIDA-GUIADA — "Aprender a jogar": a faixa de passos sobre o jogo livre.
//
// A lista de passos e a condicao de cada um sao DADO DA TELA, aqui, como as teclas moram em
// `input/atalhos.ts`: a `sim/` nao sabe que existe tutorial, e nada no `GameState` marca passo
// nenhum. O passo atual e DERIVADO do estado, por funcao pura (`passoAtual`), toda vez que a tela
// pergunta. Os textos vem de `data/theme-sertao.json` (`partidaGuiada`), e o nome de cada predio,
// do tema dos predios: o passo diz o tipo neutro, e quem da nome a ele e o tema (CLAUDE.md §9).
//
// A ordem segue a abertura do GDD §1.3: estrada ate o armazem, a escola, o lenhador, a pedreira, a
// serraria, a primeira comida, o quartel, e por fim a escaramuca (o ultimo passo nao tem condicao:
// e o convite para a partida contra outro bando, que comeca pelo menu).
import type { GameState, Predio } from '../sim/state';
import { ID_DA_ESCOLA, LADO_DO_JOGADOR } from '../sim/state';
import type { GameData } from '../sim/data/types';
import { predioLigadoAoArmazem } from '../sim/estradas';
import temaSertao from '../../data/theme-sertao.json';

/** O que faz um passo valer. Cada uma e lida do estado na hora, nunca guardada. */
export type CondicaoDoPasso =
  /** Um predio deste tipo, do jogador, ligado ao armazem por estrada de pe OU planejada: o passo
   *  ensina o gesto, e o calcamento e trabalho dos trabalhadores, que vem depois. */
  | { readonly tipo: 'ligado'; readonly predio: string }
  /** Um civil deste tipo na fila de alguma escola do jogador, ou ja formado. */
  | { readonly tipo: 'treino'; readonly unidade: string }
  /** Um predio deste tipo, do jogador, completo. */
  | { readonly tipo: 'completo'; readonly predio: string }
  /** Um predio do jogador, completo, cuja receita produz comida (`predioDeComida`). */
  | { readonly tipo: 'comida' }
  /** O fim: nao ha o que cumprir. */
  | { readonly tipo: 'fim' };

/** O que o passo pede ao jogador, como comando (o que o teste headless da, um a um, ao `step`). */
export type PedidoDoPasso =
  /** Estrada da porta deste tipo ate a rede do armazem; `null` e a planta que o proprio passo pede. */
  | { readonly comando: 'PlaceRoad'; readonly ate: string | null }
  /** Um civil na escola; `null` e o trabalhador (`buildings.json`) da planta que o passo pede. */
  | { readonly comando: 'EnqueueTraining'; readonly unidade: string | null }
  | { readonly comando: 'PlaceBlueprint'; readonly predios: readonly string[] };

export interface PassoDaPartidaGuiada {
  /** Chave do texto em `theme-sertao.json: partidaGuiada.passos`. */
  readonly id: string;
  readonly condicao: CondicaoDoPasso;
  /** Os comandos que o passo pede, na ordem. Vazio no ultimo passo. */
  readonly pede: readonly PedidoDoPasso[];
}

/** Os tipos de predio cuja receita poe comida no mundo SEM insumo (o canavial, o pescador): os que
 *  a primeira comida pode pedir. Derivado do dado: comida e o que `condition.json` restaura, e a
 *  receita vem de `production.json`. */
export function predioDeComidaSemInsumo(dados: GameData): string[] {
  const comidas = new Set(Object.keys(dados.condicao.restauracaoPorComida));
  return dados.predios
    .map((p) => p.id)
    .filter((id) => {
      const r = dados.producao.receitas[id];
      return r !== undefined && Object.keys(r.entra).length === 0 && Object.keys(r.sai).some((m) => comidas.has(m));
    });
}

/** Todo tipo de predio cuja receita produz comida, com ou sem insumo. */
export function predioDeComida(dados: GameData): string[] {
  const comidas = new Set(Object.keys(dados.condicao.restauracaoPorComida));
  return dados.predios
    .map((p) => p.id)
    .filter((id) => Object.keys(dados.producao.receitas[id]?.sai ?? {}).some((m) => comidas.has(m)));
}

/** O trabalhador do tipo em `buildings.json`, ou `null` (o quartel nao tem). */
function trabalhadorDo(tipo: string, dados: GameData): string | null {
  return dados.predios.find((p) => p.id === tipo)?.trabalhador ?? null;
}

/** A lista de passos. O civil do passo da escola e o trabalhador do lenhador, lido do dado; os
 *  passos de construir pedem o trabalhador da planta, quando ela tem um. */
export function passosDaPartidaGuiada(dados: GameData): readonly PassoDaPartidaGuiada[] {
  const doLenhador = trabalhadorDo('woodcutters', dados);
  if (doLenhador === null) throw new Error("partida guiada: 'woodcutters' nao tem trabalhador em data/buildings.json");
  const construir = (id: string, condicao: CondicaoDoPasso, predios: readonly string[], treinar: boolean): PassoDaPartidaGuiada => ({
    id,
    condicao,
    pede: [
      { comando: 'PlaceBlueprint', predios },
      { comando: 'PlaceRoad', ate: null },
      ...(treinar && predios.some((t) => trabalhadorDo(t, dados) !== null) ? [{ comando: 'EnqueueTraining', unidade: null } as const] : []),
    ],
  });
  const completo = (predio: string): CondicaoDoPasso => ({ tipo: 'completo', predio });
  return [
    { id: 'estrada', condicao: { tipo: 'ligado', predio: ID_DA_ESCOLA }, pede: [{ comando: 'PlaceRoad', ate: ID_DA_ESCOLA }] },
    { id: 'escola', condicao: { tipo: 'treino', unidade: doLenhador }, pede: [{ comando: 'EnqueueTraining', unidade: doLenhador }] },
    // o lenhador ja foi pedido no passo da escola
    construir('lenhador', completo('woodcutters'), ['woodcutters'], false),
    construir('pedreira', completo('quarry'), ['quarry'], true),
    construir('serraria', completo('sawmill'), ['sawmill'], true),
    construir('comida', { tipo: 'comida' }, predioDeComidaSemInsumo(dados), true),
    construir('quartel', completo('barracks'), ['barracks'], true),
    { id: 'escaramuca', condicao: { tipo: 'fim' }, pede: [] },
  ];
}

const doJogador = (s: GameState): Predio[] =>
  s.predios.ordem.flatMap((id) => {
    const p = s.predios.porId[id];
    return p !== undefined && p.lado === LADO_DO_JOGADOR ? [p] : [];
  });

/** A rede com a estrada planejada somada, memoizada pelas duas referencias: a tela pergunta a
 *  cada quadro, e o indice de componentes da sim e memoizado pela referencia de `estradas`. */
let redeMemo: { de: GameState['estradas']; planejadas: GameState['estradasPlanejadas']; rede: GameState['estradas'] } | null = null;
function redeComPlanejadas(s: GameState): GameState['estradas'] {
  if (Object.keys(s.estradasPlanejadas).length === 0) return s.estradas;
  if (redeMemo === null || redeMemo.de !== s.estradas || redeMemo.planejadas !== s.estradasPlanejadas) {
    redeMemo = { de: s.estradas, planejadas: s.estradasPlanejadas, rede: { ...s.estradas, ...s.estradasPlanejadas } };
  }
  return redeMemo.rede;
}

/** A condicao vale neste estado? Pura: so le. */
export function condicaoCumprida(condicao: CondicaoDoPasso, s: GameState, dados: GameData): boolean {
  switch (condicao.tipo) {
    case 'ligado': {
      const comRede: GameState = { ...s, estradas: redeComPlanejadas(s) };
      return doJogador(s).some((p) => p.tipo === condicao.predio && p.estado === 'completo' && predioLigadoAoArmazem(comRede, p, dados));
    }
    case 'treino': {
      const formado = s.unidades.ordem.some((id) => {
        const u = s.unidades.porId[id];
        return u !== undefined && u.lado === LADO_DO_JOGADOR && u.tipo === condicao.unidade;
      });
      if (formado) return true;
      return doJogador(s).some((p) => (s.treino[p.id] ?? []).some((i) => i.unidade === condicao.unidade));
    }
    case 'completo':
      return doJogador(s).some((p) => p.tipo === condicao.predio && p.estado === 'completo');
    case 'comida': {
      const tipos = new Set(predioDeComida(dados));
      return doJogador(s).some((p) => tipos.has(p.tipo) && p.estado === 'completo');
    }
    case 'fim':
      return false;
  }
}

/** O indice do passo atual: o PRIMEIRO cuja condicao ainda nao vale. Pura, e sem memoria: o que
 *  ja passou volta a pedir se o estado desfizer (o lenhador demolido pede o lenhador de novo). */
export function passoAtual(s: GameState, dados: GameData, passos: readonly PassoDaPartidaGuiada[] = passosDaPartidaGuiada(dados)): number {
  const i = passos.findIndex((p) => !condicaoCumprida(p.condicao, s, dados));
  return i === -1 ? passos.length - 1 : i;
}

type TemaDaPartidaGuiada = typeof temaSertao.partidaGuiada;

/** O nome do predio que o passo pede, pelo tema: o que ele manda construir ou, no passo da
 *  estrada, o que ele manda ligar. Mais de um tipo vira "A ou B". */
function nomesDosPredios(passo: PassoDaPartidaGuiada, tema: typeof temaSertao): string {
  const nomes = tema.predios as Readonly<Record<string, { readonly nome: string } | undefined>>;
  const construir = passo.pede.flatMap((p) => (p.comando === 'PlaceBlueprint' ? p.predios : []));
  const tipos = construir.length > 0 ? construir : passo.pede.flatMap((p) => (p.comando === 'PlaceRoad' && p.ate !== null ? [p.ate] : []));
  return tipos.map((t) => nomes[t]?.nome ?? t).join(tema.partidaGuiada.ou);
}

/** O nome do civil que o passo manda engajar, pelo tema: o pedido pelo nome ou, com `null`, o
 *  trabalhador de cada planta do passo. */
function nomeDaUnidade(passo: PassoDaPartidaGuiada, tema: typeof temaSertao, dados: GameData): string {
  const nomes = tema.civis as Readonly<Record<string, { readonly nome: string } | undefined>>;
  const plantas = passo.pede.flatMap((p) => (p.comando === 'PlaceBlueprint' ? p.predios : []));
  const civis = passo.pede.flatMap((p) => {
    if (p.comando !== 'EnqueueTraining') return [];
    if (p.unidade !== null) return [p.unidade];
    return plantas.flatMap((t) => { const c = trabalhadorDo(t, dados); return c === null ? [] : [c]; });
  });
  return [...new Set(civis)].map((c) => nomes[c]?.nome ?? c).join(tema.partidaGuiada.ou);
}

/** O titulo e o texto do passo, do tema, com `{predio}` e `{n}`/`{total}` preenchidos. Pura. */
export function textoDoPasso(
  indice: number, passos: readonly PassoDaPartidaGuiada[], dados: GameData, tema: typeof temaSertao = temaSertao,
): { readonly contagem: string; readonly titulo: string; readonly texto: string } {
  const passo = passos[indice];
  if (passo === undefined) throw new Error(`partida guiada: passo ${indice} nao existe`);
  const textos = (tema.partidaGuiada as TemaDaPartidaGuiada).passos as Readonly<Record<string, { readonly titulo: string; readonly texto: string } | undefined>>;
  const t = textos[passo.id];
  if (t === undefined) throw new Error(`partida guiada: o passo '${passo.id}' nao tem texto em theme-sertao.json`);
  const predio = nomesDosPredios(passo, tema);
  const unidade = nomeDaUnidade(passo, tema, dados);
  const preencher = (x: string): string => x.replaceAll('{predio}', predio).replaceAll('{unidade}', unidade);
  return {
    contagem: tema.partidaGuiada.contagem.replace('{n}', String(indice + 1)).replace('{total}', String(passos.length)),
    titulo: preencher(t.titulo),
    texto: preencher(t.texto),
  };
}

export interface FaixaDePassos {
  atualizar(estado: GameState): void;
}

/** Monta a faixa em `<body>` uma vez e so troca texto e `hidden` depois (o preco de recriar DOM
 *  com o jogo andando foi o BUG-B). "Pular" esconde a faixa e deixa o botao que a reabre. O dado
 *  chega de quem monta (`main.ts`): `ui/` nao le `sim/data` (guarda da F05b). */
export function montarFaixaDePassos(dados: GameData): FaixaDePassos {
  const tema = temaSertao.partidaGuiada;
  const passos = passosDaPartidaGuiada(dados);

  const faixa = document.createElement('aside');
  faixa.id = 'partida-guiada';
  faixa.setAttribute('role', 'status');
  const contagem = document.createElement('span');
  contagem.className = 'contagem';
  const titulo = document.createElement('strong');
  titulo.className = 'titulo';
  const texto = document.createElement('p');
  texto.className = 'texto';
  const pular = document.createElement('button');
  pular.type = 'button';
  pular.dataset.acao = 'pular';
  pular.textContent = tema.pular;
  faixa.append(contagem, titulo, texto, pular);

  const reabrir = document.createElement('button');
  reabrir.type = 'button';
  reabrir.id = 'reabrir-passos';
  reabrir.textContent = tema.reabrir;
  reabrir.hidden = true;

  pular.addEventListener('click', () => {
    faixa.hidden = true;
    reabrir.hidden = false;
    pular.blur();
  });
  reabrir.addEventListener('click', () => {
    faixa.hidden = false;
    reabrir.hidden = true;
    reabrir.blur();
  });

  document.body.append(faixa, reabrir);

  let ultimo = -1;
  return {
    atualizar(estado) {
      const i = passoAtual(estado, dados, passos);
      if (i === ultimo) return;
      ultimo = i;
      const t = textoDoPasso(i, passos, dados);
      faixa.dataset.passo = passos[i]?.id ?? '';
      contagem.textContent = t.contagem;
      titulo.textContent = t.titulo;
      texto.textContent = t.texto;
    },
  };
}
