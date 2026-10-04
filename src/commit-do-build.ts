/**
 * I-ENTREGA-PLAYTEST — o commit do build, que vai no relato. O `vite.config.mts` troca o
 * identificador pelo `git describe` na hora do build e do dev server. Fora do Vite (o teste), ele
 * nao existe, e o valor e `desconhecido`.
 */
declare const __COMMIT_DO_BUILD__: string | undefined;

export const COMMIT_DO_BUILD: string = typeof __COMMIT_DO_BUILD__ === 'string' ? __COMMIT_DO_BUILD__ : 'desconhecido';
