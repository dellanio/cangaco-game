// I-TELA-TRILHA-SONORA — o player da trilha na aba Opcoes da barra (pedido do operador, 2026-10-06):
// o nome da faixa que toca, pausar/continuar, passar para a proxima, e os volumes (o geral e o de cada
// canal, e o mudo). Os volumes sao a MESMA preferencia da caixa de opcoes de som (`ui/opcoes-de-som.ts`):
// le e grava por `PreferenciasVivas`, e reescreve o deslizador quando a preferencia mudou por la. Nao
// toca no estado do jogo; os comandos da trilha vao ao fundo sonoro por callback.
import temaSertao from '../../data/theme-sertao.json';
import { CANAIS } from '../preferencias-de-som';
import type { Canal, PreferenciasDeSom, PreferenciasVivas } from '../preferencias-de-som';

export interface ControleDaTrilha {
  /** A faixa da vez e a pausa, ou `null` sem playlist. */
  estado(): { readonly faixa: string; readonly pausada: boolean } | null;
  passar(): void;
  alternarPausa(): void;
}

export interface PlayerDaTrilha {
  /** Reescreve o nome, o botao de pausa e os deslizadores (so o que mudou). */
  atualizar(): void;
}

const rotulos = temaSertao.trilha;
const rotulosDoSom = temaSertao.som;

export function montarPlayerDaTrilha(raiz: HTMLElement, controle: ControleDaTrilha, preferencias: PreferenciasVivas): PlayerDaTrilha {
  const caixa = document.createElement('section');
  caixa.className = 'player-da-trilha';
  caixa.id = 'player-da-trilha';
  const titulo = document.createElement('h2');
  titulo.textContent = rotulos.titulo;
  const nome = document.createElement('p');
  nome.className = 'faixa';
  const botoes = document.createElement('div');
  botoes.className = 'botoes';
  const pausa = document.createElement('button');
  pausa.type = 'button';
  pausa.dataset.trilha = 'pausa';
  pausa.addEventListener('click', () => { controle.alternarPausa(); atualizar(); });
  const passar = document.createElement('button');
  passar.type = 'button';
  passar.dataset.trilha = 'passar';
  passar.textContent = '⏭';
  passar.title = rotulos.passar;
  passar.setAttribute('aria-label', rotulos.passar);
  passar.addEventListener('click', () => { controle.passar(); atualizar(); });
  botoes.append(pausa, passar);

  const volumes = document.createElement('div');
  volumes.className = 'volumes';
  const tituloDosVolumes = document.createElement('h3');
  tituloDosVolumes.textContent = rotulos.volumes;
  volumes.append(tituloDosVolumes);
  const deslizadores = new Map<'geral' | Canal, HTMLInputElement>();
  for (const campo of ['geral', ...CANAIS] as const) {
    const linha = document.createElement('label');
    linha.className = 'campo';
    const texto = document.createElement('span');
    texto.textContent = campo === 'geral' ? rotulosDoSom.geral : rotulosDoSom.canais[campo];
    const entrada = document.createElement('input');
    entrada.type = 'range';
    entrada.min = '0';
    entrada.max = '100';
    entrada.step = '1';
    entrada.dataset.volume = campo;
    entrada.addEventListener('input', () => {
      const p: PreferenciasDeSom = { ...preferencias.atual, [campo]: Number(entrada.value) / 100 };
      preferencias.mudar(p);
    });
    linha.append(texto, entrada);
    volumes.append(linha);
    deslizadores.set(campo, entrada);
  }
  const linhaDoMudo = document.createElement('label');
  linhaDoMudo.className = 'campo mudo';
  const mudo = document.createElement('input');
  mudo.type = 'checkbox';
  mudo.dataset.volume = 'mudo';
  mudo.addEventListener('change', () => { preferencias.mudar({ ...preferencias.atual, mudo: mudo.checked }); });
  const nomeDoMudo = document.createElement('span');
  nomeDoMudo.textContent = rotulosDoSom.mudo;
  linhaDoMudo.append(mudo, nomeDoMudo);
  volumes.append(linhaDoMudo);

  caixa.append(titulo, nome, botoes, volumes);
  raiz.prepend(caixa);

  const nomes = rotulos.faixas as Readonly<Record<string, string>>;
  function atualizar(): void {
    const e = controle.estado();
    caixa.hidden = e === null;
    if (e !== null) {
      const texto = `${rotulos.tocando}: ${nomes[e.faixa] ?? e.faixa}`;
      if (nome.textContent !== texto) nome.textContent = texto;
      nome.dataset.faixa = e.faixa;
      const simbolo = e.pausada ? '▶' : '⏸';
      const dica = e.pausada ? rotulos.continuar : rotulos.pausar;
      if (pausa.textContent !== simbolo) {
        pausa.textContent = simbolo;
        pausa.title = dica;
        pausa.setAttribute('aria-label', dica);
        pausa.setAttribute('aria-pressed', String(e.pausada));
      }
    }
    // a preferencia pode ter mudado pela caixa de opcoes de som: o deslizador que o jogador nao segura acompanha
    const p = preferencias.atual;
    for (const [campo, entrada] of deslizadores) {
      const valor = String(Math.round(p[campo] * 100));
      if (entrada.value !== valor && document.activeElement !== entrada) entrada.value = valor;
    }
    if (mudo.checked !== p.mudo) mudo.checked = p.mudo;
  }
  atualizar();
  return { atualizar };
}
