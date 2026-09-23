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
import { distanciaDaTarefa, nivelDoTipo, podeReclamar } from '../../src/sim/jobs';
import { ehEscolaCompleta } from '../../src/sim/escola';
import { insumosDoPredio } from '../../src/sim/insumo';
import { ehPredioOcupavel } from '../../src/sim/ocupacao';
import { disponivelNaOrigem, vagaNoDestino } from '../../src/sim/reservas';
import { ID_DO_ARMAZEM } from '../../src/sim/state';

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
  const destino = estado.predios.porId[t.destino];
  switch (t.tipo) {
    case 'material-para-obra':
    case 'construir':
      return !destino || destino.estado !== 'obra' ? [`${t.id}: destino '${t.destino}' nao e obra`] : [];
    case 'ouro-para-escola':
      return !ehEscolaCompleta(destino) ? [`${t.id}: destino '${t.destino}' nao e escola completa`] : [];
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
      if (t.estado !== 'carregando') {
        const origem = estado.predios.porId[t.origem];
        if (!origem || origem.estado !== 'completo' || origem.tipo === ID_DO_ARMAZEM) {
          v.push(`${t.id}: origem '${t.origem}' nao e predio completo fora do armazem`);
        }
      }
      return v;
    }
    case 'ocupar':
      if (!ehPredioOcupavel(destino, dados)) return [`${t.id}: destino '${t.destino}' nao e predio ocupavel`];
      return destino.ocupante !== null ? [`${t.id}: destino '${t.destino}' ja tem ocupante`] : [];
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
  const reservasPorOrigem = new Set<string>();
  const reservasPorDestino = new Set<string>();

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
      if (t.estado !== 'carregando' && origem && destino && distanciaDaTarefa(estado, t, dados) === null) v.push(`${id}: sem caminho por estrada`);
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
    } else if (t.tipo === 'ocupar' && t.estado !== 'aberta') {
      // F14: a vaga e UMA por predio — a reserva de ocupacao nunca passa disso.
      contagemDeOcupacaoPorPredio.set(t.destino, (contagemDeOcupacaoPorPredio.get(t.destino) ?? 0) + 1);
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
  // F14: nunca mais de um ocupante reservado por predio — a vaga e a
  // cardinalidade do campo `ocupante`, nao um teto de dado.
  for (const [predio, reservado] of contagemDeOcupacaoPorPredio) {
    if (reservado > 1) v.push(`${predio}: ${reservado} ocupantes reclamados para uma vaga`);
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
  return v;
}
