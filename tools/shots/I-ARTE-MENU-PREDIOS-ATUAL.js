async function roteiro({page,capturar,afirmar}) {
  // Menu vivo: pelo menos uma troca com down/up e o relogio andando.
  await page.keyboard.press('p');
  const abas = await page.locator('#menu-build button').evaluateAll(ns=>ns.map(n=>({texto:n.textContent,html:n.outerHTML}))) ;
  const mato = page.locator('#menu-build button').filter({hasText:'Mato e Pedra'}).first();
  await mato.scrollIntoViewIfNeeded();
  const box=await mato.boundingBox();
  afirmar(box!==null,`aba mato presente: ${JSON.stringify(abas)}`);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(150);await page.mouse.up();
  await page.keyboard.press('p');await page.waitForTimeout(150);
  for(const nome of ['Casa do Lenhador','Pedreira']) {
    const botao=page.locator('#menu-build button').filter({hasText:nome}).first();
    afirmar(await botao.count()>0,`${nome} no menu`);
  }
  await capturar('lenhador-e-pedreira');
  await page.locator('#menu-build button').filter({hasText:/^Vila$/}).first().click();await page.waitForTimeout(150);
  afirmar(await page.locator('#menu-build button').filter({hasText:'Igreja'}).count()>0,'Igreja no menu');
  await page.locator('#menu-build button').filter({hasText:'Igreja'}).first().scrollIntoViewIfNeeded();
  await capturar('igreja');
}
module.exports={roteiro};
