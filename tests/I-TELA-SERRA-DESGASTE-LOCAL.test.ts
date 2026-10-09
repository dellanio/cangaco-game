import { describe, expect, it } from 'vitest';
import { configDaSerra, MemoriaDaSerra, trechoDaSerra, texturaDaSerra, validarConfigDaSerra, volumeDaSerra } from '../src/render/serra';
import manifesto from '../assets/manifest.json';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { cenarioDePedreira, comEspacoNaSaida } from './helpers/producao-cenario';
import { createRequire } from 'node:module';
const { validarSerra } = createRequire(import.meta.url)('../tools/data-rules.js') as {
  validarSerra: (config: unknown, erros: string[]) => void;
};

describe('I-TELA-SERRA-DESGASTE-LOCAL — selecao local de volumes', () => {
  it('80 derivados passam no validador artistico original, sem tolerancias customizadas', () => {
    const {validateSpriteSpec}=createRequire(import.meta.url)('../skills/pianco-sprite-tools/scripts/validate-sprites.mjs') as {
      validateSpriteSpec:(s:unknown)=>{success:boolean;errors:unknown[]};
    };
    const frames=configDaSerra.volumes.flatMap(volume=>Array.from({length:16},(_,h)=>({
      state:`v${volume}:h${h}`,direction:'front',index:0,
      path:`assets/sprites/props/rock-serra-local/v${volume}-h${h}.png`,pivot:[0.5,1],
    })));
    const report=validateSpriteSpec({id:'rock',kind:'resource',mode:'trial',frameSize:[128,160],masterSize:[256,320],frames});
    expect(frames).toHaveLength(80);expect(report.errors).toEqual([]);expect(report.success).toBe(true);
  });
  it('405 combinacoes de altura/chao selecionam exatamente o desenho nativo de h', () => {
    const entrada=manifesto.assets.find(a=>a.id==='rock' && a.tipo==='vegetacao')!;
    const estados=entrada.estados as Record<string,string>;
    let contagem=0;
    for(const volume of configDaSerra.volumes) for(let m=0;m<16;m++) for(let h=0;h<16;h++) {
      if((h&m)!==h) continue;
      const recursos:Record<string,{tipo:string;quantidade:number}>={'0,0':{tipo:'rock',quantidade:volume}};
      // Volume3 nao tem vizinho positivo mais baixo: comprova aliases pela tabela,
      // e as combinacoes realizaveis pela regra.
      for(const [x,y,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]]) if(m&bit!) recursos[`${x},${y}`]={tipo:'rock',quantidade:(h&bit!)?15:1};
      const trecho=trechoDaSerra(recursos,0,0,15)!;
      expect(trecho.altura & ~trecho.mascara).toBe(0);
      expect(trecho.altura).toBe(volume===3?m:h);
      const estado=`v${volume}:h${h}:m${m}`;
      expect(estados[estado]).toBe(`sprites/props/rock-serra-local/v${volume}-h${h}.png`);
      contagem++;
    }
    expect(contagem).toBe(405);
    expect(entrada.anchor).toEqual([0.5,1]);
    expect(estados.presente).toBe('sprites/props/rock-autotile/rock.png');
    for(let m=0;m<16;m++) expect(estados[`m${m}`]).toBe(`sprites/props/rock-autotile/rock-m${m}.png`);
  });
  it('80 PNGs nativos preservam canvas e pe; bases e ids/hash da geracao versionados', () => {
    const {decodePng}=createRequire(import.meta.url)('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as {
      decodePng:(b:Uint8Array)=>{width:number;height:number;data:Uint8Array};
    };
    for(const volume of configDaSerra.volumes) for(let h=0;h<16;h++) {
      const png=decodePng(readFileSync(`assets/sprites/props/rock-serra-local/v${volume}-h${h}.png`));
      expect([png.width,png.height]).toEqual([128,160]);
      let pe=-1;
      for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++)if(png.data[(y*png.width+x)*4+3]!>0)pe=y;
      expect(pe).toBe(157);
    }
    const geracoes=JSON.parse(readFileSync('assets/base/rock-serra-local/geracoes.json','utf8')) as {registros:Array<{volume:number;sha256:string;prompt:string}>};
    expect(geracoes.registros.map(r=>r.volume)).toEqual([...configDaSerra.volumes]);
    for(const registro of geracoes.registros){
      expect(createHash('sha256').update(readFileSync(`assets/base/rock-serra-local/volume-${registro.volume}.png`)).digest('hex')).toBe(registro.sha256);
      expect(registro.prompt.length).toBeGreaterThan(100);
    }
  });
  it('cache nao recalcula por quadro, nao repinta por quantidade no mesmo patamar e refaz vizinhos pela altura', () => {
    const memoria=new MemoriaDaSerra();
    const r={'0,0':{tipo:'rock',quantidade:15},'1,0':{tipo:'rock',quantidade:15}};
    expect(memoria.atualizar(r,0,15)).toHaveLength(2);
    expect(memoria.atualizar(r,0,15)).toEqual([]);
    expect(memoria.recalculos).toBe(1);
    expect(memoria.atualizar({...r,'0,0':{tipo:'rock',quantidade:14}},1,15)).toEqual([]);
    expect([...memoria.atualizar({...r,'0,0':{tipo:'rock',quantidade:12}},2,15)].sort()).toEqual(['0,0','1,0']);
    expect(memoria.trechos.get('0,0')?.volume).toBe(12);
    expect(memoria.trechos.get('1,0')?.volume).toBe(15);
    expect(memoria.trechos.get('1,0')?.altura).toBe(0);
    expect([...memoria.atualizar({'1,0':r['1,0']},3,15)].sort()).toEqual(['0,0','1,0']);
    expect(memoria.trechos.has('0,0')).toBe(false);
    expect(memoria.atualizar(r,0,15)).toHaveLength(2);
  });
  it('cinco patamares, limites, rendimento parametrico e ausencia em zero', () => {
    expect(validarConfigDaSerra(configDaSerra)).toBe(true);
    for (const [q, volume] of [[15,15],[13,15],[12,12],[10,12],[9,9],[7,9],[6,6],[4,6],[3,3],[1,3],[0,null]]) {
      expect(volumeDaSerra(q!,15)).toBe(volume);
      expect(volumeDaSerra(q! * 2,30)).toBe(volume);
    }
    for (const limiares of [[0.8,0.6,0.6,0.2],[1,0.6,0.4,0.2],[0.8,0.6,0.4,0],[0.8]]) {
      expect(validarConfigDaSerra({...configDaSerra,limiares})).toBe(false);
    }
    expect(() => volumeDaSerra(1,0)).toThrow();
  });
  it('dezesseis vizinhancas, altura local independente e desaparecimento', () => {
    const vizinhos = [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]] as const;
    for (let mascara=0;mascara<16;mascara++) {
      const recursos: Record<string,{tipo:string;quantidade:number}> = {'0,0':{tipo:'rock',quantidade:15}};
      for (const [x,y,bit] of vizinhos) if(mascara & bit) recursos[`${x},${y}`]={tipo:'rock',quantidade:9};
      const antes=JSON.stringify(recursos);
      expect(trechoDaSerra(recursos,0,0,15)).toEqual({volume:15,mascara,altura:0,estado:`v15:h0:m${mascara}`});
      expect(JSON.stringify(recursos)).toBe(antes);
      recursos['0,0']={tipo:'rock',quantidade:3};
      expect(trechoDaSerra(recursos,0,0,15)?.volume).toBe(3);
      expect(trechoDaSerra(recursos,0,0,15)?.altura).toBe(mascara);
      for(const [x,y,bit] of vizinhos) if(mascara & bit) expect(trechoDaSerra(recursos,x,y,15)?.volume).toBe(9);
      delete recursos['0,0'];
      expect(trechoDaSerra(recursos,0,0,15)).toBeNull();
    }
    const r={'0,0':{tipo:'rock',quantidade:15},'1,0':{tipo:'rock',quantidade:0}};
    expect(trechoDaSerra(r,0,0,15)?.mascara).toBe(0);
  });
  it('fallback conserva arte anterior; nenhuma textura para zero', () => {
    const trecho=trechoDaSerra({'0,0':{tipo:'rock',quantidade:12}},0,0,15);
    expect(texturaDaSerra(trecho,()=>true,'anterior')).toBe('vegetacao:rock:v12:h0:m0');
    expect(texturaDaSerra(trecho,()=>false,'anterior')).toBe('anterior');
    expect(texturaDaSerra(null,()=>true,'anterior')).toBeNull();
  });
  it('validate:data aceita o dado e recusa limites, escala e volumes invalidos', () => {
    const erros:string[]=[];
    validarSerra(configDaSerra,erros);
    expect(erros).toEqual([]);
    for(const invalido of [null,{...configDaSerra,limiares:[0.8,0.6,0.6,0.2]},
      {...configDaSerra,limiares:[1,0.6,0.4,0.2]}, {...configDaSerra,escala:0},
      {...configDaSerra,volumes:[15,12,9,9,3]}, {...configDaSerra,volumes:[15,12]}]) {
      const recusas:string[]=[]; validarSerra(invalido,recusas);
      expect(recusas.length).toBeGreaterThan(0);
      expect(recusas.every(e=>e.startsWith('interface/serra:'))).toBe(true);
    }
  });
  it('extracao real pelo step altera somente o volume local, sem mutar o estado de entrada', () => {
    const inicial=comEspacoNaSaida(cenarioDePedreira(),'q1');
    const antes=JSON.stringify(inicial.recursos);
    const rendimento=gameData.recursos.tipos.rock!.rendimentoPorTile;
    let estado=inicial;
    let alterados:string[]=[];
    for(let ticks=0;ticks<6000 && alterados.length===0;ticks++) {
      estado=step(estado,[]);
      alterados=Object.keys(inicial.recursos).filter(chave=>inicial.recursos[chave]?.tipo==='rock'
        && (estado.recursos[chave]?.quantidade ?? 0)!==inicial.recursos[chave]!.quantidade);
    }
    expect(alterados).toHaveLength(1);
    const chave=alterados[0]!;
    expect((estado.recursos[chave]?.quantidade ?? 0)).toBeLessThan(inicial.recursos[chave]!.quantidade);
    expect(JSON.stringify(inicial.recursos)).toBe(antes);
    for(const [vizinho,recurso] of Object.entries(inicial.recursos)) if(recurso.tipo==='rock' && vizinho!==chave) {
      expect(volumeDaSerra(estado.recursos[vizinho]!.quantidade,rendimento)).toBe(volumeDaSerra(recurso.quantidade,rendimento));
    }
  });
});
