'use strict';
const { roteiro: crescimento } = require('./F-REPL-e');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
async function roteiro(ctx) {
  const evidencia = 'I-ARTE-ARVORE-CRESCENDO-roteiro';
  const plano = JSON.parse(readFileSync(`test-output/${evidencia}.json`, 'utf8'));
  const vistos = new Set();
  await crescimento({ ...ctx, evidencia, capturar: async nome => {
    if (['muda', 'crescendo_1', 'crescendo_2'].includes(nome)) {
      const desenho = (await ctx.estado()).crescimentoDasArvores[plano.tile];
      ctx.afirmar(desenho.fonte === 'png' && desenho.escala === 1 && desenho.especie === 'presente', `${nome}: juazeiro proprio em jogo`);
      vistos.add(nome);
    }
    await ctx.capturar(nome);
  } });
  ctx.afirmar(vistos.size === 3, 'tres estados passaram pelo relogio real');
  execFileSync(process.execPath, ['tools/prancha-crescimento-arvore.mjs', 'assets/sprites/vegetation', 'screenshots/I-ARTE-ARVORE-CRESCENDO-pranchas'], { stdio: 'inherit' });
}
module.exports = { roteiro };
