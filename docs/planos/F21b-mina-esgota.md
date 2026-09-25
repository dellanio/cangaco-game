# F21b — A mina esgota: minério no tile (dado + mapa)

> Plano escrito em 2026-09-25, **antes** de qualquer código, como o operador
> pediu. O item da fila é `BUILD_PLAN.md:2591`. O critério de aceite **não
> estava escrito** no item (ele tem Por que existe / O que falta / Pergunta de
> design / Posição na fila, e só): o Aceite e a Evidência abaixo são
> interpretação minha pela leitura mais conservadora (CLAUDE.md §14), pelo mesmo
> precedente registrado na Nota da F22. Vão para o item da fila **antes** de eu
> escrever código, e ficam registrados em `PROGRESS.md` como interpretação.

**Objetivo (uma frase):** o ouro, o carvão e o ferro deixam de sair do nada e
passam a sair do tile, como a pedra desde a F-T2a e o peixe desde a F-T4a — a
mina colhe o que alcança em volta, e quando o veio acaba ela para e alerta.

---

## 1. O que já foi medido (fatos, não hipóteses)

Medido nesta sessão, antes do plano, com sonda em `python` sobre os arquivos de
dado. Cada número aqui é verificável rodando de novo a mesma conta.

| Fato | Número | Onde |
|---|---|---|
| Tiles de `montanha` no mapa | **453** | `data/maps/sertao-128.json` |
| Aglomerados de montanha | **1** só, x88..119 y84..119 | idem |
| Vizinhança da montanha (tiles não-montanha encostados) | **94** grama, **248** rocha | idem |
| Tiles pisáveis encostados na montanha | **37** | idem |
| Tiles de montanha a Chebyshev ≤ 6 de algum pisável | **437** de 453 | idem |
| Tiles de `rocha` | **298**, e os 311 `rock` já ocupam todos eles + o lajedo de 13 da vila | idem |
| Vila (armazém inicial) | (29,30) | `data/economy.json` |
| Receitas das minas hoje | `gold_mine` sai `gold_ore` 1.0; `coal_mine` sai `coal` 1.2; `iron_mine` sai `iron_ore` 1.0 — **nenhuma tem `colheita` nem `veio`** | `data/production.json` |
| Minas no menu | `desbloqueadoPor: sawmill`, iguais à casa do pescador | `data/buildings.json` |
| Tamanhos | `gold_mine` 2×1, `coal_mine` 3×2, `iron_mine` 3×1 | idem |
| Cenário de teste da cadeia do ouro | minas em (54,61) e (57,60), estrada y=62 x50..72 — **a 30+ tiles da montanha** | `tests/helpers/producao-cenario.ts:757` |

A serra é **uma cordilheira diagonal** de ~14 tiles de largura correndo de
noroeste (x88,y84) a sudeste (x119,y119), com **saia de rocha** em volta quase
toda. É por isso que só 37 tiles pisáveis a encostam, e ao mesmo tempo 437 dos
453 estão a 6 tiles de chão pisável: a saia é fina (2–3 tiles) e a serra também.
Ou seja: **há onde pôr mina, mas não em qualquer face** — o lugar importa, que é
exatamente o que a F-T2a queria dizer da pedreira.

## 2. O que já está pronto e esta feature apenas herda

- **Colheita é regra de classe** desde a F-T3/F-T2c: receita com `colheita`
  manda o ocupante ao tile pelo JobBoard, e a mercadoria cai na gaveta no tick
  da VOLTA. Nenhuma linha de `src/sim/` precisa saber o que é minério.
- **Alerta de veio esgotado sai de graça**: `sim/selectors.ts:temCausa` deriva
  `veio-esgotado` de *recurso sem `reposicao` cuja fonte acabou ao alcance*
  (`fonteSemTrabalho`). Minério com `regime: nunca` e sem `reposicao` cai nesse
  caso por construção — o HUD da F22 passa a avisar "veio esgotado" na mina sem
  uma linha nova.
- **Desenho sai de graça**: `render/mapa.ts:criarRecursosDeRender` lê os tipos de
  `data/resources.json` e a cor de `data/theme-sertao.json:recursos`; a frase do
  alcance sai de `render/rotulo-de-alcance.ts`, que lê
  `theme-sertao.json:plantaFantasma.recursos`. **Verificado lendo os dois
  arquivos**: tipo novo com cor e nome no tema aparece na tela sem tocar em
  `src/render/` nem em `src/ui/` — o que mantém esta feature dentro de
  "dado + mapa" e longe do veto do operador a `src/ui/` e `index.html`.
- **Construção sobre recurso já é recusada** (BUG-F, `sim/placement.ts:108`), e
  montanha já é terreno intransponível: nenhuma mina nasce em cima do veio.

## 3. Decisões de projeto (e por quê)

**D1 — O minério mora na montanha, e só nela.** As outras duas moradas possíveis
estão ocupadas ou erradas: todo tile de `rocha` já tem `rock` (298 de 298, e
`por()` no gerador proíbe dois recursos no mesmo tile), e veio solto na grama
seria recurso que bloqueia construção no meio do pasto, sem nenhuma razão de
mundo. A montanha é o que o próprio item da fila aponta: *"tem 453 tiles e hoje
é só obstáculo"*.

**D2 — `bloqueiaConstrucao: false`, e o `_doc` explica.** O operador respondeu a
pergunta de design assim: *"só os adjacentes, nunca o tile sob o prédio"*, e o
argumento dele foi que minério com `bloqueiaConstrucao: true` faz `canPlace`
recusar a mina em cima do veio. **A resposta dele continua valendo inteira** — o
que muda é que, com D1, a bandeira não é o que a faz valer: `canPlace` confere
**terreno antes de recurso** (`placement.ts`, ordem: terreno → recurso), e
montanha é intransponível, então a recusa já acontece uma linha antes e a
bandeira nunca seria lida. Marcar `true` seria a segunda regra dizendo o mesmo
fato — exatamente o que o `_docBloqueiaConstrucao` do `fish` já recusa por
escrito para o cardume na água. Vai `false` com o mesmo `_doc`, e a decisão
fica em `PROGRESS.md` para o operador derrubar se discordar.
`bloqueiaPasso: false` pelo mesmo motivo.

**D3 — `regime: nunca`.** O item manda: *"minério não repõe, ao contrário da
árvore"*. `nunca` apaga a entrada do tile ao zerar — o veio some do mapa, como o
cardume. É também o que liga o alerta `veio-esgotado` em vez de `sem-campo`
(tipo sem `reposicao`).

**D4 — O cenário da cadeia do ouro muda de lugar.** Hoje ele planta as minas em
(54,61)/(57,60), onde nunca vai haver minério. Assim que as três receitas
ganharem `colheita`, esse cenário para de produzir e a F21 reprova. Duas saídas:
mudar o cenário de lugar, ou semear minério onde ele está. A segunda é o
andaime que o projeto já recusou uma vez (dado inventado só para o aceite
passar): minério na grama a 30 tiles da serra não é estado que uma partida
alcança. **O cenário muda de lugar, para a face noroeste da serra.** O sítio
exato sai da medição da Tarefa 3, depois de o mapa já ter os veios.

**D5 — O gerador semeia por último.** Precedente escrito em
`tools/gerar-mapa.js` (o mato do nascente entrou por último *"de proposito:
assim ele nao desloca o RNG de nada que ja estava aqui"*). Semear minério depois
de rocha, árvore, peixe e mato mantém **byte a byte** tudo que já existe no
`sertao-128.json`, e a prova disso é a Tarefa 3.

**D6 — Semeadura só onde é alcançável.** Um veio no miolo da serra é minério que
nenhuma mina alcança: dado bonito e morto. A âncora de cada veio é sorteada
entre os tiles de montanha que estão a Chebyshev ≤ `alcance` de algum tile
pisável, e o crescimento prefere tiles que continuem nessa condição. A conta do
que ficou de fato alcançável vai para o `BALANCE_LOG.md`, com a FORMA (quantos
veios, de que tamanho, a que distância da vila) e não só a média — a lição do
BUG-C com a rocha aglomerada em 11 lajedos.

## 4. Restrições globais (CLAUDE.md, valendo em toda tarefa)

- `src/sim/` **não é tocado** nesta feature. Se alguma tarefa exigir mexer lá,
  isso é sinal de que a herança de classe não é o que este plano afirma: parar e
  reportar antes de escrever a linha.
- `src/ui/` e `index.html` **não são tocados** (ordem do operador: outra branch
  mexe neles agora). Se o aceite precisar deles, **parar e reportar**.
- `src/render/` **não é tocado** — o item está escrito como "(sim + dado)" e o
  §10 proíbe misturar sem nota de integração escrita antes.
- Número de balanceamento em `data/`, nunca em `.ts`.
- Nada de `Math.random()`/`Date.now()` fora do gerador semeado.
- Medida de relógio não vira `expect`.
- Commit `feat(F21b): ...` no fim, com o rodapé de coautoria.

## 5. Aceite proposto (vai para o `BUILD_PLAN.md` na Tarefa 0)

> **Aceite**: com uma mina plantada ao lado de um veio, o painel dela diz quantos
> tiles de minério há ao alcance e quantas unidades sobram; a mina produz, e o
> total no mapa **cai** na mesma medida do que ela entregou (medição contra a
> linha de base do tick 0, não contra zero); com o veio zerado a entrada **sai**
> de `state.recursos` (regime `nunca`), a mina para e o HUD da F22 acusa
> `veio-esgotado` **sem o jogador clicar nela**. `canPlace` recusa a mina sobre o
> veio. Guarda estrutural: toda receita com `colheita` colhe tipo que existe em
> `resources.tipos` e todo tipo tem tile em algum mapa — as duas já são regra em
> `tools/data-rules.js`, e a terceira, nova, é que **todo tipo de recurso tem cor
> e nome no tema** (hoje isso só quebra em tempo de carregamento do render).
>
> **Evidência**: `test-output/F21b.json` + `test-output/F21b-shot.json` +
> `screenshots/F21b-*.png`.

## 6. Tarefas

### Tarefa 0 — O item da fila recebe Aceite e Evidência
- **Arquivo**: `BUILD_PLAN.md` (item F21b, linha 2591).
- Escrever o bloco da §5 acima no item, com a nota de que é interpretação minha
  pela §14 (o item não trazia critério), como a F22 registrou.
- Registrar no `PROGRESS.md` a mesma coisa, sob a sessão da F21b.
- **Por que primeiro**: o critério tem de existir antes do código; e a regra da
  casa diz que contrato futuro vai na nota do item, não só no PROGRESS.

### Tarefa 1 — Os três tipos em `data/resources.json`
- **Arquivo**: `data/resources.json`, bloco `tipos`.
- Acrescentar, no mesmo formato de `rock`/`fish`:
  - `coal`: `regime: nunca`, `rendimentoPorTile: 15`, `bloqueiaConstrucao: false`,
    `bloqueiaPasso: false`;
  - `iron_ore`: idem, `rendimentoPorTile: 12`;
  - `gold_ore`: idem, `rendimentoPorTile: 8`.
- Cada um com `_doc`, `_docBloqueiaConstrucao` e `_docBloqueiaPasso` dizendo o
  que a D2 diz (montanha já é intransponível; a bandeira seria a segunda regra).
- O `_doc` de cada um justifica o rendimento **em ciclos**, como o `rock` faz:
  carvão é o que mais se queima (1.2/ciclo na metalurgia), ouro é o mais raro.
- **Verificação**: `npm run validate:data` **deve reprovar agora**, com
  `recurso/sem-instancia: resources.tipos.coal nao tem nenhum tile em nenhum
  mapa` (e idem para os outros dois). Essa reprovação é o *red* desta tarefa:
  ela prova que a regra de "tipo sem tile é dado sem leitor" está viva e que a
  Tarefa 2 é obrigatória. Guardar a saída.

### Tarefa 2 — O gerador semeia os veios
- **Arquivo**: `tools/gerar-mapa.js`, função `gerarRecursos`, **no fim**, depois
  do mato do nascente (D5).
- Constantes novas, no estilo das que já existem lá (contagem de veios e
  tamanho por tipo), com comentário dizendo de onde saem.
- Algoritmo, determinístico e semeado pelo RNG que já está em uso:
  1. montar o conjunto `montanhaAlcancavel` = tiles de montanha a Chebyshev ≤ 6
     de algum tile pisável (o mesmo 6 do `alcance_tiles` das minas — e o número
     vem do dado, lido de `production.json`, não digitado aqui);
  2. para cada tipo, na ordem `coal`, `iron_ore`, `gold_ore` (a ordem é parte da
     semente e fica escrita): sortear âncora entre os alcançáveis ainda livres e
     crescer o veio por vizinhança 8, preferindo tiles alcançáveis, até o
     tamanho do veio;
  3. cada tile passa por `por()`, que já garante um recurso por tile e respeita a
     reserva da vila.
- Proporção proposta: `coal` 5 veios × 12, `iron_ore` 4 × 10, `gold_ore` 3 × 6.
  Total ~118 tiles de 453 — a serra continua sendo mais obstáculo que jazida.
- **Verificação**: rodar o gerador e conferir, com `git diff` sobre
  `data/maps/sertao-128.json`, que **nenhuma linha de terreno mudou** e que
  `recursos.rock/tree/fish` continuam com a MESMA lista, na mesma ordem (prova
  da D5). Atualizar `contagemDeRecursos`. Depois disso
  `npm run validate:data` volta ao verde.

### Tarefa 3 — Medir a serra depois dos veios, e escolher o sítio
- **Sonda** em `python`, sem arquivo permanente:
  - quantos tiles e quantas unidades de cada tipo; quantos deles têm um tile
    pisável a ≤ 6 (o que uma mina alcança de verdade);
  - a FORMA: número de veios, tamanho de cada um, distância do centro de cada
    veio ao armazém da vila (29,30);
  - os sítios legais para `gold_mine` 2×1, `coal_mine` 3×2 e `iron_mine` 3×1 na
    face noroeste: footprint em terreno pisável, sem recurso, com a fileira da
    porta (sul) livre — a mesma conta que `podeErguer` faz em
    `tools/shots/F-T4a.js`.
- **Saída**: os números vão para o `BALANCE_LOG.md` (entrada datada, com
  "a calibrar" explícito no rendimento e na contagem de veios) e as coordenadas
  escolhidas alimentam as Tarefas 4 e 6.
- **Se não houver sítio legal para as três minas na face noroeste**: parar e
  reportar. É o mesmo travamento da F-T4b, e improvisar ali foi o que o operador
  proibiu.

### Tarefa 4 — As três receitas ganham `colheita`
- **Arquivo**: `data/production.json`, `predios.gold_mine`, `.coal_mine`,
  `.iron_mine`.
- `"colheita": { "recurso": "<tipo>", "alcance_tiles": 6 }`, como pedreira e
  casa do pescador. `notas` explicando que o `veio esgota` que estava escrito em
  prosa virou regra.
- **Verificação**: `npm run validate:data` verde; `npm run test` **deve reprovar
  agora** em `tests/F21-cadeia-do-ouro.test.ts` — é o *red* da Tarefa 5, e é a
  prova de que a colheita passou a valer para a mina. Guardar a saída.

### Tarefa 5 — O cenário da cadeia do ouro muda de lugar
- **Arquivo**: `tests/helpers/producao-cenario.ts`, `cenarioDaCadeiaDoOuro`.
- Mover armazém, `gold_mine`, `coal_mine`, `metallurgists`, `schoolhouse` e a
  estrada para as coordenadas da Tarefa 3, ao lado dos veios; comentário
  dizendo por que o cenário mudou (a F21b tirou o minério do nada).
- **Verificação**: `npm run test` verde de novo, incluindo
  `tests/F21-cadeia-do-ouro.test.ts`, `tests/F17d-nivelamento.test.ts`,
  `tests/F23-save-e-load.test.ts` e as duas sondas `zz-probe-F21/F23` — os cinco
  arquivos que hoje citam o cenário ou as minas.

### Tarefa 6 — O teste da feature
- **Arquivo novo**: `tests/F21b-mina-esgota.test.ts`.
- Casos (todos headless, determinísticos):
  1. cada um dos três tipos existe em `resources.tipos` com `regime: nunca` e
     sem `reposicao`;
  2. cada um tem tile no mapa publicado, e **pelo menos um** tile alcançável por
     um footprint legal (o dado não é decorativo);
  3. mina ao lado do veio produz, e o **acumulado entregue** bate com a **queda**
     do total no mapa medida contra o tick 0;
  4. veio zerado: a entrada **sai** de `state.recursos` e a mina para;
  5. com o veio zerado, `alertasDoEstado` traz `veio-esgotado` para a mina — e
     **não** `sem-campo`;
  6. `canPlace` recusa a mina sobre o tile de veio (motivo `terreno`, pela ordem
     de recusa — a asserção afirma a recusa, e registra o motivo observado);
  7. guarda estrutural nova: para todo `id` em `resources.tipos`, o tema tem cor
     (`recursos[id]`) e nome (`plantaFantasma.recursos[id]`). O guarda tem de
     **acusar**: provar com um objeto de tema sem a chave, não só com o tema
     real (a regra da casa: prove que o guarda acusa, não só que não acusa à
     toa).
- O que **não** entra: nenhuma asserção de tempo de relógio.

### Tarefa 7 — O tema e a tela
- **Arquivo**: `data/theme-sertao.json` — `recursos` ganha cor para os três
  (`coal` escuro, `iron_ore` ferrugem, `gold_ore` dourado, todas distintas das
  cinco de hoje) e `plantaFantasma.recursos` ganha o nome que o jogador lê.
- **Arquivo novo**: `tools/shots/F21b.js`, no molde do `F-T4a.js` (que já sabe
  abrir a vila, erguer serraria para desbloquear, andar com a câmera e cumprir a
  §8):
  1. capturar a serra com os veios desenhados, com a câmera enquadrada pela
     medição (nada de coordenada digitada);
  2. com a serraria pronta, selecionar a mina no menu e pousar a planta
     fantasma ao lado do veio: a prévia diz quantos tiles e quantas unidades há
     ao alcance (F-TP), e a captura mostra isso;
  3. pousar a planta **sobre** a montanha: recusa visível;
  4. pelo menos um passo despausado com `press('p')` + `mouse.down` +
     `waitForTimeout(150)` + `mouse.up` (§8), porque o roteiro clica em
     `#menu-build`.
- As duas capturas são abertas com `Read` — só as desta feature.

### Tarefa 8 — Fechar
- `npm run verify` verde; ler a saída.
- `BALANCE_LOG.md` com os números da Tarefa 3 e o "a calibrar".
- `PROGRESS.md`: Verificado / Decidido / Aberto, com a D2 marcada como decisão
  minha contra a premissa (não contra a resposta) do operador.
- `test-results.json`: `"F21b-mina-esgota": { "passes": true }` pela ferramenta
  `Edit`, dentro dos 15 minutos do selo.
- Commit `feat(F21b): a mina colhe o veio do tile`.

## 7. O que pode travar (e o que fazer)

| Risco | Sinal | Saída |
|---|---|---|
| Não há sítio legal para as três minas perto de veio | Tarefa 3 não acha footprint com porta livre | **Parar e reportar** (é o caso F-T4b) |
| A cadeia do ouro não cabe reposicionada (estrada longa demais, terreno picado) | Tarefa 5 não fecha | **Parar e reportar**; não inventar minério perto da vila |
| A prévia da planta fantasma precisar de linha nova em `src/ui/` | Tarefa 7 | **Parar e reportar** — é o arquivo vetado |
| O desenho do minério exigir `src/render/` | Tarefa 7 | **Parar e reportar** — vira feature de integração, e a nota tem de ser escrita antes |
| O minério ficar longe demais da vila para o jogador usar | Tarefa 3 mede distância | Não trava: vai para `BALANCE_LOG.md` como observação, e a fila decide |
