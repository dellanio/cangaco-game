#!/usr/bin/env node
'use strict';
// I-COMBATE-CAMPANHA-JOGADA (BUILD_PLAN.md) — joga as fases da campanha sem tela, com os dois
// jogadores automaticos de tests/helpers/jogador-da-campanha.ts, e grava a evidencia em
// test-output/I-COMBATE-CAMPANHA-JOGADA.json. Carrega o TypeScript pelo Vite, como o tools/sim.js.
//
//   node tools/trava-de-testes.js node tools/jogar-campanha.js [fase-02-patos ...]
//
// Sem argumento, roda as dez fases. Cada corrida vai ate o fim da fase, ate o prazo dela, ou ate
// 30 min de jogo. Os alvos de desenho (A a D) sao conferidos aqui e vao para a evidencia: nao sao
// asserção de teste (CLAUDE.md, "teste afirma mecanica").
const { createServer } = require('vite');
const fs = require('node:fs');
const path = require('node:path');

const TETO_DE_TICKS = 30 * 60 * 10;
const CINCO_MIN = 5 * 60 * 10;
const LUTAR = new Set([7, 9, 10]);
const CONSTRUIR_COM_PRESSAO = new Set([1, 2, 4, 5, 8]);
const CONSTRUIR_DE_DESTRUIR = new Set([1, 2, 3, 6, 8]);
const CONSTRUIR = new Set([1, 2, 3, 4, 5, 6, 8]);

function alvos(numero, objetivo, corridas) {
  const p = corridas.passivo;
  const a = corridas.ataque;
  const out = [];
  if (objetivo === 'destruir' || objetivo === 'capturar') {
    out.push({ alvo: 'A', ok: p.resultado !== 'vitoria', medida: `passivo: ${p.resultado}` });
  }
  if (LUTAR.has(numero)) out.push({ alvo: 'B', ok: a.resultado === 'vitoria', medida: `ataque: ${a.resultado} aos ${a.segundosDeJogo} s` });
  if (CONSTRUIR_COM_PRESSAO.has(numero)) {
    const cedo = p.resultado === 'derrota' && p.tick < CINCO_MIN;
    out.push({ alvo: 'C', ok: !cedo && p.resultado !== 'vitoria', medida: `passivo: ${p.resultado} aos ${p.segundosDeJogo} s` });
  }
  if (CONSTRUIR_DE_DESTRUIR.has(numero)) out.push({ alvo: 'D', ok: a.resultado !== 'vitoria', medida: `ataque: ${a.resultado} aos ${a.segundosDeJogo} s, sobram ${a.militaresDoJogador} x ${a.militaresInimigos}` });
  if (CONSTRUIR.has(numero)) {
    const r = corridas.reforco;
    const defender = objetivo === 'sobreviver' || objetivo === 'manter';
    const ok = defender ? r.resultado !== 'derrota' : r.resultado === 'vitoria';
    out.push({ alvo: 'E', ok, medida: `reforco: ${r.resultado} aos ${r.segundosDeJogo} s, sobram ${r.militaresDoJogador} x ${r.militaresInimigos}` });
  }
  return out;
}

async function main() {
  const pedidas = process.argv.slice(2);
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { dadosDaFase, criarFase } = await server.ssrLoadModule('/src/sim/fase.ts');
    const { rawGameData } = await server.ssrLoadModule('/src/sim/data/raw.ts');
    const { jogar } = await server.ssrLoadModule('/tests/helpers/jogador-da-campanha.ts');
    const ids = rawGameData.fases.map((f) => f.id).filter((id) => pedidas.length === 0 || pedidas.includes(id));
    const fases = [];
    for (const id of ids) {
      const dados = dadosDaFase(id);
      const fase = dados.campanha.fases.find((f) => f.id === id);
      const prazo = fase.objetivos.derrota.find((o) => o.tipo === 'prazo');
      const ticks = prazo !== undefined ? prazo.ticks + 1 : TETO_DE_TICKS;
      const corridas = {};
      for (const jogador of ['passivo', 'ataque', 'reforco']) {
        const inicio = Date.now();
        const { corrida } = jogar(criarFase(id, dados), jogador, ticks, dados);
        corridas[jogador] = { ...corrida, segundosDeParede: Math.round((Date.now() - inicio) / 100) / 10 };
        console.log(`${id} ${jogador}: ${corrida.resultado} aos ${corrida.segundosDeJogo} s; jogador ${corrida.militaresDoJogador}, inimigo ${corrida.militaresInimigos} tropas / ${corrida.prediosInimigos} predios; ondas ${corrida.ondasDisparadas}; recusas ${JSON.stringify(corrida.recusas)}`);
      }
      const objetivo = fase.objetivos.vitoria[0]?.tipo ?? '?';
      const conferidos = alvos(fase.numero, objetivo, corridas);
      for (const c of conferidos) console.log(`   alvo ${c.alvo}: ${c.ok ? 'ok' : 'ERRA'} (${c.medida})`);
      fases.push({ id, numero: fase.numero, modo: fase.modo, objetivo, ticksDaCorrida: ticks, corridas, alvos: conferidos });
    }
    const saida = path.join('test-output', 'I-COMBATE-CAMPANHA-JOGADA.json');
    const anterior = fs.existsSync(saida) ? JSON.parse(fs.readFileSync(saida, 'utf8')) : { fases: [] };
    const porId = new Map(anterior.fases.map((f) => [f.id, f]));
    for (const f of fases) porId.set(f.id, f);
    const todas = [...porId.values()].sort((a, b) => a.numero - b.numero);
    fs.mkdirSync('test-output', { recursive: true });
    fs.writeFileSync(saida, `${JSON.stringify({ feature: 'I-COMBATE-CAMPANHA-JOGADA', fases: todas }, null, 2)}\n`);
    const erros = fases.flatMap((f) => f.alvos.filter((a) => !a.ok).map((a) => `${f.id}:${a.alvo}`));
    console.log(erros.length === 0 ? 'todos os alvos ok' : `alvos errados: ${erros.join(', ')}`);
    process.exitCode = erros.length === 0 ? 0 : 1;
  } finally {
    await server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
