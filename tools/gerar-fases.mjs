#!/usr/bin/env node
// I-TERRENO-DEZ-MAPAS-DA-CAMPANHA — o gerador das dez fases da campanha. EMITE
// `data/campanha/fase-NN-<local>.json` e o `.tmj` do Tiled em `tools/tiled/fases/`; o jogo nunca roda
// este script. O desenho de cada fase esta em `docs/planos/2026-10-10-campanha-dez-fases.md`, e a
// narrativa em `pianco-campanha-10-missoes.md`.
//
//   node tools/gerar-fases.mjs              # regrava as dez fases e os .tmj
//   node tools/gerar-fases.mjs --conferir   # sai 1 se algum arquivo no disco diferir
//
// DEPOIS DE EMITIDO, O `.tmj` E A FONTE: quem edita no Tiled roda `node tools/mapa-tiled.mjs importar`
// e o JSON da fase passa a ser o editado. Regerar por aqui apaga a edicao (como o `gerar-mapa.js`
// diz do `sertao-128`: a semente vira registro historico).
//
// Os mapas sao 128x128 (o `terrain.mapaPadrao`). Nenhum vem do jogo de 1998 (CLAUDE.md §9): sao
// desenho nosso, do sertao ao litoral.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { escreverFase, LEGENDA } from './fase-formato.mjs';
import { exportar } from './mapa-tiled.mjs';
import { encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TERRENO = JSON.parse(readFileSync(join(RAIZ, 'data', 'terrain.json'), 'utf8'));
const PREDIOS = JSON.parse(readFileSync(join(RAIZ, 'data', 'buildings.json'), 'utf8'));
const LISTA_DE_PREDIOS = Array.isArray(PREDIOS) ? PREDIOS : (PREDIOS.predios ?? PREDIOS.buildings);
const { largura: L, altura: A } = TERRENO.mapaPadrao;
export const PASTA_DAS_FASES = join(RAIZ, 'data', 'campanha');
export const PASTA_DOS_TMJ = join(RAIZ, 'tools', 'tiled', 'fases');

const TRANSPONIVEL = new Set(['g', 'c', 'a']);
const tamanho = (id) => {
  const def = LISTA_DE_PREDIOS.find((p) => p.id === id);
  if (def === undefined) throw new Error(`gerar-fases: predio '${id}' nao existe`);
  return def.tamanho;
};

function mulberry32(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A prancheta de uma fase: o terreno, os recursos e as areas que nada pode tocar. */
class Prancheta {
  constructor(semente) {
    this.rng = mulberry32(semente);
    this.t = Array.from({ length: A }, () => new Array(L).fill('g'));
    this.r = new Map(); // "gx,gy" -> tipo
    this.livre = new Set(); // "gx,gy": chao limpo (vila, praca, porta, nascimento)
  }
  dentro(x, y) { return x >= 0 && y >= 0 && x < L && y < A; }
  set(x, y, ch) { if (this.dentro(x, y)) this.t[y][x] = ch; }
  get(x, y) { return this.dentro(x, y) ? this.t[y][x] : null; }
  rand(a, b) { return a + this.rng() * (b - a); }
  irand(a, b) { return Math.floor(this.rand(a, b + 1)); }

  elipse(cx, cy, rx, ry, ch, borda = 0) {
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) {
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        const ruido = borda > 0 ? (this.rng() - 0.5) * borda : 0;
        if (d <= 1 + ruido) this.set(x, y, ch);
      }
    }
  }
  disco(cx, cy, r, ch, borda = 0) { this.elipse(cx, cy, r, r, ch, borda); }
  retangulo(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch); }
  /** Uma faixa de `largura` tiles ao longo dos pontos. */
  faixa(pontos, largura, ch, borda = 0) {
    for (let i = 0; i + 1 < pontos.length; i++) {
      const [x0, y0] = pontos[i];
      const [x1, y1] = pontos[i + 1];
      const passos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= passos; s++) {
        const x = x0 + ((x1 - x0) * s) / passos;
        const y = y0 + ((y1 - y0) * s) / passos;
        this.disco(x, y, largura / 2, ch, borda);
      }
    }
  }
  /** Serra: o miolo de montanha e um anel de rocha em volta (onde ficam pedra e minerio). */
  serra(pontos, largura) {
    this.faixa(pontos, largura + 4, 'r', 0.3);
    this.faixa(pontos, largura, 'm', 0.3);
  }
  /** Manchas de solo (areia, roçado) SO por cima da grama: nunca abrem a serra, a rocha nem a agua
   *  (medido: a areia pintada depois do anel da fase 4 abriu tres passagens a mais). */
  manchas(ch, n, x0, y0, x1, y1, rmin, rmax) {
    for (let i = 0; i < n; i++) {
      const cx = this.rand(x0, x1);
      const cy = this.rand(y0, y1);
      const r = this.rand(rmin, rmax);
      for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) {
        for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
          const d = ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2;
          if (d <= 1 + (this.rng() - 0.5) * 0.5 && this.get(x, y) === 'g') this.set(x, y, ch);
        }
      }
    }
  }
  // ---------- recursos ----------
  vizinhoDe(x, y, pred) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && pred(this.get(x + dx, y + dy))) return true;
    return false;
  }
  recurso(x, y, tipo) {
    const k = `${x},${y}`;
    if (this.dentro(x, y) && !this.livre.has(k) && !this.r.has(k)) this.r.set(k, tipo);
  }
  /** Arvore (ou cana) no chao, com `densidade`, numa area. */
  vegetacao(tipo, densidade, x0, y0, x1, y1) {
    for (let y = Math.max(0, y0); y <= Math.min(A - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(L - 1, x1); x++) {
        if (this.t[y][x] === 'g' && this.rng() < densidade) this.recurso(x, y, tipo);
      }
    }
  }
  /** Moitas: discos de vegetacao densa. */
  moitas(tipo, n, x0, y0, x1, y1, rmin, rmax, densidade) {
    for (let i = 0; i < n; i++) {
      const cx = this.rand(x0, x1);
      const cy = this.rand(y0, y1);
      const r = this.rand(rmin, rmax);
      this.vegetacao(tipo, densidade, Math.floor(cx - r), Math.floor(cy - r), Math.ceil(cx + r), Math.ceil(cy + r));
    }
  }
  /** Lajedo: rocha rasa com pedra em todo tile. */
  lajedo(cx, cy, r) {
    this.disco(cx, cy, r, 'r', 0.4);
    for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) {
      for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) if (this.get(x, y) === 'r' && Math.hypot(x - cx, y - cy) <= r + 1.5) this.recurso(x, y, 'rock');
    }
  }
  /** Pedra ou minerio na rocha que encosta no chao (onde a pedreira e a mina alcancam), numa area. */
  veio(tipo, n, x0, y0, x1, y1) {
    const candidatos = [];
    for (let y = Math.max(0, y0); y <= Math.min(A - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(L - 1, x1); x++) {
        if (this.t[y][x] === 'r' && this.vizinhoDe(x, y, (c) => TRANSPONIVEL.has(c)) && !this.r.has(`${x},${y}`)) candidatos.push([x, y]);
      }
    }
    for (let i = 0; i < n && candidatos.length > 0; i++) {
      const [x, y] = candidatos.splice(Math.floor(this.rng() * candidatos.length), 1)[0];
      this.recurso(x, y, tipo);
    }
  }
  /** Peixe na agua a um passo da margem. */
  peixe() {
    for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) if (this.t[y][x] === 'w' && this.vizinhoDe(x, y, (c) => TRANSPONIVEL.has(c))) this.recurso(x, y, 'fish');
  }
  /** Limpa (chao, sem recurso) e protege um retangulo. */
  limpar(x0, y0, x1, y1, ch = 'g') {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!this.dentro(x, y)) continue;
        this.t[y][x] = ch;
        this.r.delete(`${x},${y}`);
        this.livre.add(`${x},${y}`);
      }
    }
  }
}

/** Os predios de um lado em fila, a partir de (x, y), com 2 tiles entre eles; limpa a praca em volta. */
function vila(p, x, y, ids) {
  const predios = [];
  let cx = x;
  for (const id of ids) {
    const [w, h] = tamanho(id);
    predios.push({ id, gx: cx, gy: y });
    p.limpar(cx - 2, y - 2, cx + w + 1, y + h + 2);
    cx += w + 2;
  }
  return predios;
}
/** Um predio solto, com a praca dele limpa. */
function predio(p, id, gx, gy) {
  const [w, h] = tamanho(id);
  p.limpar(gx - 2, gy - 2, gx + w + 1, gy + h + 2);
  return { id, gx, gy };
}
/** Unidades num ponto, com o chao do nascimento limpo. */
function tropa(p, tipo, quantidade, gx, gy) {
  p.limpar(gx - 3, gy - 3, gx + 3, gy + 3);
  return { tipo, quantidade, gx, gy };
}

function mapaDe(p) {
  const recursos = {};
  for (const [k, tipo] of p.r) {
    const [x, y] = k.split(',').map(Number);
    // o recurso so fica no terreno dele (CLAUDE.md: peixe na agua, pedra e minerio na rocha ou
    // montanha, arvore e cana no chao); a limpeza da vila pode ter trocado o chao por baixo
    const t = p.t[y][x];
    const ok = tipo === 'fish' ? t === 'w' : (tipo === 'rock' || tipo === 'coal' || tipo === 'iron_ore' || tipo === 'gold_ore') ? (t === 'r' || t === 'm') : t === 'g';
    if (ok) (recursos[tipo] ??= []).push([x, y]);
  }
  return { largura: L, altura: A, legenda: { ...LEGENDA }, linhas: p.t.map((l) => l.join('')), recursos };
}

const BANDO_DO_JOGADOR = 'Moita Seca';
const BANDO_INIMIGO = 'Cabo Branco';
const DOC = 'EMITIDO por tools/gerar-fases.mjs; depois de emitido, a fonte e o .tmj em tools/tiled/fases/ (editar no Tiled e rodar `node tools/mapa-tiled.mjs importar`). Desenho em docs/planos/2026-10-10-campanha-dez-fases.md.';

// ---------- as dez fases ----------
const FASES = [
  {
    n: 1, slug: 'pianco', local: 'Piancó', titulo: 'O que é nosso', ato: 'I', modo: 'construir', semente: 101001,
    narrativa: 'Homens de lenço azul acamparam dentro do Olho d\'Água e estão represando a cacimba. Não vieram conversar.',
    desafio: 'Economia crua. Pedra é o gargalo: um lajedo só, e o jogador escolhe entre estrada e prédio. Três ondas pequenas, espaçadas para dar tempo de treinar.',
    libera: { predios: ['schoolhouse', 'quarry', 'woodcutters', 'sawmill', 'inn', 'barracks', 'weapons_workshop'], tropas: ['militia'] },
    objetivos: { vitoria: [{ tipo: 'destruir', lado: 1, alvo: 'predios' }], derrota: [{ tipo: 'perder', lado: 0, predios: ['storehouse', 'schoolhouse'] }] },
    ondas: [
      { aos_segundos: 420, lado: 1, de: { gx: 124, gy: 64 }, tropas: [{ tipo: 'militia', quantidade: 3 }] },
      { aos_segundos: 840, lado: 1, de: { gx: 124, gy: 64 }, tropas: [{ tipo: 'militia', quantidade: 4 }] },
      { aos_segundos: 1260, lado: 1, de: { gx: 124, gy: 64 }, tropas: [{ tipo: 'militia', quantidade: 5 }] },
    ],
    desenhar(p) {
      p.manchas('a', 22, 0, 0, L, A, 2, 5);
      p.elipse(64, 62, 7, 5, 'w', 0.4); // o Olho d'Agua
      p.serra([[96, 104], [112, 112], [122, 124]], 4);
      p.lajedo(36, 44, 2.2); // o unico lajedo
      p.moitas('tree', 9, 8, 8, 60, 60, 2, 4, 0.5);
      p.vegetacao('tree', 0.035, 0, 0, L - 1, A - 1);
      p.peixe();
      const jogador = vila(p, 18, 20, ['storehouse', 'schoolhouse']);
      const inimigo = [predio(p, 'barracks', 78, 54), predio(p, 'storehouse', 85, 56)];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: { gold: 10, timber: 25, stone: 10, loaves: 10 }, predios: jogador,
            unidades: [tropa(p, 'serf', 4, 21, 27), tropa(p, 'laborer', 2, 25, 27), tropa(p, 'militia', 4, 30, 30)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo, unidades: [tropa(p, 'militia', 6, 82, 62)] },
        ],
      };
    },
  },
  {
    n: 2, slug: 'patos', local: 'Patos', titulo: 'A aliança', ato: 'I', modo: 'construir', semente: 101002,
    narrativa: 'O bando marcha atrás dos que fugiram. Em Patos encontra um entreposto do Cabo Branco, e um emissário com uma proposta.',
    desafio: 'A primeira cadeia de comida inteira, com prazo. O riacho só se atravessa em dois vaus, e a terra boa fica na margem do jogador.',
    libera: { predios: ['farm', 'mill', 'bakery', 'swine_farm', 'butchers', 'tannery', 'armory_workshop'], tropas: ['axe_fighter', 'bowman'] },
    objetivos: {
      vitoria: [{ tipo: 'destruir', lado: 1, alvo: 'predios' }],
      derrota: [{ tipo: 'perder', lado: 0, predios: ['storehouse', 'schoolhouse'] }, { tipo: 'prazo', segundos: 2400 }],
    },
    ondas: [],
    desenhar(p) {
      p.manchas('a', 16, 0, 0, L, A, 2, 4);
      const leito = [[0, 70], [30, 66], [60, 72], [90, 64], [127, 68]];
      p.faixa(leito, 9, 'a'); // as margens de areia
      p.faixa(leito, 4, 'w'); // a agua do riacho
      p.limpar(38, 60, 43, 78, 'a'); // vau oeste
      p.limpar(98, 56, 103, 74, 'a'); // vau leste
      for (const [x0, x1] of [[38, 43], [98, 103]]) for (let y = 0; y < A; y++) for (let x = x0; x <= x1; x++) p.livre.delete(`${x},${y}`);
      p.manchas('c', 7, 22, 54, 72, 61, 2, 4); // terra boa na margem norte
      p.serra([[96, 6], [110, 16], [122, 12]], 4);
      p.veio('rock', 40, 90, 0, 127, 30);
      p.lajedo(44, 36, 3);
      p.moitas('tree', 10, 4, 4, 70, 56, 2, 4, 0.45);
      p.moitas('tree', 8, 60, 80, 127, 127, 2, 4, 0.45);
      p.vegetacao('tree', 0.03, 0, 0, L - 1, A - 1);
      p.peixe();
      const jogador = vila(p, 16, 28, ['storehouse', 'schoolhouse', 'inn']);
      const inimigo = [predio(p, 'storehouse', 86, 90), predio(p, 'barracks', 92, 90), predio(p, 'farm', 86, 97)];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: { gold: 15, timber: 30, stone: 20, loaves: 12, sausages: 6 }, predios: jogador,
            unidades: [tropa(p, 'serf', 6, 20, 36), tropa(p, 'laborer', 3, 26, 36), tropa(p, 'militia', 8, 32, 40)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo, unidades: [tropa(p, 'militia', 8, 96, 102), tropa(p, 'bowman', 4, 90, 104)] },
        ],
      };
    },
  },
  {
    n: 3, slug: 'soledade', local: 'Soledade', titulo: 'Cavalo é bicho de rico', ato: 'I', modo: 'construir', semente: 101003,
    narrativa: 'Soledade é passagem obrigatória, e o Cabo Branco pagou os coronéis da região para fechá-la.',
    desafio: 'Um corredor entre duas serras, com dois postos no estreito. Três Vaqueiros chegam pelos atalhos da serra e caçam o carregador: a lição é posicionamento.',
    libera: { predios: ['gold_mine', 'coal_mine', 'metallurgists'], tropas: [] },
    objetivos: { vitoria: [{ tipo: 'destruir', lado: 1, alvo: 'predios' }], derrota: [{ tipo: 'perder', lado: 0, alvo: 'tropas' }] },
    ondas: [
      { aos_segundos: 600, lado: 1, de: { gx: 96, gy: 4 }, tropas: [{ tipo: 'scout', quantidade: 3 }] },
    ],
    desenhar(p) {
      p.serra([[0, 26], [40, 32], [64, 40], [90, 32], [127, 26]], 16);
      p.serra([[0, 102], [40, 96], [64, 88], [90, 96], [127, 102]], 16);
      p.disco(64, 48, 7, 'm', 0.3);
      p.disco(64, 80, 7, 'm', 0.3);
      // os dois atalhos pela serra (o flanco dos vaqueiros)
      p.faixa([[96, 0], [96, 54]], 2, 'g');
      p.faixa([[102, 127], [102, 76]], 2, 'g');
      p.veio('gold_ore', 10, 8, 40, 44, 56);
      p.veio('coal', 18, 8, 72, 44, 90);
      p.veio('rock', 40, 0, 36, 50, 92);
      p.lajedo(24, 64, 2.5);
      p.vegetacao('tree', 0.06, 0, 50, 127, 80);
      p.manchas('a', 10, 0, 52, 127, 78, 1, 3);
      p.peixe();
      const jogador = vila(p, 6, 58, ['storehouse', 'schoolhouse', 'barracks']);
      const inimigo = [predio(p, 'barracks', 56, 56), predio(p, 'watchtower', 62, 58), predio(p, 'barracks', 68, 66), predio(p, 'watchtower', 74, 68)];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: { gold: 20, timber: 30, stone: 30, loaves: 15, sausages: 10 }, predios: jogador,
            unidades: [tropa(p, 'serf', 6, 8, 68), tropa(p, 'laborer', 3, 14, 68), tropa(p, 'militia', 10, 24, 70), tropa(p, 'axe_fighter', 4, 30, 70), tropa(p, 'bowman', 4, 36, 70)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo, unidades: [tropa(p, 'militia', 16, 64, 72), tropa(p, 'bowman', 8, 60, 66), tropa(p, 'axe_fighter', 6, 70, 72)] },
        ],
      };
    },
  },
  {
    n: 4, slug: 'boqueirao', local: 'Boqueirão', titulo: 'Água parada', ato: 'II', modo: 'construir', semente: 101004,
    narrativa: 'O açude de Boqueirão é o segundo maior da região, e o Cabo Branco quer os dois. Chegaram primeiro.',
    desafio: 'Defesa pura, sem expansão. A vila é cercada de serra, com uma entrada larga e duas estreitas. Peixe é a comida que não depende de roçado.',
    libera: { predios: ['fishermans', 'reservoir', 'watchtower'], tropas: ['lance_carrier'] },
    objetivos: { vitoria: [{ tipo: 'sobreviver', ondas: 6 }], derrota: [{ tipo: 'proteger', lado: 0, predios: ['reservoir'] }] },
    ondas: [
      { aos_segundos: 300, lado: 1, de: { gx: 64, gy: 126 }, tropas: [{ tipo: 'militia', quantidade: 5 }] },
      { aos_segundos: 540, lado: 1, de: { gx: 2, gy: 80 }, tropas: [{ tipo: 'militia', quantidade: 4 }, { tipo: 'bowman', quantidade: 2 }] },
      { aos_segundos: 780, lado: 1, de: { gx: 125, gy: 80 }, tropas: [{ tipo: 'axe_fighter', quantidade: 3 }] },
      { aos_segundos: 1020, lado: 1, de: { gx: 64, gy: 126 }, tropas: [{ tipo: 'scout', quantidade: 3 }, { tipo: 'militia', quantidade: 3 }] },
      { aos_segundos: 1260, lado: 1, de: { gx: 2, gy: 80 }, tropas: [{ tipo: 'axe_fighter', quantidade: 3 }, { tipo: 'bowman', quantidade: 3 }] },
      { aos_segundos: 1500, lado: 1, de: { gx: 64, gy: 126 }, tropas: [{ tipo: 'scout', quantidade: 3 }, { tipo: 'axe_fighter', quantidade: 4 }, { tipo: 'bowman', quantidade: 3 }] },
    ],
    desenhar(p) {
      p.elipse(64, 36, 34, 20, 'w', 0.3); // o acude
      // a serra em anel em volta da vila (centro 64,82): faixa de raio 18 a 24
      for (let y = 0; y < A; y++) {
        for (let x = 0; x < L; x++) {
          const d = Math.hypot(x - 64, y - 82);
          if (d >= 18 && d <= 25) p.set(x, y, d >= 19.5 && d <= 23.5 ? 'm' : 'r');
        }
      }
      // o lado norte do anel e a margem do acude: a agua desce ate encostar no anel, e a vila (o miolo do
      // anel) beira a agua. Sem isso sobrava chao entre o acude e a serra, e a vila tinha mais entradas.
      for (let y = 40; y <= 68; y++) for (let x = 24; x <= 104; x++) if (Math.hypot(x - 64, y - 82) >= 17.5 && Math.hypot(x - 64, y - 82) <= 27) p.set(x, y, 'w');
      for (let y = 40; y <= 68; y++) for (let x = 36; x <= 92; x++) if (Math.hypot(x - 64, y - 82) > 27 && ((x - 64) / 38) ** 2 + ((y - 40) / 28) ** 2 <= 1) p.set(x, y, 'w');
      p.retangulo(59, 98, 69, 110, 'g'); // a entrada larga, ao sul (11 tiles)
      p.retangulo(36, 81, 48, 83, 'g'); // a entrada estreita, a oeste (3 tiles)
      p.retangulo(80, 81, 92, 83, 'g'); // a entrada estreita, a leste (3 tiles)
      p.veio('rock', 30, 40, 60, 90, 108);
      p.manchas('c', 3, 52, 70, 76, 92, 1.5, 2.5);
      p.vegetacao('tree', 0.05, 46, 66, 82, 98);
      p.vegetacao('tree', 0.08, 0, 60, L - 1, A - 1);
      p.manchas('a', 10, 0, 64, L, A, 2, 4);
      p.peixe();
      const jogador = vila(p, 52, 72, ['storehouse', 'schoolhouse', 'inn']);
      jogador.push(predio(p, 'barracks', 54, 86), predio(p, 'reservoir', 62, 64));
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: { gold: 25, timber: 30, stone: 25, loaves: 20, sausages: 10 }, predios: jogador,
            unidades: [tropa(p, 'serf', 6, 64, 88), tropa(p, 'laborer', 3, 70, 88), tropa(p, 'militia', 8, 60, 93), tropa(p, 'axe_fighter', 4, 66, 93), tropa(p, 'bowman', 4, 72, 92)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: [], unidades: [] },
        ],
      };
    },
  },
  {
    n: 5, slug: 'campina-grande', local: 'Campina Grande', titulo: 'A feira', ato: 'II', modo: 'construir', semente: 101005,
    narrativa: 'A cidade grande do caminho, e a que não pertence a ninguém. Quem controla a feira controla o que passa entre o sertão e o mar.',
    desafio: 'Duração, não destruição. Assédio constante pelo norte e pelo leste, cortando estrada e caçando carregador: o jogador mantém duas rotas.',
    libera: { predios: ['marketplace', 'storehouse'], tropas: [] },
    objetivos: {
      vitoria: [{ tipo: 'manter', lado: 0, predios: ['marketplace'], segundos: 1800 }],
      derrota: [{ tipo: 'proteger', lado: 0, predios: ['marketplace'] }, { tipo: 'perder', lado: 0, predios: ['storehouse', 'schoolhouse'] }],
    },
    ondas: Array.from({ length: 12 }, (_, i) => ({
      aos_segundos: 240 + i * 130, lado: 1, de: i % 2 === 0 ? { gx: 64, gy: 1 } : { gx: 126, gy: 64 },
      tropas: [{ tipo: i % 3 === 2 ? 'bowman' : 'militia', quantidade: 2 + (i % 3) }],
    })),
    desenhar(p) {
      p.manchas('a', 26, 0, 0, L, A, 2, 5);
      p.disco(100, 104, 5, 'm', 0.4);
      p.disco(100, 104, 7, 'r', 0.4);
      p.disco(100, 104, 5, 'm', 0.4);
      p.veio('rock', 12, 88, 92, 112, 116);
      p.lajedo(30, 46, 3);
      p.lajedo(44, 94, 3);
      p.elipse(26, 100, 4, 3, 'w', 0.3);
      p.manchas('c', 8, 10, 40, 60, 90, 2, 3.5);
      p.moitas('tree', 14, 0, 0, L, A, 2, 4, 0.4);
      p.vegetacao('tree', 0.025, 0, 0, L - 1, A - 1);
      p.peixe();
      const jogador = vila(p, 14, 58, ['storehouse', 'schoolhouse', 'inn', 'barracks']);
      jogador.push(predio(p, 'marketplace', 62, 62));
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: { gold: 30, timber: 35, stone: 25, loaves: 20, sausages: 12 }, predios: jogador,
            unidades: [tropa(p, 'serf', 8, 18, 68), tropa(p, 'laborer', 3, 24, 68), tropa(p, 'militia', 8, 34, 70), tropa(p, 'bowman', 6, 40, 70), tropa(p, 'lance_carrier', 4, 46, 70)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: [], unidades: [] },
        ],
      };
    },
  },
  {
    n: 6, slug: 'areia', local: 'Areia', titulo: 'O brejo', ato: 'II', modo: 'construir', semente: 101006,
    narrativa: 'Areia é outro mundo: chove, tem verde, tem cana. E tem a primeira fábrica de verdade que o bando vê na vida.',
    desafio: 'O inimigo traz Valentes e dois Cabras de Fogo, e o jogador ainda não tem arma de ferro: vence pelo número, pelo terreno e pela investida.',
    libera: { predios: ['iron_mine', 'iron_smithy', 'wineyard'], tropas: [] },
    objetivos: { vitoria: [{ tipo: 'destruir', lado: 1, predios: ['metallurgists'] }], derrota: [{ tipo: 'perder', lado: 0, alvo: 'tropas' }] },
    ondas: [],
    desenhar(p) {
      p.faixa([[0, 40], [30, 46], [56, 50], [92, 44]], 2, 'w');
      p.faixa([[18, 127], [40, 100], [52, 70], [56, 50]], 2, 'w');
      // os vaus dos corregos: sem eles a vila do jogador ficava fechada entre os dois
      p.retangulo(42, 84, 50, 86, 'a');
      p.retangulo(50, 59, 58, 61, 'a');
      p.retangulo(69, 43, 71, 52, 'a');
      p.serra([[98, 0], [102, 40], [100, 86], [98, 127]], 8);
      p.retangulo(92, 58, 110, 66, 'g'); // o vale que leva a fundicao
      p.veio('iron_ore', 22, 88, 0, 100, 127);
      p.veio('coal', 16, 88, 0, 100, 127);
      p.veio('rock', 24, 88, 0, 100, 127);
      p.lajedo(34, 60, 2.5); // perto do inicio, do lado de ca dos corregos
      p.moitas('grapes', 7, 10, 56, 80, 120, 2.5, 4, 0.7);
      p.vegetacao('tree', 0.22, 0, 0, 90, A - 1); // a mata do brejo
      p.vegetacao('tree', 0.1, 104, 0, L - 1, A - 1);
      p.peixe();
      const jogador = vila(p, 10, 70, ['storehouse', 'schoolhouse', 'inn', 'barracks']);
      const inimigo = [predio(p, 'metallurgists', 114, 52), predio(p, 'storehouse', 114, 62), predio(p, 'barracks', 112, 72)];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: { gold: 30, timber: 30, stone: 25, loaves: 20, sausages: 15 }, predios: jogador,
            unidades: [tropa(p, 'serf', 8, 14, 80), tropa(p, 'laborer', 3, 20, 80), tropa(p, 'militia', 12, 30, 84), tropa(p, 'axe_fighter', 6, 36, 84), tropa(p, 'bowman', 6, 42, 84), tropa(p, 'lance_carrier', 4, 48, 84)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo, unidades: [tropa(p, 'sword_fighter', 8, 108, 62), tropa(p, 'crossbowman', 6, 118, 70), tropa(p, 'militia', 10, 106, 54), tropa(p, 'axe_fighter', 4, 110, 76)] },
        ],
      };
    },
  },
  {
    n: 7, slug: 'itabaiana', local: 'Itabaiana', titulo: 'O que ela estava fazendo', ato: 'II', modo: 'lutar', semente: 101007,
    narrativa: 'O bando está longe demais de casa e perto demais do mar. E alguém tem passado informação.',
    desafio: 'Capturar, não destruir. Vicente foge pela rota do leste se ela não for cortada antes: a primeira missão com dois grupos fazendo coisas diferentes.',
    libera: { predios: ['weapon_smithy', 'armor_smithy'], tropas: ['sword_fighter', 'pikeman', 'crossbowman'] },
    objetivos: { vitoria: [{ tipo: 'capturar', lado: 1, unidade: 'knight' }], derrota: [{ tipo: 'perder', lado: 0, alvo: 'tropas' }] },
    ondas: [],
    desenhar(p) {
      p.manchas('a', 18, 0, 0, L, A, 2, 4);
      // o morro do posto (centro 88,60): anel de rocha, com entradas a oeste, ao sul e a leste (a fuga)
      for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) { const d = Math.hypot(x - 88, y - 60); if (d >= 9 && d <= 11) p.set(x, y, 'r'); }
      p.retangulo(76, 59, 80, 61, 'g');
      p.retangulo(87, 68, 89, 72, 'g');
      p.retangulo(96, 59, 100, 61, 'g');
      // a rota de fuga: um corredor entre duas serras, ate perto da borda leste
      p.faixa([[100, 54], [122, 54]], 3, 'm');
      p.faixa([[100, 66], [122, 66]], 3, 'm');
      p.serra([[30, 110], [60, 118], [90, 112]], 6);
      p.veio('rock', 20, 20, 100, 100, 127);
      p.moitas('tree', 12, 0, 0, L, A, 2, 4, 0.45);
      p.vegetacao('tree', 0.04, 0, 0, L - 1, A - 1);
      p.peixe();
      const inimigo = [predio(p, 'barracks', 83, 55), predio(p, 'watchtower', 90, 56)];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: {}, predios: [],
            unidades: [tropa(p, 'militia', 10, 12, 52), tropa(p, 'bowman', 4, 18, 52), tropa(p, 'axe_fighter', 6, 12, 70), tropa(p, 'scout', 4, 18, 70)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo, unidades: [tropa(p, 'militia', 12, 86, 64), tropa(p, 'bowman', 6, 92, 64), tropa(p, 'axe_fighter', 4, 84, 58), tropa(p, 'knight', 1, 88, 62)] },
        ],
      };
    },
  },
  {
    n: 8, slug: 'santa-rita', local: 'Santa Rita', titulo: 'Cortar a cana', ato: 'III', modo: 'construir', semente: 101008,
    narrativa: 'Tudo que o Cabo Branco come, veste e atira passa pelos canaviais e engenhos de Santa Rita.',
    desafio: 'Ofensiva com prazo. Quatro alvos longe uns dos outros, e só a cavalaria chega a tempo; mas cavalaria morre para a aguilhada.',
    libera: { predios: ['stables'], tropas: ['scout', 'knight'] },
    objetivos: { vitoria: [{ tipo: 'destruir', lado: 1, alvo: 'predios' }], derrota: [{ tipo: 'prazo', segundos: 1800 }] },
    ondas: [],
    desenhar(p) {
      const rio = [[0, 112], [40, 116], [80, 113], [127, 108]];
      p.faixa(rio, 10, 'a');
      p.faixa(rio, 5, 'w');
      p.moitas('grapes', 16, 0, 0, L, 100, 5, 9, 0.7); // os canaviais
      p.manchas('c', 6, 0, 0, L, 100, 2, 4);
      p.lajedo(22, 34, 2.5);
      p.lajedo(80, 40, 2.5);
      p.vegetacao('tree', 0.03, 0, 0, L - 1, A - 1);
      p.peixe();
      const jogador = vila(p, 8, 8, ['storehouse', 'schoolhouse', 'barracks', 'stables']);
      const inimigo = [predio(p, 'mill', 96, 20), predio(p, 'mill', 60, 86), predio(p, 'storehouse', 108, 76), predio(p, 'stables', 24, 90)];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: { gold: 40, timber: 30, stone: 20, loaves: 25, sausages: 15 }, predios: jogador,
            unidades: [tropa(p, 'serf', 6, 12, 18), tropa(p, 'scout', 6, 24, 20), tropa(p, 'knight', 2, 30, 20), tropa(p, 'militia', 6, 36, 20)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo,
            unidades: [tropa(p, 'lance_carrier', 5, 100, 28), tropa(p, 'lance_carrier', 5, 64, 94), tropa(p, 'lance_carrier', 5, 112, 84), tropa(p, 'lance_carrier', 5, 28, 98)] },
        ],
      };
    },
  },
  {
    n: 9, slug: 'joao-pessoa', local: 'João Pessoa', titulo: 'Casa de tijolo', ato: 'III', modo: 'lutar', semente: 101009,
    narrativa: 'A capital tem muro, torre e gente que nunca passou fome. Januária consegue abrir uma porta: uma só, e por pouco tempo.',
    desafio: 'Cerco de verdade: torres, ruas estreitas onde o bodoqueiro não tem ângulo, e a Casa do Coronel, que não pode cair.',
    libera: { predios: ['town_hall', 'church'], tropas: [] },
    objetivos: {
      vitoria: [{ tipo: 'destruir', lado: 1, alvo: 'tropas' }, { tipo: 'destruir', lado: 1, predios: ['watchtower'] }],
      derrota: [{ tipo: 'proteger', lado: 1, predios: ['schoolhouse'] }, { tipo: 'perder', lado: 0, alvo: 'tropas' }],
    },
    ondas: [],
    desenhar(p) {
      p.manchas('a', 14, 0, 0, 50, A, 2, 4);
      // o muro: retangulo de rocha de 2 tiles, com o portao a oeste e uma passagem estreita ao norte
      for (let y = 30; y <= 100; y++) for (let x = 56; x <= 120; x++) if (x <= 57 || x >= 119 || y <= 31 || y >= 99) p.set(x, y, 'r');
      p.retangulo(56, 63, 57, 66, 'g');
      p.retangulo(88, 30, 88, 31, 'g');
      // os quarteiroes de rocha, com ruas de 2 tiles, menos a praca da Casa do Coronel e os cantos das torres
      for (let by = 36; by <= 90; by += 8) {
        for (let bx = 62; bx <= 110; bx += 8) {
          const praca = bx >= 76 && bx <= 94 && by >= 52 && by <= 70;
          const canto = (bx <= 62 || bx >= 110) && (by <= 36 || by >= 90);
          if (!praca && !canto) p.retangulo(bx, by, bx + 5, by + 5, 'r');
        }
      }
      p.moitas('tree', 10, 0, 0, 50, A, 2, 4, 0.4);
      p.vegetacao('tree', 0.03, 0, 0, 50, A - 1);
      p.peixe();
      const inimigo = [
        predio(p, 'schoolhouse', 84, 60), predio(p, 'barracks', 90, 58),
        predio(p, 'watchtower', 60, 33), predio(p, 'watchtower', 114, 33), predio(p, 'watchtower', 60, 95), predio(p, 'watchtower', 114, 95),
      ];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: {}, predios: [],
            unidades: [tropa(p, 'militia', 14, 20, 56), tropa(p, 'axe_fighter', 8, 26, 56), tropa(p, 'bowman', 8, 20, 70), tropa(p, 'crossbowman', 4, 26, 70), tropa(p, 'lance_carrier', 4, 32, 64), tropa(p, 'sword_fighter', 4, 38, 64)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo,
            unidades: [tropa(p, 'militia', 10, 80, 68), tropa(p, 'bowman', 6, 96, 66), tropa(p, 'pikeman', 4, 88, 70)] },
        ],
      };
    },
  },
  {
    n: 10, slug: 'cabedelo', local: 'Cabedelo', titulo: 'Onde o rio acaba', ato: 'III', modo: 'lutar', semente: 101010,
    narrativa: 'O forte na barra, o mar atrás, e Antônio embarcando o que resta. É o fim do leste.',
    desafio: 'Duas frentes, o forte pela terra e o ancoradouro pela areia, com tropa insuficiente para as duas. O inimigo tem todas as unidades do jogo.',
    libera: { predios: [], tropas: [] },
    objetivos: { vitoria: [{ tipo: 'destruir', lado: 1, alvo: 'predios' }], derrota: [{ tipo: 'prazo', segundos: 1500 }] },
    ondas: [],
    desenhar(p) {
      // o mar a leste, com a costa ondulada e a praia de areia
      for (let y = 0; y < A; y++) {
        const costa = 104 + Math.round(3 * Math.sin(y / 9));
        for (let x = costa - 4; x < L; x++) p.set(x, y, x >= costa ? 'w' : 'a');
      }
      // o rio que desce do oeste ate a barra, com um vau
      const rio = [[0, 64], [50, 62], [104, 66]];
      p.faixa(rio, 9, 'a');
      p.faixa(rio, 5, 'w');
      p.retangulo(38, 56, 43, 70, 'a');
      // a peninsula do forte, ao norte da barra
      p.elipse(108, 52, 9, 6, 'g', 0.2);
      p.manchas('a', 10, 0, 0, 90, A, 2, 4);
      p.moitas('tree', 10, 0, 0, 90, A, 2, 4, 0.4);
      p.vegetacao('tree', 0.03, 0, 0, 90, A - 1);
      p.peixe();
      const inimigo = [
        predio(p, 'barracks', 104, 48), predio(p, 'watchtower', 111, 50), predio(p, 'watchtower', 101, 54),
        predio(p, 'storehouse', 96, 84),
      ];
      return {
        lados: [
          { lado: 0, nome: BANDO_DO_JOGADOR, estoque: {}, predios: [],
            unidades: [tropa(p, 'militia', 10, 12, 78), tropa(p, 'axe_fighter', 6, 18, 78), tropa(p, 'bowman', 6, 12, 86), tropa(p, 'scout', 4, 18, 86), tropa(p, 'knight', 2, 24, 82)] },
          { lado: 1, nome: BANDO_INIMIGO, estoque: {}, predios: inimigo,
            unidades: [
              tropa(p, 'militia', 4, 100, 42), tropa(p, 'axe_fighter', 3, 110, 44), tropa(p, 'sword_fighter', 3, 106, 58), tropa(p, 'pikeman', 3, 96, 50),
              tropa(p, 'bowman', 4, 92, 92), tropa(p, 'crossbowman', 3, 98, 92), tropa(p, 'lance_carrier', 3, 90, 80), tropa(p, 'scout', 2, 88, 88), tropa(p, 'knight', 1, 100, 78),
            ] },
        ],
      };
    },
  },
];

export function gerarFase(def) {
  const p = new Prancheta(def.semente);
  const { lados } = def.desenhar(p);
  return {
    id: `fase-${String(def.n).padStart(2, '0')}-${def.slug}`,
    fase: def.n, local: def.local, titulo: def.titulo, ato: def.ato, modo: def.modo, escala: 'combate',
    semente: def.semente, gerador: 'tools/gerar-fases.mjs', _doc: DOC,
    narrativa: def.narrativa, desafio: def.desafio, libera: def.libera, objetivos: def.objetivos, ondas: def.ondas,
    lados, mapa: mapaDe(p),
  };
}

export function gerarTodas() {
  return FASES.map(gerarFase);
}

/** A prancha das dez miniaturas (5 x 2), 3 px por tile: o terreno, os recursos e, por cima, os
 *  predios e as tropas de cada lado na cor do bando. So evidencia: nao entra no jogo. */
export function pranchaDasFases(fases) {
  const TEMA = JSON.parse(readFileSync(join(RAIZ, 'data', 'theme-sertao.json'), 'utf8'));
  const px = 3;
  const margem = 8;
  const w = 5 * (L * px + margem) + margem;
  const h = 2 * (A * px + margem) + margem;
  const data = new Uint8Array(w * h * 4).fill(255);
  const rgb = (hex) => { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const pintar = (x, y, cor) => { if (x >= 0 && y >= 0 && x < w && y < h) data.set([...cor, 255], (y * w + x) * 4); };
  fases.forEach((fase, i) => {
    const ox = margem + (i % 5) * (L * px + margem);
    const oy = margem + Math.floor(i / 5) * (A * px + margem);
    const tile = (gx, gy, cor, tam = px) => { for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) pintar(ox + gx * px + x, oy + gy * px + y, cor); };
    fase.mapa.linhas.forEach((linha, gy) => [...linha].forEach((ch, gx) => tile(gx, gy, rgb(TEMA.terreno[LEGENDA[ch]]))));
    for (const [tipo, tiles] of Object.entries(fase.mapa.recursos)) for (const [gx, gy] of tiles) tile(gx, gy, rgb(TEMA.recursos[tipo]));
    for (const lado of fase.lados) {
      const cor = rgb(TEMA.bandos[String(lado.lado)].cor);
      for (const p of lado.predios) {
        const [pw, ph] = tamanho(p.id);
        for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) tile(p.gx + x, p.gy + y, x === 0 || y === 0 || x === pw - 1 || y === ph - 1 ? [20, 20, 20] : cor);
      }
      for (const u of lado.unidades) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) tile(u.gx + x, u.gy + y, x === 0 && y === 0 ? [255, 255, 255] : cor);
    }
  });
  return { width: w, height: h, data };
}

function principal(argv) {
  if (argv[0] === 'prancha') {
    const saida = argv[1] ?? join(RAIZ, 'screenshots', 'I-TERRENO-DEZ-MAPAS-DA-CAMPANHA-prancha.png');
    mkdirSync(dirname(saida), { recursive: true });
    writeFileSync(saida, encodePng(pranchaDasFases(gerarTodas())));
    console.log(`prancha: ${saida}`);
    return 0;
  }
  const conferir = argv.includes('--conferir');
  let diferentes = 0;
  mkdirSync(PASTA_DAS_FASES, { recursive: true });
  mkdirSync(PASTA_DOS_TMJ, { recursive: true });
  for (const fase of gerarTodas()) {
    const arquivos = [
      [join(PASTA_DAS_FASES, `${fase.id}.json`), escreverFase(fase)],
      [join(PASTA_DOS_TMJ, `${fase.id}.tmj`), `${JSON.stringify(exportar(fase))}\n`],
    ];
    for (const [caminho, texto] of arquivos) {
      if (conferir) {
        let atual;
        // o git do repositorio (core.autocrlf) pode devolver o arquivo com CRLF: compara o texto, nao o fim de linha
        try { atual = readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n'); } catch { atual = null; }
        if (atual !== texto) { diferentes += 1; console.error(`difere: ${caminho}`); }
      } else writeFileSync(caminho, texto);
    }
  }
  if (conferir) {
    console.log(diferentes === 0 ? 'gerar-fases: as dez fases batem com o gerador' : `gerar-fases: ${diferentes} arquivo(s) diferem`);
    return diferentes === 0 ? 0 : 1;
  }
  console.log(`gerar-fases: ${FASES.length} fases em ${PASTA_DAS_FASES} e ${PASTA_DOS_TMJ}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(principal(process.argv.slice(2)));
