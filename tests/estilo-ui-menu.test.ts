/**
 * Layout 2, fatia 2 (docs/propostas/ui-releitura-rts.md §1-2): o agrupamento
 * do menu Construir e dado de INTERFACE (`data/menu-build.json`), e a regra
 * `interface/menu-build` e quem o mantem honesto contra `buildings.json` e o
 * tema. Como na F03, cada quebra aqui e uma copia do dado real com UM defeito,
 * e o que se afirma e o id da regra que acusa — a regra que so concorda nao
 * prova nada (a licao da sonda que concorda).
 *
 * A tela em si (5 colunas, faixas, cartao) e provada pelo roteiro da F06.
 */
import { readFileSync } from 'node:fs';
import { validarInterface } from '../tools/data-rules.js';
import { ARQUIVOS, ARQUIVOS_DA_INTERFACE } from '../tools/data-schema.js';
import { gravarEvidencia } from './helpers/evidence';

/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures mutam JSON
   heterogeneo, como na F03. */

function carregar(lista: readonly string[]): Record<string, any> {
  const dados: Record<string, any> = {};
  for (const nome of lista) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
  return dados;
}
const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

interface Quebra {
  readonly nome: string;
  readonly regraEsperada: string;
  readonly quebrar: (jogo: Record<string, any>, ui: Record<string, any>) => void;
}

const quebras: Quebra[] = [
  { nome: 'predio some de todo grupo', regraEsperada: 'interface/menu-build-sem-grupo',
    quebrar: (_j, ui) => { ui['menu-build'].grupos[0].predios.pop(); } },
  { nome: 'predio em dois grupos', regraEsperada: 'interface/menu-build-repetido',
    quebrar: (_j, ui) => { ui['menu-build'].grupos[1].predios.push(ui['menu-build'].grupos[0].predios[0]); } },
  { nome: 'id que nao existe em buildings.json', regraEsperada: 'interface/menu-build-inexistente',
    quebrar: (_j, ui) => { ui['menu-build'].grupos[0].predios.push('castelo'); } },
  { nome: 'ordem dentro do grupo diferente da de buildings.json', regraEsperada: 'interface/menu-build-ordem',
    quebrar: (_j, ui) => { ui['menu-build'].grupos[0].predios.reverse(); } },
  { nome: 'grupo sem rotulo no tema', regraEsperada: 'interface/menu-build-rotulo',
    quebrar: (_j, ui) => { delete ui['theme-sertao'].menuBuild.grupos.vila; } },
  { nome: 'rotulo no tema sem grupo', regraEsperada: 'interface/menu-build-rotulo',
    quebrar: (_j, ui) => { ui['theme-sertao'].menuBuild.grupos.fantasma = 'Fantasma'; } },
  { nome: 'grupo com id repetido', regraEsperada: 'interface/menu-build-grupo-repetido',
    quebrar: (_j, ui) => { ui['menu-build'].grupos.push({ id: 'vila', predios: [] }); } },
  { nome: 'arquivo sem forma', regraEsperada: 'interface/menu-build-forma',
    quebrar: (_j, ui) => { ui['menu-build'].grupos = 'nada'; } },
];

describe('Layout 2 — interface/menu-build', () => {
  const jogo = carregar(ARQUIVOS);
  const ui = carregar(ARQUIVOS_DA_INTERFACE);

  it('o dado real passa sem erro', () => {
    expect(validarInterface(jogo, ui)).toEqual([]);
  });

  it('todo predio de buildings.json esta em exatamente um grupo (pelo dado, nao pela regra)', () => {
    const todos = jogo.buildings.predios.map((p: any) => p.id);
    const nosGrupos = ui['menu-build'].grupos.flatMap((g: any) => g.predios);
    expect([...nosGrupos].sort()).toEqual([...todos].sort());
    expect(new Set(nosGrupos).size).toBe(nosGrupos.length);
  });

  for (const q of quebras) {
    it(`acusa: ${q.nome} -> ${q.regraEsperada}`, () => {
      const j = clonar(jogo);
      const u = clonar(ui);
      q.quebrar(j, u);
      const erros = validarInterface(j, u);
      expect(erros.some((e: string) => e.startsWith(q.regraEsperada))).toBe(true);
    });
  }
});

afterAll(() => {
  const jogo = carregar(ARQUIVOS);
  const ui = carregar(ARQUIVOS_DA_INTERFACE);
  gravarEvidencia('estilo-ui-2', {
    feature: 'estilo-ui-2-grade-de-icones',
    grupos: ui['menu-build'].grupos.map((g: any) => ({ id: g.id, n: g.predios.length })),
    total: jogo.buildings.predios.length,
    errosNoDadoReal: validarInterface(jogo, ui),
    quebrasProvadas: quebras.map((q) => q.regraEsperada),
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F06',
  });
});
