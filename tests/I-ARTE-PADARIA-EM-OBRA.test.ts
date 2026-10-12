import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import manifesto from '../assets/manifest.json';
import config from '../data/bakery-obra-arte.json';
import { createInitialState, completarObra, LADO_DO_JOGADOR } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import { canPlace } from '../src/sim/placement';
import { caixaDeTipo } from '../src/sim/footprint';
import { salvar } from '../src/sim/save';
import { gravarEvidencia } from './helpers/evidence';
const require = createRequire(import.meta.url);
interface Png { width: number; height: number; data: Uint8Array }
const { decodePng } = require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as { decodePng: (b: Uint8Array) => Png };
const entrada = manifesto.assets.find(a => a.id === 'bakery')!;
const estados = entrada.estados as Readonly<Record<string, string>>;
function pe(p: Png): number { for (let y = p.height - 1; y >= 0; y--) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3]! > 0) return y; return -1; }
describe('I-ARTE-PADARIA-EM-OBRA', () => {
  it('mede PNGs e preserva completo, origem, footprint e todos os anchors', () => {
    expect(Object.keys(estados).sort()).toEqual([...config.estados].sort());
    expect(estados['completo']).toBe('sprites/bakery/completo-D.png');
    expect(entrada.origem.base).toBe('base/bakery/bakery-D-master-2x.png');
    expect(createHash('sha256').update(readFileSync('assets/sprites/bakery/completo-D.png')).digest('hex')).toBe('98482c9d6cdac47da77336729c61da1da69d0f74c37dfcb66f356cd9ffbfd6f4');
    expect(entrada.anchor).toEqual(config.anchor); expect(entrada.footprint).toEqual([3,3]);
    expect(entrada.ancoras).toEqual({"bandeira":[0.45312,0.05729],"trabalho":{"area":[0.39,0.42,0.63,0.67],"fumaca":[0.765625,0.09375]},"estoque":{"entrada":[[0.23,0.81]],"saida":[[0.72,0.83]]}});
    const medidas = config.estados.map(s => { const p=decodePng(readFileSync(`assets/${estados[s]}`)); expect([p.width,p.height]).toEqual(config.canvas); expect(pe(p)).toBe(config.pe); return { estado:s, tamanho:[p.width,p.height],pe:pe(p) }; });
    const master=decodePng(readFileSync('assets/base/bakery/bakery-madeira-20261012-master-2x.png'));
    expect([master.width,master.height]).toEqual(config.master); expect(pe(master)).toBe((config.pe+1)*2-1);
    gravarEvidencia('I-ARTE-PADARIA-EM-OBRA',{medidas,anchor:entrada.anchor});
  });
  it('monta cenários de obra e completo em lote legal sem culturas para o roteiro', () => {
    const def=gameData.predios.find(p=>p.id==='bakery')!;
    const base=createInitialState(1), inicial={...base,tiposJaConstruidos:[...base.tiposJaConstruidos,def.desbloqueadoPor!]};
    const vila=gameData.economia.estadoInicial.predios.find(p=>p.id==='storehouse')!;
    let local:{gx:number;gy:number}|undefined;
    for(let r=1;r<=20 && !local;r++) for(let dy=-r;dy<=r && !local;dy++) for(let dx=-r;dx<=r;dx++) {
      const gx=vila.gx+dx,gy=vila.gy+dy, caixa=caixaDeTipo('bakery',gx,gy,gameData); if(!caixa) continue;
      let livre=true; for(let y=caixa.y0;y<caixa.y1;y++) for(let x=caixa.x0;x<caixa.x1;x++) if(inicial.recursos[`${x},${y}`]!==undefined) livre=false;
      if(livre && canPlace(inicial,'bakery',gx,gy).ok) { local={gx,gy}; break; }
    }
    if(!local) throw new Error('sem lote legal para bakery');
    const dir=process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output'; mkdirSync(dir,{recursive:true});
    for(const s of config.estados) {
      const obra={id:'bakery-arte',tipo:'bakery',...local,lado:LADO_DO_JOGADOR,estado:'obra' as const,hp:Math.round(def.hp*def.timber/(def.timber+def.stone)),obra:{faltam:{},nivelamento:0}};
      const p=s==='madeira'?obra:completarObra(obra,gameData);
      const state={...inicial,predios:{ordem:[...inicial.predios.ordem,p.id],porId:{...inicial.predios.porId,[p.id]:p}}};
      writeFileSync(`${dir}/I-ARTE-PADARIA-EM-OBRA-${s}.save.txt`,salvar(state));
    }
  });
});
