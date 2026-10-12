import assert from 'node:assert/strict';
export const ANTIGOS_DA_ARVORE: Readonly<Record<string, string>> = {
  presente: 'sprites/vegetation/tree-D-double.png', umbuzeiro: 'sprites/vegetation/arvore-seca-double-frame.png',
  mandacaru: 'sprites/vegetation/mandacaru-double-frame.png', facheiro: 'sprites/vegetation/facheiro-double-frame.png',
  'xique-xique': 'sprites/vegetation/xique-xique-double-frame.png', macambira: 'sprites/vegetation/macambira-double-frame.png',
};
export const CRESCIMENTO_DA_ARVORE: Readonly<Record<string, string>> = {
  muda: 'sprites/vegetation/tree-muda-20261012.png', crescendo_1: 'sprites/vegetation/tree-crescendo_1-20261012.png',
  crescendo_2: 'sprites/vegetation/tree-crescendo_2-20261012.png',
};
export function afirmarContratoDaArvore(tree: { readonly estados: Readonly<Record<string, string>>; readonly anchor?: readonly number[] }): void {
  for (const [estado, caminho] of Object.entries({ ...ANTIGOS_DA_ARVORE, ...CRESCIMENTO_DA_ARVORE })) assert.equal(tree.estados[estado], caminho, `caminho de ${estado}`);
  for (const estado of Object.keys(tree.estados)) {
    if (Object.hasOwn(ANTIGOS_DA_ARVORE, estado) || Object.hasOwn(CRESCIMENTO_DA_ARVORE, estado)) continue;
    assert.ok(estado === 'seca' || estado.startsWith('seca:'), `estado estranho: ${estado}`);
    const inverno = estado === 'seca' ? 'presente' : estado.slice('seca:'.length);
    assert.ok(Object.hasOwn(ANTIGOS_DA_ARVORE, inverno), `seca sem correspondente: ${estado}`);
    assert.equal(tree.estados[inverno], ANTIGOS_DA_ARVORE[inverno]);
  }
  assert.deepEqual(tree.anchor, [0.5, 1]);
}
