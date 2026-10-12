import { describe, expect, it } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { createHash } from 'node:crypto';
import manifesto from '../assets/manifest.json';
import meta from '../assets/base/tree/crescimento/derivacao.json';
import vento from '../data/vento.json';
import { ESTADOS_DE_CRESCIMENTO, especiesDaVegetacao, estadoDeCrescimento, temArteJuvenilDaEspecie, especieDoVentoDaVegetacao } from '../src/render/crescimento';
import { especieDoTile, transformacaoDoVento } from '../src/render/vento';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { tileDeChave } from '../src/sim/estradas';
import { mataCurta } from './helpers/mata-curta';
import { comEspacoNaSaida } from './helpers/producao-cenario';
import { lerPng, type Imagem } from './helpers/png';
import { afirmarContratoDaArvore } from './helpers/contrato-estados-arvore';
import { gravarEvidencia } from './helpers/evidence';
const tree = manifesto.assets.find(a => a.id === 'tree' && a.tipo === 'vegetacao')!;
const estados: Readonly<Record<string, string | undefined>> = tree.estados;
const sha = (arquivo: string): string => createHash('sha256').update(readFileSync(`assets/${arquivo}`)).digest('hex');
function limites(p: Imagem, alfa: number): { pe: number; altura: number } {
  let primeiro = p.altura, ultimo = -1;
  for (let y = 0; y < p.altura; y++) for (let x = 0; x < p.largura; x++) {
    if (p.rgba[(y * p.largura + x) * 4 + 3]! >= alfa) { primeiro = Math.min(primeiro, y); ultimo = y; }
  }
  if (ultimo < 0) throw new Error('PNG vazio');
  return { pe: ultimo, altura: ultimo - primeiro + 1 };
}
describe('I-ARTE-ARVORE-CRESCENDO', () => {
  it('preserva todos os estados anteriores, caminhos e bytes; acrescenta só três juvenis', () => {
    afirmarContratoDaArvore(tree);
    expect(Object.keys(estados).sort()).toEqual([...Object.keys(meta.preservados), ...ESTADOS_DE_CRESCIMENTO].sort());
    for (const [estado, registro] of Object.entries(meta.preservados)) {
      expect(estados[estado], estado).toBe(registro.arquivo);
      expect(sha(registro.arquivo), estado).toBe(registro.sha256);
    }
    expect(tree.origem.base).toBe(meta.referencia);
    expect(tree.anchor).toEqual(meta.anchor);
    expect(tree.footprint).toEqual([1, 1]);
  });
  it('mede canvas, pés, porte crescente, masters e origem própria no PNG', () => {
    const adulta = lerPng(`assets/${tree.estados.presente}`), pe = limites(adulta, 1).pe;
    let anterior = 0;
    const medidas = [];
    for (const estado of ESTADOS_DE_CRESCIMENTO) {
      const registro = meta.medidas.find(m => m.estado === estado)!;
      const png = lerPng(`assets/${estados[estado]}`), altura = limites(png, 128).altura;
      expect([png.largura, png.altura]).toEqual(tree.tamanho);
      expect(limites(png, 1).pe).toBe(pe);
      expect(altura).toBeGreaterThan(anterior);
      expect(altura).toBeLessThan(limites(adulta, 128).altura);
      anterior = altura;
      expect(sha(registro.fonte)).toBe(registro.sha256);
      expect(registro.geracao).toMatch(/^exec-/);
      const master = registro.arquivos[1]!, p2 = lerPng(`assets/${master.arquivo}`);
      expect([p2.largura, p2.altura]).toEqual(tree.tamanho.map(n => n * 2));
      expect(limites(p2, 1).pe).toBe((pe + 1) * 2 - 1);
      for (const arquivo of registro.arquivos) expect(sha(arquivo.arquivo)).toBe(arquivo.sha256);
      medidas.push({ estado, tamanho: [png.largura, png.altura], pe, altura });
    }
    gravarEvidencia('I-ARTE-ARVORE-CRESCENDO', { medidas, anchor: tree.anchor });
  });
  it('mantém os juvenis fora do sorteio das espécies e com vento da base', () => {
    const especies: Readonly<Record<string, { amplitude: number; velocidade: number }>> = vento.especies;
    const alterado = { ...vento, especies: { ...vento.especies, presente: { amplitude: 0.6, velocidade: 0.7 } } };
    for (const estado of ESTADOS_DE_CRESCIMENTO) {
      expect(especiesDaVegetacao(Object.keys(estados))).not.toContain(estado);
      expect(especies[estado]).toBeUndefined();
      expect(especieDoVentoDaVegetacao('tree', estado)).toBe('presente');
      for (const dados of [vento, alterado]) {
        expect(transformacaoDoVento(dados, 13, 0.4, 7, 3, 32, 64, especieDoVentoDaVegetacao('tree', estado)))
          .toEqual(transformacaoDoVento(dados, 13, 0.4, 7, 3, 32, 64, 'presente'));
      }
    }
    for (const s of ['mandacaru', 'seca:macambira', 'outono']) expect(especieDoVentoDaVegetacao('tree', s)).toBe(s);
  });
  it('a guarda acusa outono, caminho antigo trocado e estado juvenil inventado', () => {
    const presente = tree.estados.presente;
    if (!presente) throw new Error('Estado presente ausente');
    expect(() => afirmarContratoDaArvore({ ...tree, estados: { ...tree.estados, outono: presente } })).toThrow('estado estranho');
    expect(() => afirmarContratoDaArvore({ ...tree, estados: { ...tree.estados, mandacaru: presente } })).toThrow('caminho de mandacaru');
    expect(() => afirmarContratoDaArvore({ ...tree, estados: { ...tree.estados, crescendo_3: presente } })).toThrow('estado estranho');
  });
  it('o PNG juvenil serve só ao juazeiro; outras espécies preservam o fallback', () => {
    for (const s of ['presente', 'seca']) expect(temArteJuvenilDaEspecie('tree', s)).toBe(true);
    for (const s of ['umbuzeiro', 'mandacaru', 'facheiro', 'xique-xique', 'macambira', 'seca:mandacaru', 'seca:macambira']) {
      expect(temArteJuvenilDaEspecie('tree', s), s).toBe(false);
    }
  });
  it('replanta um juazeiro pelo step para o roteiro, sem modificar a sim', () => {
    const { s: inicial, tiles } = mataCurta(gameData, gameData.mapa.recursos.tree?.length ?? 0);
    const especies = especiesDaVegetacao(Object.keys(estados));
    const alvo = tiles.find(k => { const { gx, gy } = tileDeChave(k); return especieDoTile(especies, gx, gy) === 'presente'; });
    if (!alvo) throw new Error('Fixture sem juazeiro ao alcance');
    let s = { ...inicial, recursos: Object.fromEntries(Object.entries(inicial.recursos)
      .filter(([k, r]) => r.tipo !== 'tree' || !tiles.includes(k) || k === alvo)) };
    const crescer = gameData.recursos.tipos.tree?.reposicao?.ticksDeCrescer ?? 0;
    for (let i = 0; i < 20_000 && estadoDeCrescimento(s.recursos[alvo], s.tick, crescer) !== 'muda'; i++) {
      s = comEspacoNaSaida(step(s, [], gameData), 'w1');
    }
    expect(estadoDeCrescimento(s.recursos[alvo], s.tick, crescer)).toBe('muda');
    const semeadoEm = s.recursos[alvo]?.semeadoEm;
    if (semeadoEm === undefined) throw new Error('Juazeiro não replantado');
    const dir = process.env.CANGACO_EVIDENCIA_DIR ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/I-ARTE-ARVORE-CRESCENDO-roteiro.save.txt`, salvar(s));
    gravarEvidencia('I-ARTE-ARVORE-CRESCENDO-roteiro', {
      tile: alvo, tick: s.tick, semeadoEm, ticksDeCrescer: crescer,
      fronteiras: ESTADOS_DE_CRESCIMENTO.map((estado, i) => ({ estado, desde: semeadoEm + Math.ceil(i * crescer / ESTADOS_DE_CRESCIMENTO.length) })),
      adultaEm: semeadoEm + crescer,
    });
  }, 20_000);
});
