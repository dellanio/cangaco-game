# F-T2b — A árvore é obstáculo, e o A* é re-medido

> Plano escrito antes do código (CLAUDE.md §6). O backlog e o critério vêm do
> `BUILD_PLAN.md` (item *F-T2b*, perna 5 do aceite da F-T2) e não são
> reescritos aqui.

**Meta:** o recurso que a F-T2a pôs no mapa passa a reprovar o passo, e a
medição do A* é refeita com o mapa fechado pela floresta.

**Integração (CLAUDE.md §10):** autorizada na Nota de integração da **F-T2**,
escrita no `BUILD_PLAN.md` antes de qualquer código desta parte.

---

## O que foi conferido antes de planejar (medido, não suposto)

1. **O marcador de árvore no render JÁ EXISTE.** `criarRecursosDeRender()`
   (`src/render/mapa.ts:129`) monta a paleta de `Object.keys(gameData.recursos.tipos)`
   — `rock`, `tree`, `fish` —, e `codigoDoRecurso` pinta pelo índice do tipo.
   A F-T2a entregou a camada genérica, não só a rocha. O item pede "o marcador
   de árvore"; a tarefa que sobra é **provar que ele aparece**, não escrevê-lo.
2. **O oráculo Dijkstra da F10 continua cego** — agora para obstáculo.
   `custoDoOraculo` (`tests/F10-astar.test.ts:69`) lê `estado.predios` e
   `tipoDoTile`, e **nunca** `estado.recursos`. A F-D3 já o pegou cego para
   terreno pelo mesmo motivo estrutural: ele foi escrito quando só havia prédio.
3. **Ele vai reprovar de verdade se não for consertado:** `inicial` é
   `createInitialState(1)`, com a camada de recurso inteira, e há **95 tiles de
   árvore** dentro dos 64×64 em que a propriedade sorteia origem e destino.
   Não é risco teórico.
4. **`sim/estradas.ts` é a outra metade da mesma regra.** `passoPermitido`
   (`src/sim/estradas.ts:104`) aplica a regra de quina do lado da rede, e a
   propriedade da F10 afirma que A* por estrada acha caminho **se e somente se**
   `isConnected` acha. Pôr árvore na quina de um lado só quebra a equivalência.
5. **Só a Quarry colhe**, e só `rock` (`data/production.json`). Árvore hoje não
   se corta: ela é obstáculo permanente, como rocha e água são no terreno.
6. **Densidade da floresta:** 350 tiles, e a faixa de medição da F-T1
   (`x 66..109 × y 60..70`) já tem **23 tiles de árvore** dentro.

---

## As decisões

### D1 — `bloqueiaPasso` é dado, por tipo de recurso

Vai em `data/resources.json`, em `tipos.<id>`: `tree` com `true`, `rock` e
`fish` com `false`. Não é constante em `.ts` e não é lista de ids em código
(CLAUDE.md §2.3). O predicado do runtime lê o dado; ninguém digita `'tree'`.

**Rocha continua não bloqueando**, e isso não é descuido: a pedreira do BUG-C
foi plantada sobre o lajedo dois commits atrás, e `placement.ts` nunca teve
recusa por recurso. Trocar isso agora quebraria a F22 no mesmo dia em que ela
foi consertada.

### D2 — bloqueia quem tem `quantidade > 0`

Tile de árvore **cortada** (regime `porAcao`, `quantidade: 0`, entrada que
FICA) não bloqueia. É o mesmo par de estados que a perna 3 do aceite já
distingue, lido pela mesma porta.

### D3 — a estrada não se assenta sobre recurso que bloqueia (motivo novo)

`canPlaceRoad` ganha o motivo `'recurso'`. **Não é ornamento**: sem ele existe
o tile que é passável no modo `estrada` e bloqueado no modo `livre` — o serf
carregado atravessa a árvore e o serf vazio não. O terreno nunca produziu esse
par porque estrada sobre terreno intransponível já é recusada; o recurso
produziria.

**O prédio continua podendo nascer em cima**, e é decisão consciente: o
footprint bloqueia o tile nos dois modos de qualquer jeito, então não há
contradição a resolver — e é exatamente o que a pedreira sobre o lajedo faz
desde o BUG-C. Registro para veto barato: o custo de mudar de ideia é uma
recusa nova em `canPlace`, sem tocar em sistema.

### D4 — o cache de caminho não pode morrer a cada colheita

O cache do A* é `WeakMap` por referência (`dados`, `predios.ordem`,
`estradas`). `state.recursos` troca de referência **a cada tick em que a
pedreira colhe**, e chavear o cache nele esvaziaria a memória de caminho toda
vez que alguém picasse pedra — um defeito de desempenho criado pela feature.

A saída: a camada de bloqueio é **derivada** de `state.recursos`, e a
identidade dela só muda quando o CONJUNTO de tiles bloqueados muda. Colheita de
rocha produz referência nova de `recursos` e a **mesma** camada de bloqueio, e o
cache sobrevive. É o mesmo raciocínio do `predios.ordem`, escrito no topo de
`pathfinding.ts`: chavear pelo que importa, não pelo que troca.

---

## Tarefas

### Tarefa 1 — o dado e o predicado

**Arquivos:** `data/resources.json`, `tools/data-schema.js`,
`src/sim/data/types.ts`, `src/sim/recursos.ts`, `tests/F-T2b-obstaculo.test.ts`

1. Teste que falha: `bloqueiaPassoNoTile(state, gx, gy)` recusa tile de árvore
   com quantidade, aceita o mesmo tile com `quantidade: 0`, e aceita rocha.
2. `TipoDeRecurso` ganha `bloqueiaPasso: boolean`; o schema exige o campo nos
   três tipos; `data/resources.json` declara.
3. `src/sim/recursos.ts` exporta o predicado e o conjunto memoizado por
   `GameData` (`camadaPorGameData` já é o molde).
4. Verde. **`npm run validate:data` faz parte desta tarefa**, não do fim.

### Tarefa 2 — o passo reprova, nas duas metades

**Arquivos:** `src/sim/pathfinding.ts`, `src/sim/estradas.ts`, o mesmo teste

1. Teste que falha: caminho reto que atravessa uma árvore plantada no estado
   desvia; a árvore na quina proíbe a diagonal; o tile cortado deixa passar.
2. `tileAndavel` e o `andavel`/`quinaLivre` do `executar` consultam a camada;
   `Pick<GameState, ...>` ganha `'recursos'`.
3. `passoPermitido` de `estradas.ts` consulta a mesma camada; `EstadoDaRede`
   ganha `'recursos'`.
4. A camada derivada com identidade estável (D4), com teste próprio: colher
   rocha troca `state.recursos` e **não** troca a camada.

### Tarefa 3 — o oráculo enxerga o obstáculo

**Arquivos:** `tests/F10-astar.test.ts`

1. **Primeiro provar que ele erra**: rodar a propriedade com o A* já
   bloqueando e registrar a divergência. Guarda que passa por engano não vale
   (a lição da F-D3, e do `conserte-o-guarda-nao-a-assercao`).
2. `pisavel` do oráculo passa a recusar recurso que bloqueia, pela mesma porta
   do runtime — e sem exceção para a origem, que o A* também não tem.
3. Verde nas 4 sementes × 40 mapas, modo livre e modo estrada.

### Tarefa 4 — a re-medição, curta e longa

**Arquivos:** `tests/F-T2b-obstaculo.test.ts`, `test-output/F-T2b.json`

1. **Nós expandidos por acessor próprio** (`estatisticasDeExpansao()`), não
   crescendo `estatisticasDeBusca()` — a F10 congela o retorno dela com
   `toEqual` (Nota do item).
2. Quatro medidas, mapa sem recurso contra mapa com a floresta do mapa padrão,
   µs **e** nós expandidos: busca **curta** (3 tiles) e busca **longa** (através
   do mapa), as duas numa faixa com árvore de verdade — conferida por asserção,
   como a F-T1 confere que a faixa dela tem mais de um terreno.
3. Teto escrito **com o número medido ao lado**, no molde da F-T1. Se o teto de
   2,5 da F-T1 apertar, o número novo vai no comentário e a razão medida vai
   para a evidência.

### Tarefa 5 — a evidência visual e o fechamento

1. `tools/shots/F-T2b.js`: a árvore aparece no quadro, com marcador próprio,
   distinta da rocha. Passo despausado obrigatório se o roteiro tocar painel
   (CLAUDE.md §8).
2. Não-regressão por código de saída: `F-T1`, `F-T2a`, `F22`, `F-D3`.
3. `npm run verify`; `test-results.json`; `PROGRESS.md`; commit.

---

## O que este plano NÃO faz

- Não mexe em `canPlace` (prédio sobre árvore continua permitido — D3).
- Não implementa corte de árvore: o Woodcutter's é item futuro, e sem ele a
  árvore é obstáculo permanente. Isso é consequência do dado, não desta feature.
- Não toca na escolha de tile da pedreira: é a F-T2c, a seguir.
