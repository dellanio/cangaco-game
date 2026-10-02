import Phaser from 'phaser';
import { atlasDeDepuracao, manifestoDeDepuracao } from './depuracao-de-unidade';
import { DIRECOES, assetDaCamada } from './manifesto';
import { quadroDoAndar, spriteDoAtlas } from './animacao-de-unidade';
import { peDoSprite } from './pe-do-sprite';
import { publicarEstadoDebug } from './debug';
import { atualizarVirada, iniciarVirada } from './virada-de-unidade';
import configAnimacao from '../../data/animacao-unidade.json';

/** Cena isolada: não importa nem inicia a sessão ou o laço da simulação. */
class VitrineDoSerf extends Phaser.Scene {
  constructor() { super('vitrine-serf'); }
  preload(): void {
    this.load.atlas(atlasDeDepuracao.chave, atlasDeDepuracao.url, atlasDeDepuracao.dados);
  }
  create(): void {
    const debug = publicarEstadoDebug({ pausado: true, velocidade: 1, alfa: () => 1,
      pausar: () => undefined, retomar: () => undefined, avancar: () => undefined });
    const entrada = assetDaCamada(manifestoDeDepuracao, 'unidade', 'serf');
    if (!entrada?.animacoes) throw new Error('Vitrine sem animações do serf');
    this.add.text(24, 14, 'Serf · sprites de depuração · 8 direções', { fontSize: '24px', color: '#ffffff' });
    this.add.text(24, 48, 'Pé na linha · oeste espelha o leste · walk de 8 quadros', { fontSize: '16px', color: '#c4cbd5' });
    const pes: { frame: string; direcao: string; espelhado: boolean; peY: number }[] = [];
    let coluna = 0;
    for (const [animacao, dado] of Object.entries(entrada.animacoes)) {
      this.add.text(120 + coluna * 60, 78, `${animacao} (${dado.quadros})`, { fontSize: '17px', color: '#ffffff' });
      for (const [linha, direcao] of DIRECOES.entries()) {
        const peY = 176 + linha * 72;
        if (coluna === 0) this.add.text(30, peY - 38, direcao.toUpperCase(), { fontSize: '19px', color: '#ffffff' });
        for (let quadro = 0; quadro < dado.quadros; quadro++) {
          const sprite = spriteDoAtlas(manifestoDeDepuracao, 'serf', animacao, direcao, quadro,
            (chave, frame) => this.textures.get(chave).has(frame));
          if (!sprite) throw new Error(`Vitrine sem ${animacao}/${direcao}/${quadro}`);
          const x = 144 + (coluna + quadro) * 60;
          this.add.rectangle(x, peY, 46, 1, 0x607080);
          const imagem = this.add.image(x, peY, sprite.chave, sprite.frame).setOrigin(0.5, 1).setScale(0.6).setFlipX(sprite.espelhar);
          this.add.text(x, peY + 3, `${quadro}`, { fontSize: '12px', color: '#c4cbd5' }).setOrigin(0.5, 0);
          pes.push({ frame: imagem.frame.name, direcao, espelhado: imagem.flipX, peY: peDoSprite(imagem) - peY });
        }
      }
      coluna += dado.quadros;
    }
    debug.pesDosQuadrosDoSerf = pes;
    const demonstração = this.add.image(1180, 755, atlasDeDepuracao.chave).setOrigin(0.5, 1).setScale(0.6).setVisible(false);
    const rotulo = this.add.text(860, 725, '', { fontSize: '16px', color: '#ffffff' });
    debug.mostrarViradaDoSerf = (tempoTicks) => {
      const comecou = atualizarVirada(iniciarVirada('n', 0), 's', 0, configAnimacao.passoDaViradaTicks);
      const virada = atualizarVirada(comecou, 's', tempoTicks, configAnimacao.passoDaViradaTicks);
      const andar = entrada.animacoes?.andar;
      if (!andar?.tilesPorCiclo) return;
      const distancia = tempoTicks * andar.tilesPorCiclo / andar.quadros;
      const quadro = quadroDoAndar(distancia, andar.tilesPorCiclo, andar.quadros);
      const sprite = spriteDoAtlas(manifestoDeDepuracao, 'serf', 'andar', virada.visivel, quadro,
        (chave, frame) => this.textures.get(chave).has(frame));
      if (!sprite) return;
      demonstração.setFrame(sprite.frame).setFlipX(sprite.espelhar).setVisible(true);
      rotulo.setText(`Virada N → S: ${virada.visivel.toUpperCase()} · quadro ${quadro}`);
      debug.viradaDoSerf = { direcao: virada.visivel, quadro, peY: peDoSprite(demonstração) - demonstração.y };
    };
    debug.renderizador = { tipo: this.game.renderer.type, webgl: Phaser.WEBGL };
    debug.pronto = true;
    debug.fixarCamera = ({ scrollX, scrollY }) => {
      if (scrollX !== undefined) this.cameras.main.scrollX = scrollX;
      if (scrollY !== undefined) this.cameras.main.scrollY = scrollY;
    };
  }
}

const barra = document.getElementById('barra');
if (barra) barra.style.display = 'none';
const jogo = document.getElementById('jogo');
if (jogo) Object.assign(jogo.style, { position: 'fixed', inset: '0', width: '100%', height: '100%' });
new Phaser.Game({ type: Phaser.WEBGL, parent: 'jogo', backgroundColor: '#16202b', pixelArt: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 768 }, scene: [VitrineDoSerf] });
