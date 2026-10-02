import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aneisDaAgua, pescadoresNaAgua, type ConfigDosAneis } from '../src/render/agua-peixe';
import { validarInterface } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { cenarioDePescador, comEspacoNaSaida } from './helpers/producao-cenario';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { gravarEvidencia } from './helpers/evidence';

const config = JSON.parse(readFileSync('data/agua-peixe.json', 'utf8')) as ConfigDosAneis;
const vista = { x: 0, y: 0, largura: 10, altura: 10, larguraMapa: 10, alturaMapa: 10 };
const agua = (gx: number, gy: number) => (gx + gy) % 2 === 0;
const pescador = { id: 'p', fsm: 'colhendo', gx: 2, gy: 2 };

describe('D-TELA-AGUA-PEIXE', () => {
  it('e deterministica, so na agua da vista, com teto e peixe raro em cada janela', () => {
    let comPeixe = 0;
    let maximo = 0;
    const janela = 4 * config.intervaloDoPeixeTicks;
    for (let tick = 0; tick < 2 * janela; tick += 1) {
      for (const alfa of [0, 0.5, 0.9]) {
        const aneis = aneisDaAgua(config, tick, alfa, vista, agua, [pescador]);
        expect(aneisDaAgua(config, tick, alfa, vista, agua, [pescador])).toEqual(aneis);
        expect(aneis.every((a) => agua(a.gx, a.gy) && a.gx >= 0 && a.gx < 10 && a.gy >= 0 && a.gy < 10)).toBe(true);
        expect(aneis.length).toBeLessThanOrEqual(config.maximoNaVista);
        maximo = Math.max(maximo, aneis.length);
      }
      if (aneisDaAgua(config, tick, 0, vista, agua, []).length) comPeixe += 1;
    }
    // Toda janela deslizante, nao apenas uma janela escolhida depois de ver a saida.
    for (let inicio = 0; inicio < janela; inicio += 1) {
      expect(Array.from({ length: janela }, (_, i) => aneisDaAgua(config, inicio + i, 0, vista, agua, []).length)
        .some((n) => n > 0)).toBe(true);
    }
    expect(comPeixe / (2 * janela)).toBeLessThan(0.25);
    expect(aneisDaAgua(config, 100, 0, vista, () => false, [pescador])).toEqual([]);
    expect(aneisDaAgua(config, 8, 0, { ...vista, x: 20 }, agua, [pescador])).toEqual([]);
    expect(aneisDaAgua({ ...config, maximoNaVista: 1 }, 8, 0, vista, agua,
      Array.from({ length: 20 }, (_, i) => ({ ...pescador, id: `${i}` })))).toHaveLength(1);
    gravarEvidencia('D-TELA-AGUA-PEIXE', { ticks: 2 * janela, comPeixe, fracaoComPeixe: comPeixe / (2 * janela), maximo });
  });

  it('cresce, perde opacidade e some exatamente na vidaTicks, com alfa', () => {
    const nascimento = config.intervaloDoPescadorTicks;
    const id = `pescador:p:${nascimento}`;
    let anterior = aneisDaAgua(config, nascimento, 0, vista, agua, [pescador]).find((a) => a.id === id)!;
    for (let idade = 0.5; idade < config.vidaTicks; idade += 0.5) {
      const tempo = nascimento + idade;
      const atual = aneisDaAgua(config, Math.floor(tempo), tempo % 1, vista, agua, [pescador]).find((a) => a.id === id)!;
      expect(atual.raio).toBeGreaterThan(anterior.raio);
      expect(atual.opacidade).toBeLessThan(anterior.opacidade);
      anterior = atual;
    }
    expect(aneisDaAgua(config, nascimento + config.vidaTicks, 0, vista, agua, [pescador]).some((a) => a.id === id)).toBe(false);
    for (const fsm of ['colhendo', 'indo_colher', 'voltando', 'ocioso']) {
      for (let tick = 0; tick < 80; tick += config.intervaloDoPescadorTicks) {
        const aneis = aneisDaAgua(config, tick, 0, vista, agua, [{ ...pescador, fsm }]).filter((a) => a.tipo === 'pescador');
        expect(aneis.some((a) => a.nascimento === tick && a.gx === 2 && a.gy === 2)).toBe(fsm === 'colhendo');
      }
    }
  });

  it('registra dado de interface e reprova cada campo, limites e dado ausente', () => {
    expect(ARQUIVOS_DA_INTERFACE).toContain('agua-peixe');
    expect(ARQUIVOS).not.toContain('agua-peixe');
    const ler = (nomes: readonly string[]) => Object.fromEntries(nomes.map((n) => [n, JSON.parse(readFileSync(`data/${n}.json`, 'utf8'))]));
    const jogo = ler(ARQUIVOS);
    const ui = ler(ARQUIVOS_DA_INTERFACE);
    const erros = (c: unknown) => validarInterface(jogo, { ...ui, 'agua-peixe': c }).filter((e: string) => e.startsWith('interface/agua-peixe:'));
    expect(erros(config)).toEqual([]);
    for (const campo of Object.keys(config)) expect(erros({ ...config, [campo]: null }).length, campo).toBeGreaterThan(0);
    for (const c of [null, [], { ...config, raioFinalTiles: 0.6 }, { ...config, raioFinalTiles: config.raioInicialTiles },
      { ...config, opacidadeInicial: 1.1 }, { ...config, vidaTicks: config.intervaloDoPeixeTicks }, { ...config, cor: 'blue' }])
      expect(erros(c).length).toBeGreaterThan(0);
  });

  it('monta a partida pela sim e resolve o origemTile, distinto da margem', () => {
    let estado = comEspacoNaSaida(cenarioDePescador(), 'pesc1');
    for (let n = 0; n < 800; n += 1) {
      estado = step(estado, []);
      if (estado.unidades.porId.pescador?.fsm === 'colhendo'
        && estado.tick % config.intervaloDoPescadorTicks === 0) break;
    }
    const u = estado.unidades.porId.pescador!;
    expect(u.fsm).toBe('colhendo');
    const pescadores = pescadoresNaAgua(estado);
    expect(pescadores).toHaveLength(1);
    const tarefa = estado.jobs.tarefas.porId[u.fsmData.tarefa!];
    if (tarefa?.tipo !== 'colher') throw new Error('fixture sem tarefa de colheita');
    expect(pescadores[0]).toMatchObject(tarefa.origemTile);
    expect(tarefa.origemTile).not.toEqual({ gx: u.gx, gy: u.gy });
    expect(pescadoresNaAgua({ ...estado, unidades: { ...estado.unidades, porId: {
      ...estado.unidades.porId, pescador: { ...u, fsm: 'voltando' },
    } } })).toEqual([]);
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/D-TELA-AGUA-PEIXE.save.txt`, salvar(estado));
  });
});
