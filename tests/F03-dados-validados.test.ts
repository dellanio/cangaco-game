import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validarTudo } from '../tools/data-rules.js';
import { ARQUIVOS } from '../tools/data-schema.js';

/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures mutam JSON
   heterogeneo; tipar cada forma aqui so pra este teste seria ruido. */

function carregarDadosReais(): Record<string, any> {
  const dados: Record<string, any> = {};
  for (const nome of ARQUIVOS) {
    dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
  }
  return dados;
}

function clonar<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function acharPredio(d: Record<string, any>, id: string): any {
  const p = d.buildings.predios.find((x: any) => x.id === id);
  if (!p) throw new Error(`fixture: predio '${id}' nao existe no dado real`);
  return p;
}

interface Fixture {
  readonly nome: string;
  readonly regraEsperada: string;
  readonly quebrar: (d: Record<string, any>) => void;
}

const fixtures: Fixture[] = [
  { nome: 'storehouse.hp errado', regraEsperada: 'predios/hp',
    quebrar: (d) => { acharPredio(d, 'storehouse').hp = 999; } },
  { nome: 'remove um predio', regraEsperada: 'predios/contagem',
    quebrar: (d) => { d.buildings.predios.pop(); } },
  { nome: 'quarry.desbloqueadoPor fica pendurado', regraEsperada: 'predios/desbloqueio-pendurado',
    quebrar: (d) => { acharPredio(d, 'quarry').desbloqueadoPor = 'nao_existe'; } },
  { nome: 'storehouse.desbloqueadoPor cria ciclo', regraEsperada: 'predios/ciclo',
    quebrar: (d) => { acharPredio(d, 'storehouse').desbloqueadoPor = 'sawmill'; } },
  { nome: 'schoolhouse vira raiz tambem', regraEsperada: 'predios/raiz-unica',
    quebrar: (d) => { acharPredio(d, 'schoolhouse').desbloqueadoPor = null; } },
  { nome: 'quarry.trabalhador inexistente', regraEsperada: 'predios/trabalhador',
    quebrar: (d) => { acharPredio(d, 'quarry').trabalhador = 'ninguem'; } },
  { nome: 'production referencia predio fantasma', regraEsperada: 'producao/predio-inexistente',
    quebrar: (d) => { d.production.predios.fantasma = { entra: {}, sai: { ouro: 1 } }; } },
  { nome: 'quarry.sai.stone zerado', regraEsperada: 'producao/taxa-nao-positiva',
    quebrar: (d) => { d.production.predios.quarry.sai.stone = 0; } },
  { nome: 'production.escala aponta pra grupo inexistente', regraEsperada: 'tempo/grupo-inexistente',
    quebrar: (d) => { d.production.escala = 'inexistente'; } },
  { nome: 'delivery perde a chave escala', regraEsperada: 'tempo/duracao-sem-grupo',
    quebrar: (d) => { delete d.delivery.escala; } },
  { nome: 'condition ganha campo de tempo nao registrado', regraEsperada: 'tempo/duracao-nao-registrada',
    quebrar: (d) => { d.condition.novoCampo_segundos = 5; } },
];

/** Copia data/ para o scratchpad da sessao, quebra um valor, roda o CLI de
 *  verdade e devolve o codigo de saida e o stderr. Prova ponta a ponta, nao
 *  so a funcao pura — a copia vive fora do repositorio. */
function rodarCliContraCopiaQuebrada(): { codigo: number | null; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cangaco-f03-'));
  cpSync('data', dir, { recursive: true });
  const buildings = JSON.parse(readFileSync(join(dir, 'buildings.json'), 'utf8'));
  buildings.predios[0].hp = 999;
  writeFileSync(join(dir, 'buildings.json'), JSON.stringify(buildings, null, 2));
  const resultado = spawnSync('node', ['tools/validate-data.js', '--dir', dir], { encoding: 'utf8' });
  return { codigo: resultado.status, stderr: resultado.stderr };
}

describe('F03 — validate:data reprova dado invalido', () => {
  const dadosReais = carregarDadosReais();

  it('o dado real passa limpo (senao os fixtures abaixo nao provariam nada)', () => {
    expect(validarTudo(clonar(dadosReais))).toEqual([]);
  });

  it.each(fixtures)('$nome dispara $regraEsperada', ({ quebrar, regraEsperada }) => {
    const quebrado = clonar(dadosReais);
    quebrar(quebrado);
    const erros = validarTudo(quebrado);
    expect(erros.some((e) => e.startsWith(`${regraEsperada}:`))).toBe(true);
  });

  it('delivery.escala=null (o valor real) NAO dispara tempo/grupo-inexistente', () => {
    const d = clonar(dadosReais);
    expect(d.delivery.escala).toBeNull();
    const erros = validarTudo(d);
    expect(erros.some((e) => e.startsWith('tempo/grupo-inexistente') && e.includes('delivery'))).toBe(false);
  });

  it('CLI ponta a ponta: copia quebrada no scratchpad sai com codigo 1', () => {
    const { codigo, stderr } = rodarCliContraCopiaQuebrada();
    expect(codigo).toBe(1);
    expect(stderr).toMatch(/predios\/hp/);
  });
});
