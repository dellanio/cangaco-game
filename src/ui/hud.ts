// Barra de recursos no topo. So le o estado (via selectors puros de sim/) e
// escreve texto — nunca muta GameState, nunca importa phaser, nunca varre
// predios por conta propria (CLAUDE.md §3, §10).
import type { GameState } from '../sim/state';
import { estoqueTotal, comidaTotal, populacaoPorGrupo } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

export interface Hud {
  atualizar(estado: GameState): void;
}

const CAMPOS = ['gold', 'timber', 'stone', 'comida', 'populacao'] as const;
type Campo = (typeof CAMPOS)[number];

const ROTULOS: Readonly<Record<Campo, string>> = {
  gold: temaSertao.mercadorias.gold,
  timber: temaSertao.mercadorias.timber,
  stone: temaSertao.mercadorias.stone,
  comida: temaSertao.hud.comida,
  populacao: temaSertao.hud.populacao,
};

/** Monta os cinco campos uma vez em `#hud` e devolve `{ atualizar }`, que
 *  reescreve so o `textContent` de quem mudou — nunca recria o DOM. */
export function montarHud(): Hud {
  const raiz = document.getElementById('hud');
  if (!raiz) throw new Error('hud: #hud nao existe no index.html');

  const valores = new Map<Campo, HTMLElement>();
  for (const campo of CAMPOS) {
    const linha = document.createElement('div');
    linha.className = 'campo';

    const rotulo = document.createElement('span');
    rotulo.className = 'rotulo';
    rotulo.textContent = ROTULOS[campo];

    const valor = document.createElement('span');
    valor.className = 'valor';
    valor.dataset.campo = campo;
    valor.textContent = '0';

    linha.append(rotulo, valor);
    raiz.append(linha);
    valores.set(campo, valor);
  }

  function escrever(campo: Campo, texto: string): void {
    const elemento = valores.get(campo);
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  return {
    atualizar(estado) {
      const total = estoqueTotal(estado);
      const pop = populacaoPorGrupo(estado);
      escrever('gold', String(total.gold ?? 0));
      escrever('timber', String(total.timber ?? 0));
      escrever('stone', String(total.stone ?? 0));
      escrever('comida', String(comidaTotal(estado)));
      escrever('populacao', `${pop.civil}/${pop.militar}`);
    },
  };
}
