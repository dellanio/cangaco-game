/**
 * C9 — o fim de partida para o jogo (fila do operador, item 9; plano em
 * docs/planos/2026-09-28-C9-fim-para-o-jogo.md). Aceite headless:
 *  (a) encerrado, o laco nao roda passo; retomar, alternar e avancar nao fazem nada;
 *      reaberto, volta a rodar depois de retomar;
 *  (b) `acompanharFimDePartida` encerra no estado com fim e reabre no estado sem fim.
 * O (c), a tela, e o roteiro `tools/shots/F34.js`.
 *  (d)/(e)/(f) — hipotese do avaliador, confirmada (plano em
 *      docs/planos/2026-09-29-hipoteses-do-avaliador.md): o fim chega DE DENTRO do passo (a
 *      sessao avisa os ouvintes a cada passo), e o quadro nao pode rodar os passos que sobram.
 */
import { describe, expect, it } from 'vitest';
import { acompanharFimDePartida, criarLaco } from '../src/laco';

function laco(): { l: ReturnType<typeof criarLaco>; passos: () => number } {
  let n = 0;
  const l = criarLaco({ passo: () => { n += 1; }, tickMs: 100, velocidades: [1, 2, 3], velocidadePadrao: 1 });
  return { l, passos: () => n };
}

describe('C9 — o fim da partida para o laco', () => {
  it('(a) encerrado nao anda; retomar, alternar e avancar nao fazem nada; reaberto anda', () => {
    const { l, passos } = laco();
    l.tique(0);
    l.tique(250);
    expect(passos()).toBe(2); // rodando, andou
    l.encerrar();
    expect([l.pausado, l.encerrado]).toEqual([true, true]);
    // cada tentativa isolada, com tempo passando depois dela: nenhuma pode fazer andar
    l.retomar();
    l.tique(1000);
    l.tique(2000);
    expect([passos(), l.pausado]).toEqual([2, true]);
    l.alternarPausa();
    l.tique(3000);
    l.tique(4000);
    expect([passos(), l.pausado]).toEqual([2, true]);
    l.avancar(5);
    expect(passos()).toBe(2); // nada andou
    l.reabrir();
    expect([l.pausado, l.encerrado]).toEqual([true, false]); // reaberto, ainda pausado
    l.retomar();
    l.tique(6000);
    l.tique(6300);
    expect(passos()).toBe(5);
  });

  /** Laco cujo passo `n` chama `efeito` (o ouvinte da sessao, que encerra ou pausa). */
  function lacoQueReageNoPasso(n: number, efeito: (l: ReturnType<typeof criarLaco>) => void) {
    let rodados = 0;
    const ref: { l?: ReturnType<typeof criarLaco> } = {};
    const l = criarLaco({
      passo: () => { rodados += 1; if (rodados === n && ref.l !== undefined) efeito(ref.l); },
      tickMs: 100, velocidades: [1, 2, 3], velocidadePadrao: 1,
    });
    ref.l = l;
    return { l, passos: () => rodados };
  }

  it('(d) o fim no 2o passo de um quadro de 1 s: o quadro para ali', () => {
    const { l, passos } = lacoQueReageNoPasso(2, (x) => acompanharFimDePartida(x, { partida: { fim: 'vitoria', tick: 2 } }));
    l.tique(0);
    expect(l.tique(1000)).toBe(2);
    expect([passos(), l.encerrado]).toEqual([2, true]);
    l.tique(2000);
    expect(passos()).toBe(2);
  });

  it('(e) o fim no 2o passo de um avancar(5): param os 3 que sobram', () => {
    const { l, passos } = lacoQueReageNoPasso(2, (x) => x.encerrar());
    l.pausar();
    l.avancar(5);
    expect(passos()).toBe(2);
  });

  it('(f) pausa pedida de dentro do passo corta o quadro, e retomar nao despeja o resto', () => {
    const { l, passos } = lacoQueReageNoPasso(2, (x) => x.pausar());
    l.tique(0);
    expect(l.tique(1000)).toBe(2);
    l.retomar();
    l.tique(1100);
    l.tique(1200);
    expect(passos()).toBeLessThanOrEqual(3);
  });

  it('(b) o helper encerra no estado com fim e reabre no estado sem fim', () => {
    const { l } = laco();
    acompanharFimDePartida(l, {});
    expect(l.encerrado).toBe(false);
    acompanharFimDePartida(l, { partida: { fim: 'vitoria', tick: 10 } });
    expect(l.encerrado).toBe(true);
    acompanharFimDePartida(l, { partida: { fim: 'vitoria', tick: 10 } }); // idempotente
    expect(l.encerrado).toBe(true);
    acompanharFimDePartida(l, {}); // outro save, sem fim
    expect([l.encerrado, l.pausado]).toEqual([false, true]);
  });
});
