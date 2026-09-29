/**
 * C-IA-03c (cenario de escaramuca: jogar pela tela) — a cor do BANDO de cada lado, do tema
 * (`theme-sertao.json: bandos`, do documento da campanha: vermelho do Moita Seca, azul do
 * Cabo Branco). Sem ela o inimigo e identico ao jogador na tela. Pinta o rotulo da unidade e
 * a bandeira do predio: nenhuma arte nova.
 *
 * Lado sem cor no tema REPROVA aqui (como `nomeDaUnidade`), em vez de cair numa cor qualquer.
 * Este arquivo NAO importa `phaser` nem `sim/data`: e so o dado da tela.
 */
import temaSertao from '../../data/theme-sertao.json';

const BANDOS = temaSertao.bandos as unknown as Readonly<Record<string, { readonly nome: string; readonly cor: string } | undefined>>;

/** A cor (hex `#rrggbb`) do bando do lado. Joga se o tema nao tiver. */
export function corDoBando(lado: number): string {
  const bando = BANDOS[String(lado)];
  if (bando === undefined) throw new Error(`render/cor-do-bando: theme-sertao.json nao tem bando para o lado ${lado}.`);
  return bando.cor;
}
