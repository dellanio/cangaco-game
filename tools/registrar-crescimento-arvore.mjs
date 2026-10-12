import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
const raiz = process.argv[2], base = 'assets/base/tree/crescimento';
mkdirSync(base, { recursive: true });
const meta = JSON.parse(readFileSync(join(raiz, 'derivados/derivacao.json'), 'utf8'));
const ids = { muda: 'exec-750f8084-d5f4-4e29-ac10-d14a71720c89', crescendo_1: 'exec-0441e815-4d07-48ee-879f-90691eace40e', crescendo_2: 'exec-324cd3fe-69a1-4053-9315-73d4b35a86ef' };
const texto = readFileSync('assets/manifest.json', 'utf8');
const tree = JSON.parse(texto).assets.find(a => a.tipo === 'vegetacao' && a.id === 'tree');
for (const medida of meta.medidas) {
  const estado = medida.estado, original = `${estado}-original.png`;
  copyFileSync(join(raiz, original), join(base, original));
  medida.fonte = `base/tree/crescimento/${original}`;
  medida.geracao = ids[estado];
  for (let i = 0; i < medida.arquivos.length; i++) {
    const a = medida.arquivos[i], nome = a.arquivo.split(/[\\/]/).at(-1);
    const destino = i === 0 ? `assets/sprites/vegetation/${nome}` : join(base, nome);
    copyFileSync(a.arquivo, destino);
    a.arquivo = destino.replaceAll('\\', '/').slice('assets/'.length);
    if (i === 0) tree.estados[estado] = a.arquivo;
  }
}
meta.autor = 'OpenAI imagegen, dirigido pelo projeto Piancó';
meta.licenca = 'arte propria do projeto';
meta.vento = 'Estados juvenis herdam presente pelo seletor puro do render; sem especie extra no dado.';
meta.revisao = 'Revisao independente final passou; homologacao do operador pendente.';
writeFileSync(join(base, 'derivacao.json'), JSON.stringify(meta, null, 2) + '\n');
tree.origem.nota += ' A08: originais, masters, hashes e ids de geracao em base/tree/crescimento/derivacao.json; desenhos juvenis proprios, luz superior/sul. Homologacao pendente.';
const id = /"id"\s*:\s*"tree"/.exec(texto).index, inicio = texto.lastIndexOf('{', id);
let profundidade = 0, aspas = false, escape = false, fim = -1;
for (let i = inicio; i < texto.length; i++) {
  const c = texto[i];
  if (aspas) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') aspas = false; continue; }
  if (c === '"') aspas = true;
  else if (c === '{') profundidade++;
  else if (c === '}' && --profundidade === 0) { fim = i; break; }
}
if (fim < 0) throw new Error('Entrada tree nao encontrada');
writeFileSync('assets/manifest.json', texto.slice(0, inicio) + JSON.stringify(tree, null, 2).replaceAll('\n', '\n    ') + texto.slice(fim + 1));
