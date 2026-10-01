#!/usr/bin/env node
// PreToolUse em Write|Edit: bloqueia escrita em test-results.json sem verificacao.
// O selo .verify-ok e criado por `npm run verify` (o COMPLETO) e vale 15 minutos. O `verify:rapido`
// (camadas de teste, CLAUDE.md §13) nao o cria e nao serve aqui.
const fs = require('fs');
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const JANELA_SEG = 900;

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  // So interessa quando o ALVO da escrita e o rastreador — nao o conteudo.
  let alvo;
  try {
    const payload = JSON.parse(raw.replace(/^\uFEFF/, '').trim());
    alvo = (payload.tool_input && payload.tool_input.file_path) || '';
  } catch {
    alvo = raw;   // payload ilegivel: volta ao casamento amplo, nunca fail-open
  }
  if (!/(^|[\\/])test-results\.json$/.test(alvo)) process.exit(0);

  let idade = Infinity;
  try {
    idade = (Date.now() - fs.statSync(path.join(root, '.verify-ok')).mtimeMs) / 1000;
  } catch {
    console.error(
      'BLOQUEADO: test-results.json so pode ser alterado apos `npm run verify` passar. ' +
      'Rode a verificacao, confira a evidencia em test-output/ ou screenshots/, e so entao marque a feature.'
    );
    process.exit(2);
  }

  // camadas de teste (2026-10-01): so o selo do verify COMPLETO vale. O `verify:rapido` grava outro
  // arquivo; um .verify-ok legivel com outro `tipo` e recusado. O formato antigo (so a data) e de
  // verify completo, e continua valendo enquanto houver.
  let tipo = 'completo';
  try {
    const conteudo = fs.readFileSync(path.join(root, '.verify-ok'), 'utf8').trim();
    if (conteudo.startsWith('{')) tipo = JSON.parse(conteudo).tipo;
  } catch { tipo = 'ilegivel'; }
  if (tipo !== 'completo') {
    console.error(
      'BLOQUEADO: o selo .verify-ok nao e de um `npm run verify` completo. O `verify:rapido` nao ' +
      'serve para marcar feature: rode `npm run verify`.'
    );
    process.exit(2);
  }

  if (idade > JANELA_SEG) {
    console.error(
      'BLOQUEADO: a ultima verificacao tem mais de 15 minutos e pode nao refletir o codigo atual. ' +
      'Rode `npm run verify` de novo.'
    );
    process.exit(2);
  }
  process.exit(0);
});