// O aviso de pausa e de velocidade (F11a): um elemento so, na barra do HUD. Mostra o texto de
// pausa quando pausado, a velocidade quando ela e diferente de 1x, e SOME em 1x despausado.
// O que ficou fora foi o widget de controle, nao o retorno visual: o GDD §10 exige retorno
// imediato para toda acao, e "o jogador aperta P e nada aparece" e o que a rubrica reprova.
//
// So le o relogio (por argumentos) e escreve texto — nunca muda o jogo, nunca importa phaser.
// O rotulo vem de `data/theme-sertao.json` (`hud.pausado`), como os do HUD.
import temaSertao from '../../data/theme-sertao.json';

export interface AvisoDoTempo {
  atualizar(pausado: boolean, velocidade: number): void;
}

export interface RotulosDoAviso {
  readonly pausado: string;
}

/** 1x e a velocidade NORMAL por definicao (o multiplicador do relogio), nao uma opcao de balanceamento. */
const VELOCIDADE_NORMAL = 1;

/** O texto do aviso, ou `''` quando ele deve sumir. Pura: e o que o teste headless prova. */
export function textoDoAviso(pausado: boolean, velocidade: number, rotulos: RotulosDoAviso): string {
  const partes: string[] = [];
  if (pausado) partes.push(rotulos.pausado);
  if (velocidade !== VELOCIDADE_NORMAL) partes.push(`${velocidade}x`);
  return partes.join(' · ');
}

/** Cria o elemento uma vez, dentro de `#hud`, e devolve `{ atualizar }`, que so escreve quando o texto muda. */
export function montarAvisoDoTempo(): AvisoDoTempo {
  const hud = document.getElementById('hud');
  if (!hud) throw new Error('aviso-tempo: #hud nao existe no index.html');

  const elemento = document.createElement('div');
  elemento.className = 'aviso-tempo';
  elemento.dataset.campo = 'aviso-tempo';
  elemento.setAttribute('role', 'status');
  elemento.hidden = true;
  hud.append(elemento);

  const rotulos: RotulosDoAviso = { pausado: temaSertao.hud.pausado };
  let ultimo = '';
  return {
    atualizar(pausado, velocidade) {
      const texto = textoDoAviso(pausado, velocidade, rotulos);
      if (texto === ultimo) return;
      ultimo = texto;
      elemento.textContent = texto;
      elemento.hidden = texto === '';
    },
  };
}
