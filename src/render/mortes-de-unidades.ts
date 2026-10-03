import type Phaser from 'phaser';
import tempo from '../../data/time.json';
import { assetDaCamada } from './manifesto';
import type { AnimacaoDeUnidade } from './manifesto';
import { depuracaoDeUnidade, mesclarManifestos, quadroPeloTempo, spriteDoAtlas, unidadeNaVista } from './animacao-de-unidade';
import { manifestoDoJogo } from './sprites';
import { depuracaoRegistrada } from './registro-de-depuracao';
import { gridToScreenCentro, deslocamentoDaUnidade, depthDeY, ESCALA_DO_MUNDO } from './grid';
import { peDoSprite } from './pe-do-sprite';
import type { LuzDoRelevo } from './camada-de-relevo';
import type { MorteVisual } from './observacao-de-unidades';

export interface MorteRenderizada extends MorteVisual { readonly quadro: number; readonly frame: string; readonly peY: number }
export function quadroDaMorte(morte: MorteVisual, agora: number, animacao: AnimacaoDeUnidade): number | null {
  const idade = Math.max(0, agora - morte.tick);
  const duracao = animacao.quadros * tempo.tickHz / (animacao.fps ?? tempo.tickHz);
  return idade >= duracao ? null : quadroPeloTempo(idade, tempo.tickHz, { ...animacao, laco: false });
}

/** Corpos nunca entram na lista viva, acerto, selecao, minimapa ou save. */
export function criarCamadaDeMortes(cena: Phaser.Scene, tilePx: number, luz: LuzDoRelevo | null = null) {
  const manifesto = mesclarManifestos(manifestoDoJogo, depuracaoDeUnidade(window.location.search) ? depuracaoRegistrada()?.manifesto : undefined);
  const corpos = new Map<string, { morte: MorteVisual; imagem: Phaser.GameObjects.Image }>();
  let partida = -1;
  let ultimaChave = '';
  let ultimaLista: readonly MorteRenderizada[] = [];
  const temQuadro = (chave: string, frame: string) => cena.textures.exists(chave) && cena.textures.get(chave).has(frame);
  function limpar(): void { for (const corpo of corpos.values()) corpo.imagem.destroy(); corpos.clear(); ultimaChave = ''; ultimaLista = []; }
  return {
    limpar,
    get quantidade() { return corpos.size; },
    atualizar(mortes: readonly MorteVisual[], agora: number, identidade: number): readonly MorteRenderizada[] {
      if (partida !== identidade) { limpar(); partida = identidade; }
      const vista = cena.cameras.main.worldView;
      const chave = `${agora},${identidade},${vista.x},${vista.y},${vista.right},${vista.bottom}`;
      if (mortes.length === 0 && chave === ultimaChave) return ultimaLista;
      ultimaChave = chave;
      for (const morte of mortes) {
        if (corpos.has(morte.id)) continue;
        const animacao = assetDaCamada(manifesto, 'unidade', morte.tipo)?.animacoes?.morrer;
        if (!animacao) continue;
        const quadro = quadroDaMorte(morte, agora, animacao);
        if (quadro === null) continue;
        const sprite = spriteDoAtlas(manifesto, morte.tipo, 'morrer', morte.direcao, quadro, temQuadro);
        if (!sprite) continue;
        const imagem = cena.add.image(0, 0, sprite.chave, sprite.frame);
        imagem.setOrigin(sprite.entrada.anchor[0], sprite.entrada.anchor[1]);
        corpos.set(morte.id, { morte, imagem });
      }
      const desenhadas: MorteRenderizada[] = [];
      for (const [id, corpo] of corpos) {
        const entrada = assetDaCamada(manifesto, 'unidade', corpo.morte.tipo)!;
        const quadro = quadroDaMorte(corpo.morte, agora, entrada.animacoes!.morrer!);
        const sprite = quadro === null ? null : spriteDoAtlas(manifesto, corpo.morte.tipo, 'morrer', corpo.morte.direcao, quadro, temQuadro);
        if (!sprite) { corpo.imagem.destroy(); corpos.delete(id); continue; }
        const centro = gridToScreenCentro(corpo.morte, tilePx, ESCALA_DO_MUNDO);
        const desvio = deslocamentoDaUnidade(id, tilePx, ESCALA_DO_MUNDO);
        const x = centro.x + desvio.x, y = centro.y + desvio.y;
        corpo.imagem.setPosition(x, y).setDepth(depthDeY(y)).setFrame(sprite.frame).setFlipX(sprite.espelhar);
        corpo.imagem.setVisible(unidadeNaVista({ x, y }, entrada.tamanho, entrada.anchor, cena.cameras.main.worldView));
        luz?.tingirPelaPosicao(corpo.imagem, x, y, 'mortes-de-unidades');
        desenhadas.push({ ...corpo.morte, quadro: quadro!, frame: sprite.frame, peY: peDoSprite(corpo.imagem) - corpo.imagem.y });
      }
      ultimaLista = desenhadas;
      return ultimaLista;
    },
  };
}
