// O portao do WebGL. O jogo roda com `Phaser.WEBGL` (a arte nova depende de setTint,
// mipmaps e batching), e com esse tipo o Phaser falha sem mensagem quando o navegador
// nao tem WebGL. Por isso a pergunta vem ANTES de o jogo existir: sem WebGL, nada do
// jogo carrega e a pagina diz por que.
//
// O documento chega por parametro para o teste rodar em Node com um documento falso.

export const MENSAGEM_SEM_WEBGL = 'Este jogo precisa de WebGL; ative a aceleração de hardware do navegador';

/** O pedaco do `document` que o portao usa. */
export interface DocumentoDoPortao {
  createElement(tag: 'canvas'): { getContext(tipo: 'webgl'): unknown };
  createElement(tag: 'div'): { id: string; className: string; textContent: string | null; setAttribute(nome: string, valor: string): void };
  readonly body: { append(no: unknown): void };
}

/** Tenta um contexto 'webgl' num canvas temporario. Excecao conta como "nao tem". */
export function suportaWebgl(doc: DocumentoDoPortao): boolean {
  try {
    return doc.createElement('canvas').getContext('webgl') !== null;
  } catch {
    return false;
  }
}

/** Escreve a mensagem na pagina, por cima de tudo. */
export function avisarSemWebgl(doc: DocumentoDoPortao): void {
  const aviso = doc.createElement('div');
  aviso.id = 'sem-webgl';
  aviso.className = 'sem-webgl';
  aviso.setAttribute('role', 'alert');
  aviso.textContent = MENSAGEM_SEM_WEBGL;
  doc.body.append(aviso);
}

/** Carrega o jogo so se houver WebGL; senao avisa e nao carrega. Devolve se carregou. */
export async function iniciarSeHouverWebgl(doc: DocumentoDoPortao, carregar: () => Promise<unknown>): Promise<boolean> {
  if (!suportaWebgl(doc)) {
    avisarSemWebgl(doc);
    return false;
  }
  await carregar();
  return true;
}
