/**
 * BUG-SOM-BAIXA-A-CADA-TOQUE — o som curto busca e decodifica cada arquivo UMA vez, e cada toque e uma
 * fonte sobre o buffer pronto (aceite 1, por tabela, com o fetch e o AudioContext falsos).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { criarLacos, criarTocadorDeBuffers } from '../src/render/tocador-de-som';
import type { ContextoDeAudio } from '../src/render/tocador-de-som';

function falso(estado = 'running') {
  const registro = { buscas: [] as string[], decodificacoes: 0, fontes: [] as number[], resumes: 0 };
  const ctx: ContextoDeAudio & { state: string } = {
    state: estado,
    destination: {},
    resume: async () => { registro.resumes++; },
    decodeAudioData: async () => { registro.decodificacoes++; return { buffer: true }; },
    createBufferSource: () => ({ buffer: null, connect: () => undefined, start: () => undefined }),
    createGain: () => {
      const g = { gain: { value: 1 }, connect: () => { registro.fontes.push(g.gain.value); return undefined; } };
      return g;
    },
  };
  const buscar = async (url: string) => { registro.buscas.push(url); return { arrayBuffer: async () => new ArrayBuffer(4) }; };
  return { registro, ctx, buscar };
}
const esperarPromessas = () => new Promise((r) => setTimeout(r, 0));

describe('BUG-SOM-BAIXA-A-CADA-TOQUE', () => {
  it('N toques do mesmo id: 1 busca e 1 decodificacao; cada toque (com o buffer pronto) e uma fonte com o volume', async () => {
    const { registro, ctx, buscar } = falso();
    const tocador = criarTocadorDeBuffers({ a: '/sons/a.mp3', b: '/sons/b.mp3' }, () => ctx, buscar);
    tocador.tocar('a', 0.5); // o primeiro so pede o arquivo: silencio ate o buffer chegar
    await esperarPromessas();
    for (let i = 0; i < 50; i++) tocador.tocar('a', 0.7);
    tocador.tocar('a', 3); // o volume fica entre 0 e 1
    tocador.tocar('b', 0.2);
    await esperarPromessas();
    tocador.tocar('b', 0.2);
    expect(registro.buscas).toEqual(['/sons/a.mp3', '/sons/b.mp3']);
    expect(registro.decodificacoes).toBe(2);
    expect(registro.fontes).toEqual([...Array(50).fill(0.7), 1, 0.2]);
  });

  it('id sem URL nao busca nada; contexto suspenso e silencio, tenta resume() e nao toca', async () => {
    const { registro, ctx, buscar } = falso('suspended');
    const tocador = criarTocadorDeBuffers({ a: '/sons/a.mp3' }, () => ctx, buscar);
    tocador.tocar('sem-arquivo', 1);
    expect(registro.buscas).toEqual([]);
    tocador.tocar('a', 1);
    await esperarPromessas();
    tocador.tocar('a', 1);
    expect(registro.resumes).toBe(2);
    expect(registro.fontes).toEqual([]);
    // sem Web Audio no navegador: silencio
    const semContexto = criarTocadorDeBuffers({ a: '/sons/a.mp3' }, () => null, buscar);
    expect(() => semContexto.tocar('a', 1)).not.toThrow();
  });

  it('o laco que para e volta reusa o MESMO elemento (nao cria outro, que buscaria o arquivo de novo)', () => {
    const criados: string[] = [];
    const plays: string[] = [];
    let relogio = 0;
    const lacos = criarLacos((url) => {
      criados.push(url);
      const a = { loop: false, volume: 1, currentTime: 0, paused: true, addEventListener: () => undefined, play: async () => { plays.push(url); a.paused = false; }, pause: () => { a.paused = true; } };
      return a;
    }, () => relogio);
    for (let i = 0; i < 10; i++) {
      lacos.tocar('quarry-work:0', '/sons/quarry-work.mp3', 0.5);
      relogio += 100;
      lacos.parar('quarry-work:0');
    }
    lacos.tocar('quarry-work:1', '/sons/quarry-work.mp3', 0.5);
    expect(criados).toEqual(['/sons/quarry-work.mp3', '/sons/quarry-work.mp3']);
    // cada volta toca de novo, na hora (sem esperar o segundo da nova tentativa)
    expect(plays).toHaveLength(11);
  });

  it('o tocador do jogo nao clona mais Audio por toque, e a pagina declara o icone (sem /favicon.ico)', () => {
    const fonte = readFileSync('src/render/tocador-de-som.ts', 'utf8');
    const doJogo = fonte.slice(fonte.indexOf('export function criarTocadorDoNavegador'), fonte.indexOf('export function criarTocadorDeLacoDoNavegador'));
    expect(doJogo).toContain('criarTocadorDeBuffers');
    expect(doJogo).not.toContain('cloneNode');
    expect(readFileSync('index.html', 'utf8')).toMatch(/<link rel="icon"/);
  });
});
