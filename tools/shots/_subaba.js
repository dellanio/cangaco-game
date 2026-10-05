'use strict';
// I-TELA-SUBABAS-DO-CONSTRUIR (2026-10-05) — os roteiros miram o botao de um predio por
// `[data-predio="<id>"]`, e desde as sub-abas so a grade da sub-aba escolhida esta visivel. Para nao
// reescrever 38 roteiros, o `shot.js` envolve a pagina: antes de mirar um botao de predio do menu, abre
// a sub-aba dele com um clique de DOM. O gesto da sub-aba em si (mouse de verdade, despausado e
// segurando 150 ms, CLAUDE.md §8) e exercido nos roteiros F06 e UI-barra-a, nao aqui.

/** O id do predio do menu num seletor (`[data-predio="x"]`), ou null. `data-predio-aberto` nao conta. */
function predioDoSeletor(seletor) {
  if (typeof seletor !== 'string') return null;
  const m = /\[data-predio="([^"]+)"\]/.exec(seletor);
  return m === null ? null : m[1];
}

/** Abre, na pagina, a sub-aba do predio `id` se a grade dele estiver escondida. */
async function abrirSubabaDe(evaluate, id) {
  await evaluate((p) => {
    const botao = window.document.querySelector(`#menu-build [data-predio="${p}"]`);
    const grade = botao && botao.closest('.grade');
    if (!grade || !grade.hidden) return;
    const subaba = window.document.querySelector(`#menu-build .subaba[data-grupo="${grade.dataset.grupo}"]`);
    if (subaba) subaba.click();
  }, id);
}

/** Envolve os metodos da pagina que recebem seletor (ou seletor como argumento do evaluate). */
function comSubabaAutomatica(page) {
  const evaluate = page.evaluate.bind(page);
  const antes = async (seletor) => {
    const id = predioDoSeletor(seletor);
    if (id !== null) await abrirSubabaDe(evaluate, id);
  };
  for (const metodo of ['click', 'hover', 'focus', 'dblclick', '$', '$eval', 'waitForSelector', 'isVisible']) {
    const original = page[metodo].bind(page);
    page[metodo] = async (seletor, ...resto) => { await antes(seletor); return original(seletor, ...resto); };
  }
  page.evaluate = async (fn, arg) => { await antes(arg); return evaluate(fn, arg); };
  const locator = page.locator.bind(page);
  page.locator = (seletor, ...resto) => {
    const l = locator(seletor, ...resto);
    const id = predioDoSeletor(seletor);
    if (id === null) return l;
    for (const metodo of ['click', 'hover', 'focus', 'boundingBox', 'isVisible', 'scrollIntoViewIfNeeded', 'dispatchEvent']) {
      const original = l[metodo].bind(l);
      l[metodo] = async (...a) => { await abrirSubabaDe(evaluate, id); return original(...a); };
    }
    return l;
  };
  return page;
}

module.exports = { comSubabaAutomatica, predioDoSeletor };
