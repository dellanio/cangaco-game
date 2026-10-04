// I-TELA-AJUDA-DAS-CADEIAS — a aba Cadeias da ajuda: de onde vem cada mercadoria e para onde vai.
//
// NADA aqui e escrito a mao: uma linha por receita de `data/production.json`, na ordem de
// `data/buildings.json`, como as teclas da ajuda vem de `input/atalhos.ts`. Mudou a receita no dado,
// mudou a aba. O "para onde vai" junta as receitas que pedem a mercadoria e os destinos que o dado
// ja diz fora das receitas: o custo das obras (`buildings.json`), a comida (`condition.json`), as
// armas do quartel (`units.json: militares`) e o ouro da escola. Os nomes vem do tema.
import type { GameState } from '../sim/state';
import { ID_DA_ESCOLA, MERCADORIA_DE_OURO } from '../sim/state';
import type { GameData } from '../sim/data/types';
import { custoDoPredio } from '../sim/obra';
import { requisitosDoQuartel } from '../sim/quartel';
import { opcoesDoMenuBuild } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

/** Um destino da mercadoria: uma receita (o tipo do predio) ou um destino do dado fora delas. */
export type Destino =
  | { readonly tipo: 'predio'; readonly predio: string }
  | { readonly tipo: 'obras' };

export interface LinhaDaCadeia {
  /** O tipo do predio dono da receita. */
  readonly predio: string;
  /** O que entra, e de que receitas vem. Vazio na colheita (vem do mapa). */
  readonly entra: readonly { readonly mercadoria: string; readonly de: readonly string[] }[];
  /** O que sai, e para onde vai. */
  readonly sai: readonly { readonly mercadoria: string; readonly para: readonly Destino[] }[];
  /** O recurso do mapa que a receita colhe (`colheita.recurso`), ou `null`. A tela diz so que vem
   *  do mapa: o tema nao tem nome de recurso (o bloco `recursos` e cor). */
  readonly colhe: string | null;
}

/** Para onde vai a mercadoria `m`: as receitas que a pedem, e os destinos do dado fora delas. */
function destinosDe(m: string, dados: GameData): Destino[] {
  const para: Destino[] = [];
  for (const def of dados.predios) {
    if ((dados.producao.receitas[def.id]?.entra[m] ?? 0) > 0) para.push({ tipo: 'predio', predio: def.id });
  }
  const custoDeObra = dados.predios.some((def) => ((custoDoPredio(def) as Readonly<Record<string, number>>)[m] ?? 0) > 0);
  if (custoDeObra) para.push({ tipo: 'obras' });
  if (m in dados.condicao.restauracaoPorComida) para.push({ tipo: 'predio', predio: 'inn' });
  if (requisitosDoQuartel(dados).includes(m)) para.push({ tipo: 'predio', predio: 'barracks' });
  if (m === MERCADORIA_DE_OURO) para.push({ tipo: 'predio', predio: ID_DA_ESCOLA });
  return para;
}

/** Uma linha por receita do dado, na ordem de `buildings.json`. Pura. */
export function linhasDasCadeias(dados: GameData): LinhaDaCadeia[] {
  const linhas: LinhaDaCadeia[] = [];
  for (const def of dados.predios) {
    const r = dados.producao.receitas[def.id];
    if (r === undefined) continue;
    linhas.push({
      predio: def.id,
      entra: Object.keys(r.entra).map((m) => ({
        mercadoria: m,
        de: dados.predios.filter((p) => (dados.producao.receitas[p.id]?.sai[m] ?? 0) > 0).map((p) => p.id),
      })),
      sai: Object.keys(r.sai).map((m) => ({ mercadoria: m, para: destinosDe(m, dados) })),
      colhe: r.colheita?.recurso ?? null,
    });
  }
  return linhas;
}

/** O "requer X" do menu de construir, por tipo, para os bloqueados neste estado. Pura. */
export function requisitosNaTela(estado: GameState, dados: GameData, tema: typeof temaSertao = temaSertao): ReadonlyMap<string, string> {
  const nomes = tema.predios as Readonly<Record<string, { readonly nome: string } | undefined>>;
  const m = new Map<string, string>();
  for (const o of opcoesDoMenuBuild(estado, dados)) {
    if (o.desbloqueado) continue;
    m.set(o.id, o.requer === null ? tema.menuBuild.semRequisito : `${tema.menuBuild.requer} ${nomes[o.requer]?.nome ?? o.requer}`);
  }
  return m;
}

/** Os textos de uma linha, pelo tema. Pura. */
export function textoDaLinha(linha: LinhaDaCadeia, tema: typeof temaSertao = temaSertao): { readonly predio: string; readonly entra: string; readonly sai: string } {
  const t = tema.ajuda.cadeias;
  const predios = tema.predios as Readonly<Record<string, { readonly nome: string } | undefined>>;
  const mercadorias = tema.mercadorias as Readonly<Record<string, string | { readonly nome: string } | undefined>>;
  const nomeDe = (x: string | { readonly nome?: string } | undefined, id: string): string =>
    (typeof x === 'string' ? x : x?.nome) ?? id;
  const predio = (id: string): string => predios[id]?.nome ?? id;
  const lista = (itens: readonly string[]): string => itens.join(t.separador);
  const destino = (d: Destino): string => (d.tipo === 'obras' ? t.obras : predio(d.predio));
  const entra = linha.colhe !== null
    ? t.colhe
    : lista(linha.entra.map((e) => (e.de.length === 0 ? nomeDe(mercadorias[e.mercadoria], e.mercadoria)
      : t.vemDe.replace('{mercadoria}', nomeDe(mercadorias[e.mercadoria], e.mercadoria)).replace('{de}', lista(e.de.map(predio))))));
  const sai = lista(linha.sai.map((s) => (s.para.length === 0
    ? t.vaiParaArmazem.replace('{mercadoria}', nomeDe(mercadorias[s.mercadoria], s.mercadoria))
    : t.vaiPara.replace('{mercadoria}', nomeDe(mercadorias[s.mercadoria], s.mercadoria)).replace('{para}', lista(s.para.map(destino))))));
  return { predio: predio(linha.predio), entra, sai };
}
