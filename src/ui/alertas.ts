// F22 — o aviso de prédio parado, no canto do mapa. Irmao de `ui/hud.ts`: so le
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
import { CAUSAS_DE_ALERTA, alertasDoEstado } from '../sim/selectors';
import type { CausaDeAlerta } from '../sim/selectors';
import temaSertao from '../../data/theme-sertao.json';

export interface Alertas {
  atualizar(estado: GameState): void;
}

/** O rotulo de cada causa vem do TEMA, nunca digitado aqui: a causa e id neutro
 *  (`sem-trabalhador`) e quem fala com o jogador e `data/theme-sertao.json`
 *  (CLAUDE.md §9). `tests/F22-alertas.test.ts` exige a ida e a volta. */
const ROTULOS = temaSertao.alertas.causas as Readonly<Record<CausaDeAlerta, string>>;

/** Monta as linhas uma vez em `#alertas` e devolve `{ atualizar }`, que so
 *  reescreve contagem e visibilidade — nunca recria o DOM, como o HUD. */
export function montarAlertas(): Alertas {
  const raiz = document.getElementById('alertas');
  if (!raiz) throw new Error('alertas: #alertas nao existe no index.html');

  const titulo = document.createElement('h2');
  titulo.textContent = temaSertao.alertas.titulo;
  raiz.append(titulo);

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

  return {
    atualizar(estado) {
      const alertas = alertasDoEstado(estado);
      let total = 0;
      for (const causa of CAUSAS_DE_ALERTA) {
        const quantos = alertas.filter((a) => a.causa === causa).length;
        total += quantos;
        const linha = linhas.get(causa);
        if (!linha) continue;
        linha.caixa.hidden = quantos === 0;
        const texto = String(quantos);
        if (linha.contagem.textContent !== texto) linha.contagem.textContent = texto;
      }
      // Some inteiro quando nao ha nada: um painel mostrando "0 avisos" e ruido
      // permanente em cima do mapa, e o jogador para de olhar para ele.
      raiz.hidden = total === 0;
    },
  };
}
