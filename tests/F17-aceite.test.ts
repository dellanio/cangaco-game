/**
 * F17 — ACEITE DA FASE A. O criterio do BUILD_PLAN, inteiro, em um teste:
 * "o roteiro conclui com 2 Woodcutter's, 1 Quarry e 1 Sawmill completos e
 * ocupados, ligados por estrada, e o estoque de timber maior que o inicial."
 *
 * Nada e injetado no estado: a vila inteira sobe por COMANDO, os mesmos que
 * `tools/shots/F17.js` da em cliques. Se esta cadeia quebrar em qualquer elo
 * (estrada, ouro, treino, obra, ocupacao, producao, carregamento), o teste
 * reprova aqui — e o unico teste do projeto que exercita as sete features da
 * Fase A de uma vez.
 *
 * O TETO de ticks e MEDIDO, nao chutado: a sonda desta sessao (a mesma geometria,
 * a mesma semente) fechou o criterio no tick 3184. 25% de folga = 3980, arredondado
 * para 4000. A folga existe para mudanca de balanceamento nao virar teste vermelho
 * sem motivo; se um dia ela nao bastar, o numero a rever e o balanceamento, e a
 * medicao que o justifica esta em `docs/planos/F17-aceite.md` §8.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { gameData } from '../src/sim/data';
import { estoqueDosArmazens } from '../src/sim/selectors';
import { predioLigadoAoArmazem } from '../src/sim/estradas';
import { aberturaDaFaseA, comandosNoTick, criarMedidor, TIPOS_DA_ABERTURA } from './helpers/abertura';
import { gravarEvidencia } from './helpers/evidence';

/** Sonda: 3184 ticks. +25% de folga. */
const TETO = 4000;

describe('F17 — aceite da Fase A', () => {
  it('a vila abre inteira por comando: quatro predios completos, ocupados, ligados, e timber entregue', () => {
    let s = createInitialState(gameData.economia.estadoInicial.semente);
    const abertura = aberturaDaFaseA(s);
    const medidor = criarMedidor(s, abertura);
    const timberInicial = estoqueDosArmazens(s)['timber'] ?? 0;

    for (let i = 0; i < TETO; i++) {
      s = step(s, comandosNoTick(s, abertura, i));
      medidor.observar(s);
      const fechou = medidor.resultado().marcos['criterio-fechado'];
      if (fechou !== null && fechou !== undefined) break;
    }

    const medicao = medidor.resultado();
    const daAbertura = abertura.plantas.map((p) => {
      const id = s.predios.ordem.find((i) => {
        const b = s.predios.porId[i];
        return b !== undefined && b.gx === p.gx && b.gy === p.gy;
      });
      return id === undefined ? null : s.predios.porId[id] ?? null;
    });
    const noArmazem = estoqueDosArmazens(s);

    gravarEvidencia('F17', {
      feature: 'F17 — aceite da Fase A',
      semente: gameData.economia.estadoInicial.semente,
      tetoDeTicks: TETO,
      criterio: {
        predios: daAbertura.map((p, i) => ({
          esperado: TIPOS_DA_ABERTURA[i],
          tipo: p?.tipo ?? null,
          estado: p?.estado ?? null,
          ocupante: p !== null && p.estado === 'completo' ? p.ocupante : null,
          ligadoAoArmazem: p === null ? null : predioLigadoAoArmazem(s, p),
        })),
        timberInicial,
        timberFinal: noArmazem['timber'] ?? 0,
        // O que responde "a CADEIA produz?": acumulado ENTREGUE ao armazem. O
        // saldo sozinho misturaria producao com o que a vila ja tinha, e as
        // plantas debitam ANTES de qualquer producao comecar.
        entregueAoArmazem: medicao.entregueAoArmazem,
      },
      medicao,
    });

    // 1. os quatro existem e estao COMPLETOS, cada um do tipo que o criterio nomeia
    daAbertura.forEach((p, i) => {
      expect(p, `planta ${i} (${TIPOS_DA_ABERTURA[i]}) nao existe no estado`).not.toBeNull();
      expect(p?.tipo).toBe(TIPOS_DA_ABERTURA[i]);
      expect(p?.estado, `${TIPOS_DA_ABERTURA[i]}@${abertura.plantas[i]?.gx} nao ficou completo`).toBe('completo');
    });
    // ...e sao mesmo 2 + 1 + 1, nao quatro de um tipo so
    const porTipo: Record<string, number> = {};
    for (const p of daAbertura) if (p) porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + 1;
    expect(porTipo).toEqual({ woodcutters: 2, quarry: 1, sawmill: 1 });

    // 2. OCUPADOS: predio completo sem ocupante nao produz nada, e o criterio pede os dois
    for (const p of daAbertura) {
      if (p === null || p.estado !== 'completo') continue;
      expect(p.ocupante, `${p.tipo}@${p.gx} ficou vago`).not.toBeNull();
    }

    // 3. LIGADOS POR ESTRADA: derivado da rede, nao de um campo do predio
    for (const p of daAbertura) {
      if (p === null) continue;
      expect(predioLigadoAoArmazem(s, p), `${p.tipo}@${p.gx} sem ligacao ao armazem`).toBe(true);
    }

    // 4. ESTOQUE DE TIMBER MAIOR QUE O INICIAL, no ARMAZEM. A gaveta de saida de
    //    predio de producao NAO entra como assercao: ela fica vazia quase sempre,
    //    porque o serf leva a tabua embora (nota da F16b no item da F17).
    expect(noArmazem['timber'] ?? 0).toBeGreaterThan(timberInicial);
    // e o timber que subiu foi PRODUZIDO pela vila, nao sobra do inicial
    expect(medicao.entregueAoArmazem['timber'] ?? 0).toBeGreaterThan(0);

    // nenhum comando da abertura foi recusado: o caminho do jogador e valido
    expect(medicao.recusas).toEqual([]);
  });
});
