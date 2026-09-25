/**
 * F-D4 — o nome do OFICIO, pelo tipo NEUTRO da unidade.
 *
 * A sim so conhece `serf`, `stonemason`, `militia`. O que o jogador le vem do
 * tema, como todo texto visivel (CLAUDE.md §9), e o caminho e o mesmo de
 * `nomeDoRecurso` (`rotulo-de-alcance.ts`): tipo sem nome no tema REPROVA aqui,
 * em vez de cair num rotulo generico. Unidade rotulada com o oficio errado, ou
 * com o id cru, e pior do que o erro alto na hora de acrescentar o tipo.
 *
 * Os tres grupos do tema tem a mesma forma (`{ nome }` por id) e ids disjuntos —
 * e o guarda de `tests/F-D4-nome-da-unidade.test.ts` afirma isso contra
 * `data/units.json`, entao a busca em ordem nao esconde colisao.
 *
 * Este arquivo NAO importa `phaser` nem `sim/data`: e so o texto. Quem desenha e
 * `unidades.ts`.
 */
import temaSertao from '../../data/theme-sertao.json';

/** Os grupos de unidade do tema, na ordem em que sao procurados. */
export const GRUPOS_DE_UNIDADE = ['civis', 'militares', 'mercenarios'] as const;

type Grupo = (typeof GRUPOS_DE_UNIDADE)[number];
type NomesDoGrupo = Readonly<Record<string, { readonly nome?: string } | undefined>>;

/** O nome que o jogador le para um tipo de unidade. Joga se o tema nao tiver. */
export function nomeDaUnidade(tipo: string): string {
  for (const grupo of GRUPOS_DE_UNIDADE) {
    const nomes = (temaSertao as Readonly<Record<Grupo, NomesDoGrupo>>)[grupo];
    const nome = nomes[tipo]?.nome;
    if (typeof nome === 'string' && nome.length > 0) return nome;
  }
  throw new Error(`render/nome-de-unidade: theme-sertao.json nao tem nome para a unidade '${tipo}'.`);
}
