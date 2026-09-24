/**
 * F-D1 — o INVENTARIO de atalhos: a lista do que o jogo de fato escuta.
 *
 * Existe porque a tela de ajuda nao pode ser uma segunda copia dos `if` de
 * `teclado.ts` e `teclas-do-tempo.ts`. Duas listas divergem na primeira feature
 * que acrescenta tecla, e uma tela que anuncia tecla inexistente e pior do que
 * tela nenhuma: troca um jogador perdido por um jogador enganado (BUILD_PLAN,
 * F-D1, aceite 2).
 *
 * A direcao e esta, e nao a inversa: os ouvintes casam a tecla POR ESTA
 * DECLARACAO, e a tela LE ESTA DECLARACAO. Por isso `tests/F-D1-ajuda.test.ts`
 * consegue provar, para cada entrada, que apertar a tecla faz alguma coisa —
 * declarar sem implementar reprova.
 *
 * Nao tem DOM e nao toca `window`: o alvo do evento e injetado, como nos dois
 * ouvintes. O `id` e NEUTRO e em ingles interno (CLAUDE.md §9); quem fala com o
 * jogador e `data/theme-sertao.json`.
 */
export type GrupoDeAtalho = 'ferramenta' | 'tempo' | 'ajuda' | 'camera';

export interface AtalhoDeTeclado {
  /** Id neutro. E a chave do rotulo no tema. */
  readonly id: string;
  readonly grupo: GrupoDeAtalho;
  /**
   * As teclas que disparam, exatamente como `KeyboardEvent.key` as entrega. A
   * comparacao e sem caixa (`toLowerCase`), entao `r` cobre `R`; `F1` esta em
   * maiuscula porque e assim que o navegador manda, e a comparacao sem caixa
   * continua casando.
   */
  readonly teclas: readonly string[];
  /**
   * Com Ctrl/Meta/Alt a tecla e do NAVEGADOR, nao nossa: Ctrl+R recarrega,
   * Ctrl+`+` da zoom. Todo atalho de hoje quer `true` aqui; o campo existe para
   * que um futuro `Ctrl+1..9` (grupos de tropa, GDD §2.2) nao precise mudar a
   * forma do inventario.
   */
  readonly semModificadores: true;
}

export interface GestoDeMouse {
  readonly id: string;
  readonly grupo: GrupoDeAtalho;
}

/**
 * O que o teclado escuta HOJE. Nao ha `B`, `F`, `Delete`, `1..9` nem `Ctrl+1..9`
 * aqui de proposito: eles estao na tabela do GDD §2.2 e **nao existem no
 * codigo**. Quando alguem os implementar, a entrada nasce junto, e a tela de
 * ajuda passa a mostra-los sem uma linha de `ui/`.
 */
export const ATALHOS: readonly AtalhoDeTeclado[] = [
  { id: 'ajuda', grupo: 'ajuda', teclas: ['h', 'F1'], semModificadores: true },
  { id: 'cancelar', grupo: 'ferramenta', teclas: ['Escape'], semModificadores: true },
  { id: 'estrada', grupo: 'ferramenta', teclas: ['r'], semModificadores: true },
  { id: 'pausa', grupo: 'tempo', teclas: ['p'], semModificadores: true },
  { id: 'acelerar', grupo: 'tempo', teclas: ['+', '='], semModificadores: true },
  { id: 'desacelerar', grupo: 'tempo', teclas: ['-'], semModificadores: true },
  // F-D2. Uma entrada para as oito teclas, e nao oito: para o jogador `WASD` e
  // sinonimo da seta (decisao do operador, turno H), e a tela de ajuda mostra
  // uma linha so. Qual das oito vira qual direcao e de `input/navegacao.ts`,
  // que tem a tabela — e o teste prende as duas listas uma a outra.
  {
    id: 'camera-mover',
    grupo: 'camera',
    teclas: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'],
    semModificadores: true,
  },
  { id: 'camera-arrastar', grupo: 'camera', teclas: [' '], semModificadores: true },
];

/**
 * Os gestos de mouse. Estao na tela de ajuda pelo mesmo motivo das teclas — o
 * operador so descobriu o arrasto com o botao do meio quando alguem contou.
 *
 * Nao entram no guarda comportamental de `tests/F-D1-ajuda.test.ts`: os dois
 * vivem dentro da cena do Phaser (`render/scenes/WorldScene.ts`), que nao roda
 * headless. Quem os exerce e o roteiro da F04, que move e amplia a camera de
 * verdade. A separacao esta escrita aqui para nao se perder.
 */
export const GESTOS: readonly GestoDeMouse[] = [
  { id: 'arrastar-camera', grupo: 'camera' },
  { id: 'zoom', grupo: 'camera' },
];

interface EventoComparavel {
  readonly key?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

/**
 * Este evento dispara este atalho? Unico lugar do projeto que compara tecla —
 * e e por isso que o inventario pode ser afirmado como verdade sobre o
 * comportamento.
 */
export function casa(atalho: AtalhoDeTeclado, evento: EventoComparavel): boolean {
  if (evento.ctrlKey === true || evento.metaKey === true || evento.altKey === true) return false;
  const k = evento.key?.toLowerCase();
  if (k === undefined) return false;
  return atalho.teclas.some((tecla) => tecla.toLowerCase() === k);
}

/** O atalho desse id, ou `undefined`. Usado pelos ouvintes para nao repetirem a
 *  busca linear com o id digitado em cada `if`. */
export function atalhoDeId(id: string): AtalhoDeTeclado | undefined {
  return ATALHOS.find((a) => a.id === id);
}
