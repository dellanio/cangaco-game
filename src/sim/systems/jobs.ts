/**
 * Os dois sistemas do JobBoard que rodam TODO tick, depois dos comandos e nesta ordem:
 * `sanearTarefas` (revalida o que ja existe) e `gerarTarefas` (cria o que falta).
 *
 * `sanearTarefas` e o que garante o `release` em todo ramo de falha (CLAUDE.md §5:
 * "se `release` nao for chamado em algum ramo de erro, e bug"): em vez de sete `if`
 * espalhados que alguem precisa lembrar de chamar, toda tarefa reclamada e revalidada
 * contra o estado a cada tick, e o que deixou de valer passa por `liberar`. O ramo
 * "pedido da unidade" (a FSM do serf desiste) e o unico que nao e detectavel daqui:
 * quem o chama e a F10.
 *
 * Ordem fixa: tarefas por `numero` (o excedente sai do maior para o menor). Mesma
 * entrada, mesmo estado.
 */
import type {
  GameEvent, GameState, Predio, PredioCompleto, PredioEmObra, Tarefa, TarefaDeTransporte, TarefaDoSerf,
} from '../state';
import {
  ehTarefaDeAradura, ehTarefaDeAssentamento, ehTarefaDeColheita, ehTarefaDeComidaParaTropa, ehTarefaDePedraParaCanteiro, ehTarefaDeTransporte,
  ehTarefaDoSerf, ID_DO_ARMAZEM, LADO_DO_JOGADOR, MERCADORIA_DE_OURO, ORIGEM_ESPERADA_POR_TIPO, origemDaTarefaVale,
} from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { armazensCompletos, chaveDeTile, ehPlanejada, MERCADORIA_DA_ESTRADA, tilesOrdenados } from '../estradas';
import type { TileDeGrid } from '../estradas';
import { ehCampoPlanejado, tilesPlanejadosParaArar } from '../campos';
import {
  criarTarefa, criarTarefaComer, criarTarefaDeAradura, criarTarefaDeAssentamento, criarTarefaDeConstrucao, criarTarefaDeReparo, criarTarefaDeArma, criarTarefaDeAlistamento,
  criarTarefaDeComida, criarTarefaDeInsumo, criarTarefaDeOcupacao, criarTarefaDeOuro,
  criarTarefaDePedraParaCanteiro, criarTarefaParaArmazem, criarTarefaComidaParaTropa,
  distanciaDaTarefa, liberar, ligacaoEntrePredioETile, ligacaoEntrePredios,
  modoDoTipo, podeReclamar, tileAlcancavelDaPorta, TIPO_QUE_CARREGA,
} from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import type { ModoDeBusca } from '../pathfinding';
import {
  demandaDaTropa, demandaDoTile, demandaNoDestino, disponivelNaOrigem, ofertaNaOrigem, reservadoNoDestino, sobraNaOrigem,
  vagaDaTropa, vagaDoDestino, vagaNoTile,
} from '../reservas';
import {
  demandaDeInsumo, excedenteNaEntrada, insumosDoPredio, produtorParado,
} from '../insumo';
import { obraNivelada } from '../obra';
import { ehEscolaCompleta, ouroNecessario } from '../escola';
import { comidaNecessaria, comidasConhecidas, ehBodegaCompleta, temComidaNaBodega } from '../bodega';
import { receitaDoTipo } from '../producao';
import { ehPredioOcupavel, vagasDoPredio } from '../ocupacao';
import { predioReparavel } from '../reparo';
import { ehQuartelCompleto, ehRequisitoDoQuartel, requisitosDoQuartel } from '../quartel';

export interface ResultadoDeSistema {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

function tarefasPorNumero(state: GameState): Tarefa[] {
  return state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is Tarefa => t !== undefined)
    .sort((a, b) => a.numero - b.numero);
}

const ehArmazemCompleto = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DO_ARMAZEM;

const ehObra = (p: Predio | undefined): p is PredioEmObra => p !== undefined && p.estado === 'obra';

/**
 * O destino de `t` ainda e do tipo que a tarefa pressupoe? Obra, para material e
 * construir; escola completa, para ouro (F13); predio completo, ocupavel e VAGO,
 * para ocupar (F14). `null` se vale. Quem escolhe o ramo e o TIPO da tarefa, nao
 * o predio: material apontando para escola nao passa a valer so porque o predio
 * existe.
 */
function motivoDoDestino(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  // F18d-1b — o destino de `'assentar-estrada'` e um TILE, e a pergunta e outra:
  // ele continua no canteiro? Assentado ou demolido, a tarefa perdeu o objeto e
  // some, devolvendo a pedra reservada (a reserva e derivada da tarefa).
  if (ehTarefaDeAssentamento(t)) {
    return ehPlanejada(state.estradasPlanejadas, t.destinoTile) ? null : 'destino-sumiu';
  }
  // F18g — a pedra a caminho do canteiro faz a mesma pergunta do assentamento:
  // o tile continua la? Vale para a `carregando` tambem (`motivoDaCarregando`
  // passa por aqui): o serf que ja tem a pedra na mao devolve ao armazem.
  if (ehTarefaDePedraParaCanteiro(t)) {
    return ehPlanejada(state.estradasPlanejadas, t.destinoTile) ? null : 'destino-sumiu';
  }
  // F18h — a mesma pergunta para a aradura, no canteiro dela. Nao ha reserva de
  // material a devolver (o milho nao custa nada); o que a liberacao devolve e o
  // laborer, e e por isso que ela existe aqui e nao so no claim.
  if (ehTarefaDeAradura(t)) {
    return ehCampoPlanejado(state.camposPlanejados, t.destinoTile) ? null : 'destino-sumiu';
  }
  // C-COMIDA-01b (fome militar com o Feed) — o destino e o MILITAR. Morto, a carga
  // perdeu o dono ('destino-sumiu'); ja comeu, o pedido acabou ('destino-completo').
  // Vale para a `carregando` tambem: o serf devolve a comida ao armazem.
  if (ehTarefaDeComidaParaTropa(t)) {
    const alvo = state.unidades.porId[t.destinoUnidade];
    if (alvo === undefined) return 'destino-sumiu';
    return alvo.pedidoDeComida === true ? null : 'destino-completo';
  }
  const destino = state.predios.porId[t.destino];
  if (!destino) return 'destino-sumiu';
  switch (t.tipo) {
    case 'material-para-obra':
    case 'construir':
      return ehObra(destino) ? null : 'destino-completo';
    // F-CERCO-b — o reparo vale enquanto o predio pede: completo, LIGADO e abaixo do
    // total. Desligado no meio ou reparado ate o teto, cai (`'destino-completo'` nao
    // reabre), e o laborer volta a `ocioso` no proprio passo.
    case 'reparar':
      return predioReparavel(state, destino.id, dados) ? null : 'destino-completo';
    // F20a — nivel 1: a Bodega demolida (ou replantada, ou ainda em obra) nao
    // recebe comida. `ehBodegaCompleta` e o mesmo predicado do gerador.
    case 'comida-para-inn':
      return ehBodegaCompleta(destino) ? null : 'destino-sumiu';
    case 'ouro-para-escola':
      return ehEscolaCompleta(destino) ? null : 'destino-sumiu';
    // F25a — o quartel demolido (ou ainda em obra) nao recebe arma nem recruta.
    case 'arma-para-quartel':
      return ehQuartelCompleto(destino) && ehRequisitoDoQuartel(t.mercadoria, dados) ? null : 'destino-sumiu';
    case 'alistar':
      return ehQuartelCompleto(destino) ? null : 'destino-sumiu';
    // F20b — o assento de refeicao vale enquanto a Bodega existe de pe. A Bodega
    // que FICOU SEM COMIDA nao cancela a tarefa de quem esta no caminho: quem
    // chega e nao acha nada volta a `ocioso` no mesmo tick (decisao D5 do plano),
    // e cancelar aqui faria o comensal desistir e recomecar a cada broa que outro
    // pega — com a comida do nivel 1 a caminho, ele chegaria e a acharia.
    case 'comer':
      return ehBodegaCompleta(destino) ? null : 'destino-sumiu';
    // F15b — o destino de insumo tem que continuar CONSUMINDO a mercadoria.
    // `insumosDoPredio` e o mesmo predicado que o gerador usa.
    case 'insumo-producao-parada':
    case 'insumo-producao-baixa':
      return insumosDoPredio(state, t.destino, dados).includes(t.mercadoria) ? null : 'destino-sumiu';
    // F15b — niveis 6 e 7 entregam num armazem, e so nele.
    case 'saida-cheia-para-armazem':
    case 'excedente-para-armazem':
      return ehArmazemCompleto(destino) ? null : 'destino-sumiu';
    case 'ocupar':
      // Deixou de ser predio ocupavel (demolido e replantado, save de outra
      // versao): a tarefa nao tem mais sentido. Ja ocupado: a vaga acabou — e o
      // unico jeito de `vagaDeOcupacao` ficar negativa, e sai por aqui.
      if (!ehPredioOcupavel(destino, dados)) return 'destino-sumiu';
      return destino.ocupante === null ? null : 'destino-completo';
    // F-T2c — a tarefa de colheita tem DUAS pontas a revalidar, e as duas estao
    // aqui porque as duas valem tambem para a aberta (`abertaVale`), que e quem
    // devolve o tile a pedreira vizinha assim que este predio deixa de poder
    // usa-lo.
    case 'colher': {
      if (!destino || destino.estado !== 'completo') return 'destino-sumiu';
      const receita = receitaDoTipo(destino.tipo, dados);
      // deixou de ser predio de colheita (save de outra versao, dado editado)
      if (receita === null || receita.colheita === null) return 'destino-sumiu';
      // F16c — pausado e acao deliberada do jogador, e o relogio fica congelado
      // por tempo indeterminado. Segurar o tile nesse tempo seria o jogador
      // podendo travar a pedreira do vizinho de graca. Cancela ('destino-completo'
      // nao reabre); o gerador refaz quando ele despausar.
      if (destino.pausado) return 'destino-completo';
      // Sem ocupante nao ha quem colha, e segurar o tile vazio tiraria da
      // pedreira vizinha um lajedo que ninguem esta cavando. O ocupante MORTO
      // conta como nenhum, e por isso se pergunta pelas `unidades` e nao so pelo
      // campo: `sanearOcupacao` so zera o campo mais adiante no tick, e esperar
      // por ele deixaria o tile preso um tick inteiro depois da morte.
      const ocupante = destino.ocupante;
      if (ocupante === null || state.unidades.porId[ocupante] === undefined) return 'destino-completo';
      const chave = chaveDeTile(t.origemTile);
      if ((state.recursos[chave]?.quantidade ?? 0) < t.quantidade) return 'origem-sem-recurso';
      return null;
    }
  }
}

/** O motivo pelo qual uma tarefa reclamada, sozinha, deixou de valer; `null` se vale. */
function motivoIndividual(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  // O DESTINO vem primeiro (F14). Para `'ocupar'`, a elegibilidade e funcao do
  // predio de destino (`podeReclamar`): com o predio demolido, perguntar da
  // unidade primeiro devolveria 'unidade-removida' para uma unidade viva — o
  // rotulo da causa errada, e ainda por cima um que REABRE a tarefa. O motivo
  // do destino tambem e o mais especifico dos dois quando ambos valem.
  const motivoDeDestino = motivoDoDestino(state, t, dados);
  if (motivoDeDestino !== null) return motivoDeDestino;
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || !podeReclamar(state, t, unidade.tipo, dados)) return 'unidade-removida';
  // F-T2c — quem colhe e o OCUPANTE, e so ele: o especialista que largou o predio
  // (ou que foi trocado por outro) nao segura mais o tile. Cancela em vez de
  // reabrir, porque a tarefa nasceu para AQUELE par predio/ocupante; o gerador
  // cria a do ocupante novo no mesmo tick.
  if (ehTarefaDeColheita(t)) {
    const predio = state.predios.porId[t.destino];
    const ocupante = predio !== undefined && predio.estado === 'completo' ? predio.ocupante : null;
    return ocupante === t.reclamadaPor ? null : 'destino-completo';
  }
  if (!ehTarefaDoSerf(t)) return null; // construir/ocupar/assentar/arar: nada alem do destino importa
  const origem = state.predios.porId[t.origem];
  // F15b — a forma exigida da origem vem do TIPO (`origemDaTarefaVale`): ate o
  // nivel 5 e armazem; nos niveis 6 e 7 e o produtor que tem a sobra. F18g: a
  // pedra do canteiro sai de armazem, e a ligacao dela e da porta ate o tile.
  if (!origemDaTarefaVale(state, t) || origem === undefined) return 'origem-sumiu';
  // A EXISTENCIA do caminho, memoizada (`tileAlcancavelDaPorta`): e o que se pergunta
  // aqui, e perguntar por A* a cada tick para cada carga de pedra foi o que
  // multiplicou por nove o caos da F09.
  if (ehTarefaDePedraParaCanteiro(t)) {
    return tileAlcancavelDaPorta(state, origem, t.destinoTile, dados) ? null : 'caminho-cortado';
  }
  // C-COMIDA-01b — a mesma existencia memoizada, ate o tile onde o militar esta AGORA
  if (ehTarefaDeComidaParaTropa(t)) {
    const alvo = state.unidades.porId[t.destinoUnidade];
    return alvo !== undefined && tileAlcancavelDaPorta(state, origem, { gx: alvo.gx, gy: alvo.gy }, dados, t.tipo)
      ? null : 'caminho-cortado';
  }
  const destino = state.predios.porId[t.destino];
  if (!destino || distanciaDaTarefa(state, t, dados) === null) return 'caminho-cortado';
  return null;
}

/**
 * O motivo pelo qual uma tarefa CARREGANDO deixou de valer; `null` se vale. So olha a
 * unidade (a carga esta com ela) e o destino: a origem e o caminho da origem ja nao
 * importam, a coleta aconteceu. O caminho do serf carregado ate a obra e da FSM, que
 * tem a posicao dele.
 */
function motivoDaCarregando(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || unidade.tipo !== TIPO_QUE_CARREGA) return 'unidade-removida';
  return motivoDoDestino(state, t, dados);
}

/** Tira uma tarefa ABERTA do quadro. Nao ha o que liberar (uma aberta nao reserva nada),
 *  entao nao emite `task-released`. */
function cancelarAberta(state: GameState, tarefaId: string): GameState {
  const porId = { ...state.jobs.tarefas.porId };
  delete porId[tarefaId];
  return { ...state, jobs: { tarefas: { porId, ordem: state.jobs.tarefas.ordem.filter((id) => id !== tarefaId) } } };
}

/** Uma aberta vale enquanto o destino e obra; material tambem precisa de origem
 *  com algo livre e caminho. Se a origem esvaziou, cancela: o gerador refaz a
 *  tarefa com outra origem. Construir: so o destino importa (o laborer nao
 *  carrega material, nao ha origem nem caminho a checar). */
function abertaVale(state: GameState, t: Tarefa, dados: GameData): boolean {
  if (motivoDoDestino(state, t, dados) !== null) return false;
  if (!ehTarefaDoSerf(t)) return true;
  // F13: o destino tambem precisa continuar PEDINDO (a fila de treino encolhe quando o
  // jogador cancela um item; `faltam` de uma obra encolhe na entrega). F18g: o tile
  // deixa de pedir quando a pedra dele chega (`demandaDoTile`).
  const demanda = ehTarefaDePedraParaCanteiro(t) ? demandaDoTile(state, t, dados)
    : ehTarefaDeComidaParaTropa(t) ? demandaDaTropa(state, t) : demandaNoDestino(state, t, dados);
  if (demanda < 1) return false;
  if (!origemDaTarefaVale(state, t)) return false;
  // F15b — `sobraNaOrigem` generaliza `disponivelNaOrigem`: le a gaveta do tipo
  // e, no nivel 7, o EXCEDENTE em vez do estoque bruto.
  if (sobraNaOrigem(state, t, dados) < 1) return false;
  // F15b/D2 — a urgencia esta fotografada no tipo. Se ela virou, a aberta deixa
  // de valer; o gerador cria a do nivel certo no MESMO tick, de graca, porque
  // aberta nao reserva nada. Reclamada e carregando nunca passam por aqui.
  if (t.tipo === 'insumo-producao-parada' || t.tipo === 'insumo-producao-baixa') {
    if (produtorParado(state, t.destino, t.mercadoria, dados) !== (t.tipo === 'insumo-producao-parada')) return false;
  }
  // F18g — a carga de pedra pergunta a EXISTENCIA memoizada, nao o A*: sao dezenas
  // de abertas por canteiro, todo tick (ver `tileAlcancavelDaPorta`).
  if (ehTarefaDePedraParaCanteiro(t)) {
    const origem = state.predios.porId[t.origem];
    return origem !== undefined && tileAlcancavelDaPorta(state, origem, t.destinoTile, dados);
  }
  if (ehTarefaDeComidaParaTropa(t)) {
    const origem = state.predios.porId[t.origem];
    const alvo = state.unidades.porId[t.destinoUnidade];
    return origem !== undefined && alvo !== undefined
      && tileAlcancavelDaPorta(state, origem, { gx: alvo.gx, gy: alvo.gy }, dados, t.tipo);
  }
  return distanciaDaTarefa(state, t, dados) !== null;
}

/**
 * O TETO de tarefas que podem coexistir no grupo de `t`, e quantas ja existem
 * nele. O grupo muda de eixo com o tipo:
 *
 *  - niveis 1 a 5 agrupam por DESTINO, e o teto e a demanda de la (`faltam` da
 *    obra, a fila da escola, a gaveta do produtor);
 *  - niveis 6 e 7 agrupam por ORIGEM, e o teto e o que a gaveta dela oferece —
 *    o destino e um armazem, que nao tem teto nenhum (`demandaNoDestino`
 *    devolve infinito de proposito, e `existentes > Infinity` nunca seria
 *    verdade).
 *
 * `carregando` sai da contagem do lado da origem: a coleta ja tirou a unidade da
 * gaveta, entao ela nao disputa mais com as abertas. Do lado do destino ela
 * continua contando, porque a vaga la so e consumida na entrega.
 */
function grupoDeAbertas(
  state: GameState, t: TarefaDeTransporte, dados: GameData,
): { readonly teto: number; readonly existentes: number } {
  const mesmoTipoEMercadoria = tarefasPorNumero(state)
    .filter((o): o is TarefaDeTransporte => ehTarefaDeTransporte(o) && o.tipo === t.tipo && o.mercadoria === t.mercadoria);
  if (ORIGEM_ESPERADA_POR_TIPO[t.tipo] === 'outro-predio') {
    return {
      teto: ofertaNaOrigem(state, t, dados),
      existentes: mesmoTipoEMercadoria.filter((o) => o.origem === t.origem && o.estado !== 'carregando').length,
    };
  }
  return {
    teto: demandaNoDestino(state, t, dados),
    existentes: mesmoTipoEMercadoria.filter((o) => o.destino === t.destino).length,
  };
}

export function sanearTarefas(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  const liberarComMotivo = (id: string, motivo: MotivoDeLiberacao): void => {
    const r = liberar(atual, id, motivo);
    atual = r.state;
    events.push(...r.events);
  };

  // 1. cada tarefa em curso, sozinha. Reclamada: unidade, origem, destino, caminho.
  //    Carregando: so unidade e destino (a coleta ja aconteceu).
  for (const t of tarefasPorNumero(state)) {
    if (t.estado === 'aberta') continue;
    const motivo = t.estado === 'reclamada' ? motivoIndividual(atual, t, dados) : motivoDaCarregando(atual, t, dados);
    if (motivo !== null) liberarComMotivo(t.id, motivo);
  }

  // 2. em grupo: o reservado nao pode passar do que a origem tem (so reclamadas reservam
  //    a origem) nem do que a obra ainda pede (reclamadas e carregando). A ordem de soltar
  //    e fixa: as RECLAMADAS antes (ninguem tem carga na mao), e dentro de cada estado do
  //    maior numero para o menor, ate caber. So MATERIAL: o teto de 'construir'
  //    (`laborersMaximosPorObra`) e constante do dado, nunca encolhe em runtime como
  //    `faltam` encolhe — uma 'construir' reclamada nunca fica retroativamente invalida
  //    por essa via (ver `vagaDeConstrucao`, reservas.ts).
  // F18g — a pedra do canteiro entra no grupo pelas duas pontas: a origem e um
  // armazem como o das outras, e a "vaga" e o que o tile ainda pede (`vagaNoTile`).
  const emGrupo = tarefasPorNumero(atual)
    .filter((t): t is TarefaDoSerf => ehTarefaDoSerf(t) && t.estado !== 'aberta')
    .reverse();
  const ordemDeSoltar = [...emGrupo.filter((t) => t.estado === 'reclamada'), ...emGrupo.filter((t) => t.estado === 'carregando')];
  const vagaDe = (t: TarefaDoSerf): number =>
    (ehTarefaDePedraParaCanteiro(t) ? vagaNoTile(atual, t, dados)
      : ehTarefaDeComidaParaTropa(t) ? vagaDaTropa(atual, t) : vagaDoDestino(atual, t, dados));
  for (const t of ordemDeSoltar) {
    // F15b — `sobraNaOrigem` e `oferta - reservado` na gaveta do tipo, o mesmo
    // que a conta antiga fazia a mao para a `saida` do armazem. Negativa =
    // reservaram mais do que a origem tem (ou do que ela ainda OFERECE: a fila
    // da escola voltou a querer o ouro que ja era excedente).
    if (t.estado === 'reclamada' && sobraNaOrigem(atual, t, dados) < 0) {
      liberarComMotivo(t.id, 'origem-sem-recurso');
    } else if (vagaDe(t) < 0) {
      // A demanda caiu abaixo do reservado: obra que recebeu, ou fila de treino que
      // encolheu (F13). O excedente sai, do maior numero para o menor.
      liberarComMotivo(t.id, 'destino-completo');
    }
  }

  // 3. abertas que nao valem mais
  for (const t of tarefasPorNumero(atual)) {
    if (t.estado === 'aberta' && !abertaVale(atual, t, dados)) atual = cancelarAberta(atual, t.id);
  }

  // 4. abertas em excesso: nunca mais tarefas (abertas + reclamadas, por obra e — so
  //    material — por mercadoria) do que o teto pede. Material: teto = faltam[mercadoria]
  //    (encolhe com a entrega). Construir: teto = laborersMaximosPorObra (constante).
  for (const t of tarefasPorNumero(atual).reverse()) {
    if (t.estado !== 'aberta') continue;
    if (ehTarefaDeTransporte(t)) {
      const { teto, existentes } = grupoDeAbertas(atual, t, dados);
      if (existentes > teto) atual = cancelarAberta(atual, t.id);
    } else if (t.tipo === 'construir' || t.tipo === 'reparar') {
      // F-CERCO-b: o reparo tem o MESMO teto da obra, por predio e por tipo de tarefa
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === t.tipo && o.destino === t.destino).length;
      if (existentes > dados.construcao.laborersMaximosPorObra) atual = cancelarAberta(atual, t.id);
    } else if (ehTarefaDeAssentamento(t)) {
      // F18d-1b: um tile planejado comporta UMA tarefa. Duas assentariam a mesma
      // casa e reservariam duas pedras para uma so.
      const chave = chaveDeTile(t.destinoTile);
      const existentes = tarefasPorNumero(atual)
        .filter((o) => ehTarefaDeAssentamento(o) && chaveDeTile(o.destinoTile) === chave).length;
      if (existentes > 1) atual = cancelarAberta(atual, t.id);
    } else if (ehTarefaDeAradura(t)) {
      // F18h: um tile do canteiro do campo comporta UMA tarefa, pelo mesmo motivo
      // do tile de estrada logo acima — dois laborers arariam a mesma roca.
      const chave = chaveDeTile(t.destinoTile);
      const existentes = tarefasPorNumero(atual)
        .filter((o) => ehTarefaDeAradura(o) && chaveDeTile(o.destinoTile) === chave).length;
      if (existentes > 1) atual = cancelarAberta(atual, t.id);
    } else if (ehTarefaDePedraParaCanteiro(t)) {
      // F18g: nunca mais pedra a caminho de um tile do que ele ainda pede — o
      // teto e `demandaDoTile` (custo menos o que ja esta la), como `faltam` e o
      // teto do material de obra.
      const chave = chaveDeTile(t.destinoTile);
      const existentes = tarefasPorNumero(atual)
        .filter((o) => ehTarefaDePedraParaCanteiro(o) && chaveDeTile(o.destinoTile) === chave).length;
      if (existentes > demandaDoTile(atual, t, dados)) atual = cancelarAberta(atual, t.id);
    } else if (ehTarefaDeColheita(t)) {
      // F-T2c: um predio colhe UM tile por vez (um ciclo, um ocupante), e um
      // tile serve a UMA tarefa (a reserva e do tile inteiro). As duas contas
      // sao a mesma regra vista das duas pontas, e as duas precisam existir: sem
      // a segunda, duas pedreiras com alcances sobrepostos voltariam a mirar o
      // mesmo tile — que e a divida que esta feature fecha.
      const chave = chaveDeTile(t.origemTile);
      const doPredio = tarefasPorNumero(atual).filter((o) => ehTarefaDeColheita(o) && o.destino === t.destino).length;
      const doTile = tarefasPorNumero(atual)
        .filter((o) => ehTarefaDeColheita(o) && chaveDeTile(o.origemTile) === chave).length;
      if (doPredio > 1 || doTile > 1) atual = cancelarAberta(atual, t.id);
    } else if (ehTarefaDeComidaParaTropa(t)) {
      // C-COMIDA-01b: UMA tarefa por militar, em qualquer estado. A comida enche a
      // condicao inteira; a segunda chegaria a quem ja comeu.
      const existentes = tarefasPorNumero(atual)
        .filter((o) => ehTarefaDeComidaParaTropa(o) && o.destinoUnidade === t.destinoUnidade).length;
      if (existentes > 1) atual = cancelarAberta(atual, t.id);
    } else {
      // 'ocupar' (F14): o teto e a VAGA do predio (1 vago, 0 ocupado), derivada
      // do estado — nao ha teto em dado, ver `vagasDoPredio`.
      const existentes = tarefasPorNumero(atual).filter((o) => o.tipo === 'ocupar' && o.destino === t.destino).length;
      if (existentes > vagasDoPredio(atual.predios.porId[t.destino], dados)) atual = cancelarAberta(atual, t.id);
    }
  }

  return { state: atual, events };
}

/** O armazem completo de menor caminho ate `destino` que tem `mercadoria` livre;
 *  empate: o primeiro em `predios.ordem`. `null` se nenhum serve.
 *
 *  F18d-1a — a medida e a do MODO do tipo que se vai criar: por estrada nos niveis
 *  de coleta, a pe no nivel 3 (material para obra). Sao unidades diferentes, mas a
 *  comparacao acontece toda dentro de um `tipo` so. */
function origemMaisPerto(
  state: GameState, destino: Predio, mercadoria: string, tipo: TarefaDeTransporte['tipo'], dados: GameData,
): string | null {
  const modo = modoDoTipo(tipo, dados);
  let melhor: { id: string; distancia: number } | null = null;
  // C7: so o armazem do lado do destino abastece
  for (const armazem of armazensCompletos(state, destino.lado)) {
    if (disponivelNaOrigem(state, armazem.id, mercadoria) < 1) continue;
    const distancia = ligacaoEntrePredios(state, armazem, destino, modo, dados);
    if (distancia === null) continue;
    if (melhor === null || distancia < melhor.distancia) melhor = { id: armazem.id, distancia };
  }
  return melhor === null ? null : melhor.id;
}

/** Os niveis 6 e 7 entregam os dois na PORTA do armazem, e por isso tem que ter o
 *  mesmo modo: `destinoMaisPerto` escolhe o armazem antes de saber qual dos dois
 *  vai criar. Dado divergente falha alto em vez de escolher pelo nivel errado. */
function modoDoArmazem(dados: GameData): ModoDeBusca {
  const daSaidaCheia = modoDoTipo('saida-cheia-para-armazem', dados);
  if (daSaidaCheia !== modoDoTipo('excedente-para-armazem', dados)) {
    throw new Error('delivery.json: niveis 6 e 7 entregam na mesma porta e precisam do mesmo modo');
  }
  return daSaidaCheia;
}

/**
 * F15b — o espelho de `origemMaisPerto` para os niveis 6 e 7: o armazem completo
 * de menor caminho por estrada a partir de `origem`. Aqui a origem e que e
 * conhecida (e o predio que tem a sobra) e quem se escolhe e o destino. Mesmo
 * desempate: menor distancia, e no empate o primeiro em `predios.ordem`.
 *
 * `null` quando nenhum armazem esta ligado — e nao e travamento: e o mesmo
 * silencio de uma obra sem estrada. A carga espera na gaveta ate haver caminho.
 */
function destinoMaisPerto(
  state: GameState, origem: PredioCompleto, modo: ModoDeBusca, dados: GameData,
): string | null {
  let melhor: { id: string; distancia: number } | null = null;
  // C7: a sobra vai para o armazem do lado de quem a produziu
  for (const armazem of armazensCompletos(state, origem.lado)) {
    if (armazem.id === origem.id) continue;
    const distancia = ligacaoEntrePredios(state, origem, armazem, modo, dados);
    if (distancia === null) continue;
    if (melhor === null || distancia < melhor.distancia) melhor = { id: armazem.id, distancia };
  }
  return melhor === null ? null : melhor.id;
}

/** As mercadorias de uma gaveta com quantidade positiva, em ordem ALFABETICA —
 *  e nao a ordem das chaves do objeto, que depende de como o estoque foi montado
 *  e nao sobreviveria a um save/load como criterio de determinismo. Nao da para
 *  usar `economia.mercadorias`: `gold` nao esta la, e e justamente o ouro preso
 *  na escola que o nivel 7 existe para devolver. */
function mercadoriasDaGaveta(predio: PredioCompleto, gaveta: 'entrada' | 'saida'): string[] {
  return Object.keys(predio.estoque[gaveta]).filter((m) => (predio.estoque[gaveta][m] ?? 0) > 0).sort();
}

/**
 * F15b — niveis 4 e 5: o insumo que falta na gaveta `entrada` de cada produtor.
 * Uma tarefa por unidade que falta, limitada pelo que o armazem escolhido tem
 * livre — diferente do material de obra, que gera pelo `faltam` inteiro mesmo
 * sem estoque. A diferenca e deliberada: aqui a demanda e permanente (a gaveta
 * quer ficar cheia para sempre), e gerar tarefa sem lastro encheria o quadro de
 * aberta que ninguem pode atender.
 *
 * `parada` vem de `produtorParado` no momento da criacao — a urgencia do D2.
 */
function gerarTarefasDeInsumo(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (!predio || predio.estado !== 'completo') continue;
    for (const mercadoria of insumosDoPredio(atual, id, dados)) {
      const querem = demandaDeInsumo(atual, id, mercadoria, dados);
      const existentes = tarefasPorNumero(atual)
        .filter((t) => ehTarefaDeTransporte(t) && t.destino === id && t.mercadoria === mercadoria
          && (t.tipo === 'insumo-producao-parada' || t.tipo === 'insumo-producao-baixa')).length;
      if (querem <= existentes) continue;
      // `parada` sobe para antes da origem porque agora e ele que diz o TIPO da
      // tarefa, e o tipo e que diz em que modo a origem se mede (F18d-1a).
      const parada = produtorParado(atual, id, mercadoria, dados);
      const origem = origemMaisPerto(
        atual, predio, mercadoria, parada ? 'insumo-producao-parada' : 'insumo-producao-baixa', dados,
      );
      if (origem === null) continue;
      const livres = disponivelNaOrigem(atual, origem, mercadoria);
      for (let i = existentes; i < Math.min(querem, existentes + livres); i++) {
        atual = criarTarefaDeInsumo(atual, { mercadoria, origem, destino: id, parada }).state;
      }
    }
  }
  return atual;
}

/**
 * F15b — niveis 6 e 7: o que um predio COMPLETO que nao e armazem tem para
 * devolver. Da gaveta `saida` sai tudo (nivel 6, e dispara com estoque > 0 e nao
 * com a gaveta cheia — nota D3); da `entrada` sai so o EXCEDENTE (nivel 7), o
 * que o predio nao pede mais.
 *
 * O armazem nao entra no laco: ele nunca e origem, ou passaria a mandar carga
 * para si mesmo (ou para o vizinho) sem que ninguem tivesse pedido.
 */
function gerarTarefasParaArmazem(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (!predio || predio.estado !== 'completo' || predio.tipo === ID_DO_ARMAZEM) continue;
    const destino = destinoMaisPerto(atual, predio, modoDoArmazem(dados), dados);
    if (destino === null) continue;
    for (const excedente of [false, true]) {
      const gaveta = excedente ? 'entrada' : 'saida';
      for (const mercadoria of mercadoriasDaGaveta(predio, gaveta)) {
        const tipo = excedente ? 'excedente-para-armazem' : 'saida-cheia-para-armazem';
        const oferta = excedente
          ? excedenteNaEntrada(atual, id, mercadoria, dados)
          : (predio.estoque.saida[mercadoria] ?? 0);
        const existentes = tarefasPorNumero(atual)
          .filter((t) => ehTarefaDeTransporte(t) && t.tipo === tipo && t.origem === id
            && t.mercadoria === mercadoria && t.estado !== 'carregando').length;
        for (let i = existentes; i < oferta; i++) {
          atual = criarTarefaParaArmazem(atual, { mercadoria, origem: id, destino, excedente }).state;
        }
      }
    }
  }
  return atual;
}

/**
 * Cria as tarefas de nivel "material para obra": para cada obra e cada mercadoria de
 * `faltam` (na ordem de `economia.mercadorias`), tantas tarefas quantas faltam menos as
 * que ja existem. Sem armazem ligado e com estoque, nao cria: a obra espera, e a
 * tarefa surge quando a estrada e o estoque existirem.
 *
 * "Obra ja nivelada" (GDD): o portao so vale para MATERIAL — o laborer nivela sem
 * carregar nada, e tarefa de construir e o que faz o nivelamento acontecer. Pos o
 * portao tambem no laco de construir seria deadlock (F11c, Task 6).
 */
/**
 * F20a — o NIVEL 1 da escada, o mais alto: para cada Bodega completa e cada tipo de
 * comida, tantas tarefas quantas faltam para o teto (`comidaNecessaria`) menos as
 * que ja existem daquela comida. Sem armazem ligado, ou sem aquela comida livre em
 * nenhum deles, nao cria — a mesma regra do ouro e do material, e e ela que faz o
 * gerador ignorar de graca a comida que o jogo ainda nao produz (`wine`, `fish`):
 * `origemMaisPerto` devolve `null` e ninguem fica esperando o que nao existe.
 *
 * Roda ANTES de todos os outros geradores so para espelhar a escada de
 * `delivery.json` na leitura do quadro; a ORDEM de atendimento continua vindo de
 * `nivelDoTipo` em `tarefasEmOrdem`, nunca da ordem de criacao.
 */
function gerarTarefasDeComida(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const bodega = atual.predios.porId[id];
    if (!ehBodegaCompleta(bodega)) continue;
    for (const comida of comidasConhecidas(dados)) {
      const querem = comidaNecessaria(atual, id, comida, dados);
      const existentes = tarefasPorNumero(atual).filter(
        (t) => t.tipo === 'comida-para-inn' && t.destino === id && t.mercadoria === comida,
      ).length;
      if (querem <= existentes) continue;
      const origem = origemMaisPerto(atual, bodega, comida, 'comida-para-inn', dados);
      if (origem === null) continue;
      for (let i = existentes; i < querem; i++) {
        atual = criarTarefaDeComida(atual, { mercadoria: comida, origem, destino: id }).state;
      }
    }
  }
  return atual;
}

/**
 * F13 — as tarefas de nivel "ouro para escola": para cada escola completa, tantas
 * quantas a fila de treino ainda pede (`ouroNecessario`) menos as que ja existem.
 * Sem armazem ligado e com ouro livre, nao cria: a fila espera, e a tarefa surge
 * quando a estrada e o ouro existirem — mesma regra do material.
 *
 * Roda ANTES do laco das obras so para espelhar a escada de `delivery.json` (ouro e
 * nivel 2, material e 3) na leitura do quadro; a ORDEM de escolha do serf continua
 * vindo de `tarefasEmOrdem`, nao da ordem de criacao.
 */
function gerarTarefasDeOuro(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const escola = atual.predios.porId[id];
    if (!ehEscolaCompleta(escola)) continue;
    const querem = ouroNecessario(atual, id, dados);
    const existentes = tarefasPorNumero(atual)
      .filter((t) => t.tipo === 'ouro-para-escola' && t.destino === id).length;
    if (querem <= existentes) continue;
    const origem = origemMaisPerto(atual, escola, MERCADORIA_DE_OURO, 'ouro-para-escola', dados);
    if (origem === null) continue;
    for (let i = existentes; i < querem; i++) {
      atual = criarTarefaDeOuro(atual, { origem, destino: id }).state;
    }
  }
  return atual;
}

/**
 * F14 — uma vaga de OCUPACAO por predio completo, vago e que pede trabalhador.
 * Cria MESMO SEM especialista daquele tipo no mapa, como `'construir'` cria sem
 * laborer (F11b): a vaga existe no quadro assim que o predio fica pronto. Quem
 * responde "este predio esta parado esperando trabalhador" e `predio.ocupante`
 * (F22), nunca a existencia da tarefa — entao o quadro nao precisa mentir.
 *
 * Nao exige estrada: o especialista anda em modo `'livre'`, como o laborer.
 */
/**
 * F20b — os ASSENTOS de refeicao: cada Bodega completa QUE TEM COMIDA oferece
 * `condition.json:inn.comensaisSimultaneos` assentos, menos os que ja existem.
 *
 * Irma de `gerarTarefasDeOcupacao`, e pelo mesmo desenho: o quadro declara o
 * trabalho DISPONIVEL, nao reage ao estado das unidades — a vaga de ocupante
 * tambem nasce sem haver especialista livre. Quem decide que vai comer e o civil,
 * no `reclamar` (portao da fome).
 *
 * O portao `temComidaNaBodega` e o mesmo que na F20a impediu tarefa de `wine`:
 * ninguem caminha para encontrar prateleira vazia.
 */
function gerarTarefasDeComer(state: GameState, dados: GameData): GameState {
  let atual = state;
  const assentos = dados.condicao.inn.comensaisSimultaneos;
  for (const id of state.predios.ordem) {
    if (!temComidaNaBodega(atual, id, dados)) continue;
    const existentes = tarefasPorNumero(atual).filter((t) => t.tipo === 'comer' && t.destino === id).length;
    for (let i = existentes; i < assentos; i++) {
      atual = criarTarefaComer(atual, id).state;
    }
  }
  return atual;
}

function gerarTarefasDeOcupacao(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (!ehPredioOcupavel(predio, dados) || predio.ocupante !== null) continue;
    const existentes = tarefasPorNumero(atual).filter((t) => t.tipo === 'ocupar' && t.destino === id).length;
    if (existentes >= vagasDoPredio(predio, dados)) continue;
    atual = criarTarefaDeOcupacao(atual, id).state;
  }
  return atual;
}

/**
 * F18d-1b — o remendo do canteiro: todo tile desenhado precisa de UMA tarefa. O
 * `PlaceRoad` ja cria a dele no clique; esta funcao existe para os buracos — o tile
 * cuja tarefa caiu porque o armazem que pagava sumiu ou secou, e que agora tem de
 * novo quem pague.
 *
 * Nunca duplica: tile que ja tem tarefa (aberta ou reclamada) e pulado. A varredura
 * segue `tilesOrdenados` (por gy, depois gx), e nao a ordem de insercao do objeto:
 * dois saves com o mesmo canteiro tem de gerar os mesmos ids na mesma ordem.
 */
function gerarTarefasDeAssentamento(state: GameState): GameState {
  const comTarefa = new Set<string>();
  for (const t of tarefasPorNumero(state)) {
    if (ehTarefaDeAssentamento(t)) comTarefa.add(chaveDeTile(t.destinoTile));
  }
  let atual = state;
  for (const tile of tilesOrdenados(state.estradasPlanejadas)) {
    if (comTarefa.has(chaveDeTile(tile))) continue;
    // F18g: sem pagador a procurar, a tarefa nasce para todo tile — como a de arar.
    atual = criarTarefaDeAssentamento(atual, tile).state;
  }
  return atual;
}

/**
 * F18g — o armazem completo de menor caminho ate o TILE `tile` que tem `mercadoria`
 * livre; empate: o primeiro em `predios.ordem`. `null` se nenhum serve. Irma de
 * `origemMaisPerto` com a ponta trocada, no modo do tipo (`livre`).
 */
function armazemMaisPertoDoTile(
  state: GameState, tile: TileDeGrid, modo: ModoDeBusca,
  livre: (armazemId: string) => number, dados: GameData,
): string | null {
  let melhor: { id: string; distancia: number } | null = null;
  // BUG-R: a pedra da estrada sai de armazem do JOGADOR (so ele planeja estrada, plano da
  // C7). Sem o lado, um canteiro perto da vila da IA pegava o armazem dela, e a tarefa ficava
  // aberta para sempre: o serf do jogador nao pode reclama-la (C7).
  for (const armazem of armazensCompletos(state, LADO_DO_JOGADOR)) {
    if (livre(armazem.id) < 1) continue;
    // a existencia memoizada ANTES do A* do custo: um tile ilhado com pedra livre
    // no armazem faria um A* de mapa inteiro por tick, para sempre.
    if (!tileAlcancavelDaPorta(state, armazem, tile, dados)) continue;
    const distancia = ligacaoEntrePredioETile(state, armazem, tile, modo, dados);
    if (distancia === null) continue;
    if (melhor === null || distancia < melhor.distancia) melhor = { id: armazem.id, distancia };
  }
  return melhor === null ? null : melhor.id;
}

/**
 * C-COMIDA-01b (fome militar com o Feed) — a comida da tropa: para cada militar com
 * `pedidoDeComida` e sem tarefa de comida, UMA carga, do armazem completo do MESMO
 * lado de menor caminho ate o tile onde ele esta, entre os que tem alguma comida
 * livre. A comida e a de mais unidades livres naquele armazem; empate, a primeira de
 * `restauracaoPorComida` (`comidasConhecidas`). Sem armazem que sirva, nao cria: o
 * pedido espera, e o HUD mostra (C-COMIDA-01f).
 *
 * "Livre" desconta as cargas ABERTAS que ja saem daquele armazem com aquela comida,
 * pelo mesmo motivo da pedra (aberta nao reserva). Varre `unidades.ordem`: mesma
 * ordem, mesmos ids.
 */
function gerarTarefasDeComidaParaTropa(state: GameState, dados: GameData): GameState {
  let atual = state;
  const comTarefa = new Set<string>();
  const abertas: Record<string, number> = {};
  for (const t of tarefasPorNumero(state)) {
    if (!ehTarefaDeComidaParaTropa(t)) continue;
    comTarefa.add(t.destinoUnidade);
    if (t.estado === 'aberta') abertas[`${t.origem}|${t.mercadoria}`] = (abertas[`${t.origem}|${t.mercadoria}`] ?? 0) + 1;
  }
  const livre = (armazemId: string, comida: string): number =>
    disponivelNaOrigem(atual, armazemId, comida) - (abertas[`${armazemId}|${comida}`] ?? 0);
  const modo = modoDoTipo('comida-para-tropa', dados);
  for (const id of state.unidades.ordem) {
    const alvo = atual.unidades.porId[id];
    if (alvo === undefined || alvo.pedidoDeComida !== true || comTarefa.has(id)) continue;
    const tile = { gx: alvo.gx, gy: alvo.gy };
    let melhor: { armazem: string; distancia: number } | null = null;
    for (const armazem of armazensCompletos(atual, alvo.lado)) {
      if (!comidasConhecidas(dados).some((c) => livre(armazem.id, c) >= 1)) continue;
      if (!tileAlcancavelDaPorta(atual, armazem, tile, dados, 'comida-para-tropa')) continue;
      const distancia = ligacaoEntrePredioETile(atual, armazem, tile, modo, dados);
      if (distancia === null) continue;
      if (melhor === null || distancia < melhor.distancia) melhor = { armazem: armazem.id, distancia };
    }
    if (melhor === null) continue;
    let comida: string | null = null;
    for (const c of comidasConhecidas(dados)) {
      if (livre(melhor.armazem, c) >= 1 && (comida === null || livre(melhor.armazem, c) > livre(melhor.armazem, comida))) comida = c;
    }
    if (comida === null) continue;
    atual = criarTarefaComidaParaTropa(atual, { mercadoria: comida, origem: melhor.armazem, destinoUnidade: id }).state;
    const chave = `${melhor.armazem}|${comida}`;
    abertas[chave] = (abertas[chave] ?? 0) + 1;
  }
  return atual;
}

/**
 * F18g — a pedra para o canteiro: para cada tile planejado, tantas cargas quantas
 * unidades ele ainda pede (`demandaDoTile`) menos as que ja existem, limitadas ao
 * que o armazem escolhido tem livre — o mesmo desenho do insumo (niveis 4 e 5), e
 * pelo mesmo motivo: tarefa aberta sem lastro encheria o quadro de pedido que
 * ninguem pode atender, e o laborer a leria como "pedra a caminho"
 * (`tileDeEstradaTrabalhavel`) e iria esperar por ela.
 *
 * "Livre" aqui desconta tambem as cargas ABERTAS que ja saem daquele armazem: aberta
 * nao reserva (contrato de toda carga), entao `disponivelNaOrigem` nao cai quando
 * uma nasce, e sem este desconto um canteiro de 30 tiles abriria 30 cargas sobre 4
 * de pedra no mesmo tick — 26 delas para cair no saneamento seguinte, depois de
 * mandar laborers esperarem por elas. E a diferenca do insumo, que pede pouco por
 * predio; o canteiro pede uma por tile, e tiles sao muitos.
 *
 * Varre `tilesOrdenados`, nunca a ordem de insercao: dois saves com o mesmo
 * canteiro geram os mesmos ids na mesma ordem. Sem armazem com pedra livre nao
 * cria — o tile fica desenhado esperando, que e o feedback do jogador.
 */
function gerarTarefasDePedraParaCanteiro(state: GameState, dados: GameData): GameState {
  let atual = state;
  const modo = modoDoTipo('pedra-para-canteiro', dados);
  const abertasPorOrigem: Record<string, number> = {};
  const existentesPorTile: Record<string, number> = {};
  for (const t of tarefasPorNumero(state)) {
    if (!ehTarefaDePedraParaCanteiro(t)) continue;
    const chave = chaveDeTile(t.destinoTile);
    existentesPorTile[chave] = (existentesPorTile[chave] ?? 0) + 1;
    if (t.estado === 'aberta') abertasPorOrigem[t.origem] = (abertasPorOrigem[t.origem] ?? 0) + 1;
  }
  const livre = (armazemId: string): number =>
    disponivelNaOrigem(atual, armazemId, MERCADORIA_DA_ESTRADA) - (abertasPorOrigem[armazemId] ?? 0);
  for (const tile of tilesOrdenados(state.estradasPlanejadas)) {
    const chave = chaveDeTile(tile);
    const existentes = existentesPorTile[chave] ?? 0;
    // A demanda e do TILE e nao da tarefa; a assinatura de `demandaDoTile` pede a
    // tarefa so para ler o tile dela — aqui o tile e conhecido antes de ela existir.
    const querem = Math.max(0, dados.terreno.estrada.custoStonePorTile - (atual.pedraNoCanteiro[chave] ?? 0));
    for (let i = existentes; i < querem; i++) {
      const origem = armazemMaisPertoDoTile(atual, tile, modo, livre, dados);
      if (origem === null) break;
      atual = criarTarefaDePedraParaCanteiro(atual, { origem, tile }).state;
      abertasPorOrigem[origem] = (abertasPorOrigem[origem] ?? 0) + 1;
    }
  }
  return atual;
}

/**
 * F25a — o quartel: para cada quartel completo,
 * - cada REQUISITO de soldado que um armazem ligado tem livre vira tarefa de carga,
 *   uma por unidade livre (o quartel quer tudo; quem limita e a origem). `livres`
 *   e o disponivel na origem MAIS o que tarefas deste quartel ja reservam la, menos
 *   as tarefas que ja existem — aberta nao reserva, e por isso entra na conta como
 *   "ja pedida";
 * - UMA vaga de alistamento aberta, sempre: o quartel nao tem teto de recrutas.
 */
function gerarTarefasDoQuartel(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const quartel = atual.predios.porId[id];
    if (!ehQuartelCompleto(quartel)) continue;
    for (const mercadoria of requisitosDoQuartel(dados)) {
      const origem = origemMaisPerto(atual, quartel, mercadoria, 'arma-para-quartel', dados);
      if (origem === null) continue;
      const abertas = tarefasPorNumero(atual).filter(
        (t) => t.tipo === 'arma-para-quartel' && t.destino === id && t.mercadoria === mercadoria && t.estado === 'aberta',
      ).length;
      const livres = disponivelNaOrigem(atual, origem, mercadoria);
      // C3: so ate a VAGA no quartel (o teto menos o que ja tem e o que ja vem a caminho),
      // nunca mais que o armazem tem livre
      const vaga = demandaDeInsumo(atual, id, mercadoria, dados) - reservadoNoDestino(atual, id, mercadoria);
      for (let i = abertas; i < Math.min(livres, vaga); i++) {
        atual = criarTarefaDeArma(atual, { mercadoria, origem, destino: id }).state;
      }
    }
    const alistamentoAberto = tarefasPorNumero(atual).some((t) => t.tipo === 'alistar' && t.destino === id && t.estado === 'aberta');
    if (!alistamentoAberto) atual = criarTarefaDeAlistamento(atual, id).state;
  }
  return atual;
}

/**
 * F-CERCO-b — o reparo: todo predio completo que pede reparo (`predioReparavel`:
 * ligado e abaixo do total) ganha vagas ate `construcao.laborersMaximosPorObra`, o
 * MESMO teto da obra — nenhum numero novo. Sem armazem e sem estrada: o laborer nao
 * carrega nada, como na `'construir'`.
 */
function gerarTarefasDeReparo(state: GameState, dados: GameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    if (!predioReparavel(atual, id, dados)) continue;
    const existentes = tarefasPorNumero(atual).filter((t) => t.tipo === 'reparar' && t.destino === id).length;
    for (let i = existentes; i < dados.construcao.laborersMaximosPorObra; i++) {
      atual = criarTarefaDeReparo(atual, id).state;
    }
  }
  return atual;
}

/**
 * F18h — o mesmo remendo, para o canteiro do campo. Aqui ele nao cobre buraco de
 * pagador (nao ha material a pagar): ele cobre o tile cuja tarefa CAIU — o laborer
 * morreu com ela e o cancelamento a apagou, um save antigo trouxe canteiro sem
 * tarefa. Sem ele, o tile ficaria desenhado para sempre esperando quem nunca vem.
 *
 * Ordem canonica por `tilesPlanejadosParaArar`, pelo motivo de sempre: dois saves
 * com o mesmo canteiro geram os mesmos ids na mesma ordem.
 */
function gerarTarefasDeAradura(state: GameState): GameState {
  const comTarefa = new Set<string>();
  for (const t of tarefasPorNumero(state)) {
    if (ehTarefaDeAradura(t)) comTarefa.add(chaveDeTile(t.destinoTile));
  }
  let atual = state;
  for (const { tile, recurso } of tilesPlanejadosParaArar(state.camposPlanejados)) {
    if (comTarefa.has(chaveDeTile(tile))) continue;
    atual = criarTarefaDeAradura(atual, tile, recurso).state;
  }
  return atual;
}

export function gerarTarefas(state: GameState, dados: GameData = gameData): GameState {
  // Na ordem da escada de `delivery.json`: nivel 1 (comida), nivel 2 (ouro), e
  // dentro do laco os niveis 3 (material) e a construcao.
  let atual = gerarTarefasDeComida(state, dados);
  atual = gerarTarefasDeComidaParaTropa(atual, dados); // C-COMIDA-01b: nivel 2 da escada
  atual = gerarTarefasDeOuro(atual, dados);
  for (const id of state.predios.ordem) {
    const obra = atual.predios.porId[id];
    if (!ehObra(obra)) continue;
    if (obraNivelada(obra, dados)) {
      for (const mercadoria of dados.economia.mercadorias) {
        const faltam = obra.obra.faltam[mercadoria] ?? 0;
        const existentes = tarefasPorNumero(atual)
          .filter((t) => t.tipo === 'material-para-obra' && t.destino === obra.id && t.mercadoria === mercadoria).length;
        if (faltam <= existentes) continue;
        const origem = origemMaisPerto(atual, obra, mercadoria, 'material-para-obra', dados);
        if (origem === null) continue;
        for (let i = existentes; i < faltam; i++) {
          atual = criarTarefa(atual, { mercadoria, origem, destino: obra.id }).state;
        }
      }
    }

    // 'construir' (F11b): ate o teto do dado, sem checar armazem/estrada — o
    // laborer nivela/martela sem carregar material (decisao do operador).
    const existentesConstruir = tarefasPorNumero(atual).filter((t) => t.tipo === 'construir' && t.destino === obra.id).length;
    for (let i = existentesConstruir; i < dados.construcao.laborersMaximosPorObra; i++) {
      atual = criarTarefaDeConstrucao(atual, obra.id).state;
    }
  }
  // F15b: os niveis 4 a 7, tambem sobre PREDIOS COMPLETOS. A ordem de criacao
  // nao decide prioridade nenhuma — quem decide e `nivelDoTipo` no atendimento;
  // seguir a escada aqui so deixa os ids em ordem legivel na evidencia.
  atual = gerarTarefasDeInsumo(atual, dados);
  atual = gerarTarefasParaArmazem(atual, dados);
  // F18g: a pedra ANTES do assentamento, so para a evidencia ler "a carga nasce,
  // depois a obra dela"; a ordem de atendimento continua vindo de `nivelDoTipo`.
  atual = gerarTarefasDePedraParaCanteiro(atual, dados);
  atual = gerarTarefasDeAssentamento(atual);
  atual = gerarTarefasDeAradura(atual);
  atual = gerarTarefasDeReparo(atual, dados);
  atual = gerarTarefasDoQuartel(atual, dados);
  // F14 por ultimo, e sobre PREDIOS COMPLETOS — o laco acima so olha obra. Uma
  // obra que o laborer completou neste tick ja entra aqui e ganha a vaga de
  // ocupante no mesmo tick; o especialista a reclama no tick seguinte.
  atual = gerarTarefasDeOcupacao(atual, dados);
  // F20b por ultimo: o assento depende da comida que o nivel 1 acabou de entregar
  // (a entrega deste tick ja conta), e nao e um nivel da escada — nada abaixo dele
  // depende dele.
  return gerarTarefasDeComer(atual, dados);
}
