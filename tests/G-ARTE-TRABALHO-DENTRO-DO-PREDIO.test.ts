/**
 * G-ARTE-TRABALHO-DENTRO-DO-PREDIO — o trabalhador aparece trabalhando no espaco da casa.
 *
 * Os 13 predios dos casos `transforma` e `dentro` tem a entrada `trabalho` no manifesto, com os lacos
 * do caso; os quadros tem o tamanho da `ancoras.trabalho.area` do predio (o render estica o quadro
 * para a area, e quadro de outra proporcao deforma o boneco); cada quadro tem gente; e o personagem
 * que a origem registra e o trabalhador do predio em `data/buildings.json`.
 * G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS: mais as 3 minas (mineiro) e o chiqueiro e o estabulo (criador), 18 no total.
 * G-ARTE-TRABALHADOR-RECORTADO: o boneco na escala 1 (a da rua), recortado pela area quando nao cabe.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { EntradaDeAsset, EntradaDeCamada, Manifesto } from '../src/render/manifesto';
import { ehEntradaDePredio } from '../src/render/manifesto';
import { CASO_DO_PREDIO, LACOS_DO_CASO, violacoesDaCamadaViva } from '../src/render/manifesto-camadas';
import { contextoDasCamadas, dadosDoTrabalho } from '../src/render/predios';
import { quadroDeTrabalho } from '../src/render/trabalho';
import type { GameState } from '../src/sim/state';
import { salvar } from '../src/sim/save';
import { avancar, cenarioDaCadeiaDaCarne, cenarioDaCadeiaDoOuro } from './helpers/producao-cenario';
import { lerPng, caixaOpaca } from './helpers/png';
import { gravarEvidencia } from './helpers/evidence';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const predios = (JSON.parse(readFileSync('data/buildings.json', 'utf8')) as { predios: { id: string; trabalhador: string | null }[] }).predios;
const trabalhadorDo = new Map(predios.map((p) => [p.id, p.trabalhador]));
// G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS: os casos `luz` (as minas) e `criacao` (chiqueiro e estabulo) entraram; fica de fora
// so o `guarda`, cujo trabalho e no campo, fora da casa
const comTrabalho = Object.entries(CASO_DO_PREDIO).filter(([, caso]) => caso !== 'guarda').map(([id]) => id);

const camadaDe = (id: string): EntradaDeCamada | undefined =>
  manifesto.assets.find((e): e is EntradaDeCamada => !ehEntradaDePredio(e) && e.tipo === 'trabalho' && e.id === id);
const predioDe = (id: string): EntradaDeAsset =>
  manifesto.assets.find((e): e is EntradaDeAsset => ehEntradaDePredio(e) && e.id === id)!;

describe('G-ARTE-TRABALHO-DENTRO-DO-PREDIO', () => {
  it('sao os 13 predios do pedido, mais as 3 minas e os 2 currais', () => {
    expect(comTrabalho).toHaveLength(18);
  });

  const medidas: Record<string, unknown> = {};
  it.each(comTrabalho)('%s: a entrada trabalho passa no validador, com os lacos do caso', (id) => {
    const e = camadaDe(id);
    expect(e, id).toBeDefined();
    expect(violacoesDaCamadaViva(e!, contextoDasCamadas)).toEqual([]);
    const esperados = Object.entries(LACOS_DO_CASO[CASO_DO_PREDIO[id]!]!).flatMap(([laco, n]) =>
      Array.from({ length: n }, (_, i) => `${laco}_${i + 1}`));
    expect(Object.keys(e!.estados).sort()).toEqual(esperados.sort());
  });

  it.each(comTrabalho)('%s: cada quadro tem o tamanho da area e tem gente', (id) => {
    const e = camadaDe(id)!;
    const p = predioDe(id);
    const [x0, y0, x1, y1] = p.ancoras!.trabalho!.area!;
    const [W, H] = p.tamanho;
    expect(e.tamanho).toEqual([Math.round((x1 - x0) * W), Math.round((y1 - y0) * H)]);
    const caixas = Object.values(e.estados).map((arq) => {
      const img = lerPng(`assets/${arq}`);
      expect([img.largura, img.altura], arq).toEqual(e.tamanho);
      const c = caixaOpaca(img, { x: 0, y: 0, w: img.largura, h: img.altura });
      expect(c, arq).not.toBeNull();
      return c!;
    });
    medidas[id] = { area: e.tamanho, alturaDoBoneco: Math.max(...caixas.map((c) => c.y1 - c.y0)) };
    gravarEvidencia('G-ARTE-TRABALHO-DENTRO-DO-PREDIO', { medidas });
  });

  it.each(comTrabalho)('%s: o boneco e o trabalhador do predio em buildings.json', (id) => {
    const nota = (camadaDe(id)!.origem as { nota?: string }).nota ?? '';
    const personagem = /personagem (\w+) \(/.exec(nota)?.[1];
    expect(personagem).toBe(trabalhadorDo.get(id));
  });
});

describe('G-ARTE-TRABALHADOR-RECORTADO — na escala da rua, recortado pela area', () => {
  /** A altura do serf no `parado` sul, a regua da rua (G-ARTE-OBREIRO-MAIOR a afirma): area mais baixa
   *  que ela nao cabe o boneco inteiro na escala 1, e o recorte tem de aparecer. */
  const ALTURA_DO_BONECO = 74;

  it.each(comTrabalho)('%s: a origem registra escala 1', (id) => {
    expect((camadaDe(id)!.origem as { escala?: number }).escala).toBe(1);
  });

  it.each(comTrabalho)('%s: area mais baixa que o boneco -> o corte encosta na borda de baixo e a cabeca no topo', (id) => {
    const e = camadaDe(id)!;
    if (e.tamanho[1] >= ALTURA_DO_BONECO) return;
    let cabeca = Infinity;
    for (const arq of Object.values(e.estados)) {
      const img = lerPng(`assets/${arq}`);
      const c = caixaOpaca(img, { x: 0, y: 0, w: img.largura, h: img.altura })!;
      expect(c.y1, `${arq}: o boneco flutua acima da borda de baixo`).toBe(img.altura - 1);
      cabeca = Math.min(cabeca, c.y0);
    }
    expect(cabeca, 'o alto da cabeca, no quadro mais alto, longe do topo').toBeLessThanOrEqual(3);
  });
});

describe('G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS — os saves que o roteiro carrega', () => {
  // A tela nao constroi a cadeia pela abertura; o roteiro carrega estes estados pelo gesto do jogador (a gaveta):
  // a cadeia do ouro (a mina) e a da carne (o chiqueiro), andadas ate o predio publicar um quadro de trabalho.
  const dadosDaTela = dadosDoTrabalho(manifesto);
  const casos = [
    { tipo: 'gold_mine', cenario: () => cenarioDaCadeiaDoOuro() },
    { tipo: 'swine_farm', cenario: () => cenarioDaCadeiaDaCarne() },
  ] as const;
  it.each(casos)('$tipo trabalha, e o save vai para o roteiro', ({ tipo, cenario }) => {
    let s: GameState = cenario();
    const trabalhando = (e: GameState): boolean => e.predios.ordem.some((id) => {
      const p = e.predios.porId[id]!;
      if (p.tipo !== tipo || p.estado !== 'completo' || p.ocupante === null) return false;
      return quadroDeTrabalho(p, e.unidades.porId[p.ocupante] ?? null, e.tick, dadosDaTela) !== null;
    });
    while (!trabalhando(s) && s.tick < 20000) s = avancar(s, 25);
    expect(trabalhando(s), `${tipo} nao trabalhou em 20 000 ticks`).toBe(true);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS-${tipo}.save.txt`, salvar(s));
  }, 60000);
});
