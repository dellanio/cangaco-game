/**
 * As invariantes do JobBoard, para o teste de propriedade e o cenario de carga.
 * Devolve a lista de violacoes (vazia = tudo certo). Roda DEPOIS de cada `step`:
 * `sanearTarefas` roda dentro do step, entao o que um evento externo estragou tem
 * que ter sido consertado quando o tick fecha.
 *
 * O ponto central: nao existe reserva sem tarefa (a reserva e derivada), entao "nao
 * ha reserva orfa" se reduz a "nenhuma tarefa `reclamada` invalida sobrevive a um
 * tick" — e e isto que se verifica aqui.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { GameState, Tarefa } from '../../src/sim/state';
import { distanciaDaTarefa, modoDoTipo, nivelDoTipo, podeReclamar } from '../../src/sim/jobs';
import { ehEscolaCompleta } from '../../src/sim/escola';
import { ehBodegaCompleta, ehComida } from '../../src/sim/bodega';
import { chaveDeTile, ehPlanejada, MERCADORIA_DA_ESTRADA } from '../../src/sim/estradas';
import { ehCampoPlanejado } from '../../src/sim/campos';
import { insumosDoPredio } from '../../src/sim/insumo';
import { receitaDoTipo, unidadesPorCiclo } from '../../src/sim/producao';
import { ehPredioOcupavel } from '../../src/sim/ocupacao';
import { predioReparavel } from '../../src/sim/reparo';
import { ehCivilQueOcupa, POSICAO_DO_ESTADO, tetoDaEspera } from '../../src/sim/colisao';
import { classeDaUnidade } from '../../src/sim/condicao';
import { ehQuartelCompleto, ehRequisitoDoQuartel } from '../../src/sim/quartel';
import { demandaDoTile, disponivelNaOrigem, vagaNoDestino } from '../../src/sim/reservas';
import {
  ehTarefaDeAradura, ehTarefaDeAssentamento, ehTarefaDeColheita, ehTarefaDePedraParaCanteiro, ID_DO_ARMAZEM,
  origemDaTarefaVale,
} from '../../src/sim/state';

/**
 * O destino tem que ser coerente com o TIPO da tarefa. A regra nasceu na F09,
 * quando todo destino era obra, e a F13 a deixou desatualizada sem que ninguem
 * percebesse — a escola virou destino de ouro e o helper continuou exigindo
 * obra. Correcao do operador na F14.
 *
 * O `switch` e EXAUSTIVO de proposito: um membro novo de `Tarefa` sem contrato
 * de destino nao compila (o `never` do `default` deixa de aceitar `t`), em vez
 * de passar calado por um `else` generico. Cada caso pergunta pelo MESMO
 * predicado que a sim usa, nao por uma copia da regra:
 * `ehEscolaCompleta` (sim/escola.ts) e `ehPredioOcupavel` (sim/ocupacao.ts).
 */
function violacoesDoDestino(estado: GameState, t: Tarefa, dados: GameData): string[] {
  // F18d-1b: o destino de `'assentar-estrada'` nao e predio, e o `switch` abaixo
  // le `predios.porId[t.destino]`. A pergunta dela vem antes, e e a mesma que
  // `motivoDoDestino` faz (`ehPlanejada`, sim/estradas.ts): o tile continua no
  // canteiro? Tile ja assentado ou demolido deixa a tarefa sem objeto.
  if (ehTarefaDeAssentamento(t)) {
    const chave = chaveDeTile(t.destinoTile);
    return ehPlanejada(estado.estradasPlanejadas, t.destinoTile)
      ? [] : [`${t.id}: tile '${chave}' nao esta no canteiro`];
  }
  // F18g: a pedra a caminho do canteiro mira um tile que continua la, sai de um
  // armazem completo (a forma vem de `origemDaTarefaVale`, o mesmo predicado do
  // saneamento) e leva a mercadoria da estrada — nunca outra.
  if (ehTarefaDePedraParaCanteiro(t)) {
    const v: string[] = [];
    const chave = chaveDeTile(t.destinoTile);
    if (!ehPlanejada(estado.estradasPlanejadas, t.destinoTile)) v.push(`${t.id}: tile '${chave}' nao esta no canteiro`);
    if (t.mercadoria !== MERCADORIA_DA_ESTRADA) v.push(`${t.id}: leva '${t.mercadoria}' para o canteiro`);
    if (t.estado !== 'carregando' && !origemDaTarefaVale(estado, t)) {
      v.push(`${t.id}: origem '${t.origem}' nao e armazem completo`);
    }
    return v;
  }
  // F18h: a mesma coisa para a aradura, no canteiro dela, e com UMA exigencia a
  // mais que a estrada nao tem — a cultura gravada na tarefa tem de ser a que o
  // canteiro diz, senao o tile nasceria com a planta de outro pedido. O predicado e
  // o da sim (`ehCampoPlanejado`, sim/campos.ts), nao uma copia da regra.
  if (ehTarefaDeAradura(t)) {
    const chave = chaveDeTile(t.destinoTile);
    if (!ehCampoPlanejado(estado.camposPlanejados, t.destinoTile)) {
      return [`${t.id}: tile '${chave}' nao esta no canteiro do campo`];
    }
    const plantada = estado.camposPlanejados[chave];
    return plantada === t.recurso
      ? [] : [`${t.id}: ara '${t.recurso}' num tile planejado como '${plantada}'`];
  }
  const destino = estado.predios.porId[t.destino];
  switch (t.tipo) {
    case 'material-para-obra':
    case 'construir':
      return !destino || destino.estado !== 'obra' ? [`${t.id}: destino '${t.destino}' nao e obra`] : [];
    // F-CERCO-b: o destino PEDE reparo (completo, ligado, abaixo do total) — o mesmo
    // predicado do gerador e do saneamento, nao uma copia da regra.
    case 'reparar':
      return predioReparavel(estado, t.destino, dados) ? [] : [`${t.id}: destino '${t.destino}' nao pede reparo`];
    case 'ouro-para-escola':
      return !ehEscolaCompleta(destino) ? [`${t.id}: destino '${t.destino}' nao e escola completa`] : [];
    // F25a: o quartel completo, e a mercadoria e requisito de soldado
    case 'arma-para-quartel':
      if (!ehQuartelCompleto(destino)) return [`${t.id}: destino '${t.destino}' nao e quartel completo`];
      return ehRequisitoDoQuartel(t.mercadoria, dados) ? [] : [`${t.id}: '${t.mercadoria}' nao e requisito de soldado`];
    case 'alistar':
      return ehQuartelCompleto(destino) ? [] : [`${t.id}: destino '${t.destino}' nao e quartel completo`];
    // F20a, nivel 1: o destino e uma Bodega completa, e a mercadoria e comida.
    // `ehBodegaCompleta`/`ehComida` (sim/bodega.ts) sao os predicados da sim.
    case 'comida-para-inn': {
      if (!ehBodegaCompleta(destino)) return [`${t.id}: destino '${t.destino}' nao e bodega completa`];
      return ehComida(t.mercadoria, dados) ? [] : [`${t.id}: '${t.mercadoria}' nao e comida`];
    }
    // F15b, niveis 4 e 5: o destino tem que ser um produtor completo que PEDE
    // esta mercadoria. `insumosDoPredio` (sim/insumo.ts) e o mesmo predicado que
    // o gerador usa — nao uma copia da regra.
    case 'insumo-producao-parada':
    case 'insumo-producao-baixa':
      return insumosDoPredio(estado, t.destino, dados).includes(t.mercadoria)
        ? [] : [`${t.id}: destino '${t.destino}' nao consome '${t.mercadoria}'`];
    // F15b, niveis 6 e 7: o destino e armazem completo e a origem e um predio
    // completo QUE NAO E ARMAZEM — armazem mandando para armazem seria carga
    // andando em circulo.
    case 'saida-cheia-para-armazem':
    case 'excedente-para-armazem': {
      const v: string[] = [];
      if (!destino || destino.estado !== 'completo' || destino.tipo !== ID_DO_ARMAZEM) {
        v.push(`${t.id}: destino '${t.destino}' nao e armazem completo`);
      }
      // `carregando` (F10): a coleta ja aconteceu e a origem deixou de importar.
      // A forma exigida da origem vem de `origemDaTarefaVale` (sim/state.ts), o
      // MESMO predicado que `sanearTarefas` usa — nao uma copia da regra aqui.
      if (t.estado !== 'carregando' && !origemDaTarefaVale(estado, t)) {
        v.push(`${t.id}: origem '${t.origem}' nao e predio completo fora do armazem`);
      }
      return v;
    }
    case 'ocupar':
      if (!ehPredioOcupavel(destino, dados)) return [`${t.id}: destino '${t.destino}' nao e predio ocupavel`];
      return destino.ocupante !== null ? [`${t.id}: destino '${t.destino}' ja tem ocupante`] : [];
    // F20b: o assento de refeicao so vale numa Bodega completa. A Bodega TER comida
    // NAO e invariante — quem esta a caminho pode chegar e achar a prateleira vazia
    // (D5 do plano), e afirmar comida aqui condenaria o estado legitimo.
    case 'comer':
      return !ehBodegaCompleta(destino) ? [`${t.id}: destino '${t.destino}' nao e bodega completa`] : [];
    // F-T2c: o destino de uma colheita e um predio COMPLETO cuja receita colhe, e
    // o tile ainda tem o ciclo inteiro. `reclamada` exige mais: quem a segura tem
    // de ser o OCUPANTE daquele predio — a tarefa nasce para um par
    // predio/ocupante, e trocar de ocupante a cancela (`motivoIndividual`).
    case 'colher': {
      if (!destino || destino.estado !== 'completo') return [`${t.id}: destino '${t.destino}' nao e predio completo`];
      const receita = receitaDoTipo(destino.tipo, dados);
      if (receita === null || receita.colheita === null) {
        return [`${t.id}: destino '${t.destino}' (${destino.tipo}) nao tem receita de colheita`];
      }
      const v: string[] = [];
      const chave = chaveDeTile(t.origemTile);
      const quantidade = estado.recursos[chave]?.quantidade ?? 0;
      if (quantidade < t.quantidade) v.push(`${t.id}: tile '${chave}' tem ${quantidade} para um ciclo de ${t.quantidade}`);
      if (t.quantidade !== unidadesPorCiclo(receita)) {
        v.push(`${t.id}: quantidade ${t.quantidade} discorda do ciclo de '${destino.tipo}'`);
      }
      if (t.estado === 'reclamada' && destino.ocupante !== t.reclamadaPor) {
        v.push(`${t.id}: reclamada por ${t.reclamadaPor}, que nao ocupa '${t.destino}'`);
      }
      return v;
    }
    default: {
      const semContrato: never = t;
      throw new Error(`jobs-invariantes: tarefa sem contrato de destino ${JSON.stringify(semContrato)}`);
    }
  }
}

export function violacoesDeInvariantes(estado: GameState, dados: GameData = gameData): string[] {
  const v: string[] = [];
  const { tarefas } = estado.jobs;

  const idsOrdem = [...tarefas.ordem].sort();
  const idsMapa = Object.keys(tarefas.porId).sort();
  if (JSON.stringify(idsOrdem) !== JSON.stringify(idsMapa)) v.push('jobs.tarefas: ordem e porId divergem');
  if (new Set(tarefas.ordem).size !== tarefas.ordem.length) v.push('jobs.tarefas: id repetido em ordem');

  const unidadesEmUso = new Map<string, string>();
  const contagemPorDestino = new Map<string, { total: number; obra: string; mercadoria: string }>();
  const contagemDeConstrucaoPorObra = new Map<string, number>();
  const contagemDeOcupacaoPorPredio = new Map<string, number>();
  const contagemDeRefeicaoPorBodega = new Map<string, number>();
  const reservasPorOrigem = new Set<string>();
  const reservasPorDestino = new Set<string>();
  // F-T2c: a reserva de colheita e do TILE INTEIRO. Um tile com duas tarefas e
  // exatamente o defeito que a feature fecha (duas pedreiras mirando o mesmo
  // lajedo), e um predio com duas e um ciclo colhendo em dobro.
  const colheitaPorTile = new Map<string, string>();
  const colheitaPorPredio = new Map<string, string>();
  // F18g: pedra a caminho de um tile, contada por tile (aberta, reclamada ou
  // carregando — como o material de obra), contra `demandaDoTile`.
  const contagemDePedraPorTile = new Map<string, { total: number; tarefa: Parameters<typeof demandaDoTile>[1] }>();

  for (const id of tarefas.ordem) {
    const t = tarefas.porId[id];
    if (!t) {
      v.push(`${id}: em ordem mas ausente de porId`);
      continue;
    }
    if (t.id !== `t${t.numero}`) v.push(`${id}: id nao e t<numero>`);
    if (t.numero >= estado.proximoId) v.push(`${id}: numero >= proximoId (colisao futura de id)`);

    v.push(...violacoesDoDestino(estado, t, dados));

    if (t.tipo === 'material-para-obra') {
      try {
        nivelDoTipo(t.tipo, dados);
      } catch {
        v.push(`${id}: tipo '${t.tipo}' fora da escada do dado`);
      }
      // `carregando` (F10): a coleta consumiu a reserva da origem e o caminho de la ja nao
      // importa; so o destino, a unidade e a vaga tem que valer.
      const origem = estado.predios.porId[t.origem];
      const destino = estado.predios.porId[t.destino];
      if (t.estado !== 'carregando' && (!origem || origem.estado !== 'completo' || origem.tipo !== ID_DO_ARMAZEM)) {
        v.push(`${id}: origem '${t.origem}' nao e armazem completo`);
      }
      // F18d-1a: o modo e do nivel, nao do verificador — o nivel 3 anda livre, e dizer
      // "por estrada" aqui esconderia qual busca falhou.
      if (t.estado !== 'carregando' && origem && destino && distanciaDaTarefa(estado, t, dados) === null) {
        v.push(`${id}: sem caminho no modo '${modoDoTipo(t.tipo, dados)}'`);
      }
    }
    // 'construir' (F11b) fica fora da escada por decisao do operador — nao e violacao.

    if (t.estado === 'aberta' && t.reclamadaPor !== null) v.push(`${id}: aberta mas com reclamadaPor`);
    if (t.estado !== 'aberta') {
      if (t.reclamadaPor === null) {
        v.push(`${id}: ${t.estado} sem unidade`);
      } else {
        const u = estado.unidades.porId[t.reclamadaPor];
        // F14: quem responde "este civil pode segurar esta tarefa" e
        // `podeReclamar` — para 'ocupar' a resposta vem do predio de destino, e
        // nao de um par fixo tipo-de-tarefa/tipo-de-unidade.
        if (!u || !podeReclamar(estado, t, u.tipo, dados)) v.push(`${id}: ${t.estado} por unidade inexistente ou de tipo errado`);
        const outra = unidadesEmUso.get(t.reclamadaPor);
        if (outra !== undefined) v.push(`${id}: a unidade ${t.reclamadaPor} tambem segura ${outra}`);
        unidadesEmUso.set(t.reclamadaPor, id);
      }
      if (t.tipo === 'material-para-obra') {
        if (t.estado === 'reclamada') reservasPorOrigem.add(`${t.origem}|${t.mercadoria}`);
        reservasPorDestino.add(`${t.destino}|${t.mercadoria}`);
      }
    }

    if (t.tipo === 'material-para-obra') {
      const chave = `${t.destino}|${t.mercadoria}`;
      const atual = contagemPorDestino.get(chave) ?? { total: 0, obra: t.destino, mercadoria: t.mercadoria };
      contagemPorDestino.set(chave, { ...atual, total: atual.total + 1 });
    } else if (t.tipo === 'construir' && t.estado !== 'aberta') {
      contagemDeConstrucaoPorObra.set(t.destino, (contagemDeConstrucaoPorObra.get(t.destino) ?? 0) + 1);
    } else if (ehTarefaDeColheita(t)) {
      const chave = chaveDeTile(t.origemTile);
      const outraNoTile = colheitaPorTile.get(chave);
      if (outraNoTile !== undefined) v.push(`${id}: o tile '${chave}' ja e reservado por ${outraNoTile}`);
      colheitaPorTile.set(chave, id);
      const outraNoPredio = colheitaPorPredio.get(t.destino);
      if (outraNoPredio !== undefined) v.push(`${id}: '${t.destino}' ja colhe por ${outraNoPredio}`);
      colheitaPorPredio.set(t.destino, id);
    } else if (ehTarefaDePedraParaCanteiro(t)) {
      // F18g: a pedra a caminho reserva na origem como material (so reclamada), e
      // nunca ha mais tarefas para um tile do que ele ainda pede.
      if (t.estado === 'reclamada') reservasPorOrigem.add(`${t.origem}|${t.mercadoria}`);
      const chave = chaveDeTile(t.destinoTile);
      contagemDePedraPorTile.set(chave, { total: (contagemDePedraPorTile.get(chave)?.total ?? 0) + 1, tarefa: t });
    } else if (t.tipo === 'ocupar' && t.estado !== 'aberta') {
      // F14: a vaga e UMA por predio — a reserva de ocupacao nunca passa disso.
      contagemDeOcupacaoPorPredio.set(t.destino, (contagemDeOcupacaoPorPredio.get(t.destino) ?? 0) + 1);
    } else if (t.tipo === 'comer' && t.estado !== 'aberta') {
      // F20b: assento reservado — o teto e do dado, como o dos laborers por obra.
      contagemDeRefeicaoPorBodega.set(t.destino, (contagemDeRefeicaoPorBodega.get(t.destino) ?? 0) + 1);
    }
  }

  // nunca mais tarefas do que a obra precisa (aberta ou reclamada)
  for (const { total, obra, mercadoria } of contagemPorDestino.values()) {
    const p = estado.predios.porId[obra];
    const faltam = p && p.estado === 'obra' ? (p.obra.faltam[mercadoria] ?? 0) : 0;
    if (total > faltam) v.push(`${obra}/${mercadoria}: ${total} tarefas para faltam=${faltam}`);
  }
  // idem para construir: reservado nunca acima do teto do dado (aqui SO reclamadas, ja
  // que abertas nao entram em `contagemDeConstrucaoPorObra`)
  for (const [obra, reservado] of contagemDeConstrucaoPorObra) {
    if (reservado > dados.construcao.laborersMaximosPorObra) {
      v.push(`${obra}: ${reservado} laborers reclamados para teto=${dados.construcao.laborersMaximosPorObra}`);
    }
  }
  // F18g: nunca mais pedra a caminho de um tile do que ele ainda pede.
  for (const [chave, { total, tarefa }] of contagemDePedraPorTile) {
    const pede = demandaDoTile(estado, tarefa, dados);
    if (total > pede) v.push(`${chave}: ${total} tarefas de pedra para um tile que pede ${pede}`);
  }
  // F14: nunca mais de um ocupante reservado por predio — a vaga e a
  // cardinalidade do campo `ocupante`, nao um teto de dado.
  for (const [predio, reservado] of contagemDeOcupacaoPorPredio) {
    if (reservado > 1) v.push(`${predio}: ${reservado} ocupantes reclamados para uma vaga`);
  }
  // F20b: comensal reservado nunca acima de `inn.comensaisSimultaneos`.
  for (const [predio, reservado] of contagemDeRefeicaoPorBodega) {
    const assentos = dados.condicao.inn.comensaisSimultaneos;
    if (reservado > assentos) v.push(`${predio}: ${reservado} comensais reclamados para ${assentos} assentos`);
  }
  // reservado <= disponivel nas DUAS pontas (disponivel/vaga nunca negativos)
  for (const chave of reservasPorOrigem) {
    const [predio, mercadoria] = chave.split('|') as [string, string];
    if (disponivelNaOrigem(estado, predio, mercadoria) < 0) v.push(`${predio}/${mercadoria}: reservado na origem acima do estoque`);
  }
  for (const chave of reservasPorDestino) {
    const [predio, mercadoria] = chave.split('|') as [string, string];
    if (vagaNoDestino(estado, predio, mercadoria) < 0) v.push(`${predio}/${mercadoria}: reservado no destino acima da vaga`);
  }
  v.push(...violacoesDaColisao(estado, dados));
  return v;
}

/**
 * D-MOVIMENTO-01 — as invariantes da colisao civil. So com `colisaoCivil.ligada`: desligada, os civis se
 * atravessam como antes e nada disto vale.
 *  - todo estado de FSM tem classificacao (dentro ou fora);
 *  - nenhum civil espera alem do teto (`tetoDaEspera`: a troca forcada mais o maior passo),
 *    nem no passo nem na porta: e o "nao trava";
 *  - num tile com k civis "fora", pelo menos k-1 dividem o tile por troca (`trocaCom` com
 *    alguem do mesmo tile). Qualquer outro empilhamento e defeito. Quem espera a porta
 *    (`saindo`) nao ocupa, e nao conta.
 */
export function violacoesDaColisao(estado: GameState, dados: GameData = gameData): string[] {
  const c = dados.movimento.colisaoCivil;
  if (!c.ligada) return [];
  // D-MOVIMENTO-01g — troca forcada + o maior passo: o par que ocupa o tile dura um passo
  const teto = tetoDaEspera(dados);
  const v: string[] = [];
  const porTile = new Map<string, string[]>();
  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (u === undefined) continue;
    if (POSICAO_DO_ESTADO[u.fsm] === undefined) {
      v.push(`${id}: estado '${u.fsm}' sem classificacao de colisao`);
      continue;
    }
    if (classeDaUnidade(u.tipo, dados) !== 'civil') continue;
    if ((u.fsmData.bloqueado ?? 0) > teto) v.push(`${id}: bloqueado ha ${u.fsmData.bloqueado} ticks (teto ${teto})`);
    if ((u.saindo ?? 0) > teto) v.push(`${id}: esperando a porta ha ${u.saindo} ticks (teto ${teto})`);
    if (!ehCivilQueOcupa(u, dados)) continue;
    const k = `${u.gx},${u.gy}`;
    porTile.set(k, [...(porTile.get(k) ?? []), id]);
  }
  for (const [tile, ids] of porTile) {
    if (ids.length < 2) continue;
    const emTroca = ids.filter((id) => {
      const com = estado.unidades.porId[id]?.trocaCom;
      return com !== undefined && com !== id && ids.includes(com);
    }).length;
    if (emTroca < ids.length - 1) {
      const quem = ids.map((id) => {
        const u = estado.unidades.porId[id];
        return `${id}:${u?.fsm}${u?.trocaCom === undefined ? '' : `>${u.trocaCom}`}`;
      });
      v.push(`tile ${tile}: ${ids.length} civis empilhados fora de troca (${quem.join(', ')})`);
    }
  }
  return v;
}
