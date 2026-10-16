// I-TELA-PREMIUM-PROTOTIPO (P1, plano docs/planos/2026-10-16-migracao-visual-premium.md, Fase 0) — a barra de baixo
// da tropa selecionada, so no visual premium: um retrato por soldado (o sprite `parado` do tipo), a vida de cada um e
// os comandos que o painel do grupo ja tem. Os botoes daqui apertam os do painel do grupo: nenhum comando novo nasce,
// e o comportamento e o mesmo. Le o estado e escreve texto; nao muta GameState, nao importa phaser (CLAUDE.md §3, §10).
import type { GameState } from '../sim/state';
import type { GameData } from '../sim/data/types';
import { hpMaximoDoTipo } from '../sim/vida';
import type { SelecaoMilitar } from '../input/selecao-militar';
import { nomeDaTropa } from './painel-grupo';

/** Os comandos do painel do grupo que a barra espelha, na ordem em que aparecem. */
export const ACOES_ESPELHADAS = ['alimentar', 'menos-colunas', 'mais-colunas', 'investida', 'converter'] as const;
/** Quantos retratos cabem antes de a barra resumir em "+N". */
const RETRATOS_NA_BARRA = 12;

export interface RetratoDoSoldado {
  readonly id: string;
  readonly tipo: string;
  readonly nome: string;
  /** 0 a 1; sem vida no dado, 1. */
  readonly vida: number;
  readonly imagem: string | null;
}

/** Os retratos da selecao, na ordem dela. Regra pura. */
export function retratosDaSelecao(
  estado: GameState, ids: readonly string[], dados: GameData, urls: Readonly<Record<string, string>>,
): RetratoDoSoldado[] {
  const retratos: RetratoDoSoldado[] = [];
  for (const id of ids) {
    const u = estado.unidades.porId[id];
    if (u === undefined) continue;
    const maximo = hpMaximoDoTipo(u.tipo, dados);
    const vida = maximo === null || maximo <= 0 || u.hp === undefined ? 1 : Math.max(0, Math.min(1, u.hp / maximo));
    retratos.push({ id, tipo: u.tipo, nome: nomeDaTropa(u.tipo), vida, imagem: urls[`sprites/units/${u.tipo}/parado.png`] ?? null });
  }
  return retratos;
}

export interface BarraDaTropa {
  atualizar(estado: GameState): void;
}

export function montarBarraDaTropa(
  selecao: SelecaoMilitar,
  soldados: (ids: readonly string[]) => string[],
  dados: GameData,
  urls: Readonly<Record<string, string>>,
): BarraDaTropa {
  const raiz = document.createElement('section');
  raiz.id = 'barra-da-tropa';
  raiz.hidden = true;
  const titulo = document.createElement('h2');
  const retratos = document.createElement('ol');
  retratos.className = 'retratos';
  const comandos = document.createElement('div');
  comandos.className = 'comandos';
  // a formacao ocupa uma casa so: o −, quantos por fileira (o texto do painel do grupo) e o +
  const formacao = document.createElement('div');
  formacao.className = 'formacao';
  const porFileira = document.createElement('span');
  const espelhos = ACOES_ESPELHADAS.map((acao) => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.dataset.espelha = acao;
    botao.addEventListener('click', () => {
      document.querySelector<HTMLButtonElement>(`#painel-grupo button[data-acao="${acao}"]`)?.click();
    });
    if (acao === 'menos-colunas') formacao.append(botao, porFileira);
    else if (acao === 'mais-colunas') formacao.append(botao);
    else comandos.append(botao);
    if (acao === 'menos-colunas') comandos.append(formacao);
    return botao;
  });
  raiz.append(titulo, retratos, comandos);
  document.body.append(raiz);

  let desenhado = '';
  return {
    atualizar(estado) {
      const ids = soldados(selecao.ids);
      raiz.hidden = ids.length === 0;
      if (ids.length === 0) return;
      const lista = retratosDaSelecao(estado, ids, dados, urls);
      titulo.textContent = document.querySelector('#painel-grupo h2')?.textContent ?? '';
      const assinatura = lista.map((r) => `${r.id}:${Math.round(r.vida * 20)}`).join(',');
      if (assinatura !== desenhado) {
        desenhado = assinatura;
        retratos.replaceChildren(...lista.slice(0, RETRATOS_NA_BARRA).map((r) => {
          const item = document.createElement('li');
          item.className = 'retrato';
          item.title = r.nome;
          item.dataset.tipo = r.tipo;
          if (r.imagem !== null) item.style.backgroundImage = `url('${r.imagem}')`;
          const vida = document.createElement('i');
          vida.className = 'vida';
          vida.style.setProperty('--vida', String(r.vida));
          item.append(vida);
          return item;
        }));
        if (lista.length > RETRATOS_NA_BARRA) {
          const mais = document.createElement('li');
          mais.className = 'retrato mais';
          mais.textContent = `+${lista.length - RETRATOS_NA_BARRA}`;
          retratos.append(mais);
        }
      }
      porFileira.textContent = document.querySelector('#painel-grupo [data-grupo="colunas"] span')?.textContent ?? '';
      formacao.hidden = espelhos.every((e) => e.dataset.espelha?.endsWith('colunas') !== true || e.hidden);
      // o espelho copia o texto e o estado do botao original a cada quadro: o painel do grupo continua o dono
      for (const espelho of espelhos) {
        const original = document.querySelector<HTMLButtonElement>(`#painel-grupo button[data-acao="${espelho.dataset.espelha ?? ''}"]`);
        espelho.hidden = original === null || original.hidden;
        espelho.disabled = original?.disabled ?? true;
        espelho.textContent = original?.textContent ?? '';
        espelho.classList.toggle('armado', original?.classList.contains('armado') ?? false);
      }
    },
  };
}
