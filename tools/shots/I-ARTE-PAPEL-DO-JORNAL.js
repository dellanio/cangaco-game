const antigo=require('./I-TELA-JORNAL');
async function roteiro(ctx){
  let aberto=false;
  await antigo.roteiro({...ctx,capturar:async nome=>{
    const papel=await ctx.page.evaluate(async()=>{
      const n=window.document.querySelector('#jornal');
      if(n.hidden)return null;
      const p=n.querySelector('.papel'),s=window.getComputedStyle(p);
      const titulo=window.getComputedStyle(n.querySelector('h1'));
      const url=s.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      if(!url)return {erro:'sem imagem'};
      const i=new window.Image();i.src=url;await i.decode();
      return {familia:s.fontFamily,titulo:titulo.fontFamily,w:i.naturalWidth,h:i.naturalHeight,texto:n.querySelector('.noticia')?.textContent};
    });
    if(papel){aberto=true;ctx.afirmar(papel.w===768&&papel.h===512,'textura carregada no jornal');ctx.afirmar(papel.familia.includes('serif')&&papel.titulo.includes('Georgia'),'fontes serifadas no corpo e titulo');ctx.afirmar(Boolean(papel.texto),'noticia presente sobre o papel');}
    await ctx.capturar(nome);
  }});
  ctx.afirmar(aberto,'jornal foi inspecionado aberto');
}
module.exports={roteiro};
