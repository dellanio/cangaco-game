/**
 * BUG-O — o rotulo da CARGA sobre a unidade, pelo id NEUTRO da mercadoria.
 *
 * A sim so conhece `loaves`, `stone`, `timber`. O que o jogador le vem do tema
 * (`theme-sertao.json: mercadorias`), como todo texto visivel (CLAUDE.md §9). Ate o
 * BUG-O, `unidades.ts` escrevia o id cru ("loaves" em vez de "Cuscuz").
 *
 * O caminho e o de `nomeDaUnidade`: mercadoria sem nome no tema REPROVA aqui, em vez
 * de cair no id. O guarda de `tests/BUG-O-rotulo-da-carga.test.ts` afirma que toda
 * mercadoria de `economy.json` tem nome, entao o throw so dispara com dado novo sem
 * tema — e dispara alto, na hora de acrescentar.
 *
 * Este arquivo NAO importa `phaser` nem `sim/data`: e so o texto. Quem desenha e
 * `unidades.ts`.
 */
import temaSertao from '../../data/theme-sertao.json';

const NOMES = temaSertao.mercadorias as Readonly<Record<string, string | undefined>>;

/** O nome que o jogador le para a mercadoria que a unidade carrega. Joga sem tema. */
export function rotuloDaCarga(mercadoria: string): string {
  const nome = NOMES[mercadoria];
  if (typeof nome === 'string' && nome.length > 0 && !mercadoria.startsWith('_')) return nome;
  throw new Error(`render/rotulo-da-carga: theme-sertao.json nao tem nome para a mercadoria '${mercadoria}'.`);
}
