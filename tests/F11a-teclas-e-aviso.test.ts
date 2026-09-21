// F11a — as teclas do tempo (src/input/teclas-do-tempo.ts) e o texto do aviso
// (src/ui/aviso-tempo.ts). `P` pausa, `+` e `-` mudam a velocidade (GDD §2.2). O alvo do
// evento entra por parametro, como em `teclado.ts`: o teste usa um EventTarget do Node, sem
// `window` nem `document`. O aviso e DOM, mas o TEXTO que ele mostra e uma funcao pura, e e
// ela que se prova aqui; o elemento e afirmado no roteiro (`npm run shot -- F11a`).
import { describe, expect, it } from 'vitest';
import { ligarTeclasDoTempo, type ControleDoTempo } from '../src/input/teclas-do-tempo';
import { textoDoAviso } from '../src/ui/aviso-tempo';
import temaSertao from '../data/theme-sertao.json';

const rotulos = { pausado: temaSertao.hud.pausado };

function controleFalso(): ControleDoTempo & { chamadas: string[] } {
  const chamadas: string[] = [];
  return {
    chamadas,
    alternarPausa: () => chamadas.push('pausa'),
    acelerar: () => chamadas.push('+'),
    desacelerar: () => chamadas.push('-'),
  };
}

function apertar(alvo: EventTarget, key: string, extra: Record<string, boolean> = {}): void {
  alvo.dispatchEvent(Object.assign(new Event('keydown'), { key, ...extra }));
}

describe('F11a — teclas do tempo', () => {
  it('P alterna a pausa, maiuscula ou minuscula', () => {
    const alvo = new EventTarget();
    const c = controleFalso();
    ligarTeclasDoTempo(c, alvo);
    apertar(alvo, 'p');
    apertar(alvo, 'P');
    expect(c.chamadas).toEqual(['pausa', 'pausa']);
  });

  it('+ (e = , que e a mesma tecla sem Shift) acelera; - desacelera', () => {
    const alvo = new EventTarget();
    const c = controleFalso();
    ligarTeclasDoTempo(c, alvo);
    apertar(alvo, '+');
    apertar(alvo, '=');
    apertar(alvo, '-');
    expect(c.chamadas).toEqual(['+', '+', '-']);
  });

  it('com Ctrl, Meta ou Alt nao faz nada: Ctrl+ e Ctrl- sao o zoom do navegador', () => {
    const alvo = new EventTarget();
    const c = controleFalso();
    ligarTeclasDoTempo(c, alvo);
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
      apertar(alvo, 'p', { [mod]: true });
      apertar(alvo, '+', { [mod]: true });
      apertar(alvo, '-', { [mod]: true });
    }
    expect(c.chamadas).toEqual([]);
  });

  it('segurar a tecla (keydown repetido) nao repete: P segurado nao liga e desliga a pausa 30 vezes', () => {
    const alvo = new EventTarget();
    const c = controleFalso();
    ligarTeclasDoTempo(c, alvo);
    apertar(alvo, 'p');
    for (let i = 0; i < 30; i++) apertar(alvo, 'p', { repeat: true });
    expect(c.chamadas).toEqual(['pausa']);
  });

  it('outras teclas nao fazem nada, e o desligador tira o ouvinte', () => {
    const alvo = new EventTarget();
    const c = controleFalso();
    const desligar = ligarTeclasDoTempo(c, alvo);
    apertar(alvo, 'r');
    apertar(alvo, 'Escape');
    apertar(alvo, 'Enter');
    expect(c.chamadas).toEqual([]);
    desligar();
    apertar(alvo, 'p');
    expect(c.chamadas).toEqual([]);
  });

  it('nao disputa o teclado da ferramenta: R e Esc continuam so do teclado.ts', () => {
    const alvo = new EventTarget();
    const c = controleFalso();
    ligarTeclasDoTempo(c, alvo);
    apertar(alvo, 'r');
    apertar(alvo, 'Escape');
    expect(c.chamadas).toEqual([]);
  });
});

describe('F11a — o texto do aviso: pausado, 2x, e ausente em 1x despausado', () => {
  it('1x despausado: NADA (o aviso some)', () => {
    expect(textoDoAviso(false, 1, rotulos)).toBe('');
  });

  it('pausado: o texto de pausa, que vem do tema', () => {
    expect(textoDoAviso(true, 1, rotulos)).toBe(temaSertao.hud.pausado);
    expect(temaSertao.hud.pausado.length).toBeGreaterThan(0);
  });

  it('2x e 3x despausados: a velocidade, e so ela', () => {
    expect(textoDoAviso(false, 2, rotulos)).toBe('2x');
    expect(textoDoAviso(false, 3, rotulos)).toBe('3x');
  });

  it('pausado a 2x: os dois, para nao esconder a velocidade em que o jogo vai retomar', () => {
    expect(textoDoAviso(true, 2, rotulos)).toBe(`${temaSertao.hud.pausado} · 2x`);
  });

  it('o rotulo de pausa e do tema, nao digitado: outro rotulo muda o texto', () => {
    expect(textoDoAviso(true, 1, { pausado: 'Parado' })).toBe('Parado');
  });
});
