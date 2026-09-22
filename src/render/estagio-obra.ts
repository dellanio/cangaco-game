/**
 * Aritmetica pura, ZERO imports (nem `../sim/data`, nem Phaser): os tres
 * estagios visuais de uma obra, derivados so do `hp` (F11c). `hp === 0` e
 * marcacao (nada martelado ainda); `0 < hp < hpTotal` e madeira (em obra);
 * `hp >= hpTotal` e o predio de pe. O original (K&M) sobe em quatro fases
 * (madeira, depois pedra); aqui sao tres por decisao do operador — a mesma
 * funcao pode dividir a fase do meio pela fracao de `hp` quando houver arte
 * (ver PROGRESS.md, origem F11c).
 */
export type EstagioDaObra = 'marcacao' | 'madeira' | 'completo';

export function estagioDaObra(hp: number, hpTotal: number): EstagioDaObra {
  if (hp >= hpTotal) return 'completo';
  return hp <= 0 ? 'marcacao' : 'madeira';
}
