/**
 * I-TELA-ACUDE-NA-TELA — o Acude e a irrigacao na tela: a regra pura "nivel -> estado do sprite" e o
 * validador de `data/acude-visual.json`; e a partida do roteiro (a fazenda de um tile com um Acude cheio no
 * raio, e a Pedreira ja construida para a planta do Acude ficar liberada).
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { completarObra, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { canPlace } from '../src/sim/placement';
import { acudeDaFazenda } from '../src/sim/acude';
import { salvar } from '../src/sim/save';
import { estadoDoAcude } from '../src/render/acude-visual';
import type { ConfigDoAcudeVisual } from '../src/render/acude-visual';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { validarInterface } from '../tools/data-rules.js';
import { cenarioDeFazendaDeUmTile } from './helpers/producao-cenario';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/acude-visual.json', 'utf8')) as ConfigDoAcudeVisual;
const CAP = gameData.acude.capacidade;

describe('I-TELA-ACUDE-NA-TELA', () => {
  it('(1) o nivel escolhe o estado do sprite, por tabela, nos cortes do dado', () => {
    const c = config.cortes;
    const casos: [number, string][] = [
      [0, 'vazio'],
      [Math.ceil(c.baixo * CAP), 'baixo'],
      [Math.ceil(c.medio * CAP) - 1, 'baixo'],
      [Math.ceil(c.medio * CAP), 'medio'],
      [Math.ceil(c.cheio * CAP) - 1, 'medio'],
      [Math.ceil(c.cheio * CAP), 'cheio'],
      [CAP, 'cheio'],
    ];
    for (const [agua, esperado] of casos) expect(estadoDoAcude(agua, CAP, config), `agua ${agua}`).toBe(esperado);
    // monotonico: mais agua nunca da estado de menos
    const ordem = ['vazio', 'baixo', 'medio', 'cheio'];
    let anterior = 0;
    for (let a = 0; a <= CAP; a++) {
      const i = ordem.indexOf(estadoDoAcude(a, CAP, config));
      expect(i).toBeGreaterThanOrEqual(anterior);
      anterior = i;
    }
  });

  it('o validador recusa cortes fora de ordem', () => {
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((nome) => [nome, JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'))]));
    const dados = ler(ARQUIVOS), interfaceUi = ler(ARQUIVOS_DA_INTERFACE);
    expect(validarInterface(dados, interfaceUi)).toEqual([]);
    expect(validarInterface(dados, { ...interfaceUi, 'acude-visual': { ...config, cortes: { baixo: 0.5, medio: 0.3, cheio: 0.9 } } }))
      .toContain('interface/acude-visual: cortes precisam ser 0 < baixo < medio < cheio <= 1');
  });

  it('grava a partida do roteiro: a fazenda de um tile, o Acude cheio no raio dela, a Pedreira construida', () => {
    let s: GameState = cenarioDeFazendaDeUmTile();
    s = { ...s, tiposJaConstruidos: [...s.tiposJaConstruidos, 'quarry'] };
    const f1 = s.predios.porId['f1'] as PredioCompleto;
    let lugar: { gx: number; gy: number; d: number } | null = null;
    for (let gy = f1.gy - 10; gy <= f1.gy + 10; gy++) for (let gx = f1.gx - 10; gx <= f1.gx + 10; gx++) {
      const d = Math.hypot(gx - f1.gx, gy - f1.gy);
      if (d <= gameData.acude.raio_tiles - 1 && canPlace(s, 'reservoir', gx, gy).ok && (lugar === null || d < lugar.d)) lugar = { gx, gy, d };
    }
    expect(lugar).not.toBeNull();
    const def = gameData.predios.find((p) => p.id === 'reservoir')!;
    const a1 = { ...completarObra({ lado: LADO_DO_JOGADOR, id: 'a1', tipo: 'reservoir', gx: lugar!.gx, gy: lugar!.gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 } }, gameData) as PredioCompleto, agua: CAP };
    s = { ...s, predios: { porId: { ...s.predios.porId, a1 }, ordem: [...s.predios.ordem, 'a1'] } };
    expect(acudeDaFazenda(s, f1)).toBe('a1');
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/I-TELA-ACUDE-NA-TELA.save.txt`, salvar(s));
    gravarEvidencia('I-TELA-ACUDE-NA-TELA', { acude: { gx: a1.gx, gy: a1.gy }, fazenda: { gx: f1.gx, gy: f1.gy } });
  });
});
