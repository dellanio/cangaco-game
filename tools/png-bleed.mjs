import {readFileSync,writeFileSync} from 'node:fs';
import process from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decodePng,encodePng} from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

/** RGB invisivel na borda. Alpha e todo RGB visivel sao preservados byte a byte. */
export function bleedRgba(image) {
  const {width,height,data}=image;
  const output={width,height,data:new Uint8Array(data)};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(data[i+3]!==0)continue;
    let neighbor=-1,bestAlpha=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=width||ny>=height)continue;
      const j=(ny*width+nx)*4,alpha=data[j+3];
      if(alpha>bestAlpha){bestAlpha=alpha;neighbor=j;}
    }
    if(neighbor<0||bestAlpha<128)continue;
    for(let c=0;c<3;c++)output.data[i+c]=data[neighbor+c];
  }
  return output;
}
export function bleedPng(bytes){return encodePng(bleedRgba(decodePng(bytes)));}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [source,destination]=process.argv.slice(2);
  if(!source||!destination)throw new Error('uso: node tools/png-bleed.mjs <entrada> <saida>');
  writeFileSync(destination,bleedPng(readFileSync(source)));
}
