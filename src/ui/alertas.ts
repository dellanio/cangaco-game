// F22 — o aviso de prédio parado, na faixa fixa da barra (UI-barra-a). Irmao de `ui/hud.ts`: so le
// o estado por seletor puro de `sim/` e escreve texto — nunca muta GameState,
// nunca importa phaser, nunca varre predios por conta propria (CLAUDE.md §3).
//
// O que ele resolve: ate aqui, descobrir que uma pedreira parou exigia CLICAR
// nela. O painel da F16b diz o que ha de errado com UM predio; este diz que ha
// algo errado em ALGUM.
//
// Uma linha por CAUSA, nao por predio: dez pedreiras sem trabalhador sao um
// aviso com "10", nao dez avisos empilhados por cima do mapa.
import type { GameState } from '../sim/state';
import { CAUSAS_DE_ALERTA, alertasDoEstado, tropaComFome } from '../sim/selectors';
import { LADO_DO_JOGADOR } from '../sim/state';
import type { CausaDeAlerta } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

export interface Alertas {
  atualizar(estado: GameState): void;
}

/** O rotulo de cada causa vem do TEMA, nunca digitado aqui: a causa e id neutro
 *  (`sem-trabalhador`) e quem fala com o jogador e `data/theme-sertao.json`
 *  (CLAUDE.md §9). `tests/F22-alertas.test.ts` exige a ida e a volta. */
const ROTULOS = temaSertao.alertas.causas as Readonly<Record<CausaDeAlerta, string>>;

/** Quantas causas a faixa da barra mostra (UI-barra-a): a faixa tem altura
 *  fixa, e o resto vira "+N" no canto. Medida de tela, nao balanceamento. */
export const LINHAS_NA_FAIXA = 2;

/** Quais causas aparecem e quantas sobram. Pura: e o que o teste headless prova.
 *  A ordem e a de `CAUSAS_DE_ALERTA`, nunca a da contagem — aviso que troca de
 *  lugar entre um tick e outro e aviso que o jogador nao aprende a procurar.
 *
 *  C-COMIDA-01f — a tropa com fome, quando ha, toma a PRIMEIRA linha da faixa, antes de
 *  toda causa de predio: e gente morrendo, e o predio parado espera. As causas ficam com
 *  as linhas que sobram, e o "+N" conta so as causas. */
export function causasNaFaixa(
  contagens: Readonly<Record<CausaDeAlerta, number>>,
  tropaComFome = 0,
): { readonly visiveis: readonly CausaDeAlerta[]; readonly sobram: number } {
  const linhas = LINHAS_NA_FAIXA - (tropaComFome > 0 ? 1 : 0);
  const ativas = CAUSAS_DE_ALERTA.filter((c) => contagens[c] > 0);
  return { visiveis: ativas.slice(0, linhas), sobram: Math.max(0, ativas.length - linhas) };
}

/** Monta as linhas uma vez em `#alertas` e devolve `{ atualizar }`, que so
 *  reescreve contagem e visibilidade — nunca recria o DOM, como o HUD. */
export function montarAlertas(): Alertas {
  const raiz = document.getElementById('alertas');
  if (!raiz) throw new Error('alertas: #alertas nao existe no index.html');

  const titulo = document.createElement('h2');
  titulo.textContent = temaSertao.alertas.titulo;
  raiz.append(titulo);

  // C-COMIDA-01f — a linha da tropa com fome, a primeira. `data-alerta`, e nao
  // `data-causa`: nao e causa de predio, e os roteiros da F22 contam `[data-causa]`.
  const tropa = document.createElement('div');
  tropa.className = 'alerta';
  tropa.dataset.alerta = 'tropa-com-fome';
  tropa.hidden = true;
  const rotuloDaTropa = document.createElement('span');
  rotuloDaTropa.className = 'rotulo';
  rotuloDaTropa.textContent = temaSertao.alertas.tropaComFome;
  const contagemDaTropa = document.createElement('span');
  contagemDaTropa.className = 'contagem';
  contagemDaTropa.textContent = '0';
  tropa.append(rotuloDaTropa, contagemDaTropa);
  raiz.append(tropa);

  // A ordem das linhas e a de `CAUSAS_DE_ALERTA`, fixada no DOM no nascimento:
  // aviso que troca de lugar entre um tick e outro e aviso que o jogador nao
  // aprende a procurar.
  const linhas = new Map<CausaDeAlerta, { readonly caixa: HTMLElement; readonly contagem: HTMLElement }>();
  for (const causa of CAUSAS_DE_ALERTA) {
    const caixa = document.createElement('div');
    caixa.className = 'alerta';
    caixa.dataset.causa = causa;
    caixa.hidden = true;

    const rotulo = document.createElement('span');
    rotulo.className = 'rotulo';
    rotulo.textContent = ROTULOS[causa];

    const contagem = document.createElement('span');
    contagem.className = 'contagem';
    contagem.textContent = '0';

    caixa.append(rotulo, contagem);
    raiz.append(caixa);
    linhas.set(causa, { caixa, contagem });
  }

  const mais = document.createElement('span');
  mais.className = 'mais';
  mais.dataset.mais = '0';
  mais.hidden = true;
  raiz.append(mais);

  return {
    atualizar(estado) {
      const alertas = alertasDoEstado(estado);
      const contagens = Object.fromEntries(
        CAUSAS_DE_ALERTA.map((c) => [c, alertas.filter((a) => a.causa === c).length]),
      ) as Record<CausaDeAlerta, number>;
      const comFome = tropaComFome(estado, LADO_DO_JOGADOR);
      const { visiveis, sobram } = causasNaFaixa(contagens, comFome);
      tropa.hidden = comFome === 0;
      if (contagemDaTropa.textContent !== String(comFome)) contagemDaTropa.textContent = String(comFome);
      let total = comFome;
      for (const causa of CAUSAS_DE_ALERTA) {
        const quantos = contagens[causa];
        total += quantos;
        const linha = linhas.get(causa);
        if (!linha) continue;
        linha.caixa.hidden = !visiveis.includes(causa);
        const texto = String(quantos);
        if (linha.contagem.textContent !== texto) linha.contagem.textContent = texto;
      }
      mais.hidden = sobram === 0;
      mais.dataset.mais = String(sobram);
      const textoDoMais = temaSertao.barra.maisAlertas.replace('{n}', String(sobram));
      if (mais.textContent !== textoDoMais) mais.textContent = textoDoMais;
      // Some inteiro quando nao ha nada: um painel mostrando "0 avisos" e ruido
      // permanente em cima do mapa, e o jogador para de olhar para ele.
      raiz.hidden = total === 0;
    },
  };
}
