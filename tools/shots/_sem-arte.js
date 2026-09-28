'use strict';
// Reabre a pagina com `?semArte=<ids>`: o loader nao traz a arte desses predios e
// eles caem no placeholder do §9 (retangulo, e os seis estagios na obra).
//
// Existe porque o lado do fallback nao pode depender de qual predio o manifesto
// deixou sem arte. F17e e F17f quebraram DUAS vezes pela mesma causa: o predio que
// o roteiro escolhia por nao ter arte ganhou arte (a escola em `f83f8a4`, a torre e
// a pedreira com a arte nova). Agora o roteiro escolhe o predio pela geometria e
// tira a arte dele na pagina; o manifesto pode ter arte para os 28.
//
// Afirma que a pagina LEU o parametro (`__cangaco.prediosSemArte`): sem isso um
// parametro ignorado deixaria o roteiro medindo a arte e acusando outra coisa.

/** Tempo para a pagina recarregada ficar pronta — o mesmo teto do runner. */
const TETO_PRONTO_MS = 10_000;

async function abrirSemArte(ctx, ids) {
  const { page, afirmar } = ctx;
  const base = page.url().split('?')[0];
  await page.goto(`${base}?pausado&semArte=${ids.join(',')}`);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TETO_PRONTO_MS });
  const lidos = await page.evaluate(() => [...window.__cangaco.prediosSemArte]);
  afirmar(
    JSON.stringify([...lidos].sort()) === JSON.stringify([...ids].sort()),
    `a pagina deveria tirar a arte de ${JSON.stringify(ids)}, leu ${JSON.stringify(lidos)}`,
  );
  const s = await page.evaluate(() => ({ tick: window.__cangaco.tick, pausado: window.__cangaco.pausado }));
  afirmar(s.tick === 0 && s.pausado, `a pagina recarregada deveria nascer pausada no tick 0, veio ${JSON.stringify(s)}`);
}

module.exports = { abrirSemArte };
