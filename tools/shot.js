#!/usr/bin/env node
'use strict';

// Runner generico de screenshot. NUNCA muda de feature para feature — quem
// muda e o roteiro em tools/shots/<nome>.js, que exporta `async roteiro(ctx)`.
//
// npm run shot -- F04
//
// Responsabilidades fixas, repetidas por toda feature seguinte:
//   sobe o Vite -> espera a porta -> abre Chromium (viewport 1280x720,
//   fixo para captura comparavel entre features) -> reprova se houver erro
//   de console ou pageerror -> espera window.__cangaco.pronto -> roda o
//   roteiro -> grava test-output/<nome>-shot.json -> derruba tudo -> exit 0/1.

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');
// BUG-K: as duas defesas moram em `_servidor.js`, com o `tools/dev.js` (F-DEV).
const { derrubarServidor, portaJaResponde, mensagemDePortaOcupada } = require('./_servidor');

// Fixa e fora da faixa padrao do vite dev, evita colisao. `CANGACO_SHOT_PORTA`
// troca a porta para uma segunda arvore de trabalho rodar roteiro ao mesmo
// tempo: achado da branch estilo-ui (2026-09-25), em que um vite de OUTRA
// sessao ocupava a 5175 e o runner, esperando so a porta responder, mediu o
// index.html errado — com --strictPort o vite daqui morre calado e quem
// responde e o vizinho. Por isso a espera abaixo tambem reprova se o filho
// sair antes de a porta responder.
const PORTA = Number(process.env.CANGACO_SHOT_PORTA ?? 5175);
const VIEWPORT = { width: 1280, height: 720 };
const TIMEOUT_SERVIDOR_MS = 20_000;
const TIMEOUT_PRONTO_MS = 10_000;

function lerNomeDoRoteiro(argv) {
  const nome = argv[0];
  if (!nome) {
    console.error('shot: uso `npm run shot -- <nome>` (ex.: npm run shot -- F04).');
    process.exit(1);
  }
  return nome;
}

function carregarRoteiro(nome) {
  const caminho = path.join(__dirname, 'shots', `${nome}.js`);
  if (!fs.existsSync(caminho)) {
    console.error(`shot: nao existe tools/shots/${nome}.js.`);
    process.exit(1);
  }
  const modulo = require(caminho);
  if (typeof modulo.roteiro !== 'function') {
    console.error(`shot: tools/shots/${nome}.js precisa exportar { roteiro }.`);
    process.exit(1);
  }
  return modulo.roteiro;
}

function subirServidor() {
  const processo = spawn('npx', ['vite', '--port', String(PORTA), '--strictPort'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    // fora do Windows, lider de grupo: `derrubarServidor` derruba o grupo inteiro
    detached: process.platform !== 'win32',
  });
  return processo;
}

async function esperarServidor(url, timeoutMs, processo) {
  const inicio = Date.now();
  for (;;) {
    if (processo.exitCode !== null) {
      throw new Error(`shot: o dev server saiu com codigo ${processo.exitCode} antes de responder em ${url} — a porta ja estava ocupada?`);
    }
    try {
      const resposta = await fetch(url);
      if (resposta.ok) return;
    } catch {
      // servidor ainda nao respondeu; tenta de novo
    }
    if (Date.now() - inicio > timeoutMs) {
      throw new Error(`shot: o dev server nao respondeu em ${url} depois de ${timeoutMs}ms.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function criarCapturador(nomeFeature) {
  let contador = 0;
  const capturas = [];
  return {
    capturas,
    async capturar(page, nomeDoPasso) {
      contador += 1;
      const arquivo = `screenshots/${nomeFeature}-${contador}-${nomeDoPasso}.png`;
      fs.mkdirSync('screenshots', { recursive: true });
      await page.screenshot({ path: arquivo });
      capturas.push(arquivo);
      return arquivo;
    },
  };
}

function criarAfirmador() {
  const afirmacoes = [];
  return {
    afirmacoes,
    afirmar(condicao, mensagem) {
      afirmacoes.push({ mensagem, passou: Boolean(condicao) });
      if (!condicao) {
        throw new Error(`shot: afirmacao falhou — ${mensagem}`);
      }
    },
  };
}

async function main() {
  const nomeFeature = lerNomeDoRoteiro(process.argv.slice(2));
  const roteiro = carregarRoteiro(nomeFeature);

  const url = `http://localhost:${PORTA}/`;
  if (await portaJaResponde(url)) {
    console.error(mensagemDePortaOcupada('shot', PORTA, 'CANGACO_SHOT_PORTA'));
    process.exit(1);
  }

  const errosDeConsole = [];
  const servidor = subirServidor();
  let browser;
  let sucesso = false;
  let motivoDaFalha = null;
  const { capturar, capturas } = criarCapturador(nomeFeature);
  const { afirmar, afirmacoes } = criarAfirmador();

  try {
    await esperarServidor(url, TIMEOUT_SERVIDOR_MS, servidor);

    // CANGACO_CHROMIUM aponta um Chromium ja instalado quando o do Playwright
    // pinado nao existe (sessao de nuvem: o ambiente traz outra revisao e nao
    // deixa baixar). Sem a variavel, o comportamento e o de sempre.
    const executablePath = process.env.CANGACO_CHROMIUM;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    const page = await browser.newPage({ viewport: VIEWPORT });
    // CANGACO_SHOT_NUVEM=1: a sessao de nuvem sai por um proxy que nao entrega a
    // fonte do Google (estilo.css), e o Chromium completo pede /favicon.ico, que
    // o headless shell nao pede. Os dois virariam erro de console alheio ao jogo
    // e reprovariam todo roteiro. Nesse modo, host de fora e favicon recebem 204
    // vazio. O jogo nao muda; sem a variavel, nada disto roda.
    if (process.env.CANGACO_SHOT_NUVEM === '1') {
      await page.route((alvo) => alvo.hostname !== 'localhost' || alvo.pathname === '/favicon.ico',
        (rota) => rota.fulfill({ status: 204, body: '' }));
    }

    page.on('console', (msg) => {
      if (msg.type() === 'error') errosDeConsole.push(msg.text());
    });
    page.on('pageerror', (erro) => {
      errosDeConsole.push(String(erro));
    });

    // `?pausado`: o laco de tempo NASCE pausado (F11a). E um lugar so, e todo roteiro herda: o
    // tick e 0 quando `pronto` fica verdadeiro, sem a janela de ticks (de duracao variavel) que
    // existiria se o runner pausasse DEPOIS do aperto de mao. Roteiro que quer tempo passando usa
    // `window.__cangaco.avancar(n)`, que so funciona com o timer pausado.
    await page.goto(`http://localhost:${PORTA}/?pausado`);
    await page.waitForFunction(
      () => Boolean(window.__cangaco && window.__cangaco.pronto),
      { timeout: TIMEOUT_PRONTO_MS },
    );

    if (errosDeConsole.length > 0) {
      throw new Error(`shot: erro de console antes do roteiro comecar: ${errosDeConsole.join(' | ')}`);
    }

    const ctx = {
      page,
      capturar: (nome) => capturar(page, nome),
      estado: () => page.evaluate(() => window.__cangaco),
      afirmar,
    };

    await roteiro(ctx);

    if (errosDeConsole.length > 0) {
      throw new Error(`shot: erro de console durante o roteiro: ${errosDeConsole.join(' | ')}`);
    }

    sucesso = true;
  } catch (erro) {
    motivoDaFalha = erro instanceof Error ? erro.message : String(erro);
  } finally {
    if (browser) await browser.close();
    derrubarServidor(servidor);
  }

  fs.mkdirSync('test-output', { recursive: true });
  fs.writeFileSync(
    `test-output/${nomeFeature}-shot.json`,
    JSON.stringify({
      feature: nomeFeature,
      sucesso,
      motivoDaFalha,
      capturas,
      afirmacoes,
      errosDeConsole,
    }, null, 2),
  );

  if (!sucesso) {
    console.error(`shot: FALHOU — ${motivoDaFalha}`);
    process.exit(1);
  }

  console.log(`shot — ${nomeFeature}: OK. ${capturas.length} captura(s) em screenshots/.`);
  process.exit(0);
}

main();
