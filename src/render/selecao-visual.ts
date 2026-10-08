import estilo from '../../data/selecao-visual.json';
import medidas from '../../data/pes-dos-militares.json';
import {centroDesenhado} from './acerto';
import type {UnidadeDesenhada} from './acerto';
import {LADO_DA_UNIDADE_EM_TILES} from './grid';
export interface GeometriaDoAnel {readonly id:string;readonly x:number;readonly y:number;readonly largura:number;readonly altura:number}
interface MedidaDoQuadro {readonly recuoInferiorPx:number;readonly alturaDoQuadro:number}
const porQuadro:Readonly<Record<string,MedidaDoQuadro|undefined>>=medidas.porQuadro;
export const larguraDoTracoDeSelecao=estilo.larguraDoTracoPx;
/** Compensa somente pixels transparentes abaixo dos pes, no quadro em uso. */
export function geometriaDoAnel(u:UnidadeDesenhada,tilePx:number):GeometriaDoAnel {
  const c=centroDesenhado(u,tilePx),medida=u.frame===undefined?undefined:porQuadro[u.frame];
  const escala=medida&&u.corpoPx?(u.corpoPx.y1-u.corpoPx.y0)/medida.alturaDoQuadro:1;
  const largura=tilePx*LADO_DA_UNIDADE_EM_TILES+estilo.margemDoRaioPx*2;
  return {id:u.id,x:c.x,y:c.y+(u.peY??0)-(medida?.recuoInferiorPx??0)*escala+estilo.deslocamentoDoPePx,largura,altura:largura*estilo.alturaRelativaALargura};
}
