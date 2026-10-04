/**
 * H-ARTE-SONS-APROVADOS — os sons aprovados entram no jogo.
 *
 * (a) todo som do manifesto tem licenca CC0 e o link da pagina (e o validate:data recusa o que nao
 *     tiver); (b) nenhum som sem aprovacao no docs/sons-candidatos.md: a `origem` de cada som e a
 *     escolha do operador na linha dele (o numero do candidato, ou o link que ele escreveu), e os
 *     links aprovados que nao sao CC0 ficaram de fora. O (c), o build levando os sons e o tamanho
 *     deles, e o `npm run build` (test-output/E-ENTREGA-BUILD.json) e o PROGRESS.
 * A licenca dos links novos foi conferida na pagina por tools/baixar-sons.js, que so baixa CC0.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { escolhaDoOperador, lerSonsCandidatos } from '../tools/sons-candidatos.js';
import { validarSom } from '../tools/data-rules.js';
import { EVENTOS_DA_SIM } from '../src/render/eventos-da-sim';
import { urlsDosSons } from '../src/render/som';
import manifesto from '../assets/manifest.json';
import som from '../data/som.json';
import { gravarEvidencia } from './helpers/evidence';

interface SomDoManifesto {
  arquivo: string; base: string; licenca: string; origem: string; aprovado: string;
  duracaoOriginal: number; duracao: number; recorte: unknown;
}
const SONS = Object.fromEntries(
  Object.entries((manifesto as unknown as { sons: Record<string, unknown> }).sons).filter(([id]) => !id.startsWith('_')),
) as Record<string, SomDoManifesto>;
const LINHAS = lerSonsCandidatos(readFileSync('docs/sons-candidatos.md', 'utf8'));
/** Aprovados pelo operador com link que NAO e CC0 (conferido na pagina em 2026-10-03). */
const NAO_CC0 = ['victory', 'music-peace'];
const sha = (arquivo: string): string => createHash('sha256').update(readFileSync(arquivo)).digest('hex');

describe('H-ARTE-SONS-APROVADOS — (a) licenca e link', () => {
  it('ha som no manifesto, e todo ele e CC0, com o link da pagina e o arquivo no disco', () => {
    expect(Object.keys(SONS).length).toBeGreaterThan(0);
    for (const [id, s] of Object.entries(SONS)) {
      expect(s.licenca, id).toBe('CC0 1.0');
      expect(s.origem, id).toMatch(/^https:\/\/(freesound\.org\/people|opengameart\.org\/content)\//);
      expect(s.arquivo, id).toBe(`sons/${id}.mp3`);
      expect(existsSync(`assets/${s.arquivo}`), id).toBe(true);
      expect(existsSync(`assets/${s.base}`), id).toBe(true);
      // o derivado nao e a base: o conferir-dist recusa arquivo de assets/base/ no build
      expect(sha(`assets/${s.arquivo}`), id).not.toBe(sha(`assets/${s.base}`));
    }
  });

  it('o validate:data recusa som do manifesto sem CC0, sem link ou fora de sons/', () => {
    const rodar = (m: unknown): string[] => {
      const erros: string[] = [];
      validarSom(som, erros, { eventosDaSim: EVENTOS_DA_SIM, manifesto: m });
      return erros;
    };
    expect(rodar(manifesto)).toEqual([]);
    const um = SONS['unit-killed'] as SomDoManifesto;
    expect(rodar({ sons: { 'unit-killed': { ...um, licenca: 'CC-BY 4.0' } } })).toEqual(["interface/som: manifesto, som 'unit-killed': licenca precisa ser CC0"]);
    expect(rodar({ sons: { 'unit-killed': { ...um, origem: 'sons do meu HD' } } }))
      .toEqual(["interface/som: manifesto, som 'unit-killed': origem precisa ser o link da pagina do som (Freesound ou OpenGameArt)"]);
    expect(rodar({ sons: { 'unit-killed': { ...um, arquivo: 'base/sons/unit-killed/original.mp3' } } }))
      .toEqual(["interface/som: manifesto, som 'unit-killed': arquivo precisa ser sons/<id>.mp3"]);
  });
});

describe('H-ARTE-SONS-APROVADOS — (b) so o que o operador aprovou', () => {
  it('a origem de cada som e a escolha do operador na linha dele', () => {
    for (const [id, s] of Object.entries(SONS)) {
      const linha = LINHAS.find((l) => l.id === id);
      expect(linha, id).toBeDefined();
      const escolha = escolhaDoOperador(linha!);
      expect(escolha !== null && typeof escolha === 'object', `${id}: sem aprovacao (${String(escolha)})`).toBe(true);
      expect((escolha as { url: string }).url, id).toBe(s.origem);
      expect(s.aprovado, id).toBe(linha!.aprovado.trim());
    }
  });

  it('linha sem aprovacao e link que nao e CC0 ficam em silencio: fora do manifesto e sem URL', () => {
    const semAprovacao = LINHAS.filter((l) => escolhaDoOperador(l) === null).map((l) => l.id);
    expect(semAprovacao).toEqual(['building-hit', 'peace-ended', 'command-rejected']);
    for (const id of [...semAprovacao, ...NAO_CC0]) expect(SONS[id], id).toBeUndefined();
    const aprovadas = LINHAS.filter((l) => { const e = escolhaDoOperador(l); return e !== null && typeof e === 'object'; }).map((l) => l.id);
    expect(aprovadas.length).toBe(17);
    expect(Object.keys(SONS).sort()).toEqual(aprovadas.filter((id) => !NAO_CC0.includes(id)).sort());
    // o caminho do jogo: o id sem arquivo nao ganha URL (silencio)
    const urls = urlsDosSons(SONS, Object.fromEntries(Object.values(SONS).map((s) => [s.arquivo, `/x/${s.arquivo}`])));
    expect(Object.keys(urls).sort()).toEqual(Object.keys(SONS).sort());
    gravarEvidencia('H-ARTE-SONS-APROVADOS', {
      noManifesto: Object.keys(SONS),
      silencio: { semAprovacao, naoCC0: NAO_CC0 },
      bytes: Object.fromEntries(Object.values(SONS).map((s) => [s.arquivo, readFileSync(`assets/${s.arquivo}`).length])),
      recortes: Object.fromEntries(Object.entries(SONS).map(([id, s]) => [id, `${s.duracaoOriginal} s -> ${s.duracao} s`])),
    });
  });
});
