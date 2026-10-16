/**
 * I-TELA-MODO-ADMIN — o modo do operador: os textos de depuracao (o nome e o estagio escritos no predio sem arte, o
 * nome sobre cada unidade e o `<laco>_<n>` do quadro de trabalho sem arte) so aparecem nele.
 *
 * Liga abrindo o jogo com `?admin` na URL, e fica lembrado no navegador (`localStorage`); `?admin=0` desliga e
 * esquece. A decisao e pura (`modoAdmin`), e a leitura do navegador fica em `lerModoAdmin`, uma vez por pagina.
 */

export const CHAVE_DO_MODO_ADMIN = 'cangaco:admin';

export interface DecisaoDoModoAdmin {
  readonly ligado: boolean;
  /** O que gravar no navegador: `'1'` liga, `null` apaga, `undefined` nao mexe. */
  readonly guardar: '1' | null | undefined;
}

/** `?admin` liga e guarda; `?admin=0` desliga e apaga; sem o parametro vale o que estava guardado. */
export function modoAdmin(busca: string, guardado: string | null): DecisaoDoModoAdmin {
  const parametro = new URLSearchParams(busca).get('admin');
  if (parametro === null) return { ligado: guardado === '1', guardar: undefined };
  if (parametro === '0') return { ligado: false, guardar: null };
  return { ligado: true, guardar: '1' };
}

let lido: boolean | null = null;

/** O modo admin desta pagina: decide uma vez, grava o que a decisao pede e lembra. */
export function lerModoAdmin(): boolean {
  if (lido !== null) return lido;
  let guardado: string | null;
  try { guardado = window.localStorage.getItem(CHAVE_DO_MODO_ADMIN); } catch { guardado = null; }
  const d = modoAdmin(window.location.search, guardado);
  try {
    if (d.guardar === '1') window.localStorage.setItem(CHAVE_DO_MODO_ADMIN, '1');
    else if (d.guardar === null) window.localStorage.removeItem(CHAVE_DO_MODO_ADMIN);
  } catch { /* navegador sem armazenamento: vale so nesta pagina */ }
  lido = d.ligado;
  return lido;
}
