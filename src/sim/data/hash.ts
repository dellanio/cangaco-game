/**
 * F23 — o hash do mapa, para o save recusar NA HORA uma partida carregada sobre
 * outro mapa. O terreno nao mora no `GameState` (contrato da F-T1): ele vem de
 * `data/maps/<id>.json`, entao o save guarda qual mapa a partida usava e o
 * estado do arquivo naquele dia. Sem o hash, um mapa editado nao quebra o load:
 * ele quebra a partida 300 ticks depois, que e o modo de falha caro.
 *
 * FNV-1a de 32 bits, escrito aqui em vez de importado: `sim/` nao ganha
 * dependencia nova por uma funcao de dez linhas, e o resultado precisa ser o
 * MESMO em toda maquina — `Math.imul` e o inteiro de 32 bits sao definidos pela
 * linguagem, entao o mesmo texto da o mesmo hash em qualquer node.
 *
 * Nao e criptografico e nao precisa ser: o que isto pega e o mapa trocado ou
 * regerado sem querer, nao o save forjado de proposito.
 */
export function hashDeTexto(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
