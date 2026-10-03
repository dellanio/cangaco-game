'use strict';
const {URL}=require('node:url');
const {readFileSync,writeFileSync}=require('node:fs');
const {retanguloDoCanvas}=require('./_canvas');
async function roteiro({page,estado,afirmar,capturar}) {
  const abrir=async(busca)=>{await page.goto(new URL(`/${busca}`,page.url()).href);await page.waitForFunction(()=>window.__cangaco?.pronto);};
  await abrir('?vitrine=militia');
  let s=await estado();
  afirmar(s.pesDosQuadrosDoSerf.length===192,'militia deve resolver 24 quadros × oito direções');
  afirmar(s.pesDosQuadrosDoSerf.every((p)=>p.peY===0),'pé deve permanecer constante');
  afirmar(s.pesDosQuadrosDoSerf.every((p)=>p.espelhado===['so','o','no'].includes(p.direcao)),'espelho deve ser oeste');
  await capturar('vitrine-militar-arma-escudo');
  await abrir('?pausado&depuracao=militia');
  const carregar=async(nome)=>{
    await page.evaluate((texto)=>window.localStorage.setItem('cangaco:partida',texto),readFileSync(`test-output/D-TELA-05b-${nome}.save.txt`,'utf8'));
    await page.keyboard.press('h');await page.click('#ajuda [data-acao="carregar"]');await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const st=await estado(),u=st.unidadesRenderizadas.find((v)=>v.id==='piloto'),c=await retanguloDoCanvas(page);
    await page.evaluate((cam)=>window.__cangaco.fixarCamera(cam),{scrollX:u.gx*64-c.width/2,scrollY:u.gy*64-c.height/2});
    await page.waitForTimeout(150);
  };
  await carregar('inicio');s=await estado();
  afirmar(s.unidadesRenderizadas.find((u)=>u.id==='piloto')?.direcao==='l','militar parado deve olhar direção lógica leste');
  await capturar('parado-direcao-da-sim');
  await carregar('marcha');
  const passos=[];
  for(let i=0;i<600;i++) {
    await page.evaluate(()=>window.__cangaco.avancar(1));await page.waitForTimeout(20);
    s=await estado();const u=s.unidadesRenderizadas.find((v)=>v.id==='piloto');
    afirmar(u.frame && u.peY===0,'militar deve usar atlas com pé constante');
    passos.push({tick:s.tick,direcao:u.direcao,quadro:u.quadro,distancia:u.distanciaAnimada,fsm:u.fsm});
    if(u.animacao==='andar') afirmar(u.quadro===Math.floor(u.distanciaAnimada/2*8)%8,'passada deve seguir distância');
    if(u.fsm==='ocioso') break;
  }
  // A sim termina na direção final; a virada visual aprovada termina seus degraus.
  await page.evaluate(()=>window.__cangaco.avancar(3));await page.waitForTimeout(150);
  s=await estado();afirmar(s.unidadesRenderizadas.find((u)=>u.id==='piloto')?.direcao==='n','formação deve terminar olhando norte');
  await page.keyboard.press('p');await page.waitForTimeout(150);await page.keyboard.press('p');await page.waitForTimeout(150);
  s=await estado();afirmar(s.animacoesDeUnidadeTrabalhadas===0,'pausa deve dar zero trabalho de animação');
  await capturar('formacao-direcao-final');
  writeFileSync('test-output/D-TELA-05b-roteiro.json',JSON.stringify({passos,memoria:s.memoriaDeTexturas},null,2));
  const pedidos=[];page.on('request',(r)=>{if(r.url().includes('/assets/depuracao/'))pedidos.push(r.url());});
  await abrir('?pausado');afirmar(pedidos.length===0,'jogo normal não deve importar fixtures');
}
module.exports={roteiro};
