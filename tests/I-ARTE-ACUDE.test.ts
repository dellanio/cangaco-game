import { describe, expect, it } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import manifesto from '../assets/manifest.json';
import config from '../data/acude-arte.json';
import { createInitialState, completarObra, LADO_DO_JOGADOR } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { caixaDeTipo } from '../src/sim/footprint';
import { revelacaoDaObra } from '../src/render/estagio-obra';
import { salvar } from '../src/sim/save';
import { gravarEvidencia } from './helpers/evidence';
const require = createRequire(import.meta.url);
interface Png { width: number; height: number; data: Uint8Array }
const { decodePng } = require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as { decodePng: (b: Uint8Array) => Png };
const entrada = manifesto.assets.find(a => a.id === 'reservoir')!;
const estados = entrada.estados as Readonly<Record<string, string>>;
const png = (s: string): Png => decodePng(readFileSync(`assets/${estados[s]}`));
function pe(p: Png): number {
  for (let y = p.height - 1; y >= 0; y--) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3]! > 0) return y;
  return -1;
}
function agua(p: Png): number {
  let n = 0;
  for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]! >= 128 && p.data[i + 2]! - p.data[i]! >= config.detectorDeAgua.azulMenosVermelhoMinimo && p.data[i + 1]! - p.data[i]! >= config.detectorDeAgua.verdeMenosVermelhoMinimo) n++;
  return n;
}
describe('I-ARTE-ACUDE', () => {
  it('contrato e cinco estados têm base, derivado, mesmo canvas, alfa e pé', () => {
    expect(entrada.tipo).toBe('predio'); expect(entrada.footprint).toEqual([4, 3]); expect(entrada.anchor).toEqual(config.anchor);
    expect(Object.keys(estados).sort()).toEqual([...config.estados, 'completo'].sort());
    // BUG-ACUDE-COM-AGUA-NA-OBRA (2026-10-16): o `completo` so serve a obra (o pronto escolhe pelo nivel de agua), e a
    // obra sobe seca: a agua so aparece quando a sim enche o acude
    expect(estados['completo']).toBe(estados['vazio']);
    expect(entrada.origem.base).toBe('base/reservoir/cheio-master-2x.png');
    expect(entrada.licenca).toContain('original');
    const cheio = png('cheio');
    for (const s of config.estados) {
      const p = png(s), master = decodePng(readFileSync(`assets/base/reservoir/${s}-master-2x.png`));
      expect([p.width, p.height]).toEqual(entrada.tamanho);
      expect([master.width, master.height]).toEqual(config.derivados[0]!.canvas);
      expect(pe(p), s).toBe(pe(cheio));
      expect(p.data.filter((_, i) => i % 4 === 3), `${s}: alfa canônico`).toEqual(cheio.data.filter((_, i) => i % 4 === 3));
    }
    expect(pe(cheio)).toBe(cheio.height - config.derivados[1]!.margemInferior - 1);
  });
  it('o espelho de água aumenta estritamente, vazio e obra são secos', () => {
    const areas = ['vazio', 'baixo', 'medio', 'cheio'].map(s => agua(png(s)));
    expect(areas[0]).toBe(0); expect(agua(png('madeira'))).toBe(0);
    for (let i = 1; i < areas.length; i++) expect(areas[i]).toBeGreaterThan(areas[i - 1]!);
    gravarEvidencia('I-ARTE-ACUDE', { areas, pe: pe(png('cheio')), tamanho: entrada.tamanho, estados: Object.keys(estados) });
  });
  it('grava cinco cenários válidos para o roteiro, sem modificar o GameState do jogo', () => {
    const inicial = createInitialState(1);
    const vila = gameData.economia.estadoInicial.predios.find(p => p.id === 'storehouse')!;
    const base = { ...inicial, tiposJaConstruidos: [...inicial.tiposJaConstruidos, 'quarry'] };
    let local: { gx: number; gy: number } | undefined;
    for (let r = 1; r <= 20 && local === undefined; r++) for (let dy = -r; dy <= r && local === undefined; dy++) for (let dx = -r; dx <= r; dx++) {
      const gx = vila.gx + dx, gy = vila.gy + dy;
      const caixa = caixaDeTipo('reservoir', gx, gy, gameData);
      if (caixa === null) continue;
      let livre = true;
      for (let y = caixa.y0; y < caixa.y1; y++) for (let x = caixa.x0; x < caixa.x1; x++) if (base.recursos[`${x},${y}`] !== undefined) livre = false;
      if (livre && canPlace(base, 'reservoir', gx, gy).ok) { local = { gx, gy }; break; }
    }
    expect(local).toBeDefined();
    if (local === undefined) throw new Error('sem lote legal para o Açude');
    const def = gameData.predios.find(p => p.id === 'reservoir')!;
    const niveis: Readonly<Record<string, number>> = { vazio: 0, baixo: 0.25, medio: 0.6, cheio: 1, madeira: 0 };
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output'; mkdirSync(dir, { recursive: true });
    for (const s of config.estados) {
      const obra = { id: 'acude-arte', tipo: 'reservoir', ...local, lado: LADO_DO_JOGADOR, estado: 'obra' as const, hp: 1, obra: { faltam: { stone: def.stone, timber: def.timber }, nivelamento: 0 } };
      const hpDaMadeira = Math.round(def.hp * def.timber / (def.timber + def.stone));
      const p = s === 'madeira' ? { ...obra, hp: hpDaMadeira, obra: { ...obra.obra, faltam: {} } } : { ...completarObra(obra, gameData), agua: Math.round(gameData.acude.capacidade * niveis[s]!) };
      if (s === 'madeira') {
        const revelacao = revelacaoDaObra(p.hp, def.hp, def.timber, def.stone)!;
        expect(revelacao.madeira[0]).toBe(revelacao.madeira[1]); expect(revelacao.pedra[0]).toBe(0);
      }
      const state = { ...base, predios: { ordem: [...base.predios.ordem, p.id], porId: { ...base.predios.porId, [p.id]: p } } };
      writeFileSync(`${dir}/I-ARTE-ACUDE-${s}.save.txt`, salvar(state));
    }
    // BUG-ACUDE-COM-AGUA-NA-OBRA: a obra no meio da pedra (a madeira inteira e metade da pedra), o momento em que o
    // operador viu agua na obra; o roteiro afirma que ela sobe seca
    const hpNaPedra = Math.round(def.hp * (def.timber + def.stone / 2) / (def.timber + def.stone));
    const naPedra = { id: 'acude-arte', tipo: 'reservoir', ...local, lado: LADO_DO_JOGADOR, estado: 'obra' as const, hp: hpNaPedra, obra: { faltam: {}, nivelamento: 0 } };
    const revelacao = revelacaoDaObra(naPedra.hp, def.hp, def.timber, def.stone)!;
    expect(revelacao.pedra[0]).toBeGreaterThan(0);
    expect(revelacao.pedra[0]).toBeLessThan(revelacao.pedra[1]);
    writeFileSync(`${dir}/I-ARTE-ACUDE-obra-na-pedra.save.txt`, salvar({ ...base, predios: { ordem: [...base.predios.ordem, naPedra.id], porId: { ...base.predios.porId, [naPedra.id]: naPedra } } }));
  });
});
