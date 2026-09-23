/// <reference types="vite/client" />
// A referencia acima e o que da tipo a `import.meta.glob`. Fica NESTE arquivo,
// nao em `tsconfig.json`: o glob mora so aqui, e o tipo deve morar junto.
/**
 * As URLs dos sprites, resolvidas pelo Vite em tempo de build.
 *
 * Isolado num arquivo so porque `import.meta.glob` e do bundler: o resto de
 * `render/` recebe este mapa por parametro e continua testavel em Node, sem
 * Vite. E o unico arquivo do projeto que fala com o bundler.
 *
 * So `assets/sprites/` entra: a base de `assets/base/` e registro de geracao
 * (1536x1024, megabytes) e NAO vai para o bundle.
 *
 * Arquivo que o manifesto declara e o glob nao resolveu simplesmente nao e
 * carregado — e o que impede um 404, que o runner de screenshot trata como
 * reprovacao da feature inteira.
 */
const modulos = import.meta.glob('../../assets/sprites/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Caminho como o manifesto escreve (`sprites/storehouse/x.png`) -> URL servida. */
export const urlsDeSprites: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(modulos).map(([chave, url]) => [chave.replace('../../assets/', ''), url]),
);
