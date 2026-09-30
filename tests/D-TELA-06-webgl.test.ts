/**
 * D-TELA-06 — o jogo exige WebGL (decisão do operador, 2026-10-01).
 *
 * O portão `render/webgl.ts` pergunta por um contexto 'webgl' num canvas temporário ANTES
 * de o jogo carregar. Aqui roda com um documento falso: sem WebGL o jogo não carrega e a
 * mensagem aparece; com WebGL carrega e não há mensagem. O caminho no navegador de verdade —
 * o index entrando pelo portão e o renderizador ativo ser `Phaser.WEBGL` — é o roteiro
 * `tools/shots/D-TELA-06.js`, que lê `game.renderer.type` rodando, não o fonte.
 */
import { describe, it, expect } from 'vitest';
import { iniciarSeHouverWebgl, MENSAGEM_SEM_WEBGL, suportaWebgl } from '../src/render/webgl';
import type { DocumentoDoPortao } from '../src/render/webgl';
import { gravarEvidencia } from './helpers/evidence';

interface NoFalso { id: string; className: string; textContent: string | null; atributos: Record<string, string> }

function documentoFalso(contexto: () => unknown): { doc: DocumentoDoPortao; corpo: NoFalso[] } {
  const corpo: NoFalso[] = [];
  const doc = {
    createElement(tag: string) {
      if (tag === 'canvas') return { getContext: () => contexto() };
      const no: NoFalso & { setAttribute(n: string, v: string): void } = {
        id: '', className: '', textContent: null, atributos: {},
        setAttribute(n: string, v: string) { this.atributos[n] = v; },
      };
      return no;
    },
    body: { append: (no: unknown) => { corpo.push(no as NoFalso); } },
  } as unknown as DocumentoDoPortao;
  return { doc, corpo };
}

const evidencia: Record<string, unknown> = {};

describe('D-TELA-06 — o portão do WebGL', () => {
  it('sem WebGL (getContext devolve null): o jogo não inicia e a mensagem aparece', async () => {
    const { doc, corpo } = documentoFalso(() => null);
    let carregou = false;
    const iniciou = await iniciarSeHouverWebgl(doc, async () => { carregou = true; });
    expect(iniciou).toBe(false);
    expect(carregou).toBe(false);
    expect(corpo).toHaveLength(1);
    expect(corpo[0]?.id).toBe('sem-webgl');
    expect(corpo[0]?.textContent).toBe('Este jogo precisa de WebGL; ative a aceleração de hardware do navegador');
    expect(corpo[0]?.atributos['role']).toBe('alert');
    evidencia['semWebgl'] = { iniciou, carregou, mensagem: corpo[0]?.textContent };
  });

  it('getContext que lança conta como sem WebGL', async () => {
    const { doc, corpo } = documentoFalso(() => { throw new Error('bloqueado'); });
    expect(suportaWebgl(doc)).toBe(false);
    let carregou = false;
    expect(await iniciarSeHouverWebgl(doc, async () => { carregou = true; })).toBe(false);
    expect(carregou).toBe(false);
    expect(corpo[0]?.textContent).toBe(MENSAGEM_SEM_WEBGL);
  });

  it('com WebGL: carrega o jogo e não escreve mensagem', async () => {
    const { doc, corpo } = documentoFalso(() => ({}));
    let carregou = false;
    expect(await iniciarSeHouverWebgl(doc, async () => { carregou = true; })).toBe(true);
    expect(carregou).toBe(true);
    expect(corpo).toHaveLength(0);
    evidencia['comWebgl'] = { carregou };
    gravarEvidencia('D-TELA-06', evidencia);
  });

});
