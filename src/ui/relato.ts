// I-ENTREGA-PLAYTEST — o "Enviar relato" da ajuda em jogo, e o "Abrir relato" que o traz de volta.
//
// So DOM e callback: quem monta o arquivo e quem carrega o estado e o laco externo (`src/relato.ts`,
// `main.ts`). O que a tela diz que o arquivo leva sai da MESMA lista que monta o arquivo
// (`CAMPOS_DO_RELATO`), pelo rotulo de cada campo no tema (`relato.campos`). Nada e enviado pela
// rede: "Enviar" baixa um arquivo, e quem o manda ao operador e a pessoa.
import { CAMPOS_DO_RELATO } from '../relato';
import temaSertao from '../../data/theme-sertao.json';

const rotulos = temaSertao.relato;

/** O que a tela diz que o relato leva, montado da lista dos campos. Pura. */
export function textoDoQueLeva(tema: typeof temaSertao = temaSertao): string {
  const campos = tema.relato.campos as Readonly<Record<string, string | undefined>>;
  const nomes = CAMPOS_DO_RELATO.map((c) => campos[c] ?? c);
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')}${tema.relato.e}${nomes[nomes.length - 1] ?? ''}` : (nomes[0] ?? '');
  return tema.relato.leva.replace('{campos}', lista);
}

export interface SecaoDoRelato {
  /** Mostra o recado do que aconteceu (baixou, abriu, recusou). */
  recado(texto: string, ok: boolean): void;
}

export function montarSecaoDoRelato(acoes: {
  /** Baixa o arquivo com o texto escrito. */
  aoEnviar(texto: string): void;
  /** Recebe o conteudo do arquivo escolhido. */
  aoAbrir(conteudo: string): void;
}): SecaoDoRelato {
  const ajuda = document.getElementById('ajuda');
  if (!ajuda) throw new Error('relato: #ajuda nao existe no index.html');
  const raiz = document.createElement('section');
  raiz.className = 'relato';
  const titulo = document.createElement('h3');
  titulo.textContent = rotulos.titulo;
  const leva = document.createElement('p');
  leva.className = 'leva';
  leva.textContent = textoDoQueLeva();
  const texto = document.createElement('textarea');
  texto.dataset.campo = 'texto-do-relato';
  texto.rows = 3;
  texto.placeholder = rotulos.placeholder;
  // as letras do texto nao sao atalho do jogo: H, P, R e as setas ficam no campo
  texto.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  const botoes = document.createElement('div');
  botoes.className = 'botoes';
  const enviar = document.createElement('button');
  enviar.type = 'button';
  enviar.dataset.acao = 'enviar-relato';
  enviar.textContent = rotulos.enviar;
  enviar.addEventListener('click', () => {
    acoes.aoEnviar(texto.value);
    enviar.blur();
  });
  const abrir = document.createElement('button');
  abrir.type = 'button';
  abrir.dataset.acao = 'abrir-relato';
  abrir.textContent = rotulos.abrir;
  const arquivo = document.createElement('input');
  arquivo.type = 'file';
  arquivo.accept = '.json,application/json';
  arquivo.hidden = true;
  arquivo.dataset.campo = 'arquivo-do-relato';
  abrir.addEventListener('click', () => {
    arquivo.click();
    abrir.blur();
  });
  arquivo.addEventListener('change', () => {
    const escolhido = arquivo.files?.[0];
    if (escolhido === undefined) return;
    void escolhido.text().then((conteudo) => {
      acoes.aoAbrir(conteudo);
      arquivo.value = '';
    });
  });
  const recado = document.createElement('span');
  recado.className = 'recado';
  recado.dataset.campo = 'relato';
  recado.setAttribute('role', 'status');
  recado.hidden = true;
  botoes.append(enviar, abrir, arquivo, recado);
  raiz.append(titulo, leva, texto, botoes);
  ajuda.insertBefore(raiz, ajuda.querySelector('.rodape'));
  return {
    recado(t, ok) {
      recado.textContent = t;
      recado.dataset.ok = String(ok);
      recado.hidden = false;
    },
  };
}
