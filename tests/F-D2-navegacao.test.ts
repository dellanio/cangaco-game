// F-D2 — a navegacao da camera pelo teclado.
//
// O que se prova aqui e a aritmetica e o estado; o que a camera FAZ com eles e
// do roteiro (`npm run shot -- F-D2`), porque camera e Phaser e Phaser nao roda
// headless. A divisao e a mesma da F-D1: a parte pura fica sob teste, e o
// roteiro so precisa afirmar que a cena consome direito.
import { describe, expect, it } from 'vitest';
import {
  ligarNavegacao, proximaVelocidade, teclasDeDirecao, direcaoDaTecla,
} from '../src/input/navegacao';
import type { DadosDaCamera } from '../src/input/navegacao';
import { ATALHOS, atalhoDeId } from '../src/input/atalhos';
import { gameData } from '../src/sim/data';
import { configDoMapa } from '../src/render/mapa';
import { gravarEvidencia } from './helpers/evidence';

const dados: DadosDaCamera = gameData.terreno.camera;

function apertar(alvo: EventTarget, key: string, extra: Record<string, boolean> = {}): boolean {
  const evento = Object.assign(new Event('keydown', { cancelable: true }), { key, ...extra });
  alvo.dispatchEvent(evento);
  return evento.defaultPrevented;
}

function soltar(alvo: EventTarget, key: string): void {
  alvo.dispatchEvent(Object.assign(new Event('keyup'), { key }));
}

describe('F-D2 — o dado manda, e nenhum numero mora no .ts', () => {
  it('a navegacao usa os numeros de data/terrain.json, nao os proprios', () => {
    // Igualdade por importacao, nao por leitura de texto: se alguem digitar 640
    // dentro de navegacao.ts e mudar o JSON, e aqui que quebra.
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    expect(nav.velocidade).toBe(gameData.terreno.camera.velocidadeInicialPxPorSegundo);
    nav.desligar();
  });

  it('o funil de render entrega o mesmo bloco que o carregador leu', () => {
    // `render/mapa.ts` e o unico arquivo de render/ que le sim/data (F04).
    expect(configDoMapa.camera).toEqual({
      velocidadeInicialPxPorSegundo: gameData.terreno.camera.velocidadeInicialPxPorSegundo,
      aceleracaoPxPorSegundo2: gameData.terreno.camera.aceleracaoPxPorSegundo2,
      tetoPxPorSegundo: gameData.terreno.camera.tetoPxPorSegundo,
    });
  });

  it('segurar acelera, e para no teto do dado', () => {
    let v = dados.velocidadeInicialPxPorSegundo;
    const antes = v;
    v = proximaVelocidade(v, 100, true, dados);
    expect(v, 'um quadro de 100ms deveria acelerar').toBeGreaterThan(antes);
    // Tempo longo o bastante para estourar qualquer teto plausivel.
    for (let i = 0; i < 200; i += 1) v = proximaVelocidade(v, 100, true, dados);
    expect(v).toBe(dados.tetoPxPorSegundo);
  });

  it('soltar volta ao passo inicial, sem desacelerar aos poucos', () => {
    let v = dados.tetoPxPorSegundo;
    v = proximaVelocidade(v, 16, false, dados);
    expect(v).toBe(dados.velocidadeInicialPxPorSegundo);
  });
});

describe('F-D2 — a direcao de cada tecla', () => {
  it('as teclas do inventario e as da tabela de direcoes sao a MESMA lista', () => {
    // O elo que a F-D1 exige: tecla anunciada na tela de ajuda que nao move
    // nada e exatamente o que aquela feature existe para impedir. Nao e busca
    // de texto no fonte: sao as duas listas, comparadas.
    const atalho = atalhoDeId('camera-mover');
    expect(atalho).toBeDefined();
    const noInventario = (atalho?.teclas ?? []).map((t) => t.toLowerCase()).sort();
    expect(teclasDeDirecao().map((t) => t.toLowerCase()).sort()).toEqual(noInventario);
  });

  it('WASD e sinonimo das setas, e nao um segundo esquema', () => {
    expect(direcaoDaTecla('w')).toEqual(direcaoDaTecla('ArrowUp'));
    expect(direcaoDaTecla('a')).toEqual(direcaoDaTecla('ArrowLeft'));
    expect(direcaoDaTecla('s')).toEqual(direcaoDaTecla('ArrowDown'));
    expect(direcaoDaTecla('d')).toEqual(direcaoDaTecla('ArrowRight'));
  });

  it('cada seta anda para o lado dela, e o Y cresce para baixo como na tela', () => {
    expect(direcaoDaTecla('ArrowUp')).toEqual({ x: 0, y: -1 });
    expect(direcaoDaTecla('ArrowDown')).toEqual({ x: 0, y: 1 });
    expect(direcaoDaTecla('ArrowLeft')).toEqual({ x: -1, y: 0 });
    expect(direcaoDaTecla('ArrowRight')).toEqual({ x: 1, y: 0 });
  });
});

describe('F-D2 — o ouvinte', () => {
  it('uma seta segurada move naquela direcao, e soltar para', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);

    expect(nav.avancar(100)).toEqual({ dx: 0, dy: 0 });
    apertar(alvo, 'ArrowRight');
    const passo = nav.avancar(100);
    expect(passo.dx).toBeGreaterThan(0);
    expect(passo.dy).toBe(0);

    soltar(alvo, 'ArrowRight');
    expect(nav.avancar(100)).toEqual({ dx: 0, dy: 0 });
    nav.desligar();
  });

  it('duas setas fazem diagonal, e a diagonal nao anda mais rapido que a reta', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    apertar(alvo, 'ArrowRight');
    apertar(alvo, 'ArrowDown');
    const passo = nav.avancar(100);
    const modulo = Math.hypot(passo.dx, passo.dy);

    // A linha de base e uma RETA medida nas mesmas condicoes, e nao a
    // velocidade inicial do dado: o proprio quadro acelera antes de andar, e
    // comparar com o numero de antes do quadro reprovaria por engano.
    const outro = new EventTarget();
    const emLinhaReta = ligarNavegacao(outro, dados);
    apertar(outro, 'ArrowRight');
    const referencia = Math.hypot(...Object.values(emLinhaReta.avancar(100)));
    emLinhaReta.desligar();

    expect(modulo).toBeCloseTo(referencia, 6);
    expect(passo.dx).toBeGreaterThan(0);
    expect(passo.dy).toBeGreaterThan(0);
    nav.desligar();
  });

  it('esquerda e direita ao mesmo tempo se cancelam', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    apertar(alvo, 'ArrowLeft');
    apertar(alvo, 'ArrowRight');
    expect(nav.direcao).toEqual({ x: 0, y: 0 });
    expect(nav.avancar(100)).toEqual({ dx: 0, dy: 0 });
    nav.desligar();
  });

  it('segurar por varios quadros anda mais que o mesmo tempo em toques curtos', () => {
    const alvo = new EventTarget();
    const segurando = ligarNavegacao(alvo, dados);
    apertar(alvo, 'ArrowRight');
    let longe = 0;
    for (let i = 0; i < 30; i += 1) longe += segurando.avancar(16).dx;
    segurando.desligar();

    const outro = new EventTarget();
    const batidinhas = ligarNavegacao(outro, dados);
    let perto = 0;
    for (let i = 0; i < 30; i += 1) {
      apertar(outro, 'ArrowRight');
      perto += batidinhas.avancar(16).dx;
      soltar(outro, 'ArrowRight');
      // O quadro parado entre um toque e outro e o que zera a velocidade. Sem
      // ele os toques seriam indistinguiveis de segurar, e foi o que o teste
      // acusou na primeira rodada: 414,336 px dos dois lados.
      batidinhas.avancar(16);
    }
    batidinhas.desligar();

    expect(longe).toBeGreaterThan(perto);
  });

  it('Ctrl+seta e do navegador: nao move e nao engole a tecla', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    expect(apertar(alvo, 'ArrowRight', { ctrlKey: true })).toBe(false);
    expect(nav.direcao).toEqual({ x: 0, y: 0 });
    nav.desligar();
  });

  it('seta e Espaco chamam preventDefault: senao a pagina rola junto', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    for (const tecla of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']) {
      expect(apertar(alvo, tecla), `a tecla "${tecla}" deixou o navegador agir`).toBe(true);
    }
    nav.desligar();
  });

  it('o Espaco e um estado segurado, nao um gatilho', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    expect(nav.espacoApertado).toBe(false);
    apertar(alvo, ' ');
    expect(nav.espacoApertado).toBe(true);
    soltar(alvo, ' ');
    expect(nav.espacoApertado).toBe(false);
    nav.desligar();
  });

  it('perder o foco solta tudo: senao a camera corre sozinha em outra janela', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    apertar(alvo, 'ArrowRight');
    apertar(alvo, ' ');
    alvo.dispatchEvent(new Event('blur'));
    expect(nav.direcao).toEqual({ x: 0, y: 0 });
    expect(nav.espacoApertado).toBe(false);
    expect(nav.velocidade).toBe(dados.velocidadeInicialPxPorSegundo);
    nav.desligar();
  });

  it('desligar remove os ouvintes', () => {
    const alvo = new EventTarget();
    const nav = ligarNavegacao(alvo, dados);
    nav.desligar();
    apertar(alvo, 'ArrowRight');
    expect(nav.direcao).toEqual({ x: 0, y: 0 });
  });
});

gravarEvidencia('F-D2-navegacao', {
  dados,
  teclasDeDirecao: teclasDeDirecao(),
  atalhosDeCamera: ATALHOS.filter((a) => a.grupo === 'camera').map(
    (a) => ({ id: a.id, teclas: a.teclas }),
  ),
});
