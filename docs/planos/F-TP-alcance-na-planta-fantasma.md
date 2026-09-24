# F-TP — O alcance de colheita na planta fantasma

**Item**: `BUILD_PLAN.md` → `### F-TP — A planta fantasma mostra o alcance de
colheita (render + input)`. O critério de aceite é o de lá, intocado.

**Objetivo**: enquanto a planta fantasma segue o mouse, o jogador vê o alcance de
colheita daquele prédio desenhado sobre o grid e quantos tiles do recurso caem
dentro dele — **antes** do clique. Sem recusa: plantar longe continua valendo.

**Ordem na fila — decisão do operador, 2026-09-24 (posterior à nota escrita no
item)**: esta feature passa a vir **antes** da F18, não depois. A razão escrita no
item ("quando entrar, o roceiro da F18 já existirá e a prévia nasce cobrindo os
dois") deixa de valer, e a nota do item é corrigida junto. A consequência é real e
está tratada na Tarefa 4: hoje **só a `quarry`** tem `colheita` no dado, então a
regra da classe não pode ser provada por "olha, funciona para dois prédios". Ela
é provada por um tipo **fabricado** em `GameData` de teste — prova estrutural, e
mais forte do que a que a ordem antiga daria.

---

## O que já existe, e por quê isto é pequeno

| Peça | Onde | O que faz hoje |
|---|---|---|
| A planta fantasma | `src/render/planta-fantasma.ts` (95 linhas) | pergunta `canPlace` a `sim/`, pinta um retângulo verde/vermelho, publica `EstadoDaPlanta` |
| Publicação | `src/render/debug.ts` → `window.__cangaco.plantaFantasma` | a cena grava a cada frame (`WorldScene.ts:334`) |
| Os tiles ao alcance | `sim/recursos.ts` → `tilesDeColheita(predio, colheita, dados)` | Chebyshev a partir da **caixa** do prédio, memoizado |
| Quanto ainda há | `sim/recursos.ts` → `disponivelAoAlcance(state, predio, ...)` | soma `state.recursos[k].quantidade` nos tiles ao alcance |
| A cor do recurso | `src/render/mapa.ts` → `recursosDeRender` | id neutro → cor de `data/theme-sertao.json` (§9) |
| A caixa de um tipo | `sim/footprint.ts` → `caixaDeTipo(tipo, gx, gy, dados)` | `{x0,y0,x1,y1}`, meio-aberta em x1/y1 |

O trabalho novo é ligar essas peças. **Nenhuma regra nova de jogo entra.**

## Decisões

### D1 — A prévia recebe a CAIXA, e a caixa vem de `caixaDeTipo`

A fantasma não é prédio: não tem `id`, não está em `state.predios`. `tilesDeColheita`
exige `PredioCompleto`. Fabricar um prédio falso no render para consultar seria
render inventando estado de jogo — proibido.

O núcleo passa a receber `CaixaEmTiles`, e `caixaDeTipo(tipo, gx, gy, dados)` — que
já existe e é a mesma função que `canPlace` usa — produz a caixa dos dois lados.
**É a única mudança autorizada em `src/sim/`** pela nota de integração do item, e é
refatoração de assinatura: mesma conta, mesma ordem, mesma memoização.

### D2 — `tiles` conta o que AINDA tem recurso, não o que o mapa marcou

`tilesDeColheita` devolve tiles pelo **mapa**, e um tile de regime `porAcao`
zerado continua na lista (`recursos.ts` diz isso no cabeçalho: "tile CORTADO não é
tile que nunca teve nada"). Mostrar "8 tiles" sobre um lajedo seco seria a tela
mentindo, que é exatamente o que a F-T2a existe para impedir.

Então `tiles` conta `quantidade > 0`. Em mapa novo os dois números coincidem, e o
aceite afirma **os dois** — a igualdade com `tilesDeColheita` que o item pede, e a
igualdade com a lista filtrada. Asserção mais estrita, não diferente.

### D3 — O par (tiles, unidades) sai de UMA função, e `disponivelAoAlcance` passa a chamá-la

A perna (b) do aceite — "a fantasma e o prédio concordam" — só é estrutural se o
número for literalmente o mesmo cálculo. `colheitaAoAlcanceDaCaixa` devolve
`{ tiles, unidades }`; `disponivelAoAlcance` vira uma linha que lê `.unidades`.

**Isto é interpretação da nota de integração e está declarado aqui**: a nota
autoriza extrair o núcleo por caixa e proíbe "regra nova, número novo ou campo
novo em `GameState`". Um contador de tiles sobre a lista que já existe, sob o
predicado que já existe, não é nenhuma das três — e a alternativa (somar no
render) seria a segunda cópia da regra que a nota existe para impedir.
`disponivelAoAlcance` não muda de resultado: tile com `quantidade 0` já somava 0.

### D4 — O texto do jogador vem do tema, e o id neutro fica no código

§9: `rock` é o id da sim, "Lajedo" é coisa de `data/theme-sertao.json`. Entra um
bloco `plantaFantasma` no tema com o molde da frase e um nome por recurso. Recurso
sem nome ali **reprova no carregamento**, como a cor já reprova em
`criarRecursosDeRender` — pelo mesmo motivo: prévia com o nome de outro recurso é
pior que prévia nenhuma.

### D5 — Sem recusa, e `placement.ts` não é tocado

Decisão do operador escrita no item. Zero tile mostra `0`, em cinza, e a fantasma
segue verde se `canPlace` disse que sim. A moldura de alcance tem cor do
**recurso**, nunca vermelha: vermelho neste arquivo já significa "não pode".

---

## Arquivos

- **Modifica** `src/sim/recursos.ts` — extrai `tilesDeColheitaNaCaixa` e
  `colheitaAoAlcanceDaCaixa`; `tilesDeColheita` e `disponivelAoAlcance` viram
  delegações.
- **Cria** `src/render/alcance-de-colheita.ts` — a consulta pura (tipo + tile →
  prévia ou `null`) e o molde do rótulo. Sem Phaser: é o que o teste headless roda.
- **Modifica** `src/render/planta-fantasma.ts` — desenha a moldura e o rótulo,
  publica `alcance` em `EstadoDaPlanta`.
- **Modifica** `src/render/debug.ts` — nada, se `EstadoDaPlanta` for importado (é).
- **Modifica** `data/theme-sertao.json` — bloco `plantaFantasma`.
- **Modifica** `BUILD_PLAN.md` — corrige a nota de posição na fila.
- **Cria** `tests/F-TP-alcance-previa.test.ts`.
- **Cria** `tools/shots/F-TP.js`.

---

## Tarefa 1 — O núcleo por caixa, em `sim/recursos.ts`

**Arquivos**: `src/sim/recursos.ts`, `tests/F-TP-alcance-previa.test.ts`

- [ ] **Passo 1 — teste que falha**: o núcleo por caixa devolve exatamente o que
      a assinatura de prédio devolve, para a mesma pedreira.

```ts
it('o nucleo por caixa devolve os mesmos tiles que a assinatura de predio', () => {
  const dados = comJazida(gameData, 'rock', [[24, 30], [25, 30], [26, 30]], 15);
  const predio = predioCompleto('quarry', 22, 34);
  const caixa = caixaDeTipo('quarry', 22, 34, dados);
  expect(caixa).not.toBeNull();
  expect(tilesDeColheitaNaCaixa(caixa!, COLHEITA, dados))
    .toEqual(tilesDeColheita(predio, COLHEITA, dados));
});
```

- [ ] **Passo 2**: `npx vitest run tests/F-TP-alcance-previa.test.ts` → FALHA
      ("tilesDeColheitaNaCaixa is not exported").

- [ ] **Passo 3 — implementação mínima**: mover o corpo, trocar a chave de memo.

```ts
export function tilesDeColheitaNaCaixa(
  caixa: CaixaEmTiles, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): readonly string[] {
  const memoKey = `${colheita.recurso}:${colheita.alcance}:${caixa.x0},${caixa.y0},${caixa.x1},${caixa.y1}`;
  const memo = memoPorDados(dados);
  const existente = memo.get(memoKey);
  if (existente !== undefined) return existente;
  const alcance = colheita.alcance;
  const naCamada = camadaDoTipo(dados, colheita.recurso);
  const tiles: string[] = [];
  for (let gy = caixa.y0 - alcance; gy <= caixa.y1 - 1 + alcance; gy += 1) {
    for (let gx = caixa.x0 - alcance; gx <= caixa.x1 - 1 + alcance; gx += 1) {
      if (gx < 0 || gy < 0) continue;
      const k = chave(gx, gy);
      if (naCamada.has(k)) tiles.push(k);
    }
  }
  memo.set(memoKey, tiles);
  return tiles;
}

export function tilesDeColheita(
  predio: PredioCompleto, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): readonly string[] {
  const caixa = caixaDoPredio(predio, dados);
  if (caixa === null) return SEM_TILES; // tipo fora do dado (save de outra versao)
  return tilesDeColheitaNaCaixa(caixa, colheita, dados);
}
```

`SEM_TILES` é uma constante congelada no módulo (`[]` compartilhado), para o
retorno vazio não alocar por chamada nem virar array mutável exposto.

- [ ] **Passo 4**: teste PASSA. Rodar `npm run test` inteiro — nenhum outro teste
      pode mudar de resultado: a chave de memo é derivada de (tipo, gx, gy) pela
      mesma `caixaDeTipo`, então é uma bijeção com a chave antiga.

- [ ] **Passo 5**: commit `feat(F-TP): o alcance de colheita se calcula da caixa`.

## Tarefa 2 — `colheitaAoAlcanceDaCaixa`, e `disponivelAoAlcance` passa a chamá-la

**Arquivos**: `src/sim/recursos.ts`, `tests/F-TP-alcance-previa.test.ts`

- [ ] **Passo 1 — teste que falha**: o par conta o que sobrou, não o que o mapa marcou.

```ts
it('tiles conta o que ainda tem recurso, e unidades e a soma', () => {
  const dados = comJazida(gameData, 'rock', [[24, 30], [25, 30], [26, 30]], 15);
  const caixa = caixaDeTipo('quarry', 22, 34, dados)!;
  const cheio = estadoCom(dados);
  expect(colheitaAoAlcanceDaCaixa(cheio, caixa, COLHEITA, dados))
    .toEqual({ tiles: 3, unidades: 45 });

  // um tile zerado (regime `porAcao` deixa a entrada com quantidade 0) some da
  // contagem, e a soma cai junto.
  const seco = { ...cheio, recursos: { ...cheio.recursos, '25,30': { tipo: 'rock', quantidade: 0 } } };
  expect(colheitaAoAlcanceDaCaixa(seco, caixa, COLHEITA, dados))
    .toEqual({ tiles: 2, unidades: 30 });
});

it('disponivelAoAlcance nao mudou de resultado', () => {
  const dados = comJazida(gameData, 'rock', [[24, 30], [25, 30]], 15);
  const cheio = estadoCom(dados);
  expect(disponivelAoAlcance(cheio, predioCompleto('quarry', 22, 34), COLHEITA, dados)).toBe(30);
});
```

- [ ] **Passo 2**: FALHA.

- [ ] **Passo 3 — implementação**:

```ts
/** F-TP — o que ha ao alcance de uma CAIXA: quantos tiles ainda tem recurso e
 *  quanto isso da somado. UMA funcao: a previa da planta fantasma e a conta da
 *  simulacao tem de devolver o mesmo numero, senao a tela promete o que o predio
 *  nao entrega. `tiles` conta `quantidade > 0` porque tile de regime `porAcao`
 *  fica na lista com zero, e "8 tiles" sobre lajedo seco e a tela mentindo. */
export interface ColheitaAoAlcance {
  readonly tiles: number;
  readonly unidades: number;
}

export function colheitaAoAlcanceDaCaixa(
  state: GameState, caixa: CaixaEmTiles, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): ColheitaAoAlcance {
  let tiles = 0;
  let unidades = 0;
  for (const k of tilesDeColheitaNaCaixa(caixa, colheita, dados)) {
    const quantidade = state.recursos[k]?.quantidade ?? 0;
    if (quantidade > 0) tiles += 1;
    unidades += quantidade;
  }
  return { tiles, unidades };
}

export function disponivelAoAlcance(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso, dados: GameData = gameData,
): number {
  const caixa = caixaDoPredio(predio, dados);
  return caixa === null ? 0 : colheitaAoAlcanceDaCaixa(state, caixa, colheita, dados).unidades;
}
```

- [ ] **Passo 4**: `npm run test` verde.
- [ ] **Passo 5**: commit `feat(F-TP): a conta do alcance devolve tiles e unidades`.

## Tarefa 3 — A consulta pura do render

**Arquivos**: `src/render/alcance-de-colheita.ts` (novo), `data/theme-sertao.json`,
`tests/F-TP-alcance-previa.test.ts`

- [ ] **Passo 1 — teste que falha**:

```ts
it('a previa sai para a quarry e nao sai para o armazem', () => {
  const dados = comJazida(gameData, 'rock', [[24, 30], [25, 30]], 15);
  const state = estadoCom(dados);
  const previa = previaDeAlcance(state, 'quarry', 22, 34, dados);
  expect(previa).not.toBeNull();
  expect(previa!.recurso).toBe('rock');
  expect(previa!.tiles).toBe(2);
  expect(previaDeAlcance(state, 'storehouse', 22, 34, dados)).toBeNull();
});
```

- [ ] **Passo 2**: FALHA.

- [ ] **Passo 3 — bloco no tema**, antes do código que o lê:

```json
"plantaFantasma": {
  "_doc": "F-TP. O rotulo da previa de colheita. `{n}` e quantos tiles do recurso ainda tem o que colher ao alcance, `{u}` e quanto isso da somado, `{recurso}` sai de `recursos`. A chave de `recursos` e o id NEUTRO de data/resources.json: tipo sem nome aqui reprova no carregamento, como a cor ja reprova.",
  "alcance": "{recurso}: {n} ao alcance ({u})",
  "recursos": { "rock": "lajedo", "tree": "mata", "fish": "pesca" }
}
```

- [ ] **Passo 4 — o módulo**:

```ts
/**
 * F-TP — O QUE A PLANTA FANTASMA PROMETE, antes do clique.
 *
 * Puro e sem Phaser: recebe (tipo, tile) e devolve o que desenhar, ou `null`
 * quando aquele predio nao colhe nada. Quem desenha e `planta-fantasma.ts`.
 *
 * REGRA DA CLASSE, nao da Quarry: nenhum id de predio e nenhum id de recurso
 * esta digitado aqui. O gatilho e ter `colheita` na receita
 * (`data/production.json`), o alcance e o recurso saem do dado e a cor sai do
 * tema. Predio novo com `colheita` ganha a previa sem uma linha de codigo — e e
 * isso que `tests/F-TP-alcance-previa.test.ts` afirma com um tipo fabricado.
 *
 * O numero NAO e recalculado aqui: `colheitaAoAlcanceDaCaixa` e a mesma funcao
 * que `disponivelAoAlcance` usa na simulacao. Segunda copia da regra faria a
 * previa e o predio discordarem, que e o defeito que esta feature existe para
 * nao criar.
 */
export interface PreviaDeAlcance {
  readonly recurso: string;
  /** A caixa do prédio JÁ expandida pelo alcance, em tiles, meio-aberta. */
  readonly moldura: CaixaEmTiles;
  readonly tiles: number;
  readonly unidades: number;
  /** A cor do recurso, `#rrggbb`, do tema. */
  readonly cor: string;
  /** A frase do jogador, já montada. */
  readonly rotulo: string;
}

export function previaDeAlcance(
  estado: GameState, tipo: string, gx: number, gy: number, dados: GameData = gameData,
): PreviaDeAlcance | null {
  const receita = receitaDoTipo(tipo, dados);
  const colheita = receita?.colheita ?? null;
  if (colheita === null) return null;
  const caixa = caixaDeTipo(tipo, gx, gy, dados);
  if (caixa === null) return null;
  const { tiles, unidades } = colheitaAoAlcanceDaCaixa(estado, caixa, colheita, dados);
  const a = colheita.alcance;
  return {
    recurso: colheita.recurso,
    moldura: { x0: caixa.x0 - a, y0: caixa.y0 - a, x1: caixa.x1 + a, y1: caixa.y1 + a },
    tiles,
    unidades,
    cor: corDoRecurso(colheita.recurso),
    rotulo: rotuloDoAlcance(colheita.recurso, tiles, unidades),
  };
}
```

`corDoRecurso` reusa `recursosDeRender` de `render/mapa.ts` (já é a porta de cor
por id neutro). `rotuloDoAlcance` substitui `{recurso}`, `{n}` e `{u}` no molde do
tema e **lança** se o recurso não tem nome no tema, pelo mesmo motivo da cor.

- [ ] **Passo 5**: teste PASSA. Commit `feat(F-TP): a consulta da previa de alcance`.

## Tarefa 4 — A prova da regra da classe

**Arquivo**: `tests/F-TP-alcance-previa.test.ts`

Com a F-TP antes da F18, só a `quarry` tem `colheita` hoje. A regra da classe é
provada **estruturalmente** (nunca varrendo o fonte por substring):

- [ ] **Passo 1 — teste**:

```ts
it('a previa aparece exatamente para as receitas com colheita', () => {
  const state = estadoCom(gameData);
  for (const predio of gameData.predios) {
    const temColheita = (receitaDoTipo(predio.id, gameData)?.colheita ?? null) !== null;
    const previa = previaDeAlcance(state, predio.id, 20, 20, gameData);
    expect(previa !== null, `previa de '${predio.id}'`).toBe(temColheita);
  }
});

it('predio FABRICADO com colheita ganha a previa sem uma linha de codigo', () => {
  // A prova da regra da classe: um tipo que nao existe em data/ nenhum, com
  // `colheita` na receita. Se a previa dependesse de id de predio digitado em
  // `.ts`, este teste seria o que acusaria.
  const dados = comPredioFicticio(comJazida(gameData, 'rock', [[30, 30]], 7), {
    id: 'inventado', tamanho: [2, 2], colheita: { recurso: 'rock', alcance: 4 },
  });
  const previa = previaDeAlcance(estadoCom(dados), 'inventado', 29, 29, dados);
  expect(previa).not.toBeNull();
  expect(previa!.tiles).toBe(1);
  expect(previa!.unidades).toBe(7);
});
```

- [ ] **Passo 2 — a perna (b) do aceite, estrutural**:

```ts
it('a fantasma e o predio plantado concordam, tile a tile', () => {
  const dados = comJazida(gameData, 'rock', [[24, 30], [25, 30], [26, 30], [27, 30]], 15);
  const state = estadoCom(dados);
  for (let gx = 18; gx <= 30; gx += 1) {
    for (let gy = 26; gy <= 36; gy += 1) {
      const previa = previaDeAlcance(state, 'quarry', gx, gy, dados);
      const doPredio = tilesDeColheita(predioCompleto('quarry', gx, gy), COLHEITA, dados);
      expect(previa!.tiles, `(${gx},${gy})`).toBe(
        doPredio.filter((k) => (state.recursos[k]?.quantidade ?? 0) > 0).length,
      );
      // mapa novo: nenhum tile zerado, entao a contagem filtrada e a lista inteira
      expect(previa!.tiles, `(${gx},${gy})`).toBe(doPredio.length);
    }
  }
});
```

- [ ] **Passo 3**: `npm run test` verde. Commit `feat(F-TP): a regra e da classe, e o guarda prova`.

## Tarefa 5 — O desenho e a publicação

**Arquivos**: `src/render/planta-fantasma.ts`

- [ ] **Passo 1**: `EstadoDaPlanta` ganha `readonly alcance: PreviaDeAlcance | null`.
      `debug.ts` já importa o tipo; nada a mudar lá.

- [ ] **Passo 2**: dentro de `criarPlantaFantasma`, três objetos a mais, criados
      preguiçosamente e escondidos junto com o retângulo em `esconder()`:
      - `moldura`: `cena.add.rectangle(...)` sem preenchimento
        (`setFillStyle(cor, 0.08)`) e com `setStrokeStyle(2, cor, 0.9)`, em
        `DEPTH_DA_PLANTA - 1` (por baixo da planta, por cima do chão);
      - `rotulo`: `cena.add.text(...)` acima da moldura, `DEPTH_DA_PLANTA + 1`.

      A cor é a do recurso, **nunca** vermelha: vermelho aqui já significa
      "não pode" e a prévia não recusa nada (D5).

- [ ] **Passo 3**: em `atualizar`, depois do `canPlace`:

```ts
const alcance = previaDeAlcance(estado, predioAtivo, tile.gx, tile.gy);
if (alcance === null) { moldura?.setVisible(false); rotulo?.setVisible(false); }
else { /* posiciona pela moldura em gridToScreen, pinta com alcance.cor, escreve alcance.rotulo */ }
```

      O cache de `ultimaChave` já cobre isto: a chave é `tipo|gx,gy` e o estado é
      comparado por identidade, e a prévia depende só desses três.

- [ ] **Passo 4**: `npm run verify` verde. Commit `feat(F-TP): a moldura e o rotulo na planta fantasma`.

## Tarefa 6 — O roteiro, cumprindo a §8

**Arquivo**: `tools/shots/F-TP.js`

Nenhuma coordenada digitada: a jazida sai de `data/maps/sertao-128.json`, como na
F-T2a, e o "longe da rocha" é calculado do próprio mapa (tile sem rocha a
`alcance + 2` de distância de qualquer rocha).

- [ ] **Passo 0 — pausado**: vai até a jazida, confere `recursosVisiveis.rock > 0`.
- [ ] **Passo 1 — DESPAUSADO, com o gesto do jogador**: `press('p')`, então o botão
      da pedreira com `mouse.move` / `mouse.down` / `waitForTimeout(150)` /
      `mouse.up` — nunca `page.click()`. Confere `ferramentaAtiva === 'quarry'`.
      (O roteiro clica em `#menu-build`; é exatamente o caso que a §8 cobre.)
- [ ] **Passo 2 — sobre o lajedo**: `plantaFantasma.alcance.tiles > 0`, e
      `plantaFantasma.valida === true` (sem recusa). Captura.
- [ ] **Passo 3 — longe da rocha**: mesma ferramenta, tile sem rocha ao alcance:
      `alcance.tiles === 0` e **`valida` continua `true`** — a perna que prova que
      a recusa não entrou. Captura.
- [ ] **Passo 4 — prédio sem colheita**: solta a pedreira, pega o armazém,
      `plantaFantasma.alcance === null`. Captura.
- [ ] **Passo 5**: `press('p')` de volta, `npm run shot -- F-TP`.

## Tarefa 7 — Fechamento

- [ ] `npm run verify` verde.
- [ ] Abrir `test-output/F-TP-shot.json` e **um** `screenshots/F-TP-*.png` com Read
      (§8: só o da feature atual).
- [ ] Não-regressão por código de saída, sem abrir imagem: `F07`, `F-T2a`, `F-T2b`.
- [ ] `BUILD_PLAN.md`: corrigir a nota de posição na fila (D0 deste plano).
- [ ] `PROGRESS.md`: o que foi feito, as decisões, o que ficou aberto.
- [ ] `test-results.json` → `F-TP: passes true`, dentro dos 15 minutos do selo.
- [ ] Commit `feat(F-TP): a planta fantasma mostra o que a pedreira vai achar`.

---

## O que esta feature NÃO faz

- **Não recusa nada.** `src/sim/placement.ts` não é tocado.
- **Não muda balanceamento.** `alcance_tiles` continua 6; os 85,5 % sem rocha ao
  alcance continuam existindo — o que muda é o jogador **ver** antes.
- **Não desenha arte.** Moldura e texto; a arte de recurso é a F-TR.
- **Não mexe no JobBoard, na FSM nem em `GameState`.**
