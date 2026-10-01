# Relevo, opção A: plano de implementação

> **Para quem executa:** o plano é executado nesta sessão, tarefa a tarefa (sem subagente, CLAUDE.md
> §11). Os passos usam checkbox (`- [ ]`).

**Estado: PLANO APROVADO pelo operador (2026-09-30), com as mudanças da seção "Mudanças do
operador" logo abaixo.** Nenhum código foi escrito. A implementação só começa **depois do rebase
sobre a D-TELA-06 da `main`**, a que faz o jogo exigir WebGL.

## Mudanças do operador na aprovação (2026-09-30)

Registradas como decisões. Elas valem sobre qualquer trecho do plano que diga o contrário.

1. **Sigla.** A luz do relevo esperava um id livre de D-TELA, conferido na `main` depois do commit
   da D-TELA-06 (o jogo exige WebGL). O plano escrevia **D-TELA-xx**; virou D-TELA-07, colidiu,
   virou D-TELA-08, e hoje é **D-TELA-LUZ-RELEVO** pela regra nova de id (decisão 16).
2. **A Tarefa 0 espera.** Primeiro o commit da D-TELA-06 na `main`, depois o rebase desta branch
   sobre ela. Só então a sonda do WebGL no Chromium e a linha de base.
3. **Máquina compartilhada.** A `main` está numa leva longa.
   - Roteiros desta branch rodam **só na porta 5177**, com
     `CANGACO_SHOT_PORTA=5177 npm run shot -- <nome>`.
   - A porta é conferida **antes** de cada roteiro. O `tools/shot.js` já recusa porta ocupada
     (`mensagemDePortaOcupada`); a conferência antes é para não disparar à toa.
   - **`npm run verify` não roda** enquanto o operador não disser que a leva da `main` acabou.
     Até lá, os commits de código esperam: o `verify` antes de cada commit continua valendo, e
     por isso o commit espera o `verify`, e não o contrário.
   - **Nunca matar processo.** Porta ocupada: **parar e reportar.**
4. **`PROGRESS.md` não é editado nesta branch.** As notas da sessão vão na seção "Notas da
   implementação", no fim deste arquivo. O bloco do PROGRESS entra no merge.
5. **A arte.** Vai uma nota para o contrato de arte, na seção "Texto proposto para o contrato de
   arte" abaixo. É texto proposto: a branch de arte não é editada daqui. (O texto original, sobre
   `k = 0,85`, foi substituído pela decisão 7.)
6. **Tint da unidade.** Na captura, conferir se o brilho **salta** quando a unidade cruza de
   tile. Se saltar, o tint passa a ser **interpolado pela posição**, e não mais por troca de tile
   (Tarefa 4, passo 3a). Com a decisão 7, isso só vale na encosta de sombra: na de luz, o tint é
   1,0.

## Decisões do operador sobre a luz (2026-09-30, segunda rodada)

7. **Chão plano = 1,0.** A sombra usa o MULTIPLY; a luz usa o modo próprio `[DST_COLOR, ONE]`,
   registrado por `renderer.addBlendMode`. **Aprovado.**
   - O `k` (`fatorDoPlano`) **sai** do `data/relevo.json`.
   - Asserção no roteiro: **o chão plano é igual pixel a pixel** com a flag ligada e desligada.
8. **Tint do sprite: S1.** O sprite escurece na sombra e não recebe o realce da luz. O teto do
   tint fica em `data/relevo.json`, com **1,0**.
   - **Leitura desta sessão:** o "teto `fatorMaximo` = 1,0" é o teto do **tint do sprite**, e não
     o do chão. Se fosse o do chão, a camada de luz nunca agiria, e o item 7 aprovou justamente
     essa camada. O teto do chão só entra no dado pela decisão 10.
   - **O nome:** para não confundir as duas coisas, o campo se chama `tetoDoTintDoSprite`, e não
     `fatorMaximo`. Se o operador preferir o nome dele, a troca é de um campo só.
   - **Nota do contrato de arte:** "a arte é pintada para o chão plano, sem compensação; o sprite
     escurece na sombra e não recebe o realce da luz". O texto completo está na seção "Texto
     proposto para o contrato de arte".
9. **Geometria: a captura decide** entre norte 0,83 (a mesma geometria, 8 px por degrau) e norte
   0,71 (~12,8 px por degrau). As duas vêm **lado a lado** no relatório (Tarefa 4).
10. **Saturação da areia clara** no topo da encosta de luz: **medir na captura** quantos pixels
    saturam. Se aparecer, o teto da luz do chão (`tetoDaLuzDoChao`) vai para o dado (Tarefa 4,
    passo 3b). Até lá, o chão não tem teto de luz além do que a geometria dá.
11. **Phaser 4:** o `addBlendMode` fica registrado como **risco** para o estudo de migração.
    Esse estudo ainda não existe em nenhuma branch; o único lugar que junta itens "para o estudo
    de migração" é a lista de hipóteses no fim do `docs/planos/estudo-relevo.md`, e é lá que o
    risco entra, no commit deste plano.

## Decisões do operador depois do rebase (2026-09-30, terceira rodada)

12. **Linha de base: não agora.** A `main` ainda muda nesta sessão (BUG-Y, T2, sinal de
    pausado), e uma linha de base sobre `e8f704e` ficaria velha. O procedimento passa para o
    **fim**, em sequência e só quando o operador disser que a `main` está parada:
    1. rebase sobre a ponta da `main`;
    2. linha de base dos roteiros sobre essa ponta;
    3. os mesmos roteiros com a flag desligada nesta branch, logo em seguida.

    É a Tarefa 5, passo 1. A Tarefa 0 fica só com o rebase e a checagem do WebGL, que já rodaram.
13. **`npm ci` separado nesta worktree: aprovado.** Registrado nas "Notas da implementação".
14. **A proteção de Canvas sai do plano.** A D-TELA-06 já garante o WebGL (sem ele, o jogo nem
    inicia), e código que nenhum teste alcança não entra. Saem o `decidirRelevo`, o `motivo:
    'canvas'` e a pergunta pelo `renderer.type` no `criarCamadaDeRelevo`. Fica o `relevoPedido`
    (flag do dado ou `?relevo`).
15. **O que pode avançar agora, sem roteiro de tela e sem `npm run verify`:**
    - `src/render/relevo.ts` (a matemática da luz, sem Phaser) e os testes dele;
    - `data/relevo.json` e a validação dele;
    - a D-TERRENO-ALTURA: o gerador escreve o `sertao-128.relevo.json`, e o `sertao-128.json` sai
      byte a byte igual.

    Para testar, **só `npx vitest run <arquivo>`, um arquivo por vez**; nada de suíte inteira.
    **Commit por tarefa, sem marcar `passes`.** Com isso, o "`verify` antes de cada commit" fica
    suspenso para essas tarefas, por decisão do operador. O `typecheck`, o `lint`, o
    `validate:data` e a suíte inteira rodam depois, no `verify` liberado, antes de qualquer
    `passes`.

## Decisão do operador sobre o id (2026-09-30, quarta rodada)

16. **Id pelo conteúdo (regra do operador, 2026-09-30; `main` em `bba027c`, CLAUDE.md §6
    item 9).** Item novo não tem número nem reserva: o id é `<FASE>-<ÁREA>-<NOME-CURTO>`, e quem
    cria confere com `git grep` na `main` que ele não existe. Os itens deste plano são:
    - **D-TELA-LUZ-RELEVO** (luz do relevo: camadas de sombra e de luz, e tint dos sprites);
    - **D-TERRENO-ALTURA** (altura só de render no gerador de mapa).

    A `main` já os renomeou no `BUILD_PLAN.md` e no `docs/siglas.md`.

    **Histórico, que fica registrado:** a luz foi D-TELA-xx, depois D-TELA-07, que colidiu com o
    sinal de pausado da `main` (`5402f09`), e depois D-TELA-08. A altura foi D-TERRENO-01. Uma
    regra de reserva por commit na `main` valeu por uma hora e foi **revogada** pela regra nova.

    **O renome desta branch** foi um commit só, depois do rebase sobre a `main` com a regra nova:
    - `tests/D-TELA-07-luz-do-relevo.test.ts` virou `tests/D-TELA-LUZ-RELEVO.test.ts`;
    - `tests/D-TERRENO-01-relevo-do-gerador.test.ts` virou `tests/D-TERRENO-ALTURA.test.ts`;
    - as evidências viraram `test-output/D-TELA-LUZ-RELEVO.json`,
      `D-TELA-LUZ-RELEVO-geometrias.json` e `D-TERRENO-ALTURA.json`. O `test-output/` não é
      rastreado; as antigas foram apagadas e as novas regravadas pelos testes;
    - o cabeçalho do `src/render/relevo.ts` e os comentários do `tools/gerar-mapa.js`,
      `tools/data-rules.js` e `tools/data-schema.js`.

    As mensagens dos commits anteriores mantêm os ids antigos: reescrever histórico é
    anti-padrão (§10).

## Decisão do operador sobre o `verify` (2026-09-30, quinta rodada)

17. **O `verify` roda uma vez só, no fim, depois de todas as entregas**, como validação final.
    Ele sai da frente de cada commit, e isso revoga o "`verify` antes de cada commit" da mudança
    3 e da decisão 15. **Em cada commit,** os checks localizados:
    - `npx vitest run` dos arquivos tocados, na suíte normal e na transladada
      (`-c vitest.transladado.config.mts`);
    - `npx tsc --noEmit` e `npx eslint` nos arquivos alterados, e o `node tools/validate-data.js`
      quando o commit mexe em `data/` ou nas regras.

    O roteiro da Tarefa 4 continua na Tarefa 4. A regressão completa dos roteiros continua no fim
    (decisão 12), antes do `verify` final.

## Avaliação: chão plano = 1,0, pedida pelo operador (2026-09-30)

**Estado: avaliada e aprovada (decisões 7 a 11 acima).** O resto do plano já está escrito com
ela. Esta seção fica como o registro do porquê.

**O pedido:** no plano, fator 1,0 (sem mudança); na encosta de sombra, MULTIPLY (< 1); na encosta
de luz, SCREEN ou ADD (> 1). O objetivo é a arte deixar de depender da camada estar ligada ou
desligada.

### 1. SCREEN e ADD, do jeito que o Phaser traz, não dão "× f"

Conferido no Phaser 3.90 (`node_modules/phaser/src/renderer/webgl/WebGLRenderer.js:797-801`, lido
da árvore da `main`):
- o MULTIPLY é `[DST_COLOR, ONE_MINUS_SRC_ALPHA]`;
- o SCREEN é `[ONE, ONE_MINUS_SRC_COLOR]`, que dá `c + s·(1 − c)`;
- o ADD soma, e dá `c + s`.

Os dois **somam** uma quantidade ao pixel do chão (`c`), em vez de multiplicá-lo. Para clarear a
grama em 10%:

| Canal do chão `c` | Queremos (`c × 1,1`) | SCREEN com `s = 0,1` | ADD com `s = 0,05` |
|---|---|---|---|
| 0,20 (verde escuro da grama) | 0,22 | 0,28 (+40%) | 0,25 (+25%) |
| 0,50 | 0,55 | 0,55 | 0,55 |
| 0,80 (areia clara) | 0,88 | 0,82 (+2,5%) | 0,85 |

O canal escuro sobe muito mais que o claro. A cor perde saturação e fica leitosa, e é o que a
captura do estudo mostrou na opção (b) ("o SCREEN lava a grama", estudo 3.A). **Com SCREEN ou
ADD, a encosta de luz não fica com o fator equivalente de ~1,1: ela muda de cor.**

### 2. O que funciona: um modo de mistura próprio que multiplica acima de 1

O Phaser 3 tem API pública para registrar modo de mistura:
`renderer.addBlendMode(func, equation)` (`WebGLRenderer.js:1859`, "@since 3.0.0"). Não é shader
nem pipeline: é o par de fatores do `gl.blendFunc`, registrado uma vez no `create`.

| Camada | `blendFunc` | Resultado | Neutro (plano) |
|---|---|---|---|
| **Sombra** | MULTIPLY do Phaser, `[DST_COLOR, ONE_MINUS_SRC_ALPHA]` | `c × s`, com `s = min(f, 1)` | `s = 255`, e `c × 1 = c` **exato** |
| **Luz** | próprio, `[DST_COLOR, ONE]`, `FUNC_ADD` | `c × s + c = c × (1 + s)`, com `s = max(f − 1, 0)` | `s = 0`, e `c × 1 = c` **exato** |

- A textura é opaca (alfa 1 em todo pixel), então `ONE_MINUS_SRC_ALPHA` é 0 e o MULTIPLY é
  exatamente `c × s`.
- A camada de luz **multiplica** por `1 + s`. A grama escura sobe os mesmos 10% que a areia, e
  não há lavagem. É o `c × 1,1` da tabela.
- **O plano fica igual pixel a pixel ao da flag desligada**: 255 no MULTIPLY e 0 na luz são
  neutros exatos na aritmética de 8 bits. Isso vira asserção no roteiro (item 6).
- **Limite:** a camada de luz satura por canal em 1,0. Um canal de areia a 0,95 × 1,11 fica em
  1,0, e a areia mais clara puxa um pouco para o branco no topo da encosta de luz. Com `f ≤ 1,11`,
  só o canal acima de 0,90 satura.
- **Phaser 4 (hipótese, não conferida):** o `addBlendMode` do renderer WebGL do 3 pode não
  existir igual no 4, que reescreveu o renderer em render nodes. O argumento do estudo "passa
  intacta para o Phaser 4" deixa de valer para a camada de luz, e vira item do estudo de
  migração. A camada de sombra (MULTIPLY padrão) continua valendo.

### 3. Custo

| | Hoje no plano (`k`) | Plano = 1,0 |
|---|---|---|
| Camadas | 1 imagem | 2 imagens, no mesmo depth 3 |
| Textura | 1 × 129×129 | 2 × 129×129 (~65 KB cada), ou uma de 258×129 com dois quadros |
| Draw calls a mais por quadro | 1, com uma troca de modo de mistura | 2, com duas trocas de modo de mistura |
| Código | `setBlendMode(MULTIPLY)` | mais um `addBlendMode` no `create` da camada, e o índice guardado no módulo |
| Ganchos no `WorldScene.ts` | 4 | 4, os mesmos |

A diferença de custo é desprezível: uma draw call a mais por quadro, num render que já faz
dezenas.

### 4. O tint dos sprites: onde está a decisão

O `setTint` do Phaser 3 **só escurece**: o shader faz `textura × tint`, com o tint em 0–1
(`Multi.frag`: `vec4 color = texture * texel`). Na encosta de sombra, nada muda: o sprite recebe
`setTint(cinza(f))` com `f < 1`, como no plano atual. **Na encosta de luz, o sprite não tem como
subir a 1,1 só com tint.** São quatro saídas:

| Saída | O sprite na encosta de luz | Custo | Contra |
|---|---|---|---|
| **S1. Tint preso em 1,0** | fica a 1,0, e o chão em volta a até ~1,11 | nenhum: `tintDoFator(min(f, 1))` | o sprite lê até ~10% mais escuro que o chão na encosta de luz. É o "recortado" do estudo, mas menor: lá o SCREEN subia +40% no canal escuro, e aqui o chão sobe 10% |
| **S2. S1 com teto mais baixo na luz** | igual a S1 | nenhum | o chão só sobe até `fatorMaximo`, por exemplo 1,05, e o recorte fica em ≤5%. Custo: a encosta de luz aparece menos que a de sombra (assimetria) |
| **S3. Cópia fantasma por sprite** | exato: uma cópia com `setTintFill(cinza(f − 1))` no modo de luz, logo acima do sprite, dá `c × f` na silhueta | +1 objeto por sprite em encosta de luz, e **cada cópia quebra o lote de desenho duas vezes**. Com centenas de sprites visíveis a zoom 0,5, são +100 a +300 draw calls | a cópia tem de seguir o quadro, o espelho, o `setCrop` da obra revelada, a escala e a origem de cada sprite. Isso multiplica os ganchos no `unidades.ts` e no `criarPredio`. **Não recomendo** |
| **S4. Camadas de luz acima dos sprites** | sem tint nenhum: a luz cai em tudo pela posição na tela | 2 draw calls, e zero tint | o sprite pega a luz do chão **atrás de cada pixel dele**, e não a de sob o pé: o telhado de um prédio pega a luz de dois tiles ao norte. Isso contraria a decisão 5 do estudo. E rótulo, medidor e nome da unidade, que moram dentro dos containers, escurecem junto. **Não recomendo** |

**Decidido: S1** (decisão 8), com `tetoDoTintDoSprite` = 1,0 no dado.
- O tint vira `tintDoFator(min(f, tetoDoTintDoSprite))`.
- O chão **não** tem teto de luz, a não ser que a saturação da areia apareça na captura (decisão
  10).
- A conferência do salto do tint da unidade (mudança 6) continua, e só se aplica à sombra: na
  encosta de luz, S1 não muda o tint.

### 5. Os fatores equivalentes

Com a mesma geometria do plano (declive máximo de 2 degraus a 8 px por degrau, encosta de ~14°,
luz a 30° para o sul) e `f = (n·L) / cos θ` **sem** `k`:

| Encosta | Hoje (`k` = 0,85) | Plano = 1,0, mesma geometria | Plano = 1,0, norte a 0,71 |
|---|---|---|---|
| virada para o norte | 0,71 | **0,83** | 0,71 |
| leste ou oeste | 0,82 | 0,97 | 0,93 |
| **plano** | 0,85 | **1,00** | 1,00 |
| virada para o sul | 0,94 | **1,11** | 1,14 |

- **A coluna do meio** é a de hoje dividida por 0,85. O contraste entre as encostas é o mesmo, e
  só o plano sobe a 1,0. É ela que dá o "~1,1" na encosta de luz.
- **A coluna da direita** mantém o norte escuro de hoje (0,71). Para isso a encosta tem de ser
  mais íngreme (gradiente 0,4, ~12,8 px por degrau, ~22°), e a luz sobe a 1,14.
- Os números saem da conta da seção "A conta da luz". A captura decide entre as duas, e o dado
  fica com `pxDeMundoPorDegrau`.
- **Leste e oeste continuam iguais entre si** nas três colunas: a luz não tem componente
  leste–oeste.

### 6. O que mudou no plano (aplicado com as decisões 7 a 11)

- **`data/relevo.json`:** saem `fatorDoPlano` e a hipótese dele. Entra `tetoDoTintDoSprite`
  (1,0, decisão 8). O `fatorMinimo` fica, como piso de segurança do chão.
- **A conta:** `f = (n·L) / cos θ`, com piso `fatorMinimo` e **sem teto no chão** (decisão 10). O
  teste "plano dá `k`" virou "plano dá **exatamente 1**". O teste de leste = oeste fica.
- **`relevo.ts`:** `texturasDaLuz(luz)` devolve os dois mapas de 8 bits, `sombra` e `luz`. No
  plano, 255 e 0 **exatos**.
- **`camada-de-relevo.ts`:** duas imagens, no depth 3. O tint é
  `tintDoFator(min(f, tetoDoTintDoSprite))`.
- **O roteiro da Tarefa 4:** o chão plano é igual pixel a pixel com a flag ligada e desligada; as
  duas geometrias vêm lado a lado; e a saturação da areia é medida.
- **O contrato de arte:** o texto novo está na seção abaixo.
- **Riscos:** a hipótese `k = 0,85` saiu. O `addBlendMode` no Phaser 4 entrou como risco.

---

## Texto proposto para o contrato de arte

Destino: a seção `## Cor, valores e luz` de
`noru-novos-sprites:skills/pianco-render-contract/SKILL.md`. **Não foi editado lá:** o operador
leva ao Codex. Substitui o texto anterior, que falava de `k = 0,85` (decisão 8).

> **A arte é pintada para o chão plano, sem compensação; o sprite escurece na sombra e não recebe
> o realce da luz.** Com o relevo ligado:
> - o render multiplica o chão pela luz da encosta: 1,0 no plano, abaixo de 1 na encosta virada
>   para o norte, e acima de 1 na virada para o sul;
> - o sprite (prédio, unidade, árvore, recurso, pilha) recebe a sombra da encosta pelo chão sob o
>   pé, e nunca passa de 1,0: na encosta de luz, ele fica como foi pintado;
> - por isso a arte é pintada e aprovada no plano, a 1,0, sem clarear nem escurecer para
>   compensar o relevo, e a folha de contato não aplica fator nenhum;
> - o tint é multiplicativo e só escurece. Brilho próprio (o fogo da forja, a fumaça clara)
>   também escurece na encosta de sombra. Se um dia isso incomodar, a saída é uma camada separada
>   sem tint, e não arte mais clara.

**Objetivo:** mostrar o relevo suave pela luz (opção A do estudo): duas camadas entre o chão e os
sprites (MULTIPLY na sombra, `[DST_COLOR, ONE]` na luz, com o plano neutro), mais o `setTint` dos
sprites pela sombra sob o pé. Tudo **desligado por padrão**.

**Arquitetura:**
- A altura é **só de render**. Ela sai de `tools/gerar-mapa.js` (tipos de terreno mais ruído
  semeado) para um arquivo próprio, `data/maps/sertao-128.relevo.json`, que só o render lê.
- A conta da luz é pura, em `src/render/relevo.ts`, e testada no Vitest sem Phaser.
- O que toca o Phaser mora em `src/render/camada-de-relevo.ts`.
- O `WorldScene.ts` ganha quatro ganchos de uma linha cada, e o `unidades.ts` ganha um parâmetro.

**Stack:** TypeScript, Phaser 3.90 (só `Image`, `setBlendMode`, `renderer.addBlendMode` e
`setTint`: sem shader e sem pipeline), Vitest e Playwright.

**Fonte única:** `docs/planos/estudo-relevo.md`, inteiro, inclusive a seção 7 ("Decisões do
operador (2026-09-30)").

**Branch:** `dellanio/relevo-a`, criada da `main` em `76dbcc8` nesta worktree
(`implementacao-relevo`). Sem merge: ele espera a `main` limpa e a aprovação do operador.

## Restrições globais

- **Só a opção A.** Nada de B, C, splatting, vento ou agrupamento de matas.
- **A flag nasce desligada** (`data/relevo.json`, `"ligado": false`). Com ela desligada, nenhum
  teste, roteiro ou captura muda em relação à `main`.
- **Sem proteção de Canvas (decisão 14):** a D-TELA-06 da `main` já exige WebGL antes de o jogo
  carregar. Este plano não mexe no `src/render/game.ts`.
- **Nada na sim:** nenhum arquivo de `src/sim/` muda, nada entra no `GameState`, e o `sim/` não
  importa o arquivo de altura nem o `data/relevo.json`. Um teste estrutural guarda isso.
- **Só relevo suave:** fora de `montanha` e `rocha`, a diferença entre os 4 vértices de um tile é
  no máximo `decliveMaximoEmDegraus`. O que tem de parecer intransitável continua sendo tile de
  montanha ou rocha.
- **Luz do mundo:** de cima, inclinada levemente para o sul, **sem componente leste–oeste**. O
  dado não tem campo leste–oeste, de propósito.
- **Chão plano = 1,0 exato** (decisão 7). Sombra por MULTIPLY; luz pelo modo próprio
  `[DST_COLOR, ONE]` (`renderer.addBlendMode`). Não há `k`.
- **Tint obrigatório** em árvore, prédio, recurso, pilha e unidade, pela luz do vértice sob o pé,
  preso em `tetoDoTintDoSprite` = 1,0 (decisão 8: escurece na sombra, e não recebe o realce):
  - objeto fixo: uma vez, ao nascer;
  - unidade: a cada mudança de tile.
- `src/render/` e `tools/` mudam. `src/sim/` não muda, e a regra do §10 (render e sim na mesma
  feature) não é acionada.
- `verify` roda antes de cada commit, **só depois de o operador liberar** (mudança 3). Nenhum
  `skip`, `eslint-disable` ou `ignores` novo.
- Roteiro só na **porta 5177**, conferida antes; porta ocupada é parar e reportar, e nunca matar
  processo (mudança 3).

## Siglas e fila

Pelo `docs/siglas.md` ("se muda os dois, são dois itens"), são **dois itens** da Fase D:

| Sigla | Nome | Onde |
|---|---|---|
| **D-TERRENO-ALTURA** | altura só de render no gerador de mapa | `tools/`, `data/` |
| **D-TELA-LUZ-RELEVO** | luz do relevo: camadas de sombra e de luz, e tint dos sprites | `src/render/` |

A D-TERRENO-ALTURA foi conferida em todas as branches locais: não há TERRENO no esquema novo. **Ela
também é reconferida no `BUILD_PLAN.md` da `main` depois do rebase**, junto com o id da D-TELA-LUZ-RELEVO
(mudança 1).

Os dois entram no `BUILD_PLAN.md` com o aceite abaixo, e no `test-results.json` só depois do
Definition of Done (§7).

**A D-TELA-LUZ-RELEVO não é "feature de integração":** ela não toca em `src/sim/`.

---

## O que muda, onde

| Arquivo | Muda | Tarefa |
|---|---|---|
| `data/relevo.json` | **novo.** Os números do relevo, a flag e o teto do tint do sprite (sem `k`) | 1 |
| `data/maps/sertao-128.relevo.json` | **novo, emitido.** A altura por vértice | 1 |
| `tools/gerar-mapa.js` | emite o segundo arquivo, com o próprio RNG. O `sertao-128.json` sai **byte a byte igual** | 1 |
| `tools/data-schema.js`, `tools/data-rules.js` | `relevo` entra em `ARQUIVOS_DA_INTERFACE`, com a regra própria | 1 |
| `tests/D-TERRENO-ALTURA.test.ts` | **novo** | 1 |
| `src/render/relevo.ts` | **novo, puro.** Lê a altura, calcula a luz, amostra sob o pé, decide se liga | 2 |
| `tests/D-TELA-LUZ-RELEVO.test.ts` | **novo.** A conta da luz, a decisão de ligar e a guarda estrutural | 2 |
| `src/render/camada-de-relevo.ts` | **novo, Phaser.** As duas texturas, as camadas de sombra e de luz, e o tint | 3 |
| `src/render/scenes/WorldScene.ts` | **4 ganchos** (abaixo) | 3 |
| `src/render/unidades.ts` | parâmetro opcional `luz`, e uma linha no `atualizar` | 3 |
| `src/render/debug.ts` | campo **opcional** `relevo?`, só escrito com a flag pedida | 3 |
| `tools/shots/D-TELA-LUZ-RELEVO.js` | **novo.** O roteiro com a flag ligada | 4 |
| `BUILD_PLAN.md`, `test-results.json` | os itens e as chaves (o `PROGRESS.md` **não**: mudança 4) | 5 |

### Os ganchos no `WorldScene.ts`

São **quatro**, e todos são `null`-seguros: com a flag desligada, `this.luz` é `null` e nenhum
deles faz nada.

1. **Campo:** `private luz: LuzDoRelevo | null = null;`, junto dos outros campos de memória de
   render (perto de `:154`).
2. **`create()`**, logo depois de `criarCamadaDeRecursos` (`:317`) e **antes** do primeiro
   `atualizarPredios` (`:331`):

   ```ts
   this.luz = criarCamadaDeRelevo(this, configDoMapa, window.location.search, estado);
   ```

   Na mesma função, `criarCamadaDeUnidades(this, tilePx)` (`:339`) passa a receber `this.luz`.
3. **Vegetação e rocha:** no fim de `desenharVegetacao`, depois do `this.add.image(...)` (`:1195`):

   ```ts
   this.luz?.tingir(imagem, pe.x, pe.y, `vegetacao:${chave}`);
   ```

4. **Prédio, com pilhas, trabalho e animais:** no fim de `criarPredio`, antes do `return`
   (`:1654`):

   ```ts
   this.luz?.tingirContainer(container, canto.x + larguraPx / 2, canto.y + alturaPx, `predio:${predio.id}`);
   ```

**Nada mais** no `WorldScene.ts`.

### Profundidade da camada

A camada vai em depth **3**:
- **acima** do chão, das transições, da grade, dos recursos (0,5), da estrada (1) e do canteiro de
  campo (2), que recebem a sombra e a luz pelas duas camadas;
- **abaixo** de todo sprite, cujo depth é o y do pé (`depthDeY`), sempre ≥ ~30 px.

O número é constante de TELA no módulo, como `DEPTH_DA_ESTRADA`.

### Formato do arquivo de altura

É o `data/maps/sertao-128.relevo.json`, emitido. Ele segue o estilo do mapa: uma linha de texto
por fileira, para o diff do git ficar legível.

```json
{
  "id": "sertao-128",
  "_doc": "Altura SO DE RENDER (opcao A, docs/planos/estudo-relevo.md). EMITIDO por tools/gerar-mapa.js. sim/ nunca le este arquivo. Uma linha por fileira de VERTICES: o tile (gx,gy) tem os cantos (gx,gy), (gx+1,gy), (gx,gy+1) e (gx+1,gy+1). Um char por vertice, na legenda: 0-9 e depois a-z, o degrau inteiro de 0 a 35.",
  "gerador": "tools/gerar-mapa.js",
  "mapa": "data/maps/sertao-128.json",
  "semente": 20260930,
  "largura": 129,
  "altura": 129,
  "linhas": [
    "4444455566...",
    "..."
  ]
}
```

- **O vértice é o canto do tile**, como no KaM (estudo 1.1). São `(L+1)×(A+1)` vértices.
- **Degrau inteiro de 0 a 35**, com um char base-36. O teto é do formato, e não balanceamento.
- A semente é **própria**: um `mulberry32` separado, depois do terreno e dos recursos, e por isso o
  `sertao-128.json` não muda. Quem guarda isso é o teste F-D3, que já compara o emitido com o
  disco.
- O `--conferir` passa a conferir os dois arquivos.

### `data/relevo.json`

```json
{
  "_doc": "Relevo SO DE RENDER, opcao A (docs/planos/estudo-relevo.md, secao 7). sim/ nunca le este arquivo. `ligado` e a flag: false ate a arte de terreno da F-TR entrar. `?relevo` na URL liga para o roteiro.",
  "ligado": false,
  "_docPlano": "O chao plano e 1,0 EXATO: a sombra (MULTIPLY) e a luz ([DST_COLOR, ONE]) sao neutras no plano, e a arte e pintada para ele sem compensacao (decisao do operador, 2026-09-30). Nao ha fator do plano.",
  "fatorMinimo": 0.5,
  "tetoDoTintDoSprite": 1.0,
  "_docTetoDoTintDoSprite": "O sprite escurece na sombra e nao recebe o realce da luz (S1, decisao do operador, 2026-09-30). O setTint do Phaser 3 so escurece.",
  "pxDeMundoPorDegrau": 8,
  "_docPxDeMundoPorDegrau": "Ponto de partida. A captura decide entre 8 (norte 0,83) e 12,8 (norte 0,71).",
  "luz": {
    "_doc": "De cima, inclinada levemente para o sul, SEM componente leste-oeste (decisao do operador, 2026-09-30). Nao ha campo leste-oeste de proposito.",
    "inclinacaoParaOSulGraus": 30
  },
  "geracao": {
    "semente": 20260930,
    "celulaDoRuidoEmTiles": 12,
    "amplitudeDoRuidoEmDegraus": 4,
    "decliveMaximoEmDegraus": 2,
    "tiposSemLimiteDeDeclive": ["montanha", "rocha"],
    "basePorTipo": { "agua": 0, "areia": 2, "campoArado": 4, "grama": 4, "rocha": 5, "montanha": 14 }
  }
}
```

**A validação** (`validate:data`, regra `interface/relevo`) exige:
- `0 < fatorMinimo < 1`;
- `0 < tetoDoTintDoSprite ≤ 1` (o `setTint` não passa de 1);
- `tetoDaLuzDoChao`, **se existir** (decisão 10): `1 < tetoDaLuzDoChao ≤ 2`;
- nenhum campo `fatorDoPlano` (a regra acusa se o `k` voltar por engano);
- `0 < inclinacaoParaOSulGraus < 90`;
- `basePorTipo` cobrindo todo tipo da legenda do mapa;
- base e amplitude dentro de 0–35;
- `decliveMaximoEmDegraus ≥ 1`;
- todo tipo de `tiposSemLimiteDeDeclive` sendo tipo do mapa.

**Os números da geração e da luz são ponto de partida**, a conferir na captura da Tarefa 4. Com
`pxDeMundoPorDegrau` 8, o declive máximo de 2 degraus dá uma encosta de 16 px por tile de 64
(~14°). Com a luz a 30° para o sul, isso dá (seção "Avaliação", item 5):

| Encosta | 8 px por degrau | 12,8 px por degrau |
|---|---|---|
| virada para o sul | ~1,11 | ~1,14 |
| plano | **1,00** | **1,00** |
| leste ou oeste | ~0,97 | ~0,93 |
| virada para o norte | ~0,83 | ~0,71 |

### A conta da luz

É o Lambert com a luz `L = (0, sen θ, cos θ)`, com y para o sul, e normalizada pelo plano.

```
g      = gradiente da altura no vértice (diferença central), em px de mundo por px de mundo
n      = normalizar(-gx, -gy, 1)
f      = (n·L) / cos θ, com piso fatorMinimo (e teto tetoDaLuzDoChao só se a decisão 10 pedir)
sombra = round(min(f, 1) · 255)          -> camada MULTIPLY
luz    = round(max(f − 1, 0) · 255)      -> camada [DST_COLOR, ONE]: c · (1 + luz/255)
tint   = cinza(min(f, tetoDoTintDoSprite))
```

- O plano dá **exatamente 1**: `lz / lz` é 1 exato em ponto flutuante. Daí sombra 255 e luz 0,
  os dois neutros exatos.
- Com `Lx = 0`, `gx` e `−gx` dão o mesmo fator: é o que o teste afirma para "sem leste–oeste".
- A amostra sob o pé é **bilinear** entre os 4 vértices do tile, como o `RenderFlatToHeight` do
  KaM. Fora do mapa, a coordenada é presa à borda.

---

## Foco de revisão

Os casos que nenhum aceite escrito cobre e que mais podem morder:

1. ~~**Flag ligada no Canvas**~~: saiu pela decisão 14. A D-TELA-06 garante o WebGL.
2. **Sprite recriado perde o tint:** a árvore que cresce (`desenharVegetacao` destrói e recria) e
   a obra que muda de estágio (`criarPredio` recria o container). O tint vive **no ponto de
   criação**, e não num passe único no `create`. O roteiro afirma o fator de um prédio depois de
   uma troca de estágio.
3. **Unidade cuja imagem nasce depois:** o placeholder vira sprite quando a arte resolve. O tint
   "por troca de tile" guarda o último tile num `WeakMap` indexado pela **imagem**, então imagem
   nova é tingida mesmo sem troca de tile. Teste puro do `precisaRetingir`.
4. **UI dentro do container não escurece:** medidor, texto e rótulo continuam legíveis. Só
   `Image` (e `Sprite`, que herda dela) recebe tint; `Graphics`, `Shape` e `Text` não. O
   placeholder geométrico também fica sem luz, o que é aceito: placeholder é comportamento
   normal (§9). A Tarefa 3 confere os tipos do `desenharMedidor` e do `desenharBandeira` antes de
   fechar.
5. **Borda do mapa e coordenada negativa:** o desvio de desenho da unidade (F18f) pode pôr o pé a
   poucos px fora do mapa. A amostra prende a coordenada, e o teste cobre (−5, −5) e
   (largura·64 + 5, …).

**Fora do foco, e registrado:** o `tools/transladar-mundo.js` (F18c) não translada a altura. Com a
flag desligada é irrelevante, porque a suíte transladada roda a sim, e a sim não lê altura. Vira
nota no item D-TELA-LUZ-RELEVO do `BUILD_PLAN.md`.

---

## Tarefa 0: rebase e checagem do WebGL (sem commit) — FEITA

- [x] **Passo 0: o rebase** sobre a `main` com a D-TELA-06, e a sigla D-TELA-LUZ-RELEVO conferida no
  `BUILD_PLAN.md` da `main`. Detalhes nas "Notas da implementação".
- [x] **Passo 1: a checagem do WebGL.** A sonda `zz-` não foi criada: o roteiro `D-TELA-06` da
  `main` faz a mesma pergunta, e rodou verde na porta 5177.
- **A linha de base saiu daqui** (decisão 12): ela vai para a Tarefa 5, passo 1, no fim.

## Tarefa 1: D-TERRENO-ALTURA, a altura só de render no gerador

**Arquivos:** `data/relevo.json` (novo), `tools/gerar-mapa.js`, `tools/data-schema.js`,
`tools/data-rules.js`, `data/maps/sertao-128.relevo.json` (emitido) e
`tests/D-TERRENO-ALTURA.test.ts` (novo).

**Interfaces:**
- **Produz**, no `module.exports` do `gerar-mapa.js`:
  - `montarRelevo(grade, cfg) -> { largura, altura, h: number[] }` (row-major, `(L+1)×(A+1)`);
  - `montarArquivoDeRelevo() -> objeto do arquivo`;
  - `serializarRelevo(arquivo) -> string`;
  - `forcarDecliveMaximo(h, grade, cfg)`, que muta e devolve o número de vértices baixados;
  - `declivesForaDoLimite(h, grade, cfg) -> Array<[gx, gy, amplitude]>`.

- [ ] **Passo 1: o teste que falha.** `tests/D-TERRENO-ALTURA.test.ts`:
  - **Determinismo:** duas chamadas de `montarArquivoDeRelevo()` dão o mesmo `serializarRelevo`,
    igual ao arquivo no disco (com o CRLF normalizado, como no F-D3). Uma semente diferente
    (`cfg` com `semente + 1`) dá outro `h`.
  - **Declive máximo:** `declivesForaDoLimite` é **vazio** no arquivo do disco.
  - **A guarda acusa:** uma grade 3×3 de grama com um vértice a +5 dá uma lista não vazia. Depois
    de `forcarDecliveMaximo`, a lista fica vazia e o vértice fica ≤ `min + D`.
  - **Não é plano por acaso:** fora de montanha e rocha, existe tile com amplitude > 0, e a
    amplitude global é ≥ `decliveMaximoEmDegraus` (senão o teste do declive passaria num mapa
    liso).
  - **Montanha é mais alta:** a média dos vértices interiores de montanha (os 4 tiles em volta
    são montanha) é maior que a média dos vértices só de grama.
  - **Faixa:** todo degrau está em 0–35.
  - **Formato:** `linhas.length === altura + 1`, cada linha com `largura + 1` chars da legenda.
- [ ] **Passo 2:** `npx vitest run tests/D-TERRENO-ALTURA.test.ts` falha
  (`montarArquivoDeRelevo is not a function`).
- [ ] **Passo 3: implementar no `gerar-mapa.js`.** O esboço:

  ```js
  const RELEVO = require(path.join(RAIZ, 'data', 'relevo.json'));
  const SAIDA_DO_RELEVO = path.join(RAIZ, 'data', 'maps', `${ID}.relevo.json`);
  const DIGITOS = '0123456789abcdefghijklmnopqrstuvwxyz'; // formato: degrau 0..35

  /** Ruido de valor semeado: grade grossa, interpolacao bilinear com smoothstep. So
   *  + - * / e floor: nada de Math.sin, para o numero nao depender do motor. */
  function ruidoDeValor(rng, largura, altura, celula) {
    const gl = Math.ceil(largura / celula) + 2;
    const ga = Math.ceil(altura / celula) + 2;
    const grossa = Array.from({ length: gl * ga }, () => rng());
    const s = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const cx = x / celula, cy = y / celula;
      const ix = Math.floor(cx), iy = Math.floor(cy);
      const fx = s(cx - ix), fy = s(cy - iy);
      const g = (i, j) => grossa[j * gl + i];
      const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * fx;
      const b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * fx;
      return a + (b - a) * fy;
    };
  }

  /** Os tiles (ate 4) que tocam o vertice (vx,vy). */
  function tilesDoVertice(vx, vy, largura, altura) {
    const tiles = [];
    for (const [gx, gy] of [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]]) {
      if (gx >= 0 && gy >= 0 && gx < largura && gy < altura) tiles.push([gx, gy]);
    }
    return tiles;
  }

  function cantos(gx, gy, vl) {
    return [gy * vl + gx, gy * vl + gx + 1, (gy + 1) * vl + gx, (gy + 1) * vl + gx + 1];
  }

  function limitado(grade, gx, gy, cfg) {
    return !cfg.tiposSemLimiteDeDeclive.includes(grade[gy][gx]);
  }

  /** So BAIXA vertice: a altura e inteira, nao cresce e tem piso, entao o laco termina. */
  function forcarDecliveMaximo(h, grade, cfg) {
    const altura = grade.length, largura = grade[0].length, vl = largura + 1;
    let baixados = 0;
    for (let mudou = true; mudou;) {
      mudou = false;
      for (let gy = 0; gy < altura; gy += 1) for (let gx = 0; gx < largura; gx += 1) {
        if (!limitado(grade, gx, gy, cfg)) continue;
        const c = cantos(gx, gy, vl);
        const teto = Math.min(...c.map((i) => h[i])) + cfg.decliveMaximoEmDegraus;
        for (const i of c) if (h[i] > teto) { h[i] = teto; baixados += 1; mudou = true; }
      }
    }
    return baixados;
  }

  function declivesForaDoLimite(h, grade, cfg) {
    const altura = grade.length, largura = grade[0].length, vl = largura + 1, fora = [];
    for (let gy = 0; gy < altura; gy += 1) for (let gx = 0; gx < largura; gx += 1) {
      if (!limitado(grade, gx, gy, cfg)) continue;
      const v = cantos(gx, gy, vl).map((i) => h[i]);
      const amp = Math.max(...v) - Math.min(...v);
      if (amp > cfg.decliveMaximoEmDegraus) fora.push([gx, gy, amp]);
    }
    return fora;
  }

  function montarRelevo(grade, cfg) {
    const altura = grade.length, largura = grade[0].length;
    const vl = largura + 1, va = altura + 1;
    const ruido = ruidoDeValor(mulberry32(cfg.semente), vl, va, cfg.celulaDoRuidoEmTiles);
    const h = new Array(vl * va);
    for (let vy = 0; vy < va; vy += 1) for (let vx = 0; vx < vl; vx += 1) {
      const tiles = tilesDoVertice(vx, vy, largura, altura);
      const base = tiles.reduce((s, [gx, gy]) => s + cfg.basePorTipo[grade[gy][gx]], 0) / tiles.length;
      const bruto = Math.round(base + cfg.amplitudeDoRuidoEmDegraus * ruido(vx, vy));
      h[vy * vl + vx] = Math.max(0, Math.min(DIGITOS.length - 1, bruto));
    }
    forcarDecliveMaximo(h, grade, cfg);
    return { largura: vl, altura: va, h };
  }
  ```

  Mais, no mesmo arquivo:
  - `montarArquivoDeRelevo()`: chama `gerar()` de novo (é determinístico) para ter a `grade`, e
    monta o objeto do formato acima;
  - `serializarRelevo()`: uma linha por fileira, como `serializar`;
  - `main()`: escreve e confere os **dois** arquivos. O `sertao-128.json` segue pelo mesmo caminho
    de hoje, sem mudar nada nele.
- [ ] **Passo 4: validação.**
  - `tools/data-schema.js`: `ARQUIVOS_DA_INTERFACE = ['theme-sertao', 'menu-build', 'relevo']`.
  - `tools/data-rules.js`: `validarRelevo(dados, interfaceUi)`, com as regras da seção
    `data/relevo.json`, chamada de dentro de `validarInterface`.
  - No teste: uma cópia com `tetoDoTintDoSprite: 1.2` reprova com `interface/relevo`, e uma com
    `fatorDoPlano` presente também. O caminho é o
    `--dir` que o `validate-data.js` já aceita.
- [ ] **Passo 5:** `node tools/gerar-mapa.js` escreve o `.relevo.json`, e depois:
  - `git diff --stat data/maps/sertao-128.json` fica **vazio**;
  - `node tools/gerar-mapa.js --conferir` sai 0.
- [ ] **Passo 6:** o teste novo passa, e `npm run verify` passa inteiro.
- [ ] **Passo 7: commit.**

  ```
  feat(D-TERRENO-ALTURA): altura so de render no gerador de mapa, com teto de declive
  ```

## Tarefa 2: D-TELA-LUZ-RELEVO, a conta pura da luz

**Arquivos:** `src/render/relevo.ts` (novo) e `tests/D-TELA-LUZ-RELEVO.test.ts` (novo).

**Interfaces:**
- **Consome** `data/relevo.json` e `data/maps/sertao-128.relevo.json`, por import estático de
  JSON, como o `mapa.ts` faz com o tema. `relevo.ts` é o **único** arquivo do projeto que importa o
  arquivo de altura.
- **Produz:**

  ```ts
  export interface ParametrosDaLuz {
    readonly fatorMinimo: number;
    readonly tetoDoTintDoSprite: number;
    /** So se a decisao 10 pedir (saturacao da areia). Ausente: o chao nao tem teto de luz. */
    readonly tetoDaLuzDoChao?: number;
    readonly pxDeMundoPorDegrau: number;
    readonly inclinacaoParaOSulGraus: number;
  }
  export interface AlturasDoRelevo { readonly largura: number; readonly altura: number; readonly h: Uint8Array }
  export interface MapaDeLuz { readonly largura: number; readonly altura: number; readonly fator: Float32Array }
  export const parametrosDaLuz: ParametrosDaLuz;           // de data/relevo.json
  export function lerAlturas(arquivo: { largura: number; altura: number; linhas: readonly string[] }): AlturasDoRelevo;
  export function alturasDoMapa(): AlturasDoRelevo;       // o arquivo emitido
  export function calcularLuz(alt: AlturasDoRelevo, p: ParametrosDaLuz, tilePx: number): MapaDeLuz;
  export function fatorEm(luz: MapaDeLuz, xMundo: number, yMundo: number, tilePx: number): number; // bilinear, preso na borda
  export function texturasDaLuz(luz: MapaDeLuz): { sombra: Uint8ClampedArray; luz: Uint8ClampedArray }; // um byte por vertice
  export function tintDoSprite(f: number, p: ParametrosDaLuz): number; // cinza de min(f, tetoDoTintDoSprite)
  export function tintDoFator(f: number): number;         // 0xRRGGBB cinza, round(f*255), f em [0,1]
  /** So para o roteiro comparar as duas geometrias (decisao 9): `?relevoPx=12.8`. */
  export function pxPorDegrauDaBusca(busca: string, doDado: number): number;
  export function relevoPedido(busca: string, ligadoNoDado: boolean): boolean; // dado || ?relevo
  export function tileDoPe(x: number, y: number, tilePx: number): string; // "gx,gy", para o retingir
  ```

- [ ] **Passo 1: o teste que falha.** `tests/D-TELA-LUZ-RELEVO.test.ts`:
  - **Plano dá exatamente 1:** tudo a 5 dá `fator === 1` em todo vértice, e `texturasDaLuz` dá
    `sombra === 255` e `luz === 0` em todo vértice (os neutros exatos da decisão 7).
  - **Sul clareia, norte escurece:** uma rampa que desce para o sul (h diminuindo com y) dá
    `> 1`, com `luz > 0` e `sombra === 255`. A rampa espelhada dá `< 1` e `≥ fatorMinimo`, com
    `sombra < 255` e `luz === 0`.
  - **Os números da avaliação:** a rampa de 2 degraus por tile a 8 px por degrau dá ~0,83 no
    norte e ~1,11 no sul; a 12,8 px, ~0,71 e ~1,14 (tolerância de 0,01).
  - **Sem leste–oeste:** a rampa para leste e a rampa para oeste dão o **mesmo** fator (igualdade
    exata), `< 1`.
  - **Tint S1:** `tintDoSprite(1.11, p)` dá `0xffffff` (não recebe o realce);
    `tintDoSprite(0.83, p)` dá o cinza de 0,83.
  - **Bilinear:** no vértice, dá o valor do vértice; no centro do tile, a média dos 4.
  - **Presa à borda:** (−5, −5) dá o fator do vértice (0, 0), e fora pela direita e por baixo, o
    do canto.
  - **`tintDoFator`:** 1 dá `0xffffff`, 0,83 dá `0xd4d4d4`, e é monotônico.
  - **Pedido:** `relevoPedido('?pausado', false)` dá `false`, `relevoPedido('?pausado&relevo',
    false)` dá `true`, e `relevoPedido('?pausado', true)` dá `true`.
  - **Padrão desligado:** `import relevo from '../data/relevo.json'` tem `ligado === false`.
  - **Sem `k`:** o `data/relevo.json` não tem `fatorDoPlano`, e tem `tetoDoTintDoSprite === 1`.
  - **`?relevoPx`:** sem o parâmetro, vale o dado; com `?relevo&relevoPx=12.8`, vale 12,8; um
    valor não numérico ou ≤ 0 cai no dado.
  - **Guarda estrutural** (import, não substring de número):
    - nenhum arquivo de `src/sim/**` tem import que resolva para `data/relevo.json` ou
      `data/maps/*.relevo.json`;
    - em `src/`, só `src/render/relevo.ts` importa o arquivo de altura.

    O `import` é extraído com a mesma leitura que o teste estrutural da F04 usa, que vou
    conferir e reutilizar em vez de inventar outra.
  - **O arquivo real:** `calcularLuz(alturasDoMapa(), parametrosDaLuz, 64)` tem todo fator em
    `[fatorMinimo, 2)`, e existe fator `> 1` e `< 1` (o mapa tem relevo).
- [ ] **Passo 2:** o teste falha (o módulo não existe).
- [ ] **Passo 3: implementar `relevo.ts`.** O núcleo:

  ```ts
  export function calcularLuz(alt: AlturasDoRelevo, p: ParametrosDaLuz, tilePx: number): MapaDeLuz {
    const { largura, altura, h } = alt;
    const theta = (p.inclinacaoParaOSulGraus * Math.PI) / 180;
    const ly = Math.sin(theta), lz = Math.cos(theta); // lx = 0: sem leste-oeste (decisao 2026-09-30)
    const escala = p.pxDeMundoPorDegrau / tilePx;     // degrau por tile -> px por px
    const fator = new Float32Array(largura * altura);
    const em = (x: number, y: number): number =>
      h[Math.min(altura - 1, Math.max(0, y)) * largura + Math.min(largura - 1, Math.max(0, x))]!;
    for (let y = 0; y < altura; y += 1) for (let x = 0; x < largura; x += 1) {
      const gx = ((em(x + 1, y) - em(x - 1, y)) / 2) * escala;
      const gy = ((em(x, y + 1) - em(x, y - 1)) / 2) * escala;
      const nDotL = (-gy * ly + lz) / Math.hypot(gx, gy, 1);
      const f = Math.max(p.fatorMinimo, nDotL / lz);        // plano: lz / lz === 1 exato
      fator[y * largura + x] = p.tetoDaLuzDoChao === undefined ? f : Math.min(p.tetoDaLuzDoChao, f);
    }
    return { largura, altura, fator };
  }
  ```

  - `fatorEm`: vértice `(x/tilePx, y/tilePx)`, preso a `[0, largura-1]`, e a interpolação bilinear
    dos 4.
  - `texturasDaLuz`: `sombra[i] = round(min(f, 1) · 255)` e `luz[i] = round(max(f − 1, 0) · 255)`.
  - `relevoPedido`: `ligadoNoDado || new URLSearchParams(busca).has('relevo')`.
  - `pxPorDegrauDaBusca`: lê `relevoPx` e cai no dado se ausente ou inválido. Só existe para o
    roteiro mostrar as duas geometrias sem editar o dado; o número que fica é o do dado.
- [ ] **Passo 4:** o teste passa; `npm run verify` passa.
- [ ] **Passo 5: commit.**

  ```
  feat(D-TELA-LUZ-RELEVO): conta pura da luz do relevo (sul, sem leste-oeste, plano neutro)
  ```

## Tarefa 3: D-TELA-LUZ-RELEVO, as camadas de sombra e de luz, o tint e os ganchos

**Arquivos:**
- novo: `src/render/camada-de-relevo.ts`;
- mudam: `src/render/scenes/WorldScene.ts` (os 4 ganchos), `src/render/unidades.ts` e
  `src/render/debug.ts`.

**Interfaces:**
- **Consome** tudo de `relevo.ts`.
- **Produz:**

  ```ts
  export interface LuzDoRelevo {
    /** Tinge um Image/Sprite com o fator sob o pe. Uma vez: objeto fixo. */
    tingir(obj: Phaser.GameObjects.GameObject, xPe: number, yPe: number, rotulo: string): void;
    /** Tinge todo Image/Sprite do container (recursivo), com o mesmo fator do pe do predio. */
    tingirContainer(c: Phaser.GameObjects.Container, xPe: number, yPe: number, rotulo: string): void;
    /** Unidade: so retinge quando o tile do pe muda, ou quando a imagem e nova. */
    tingirSeMudouDeTile(img: Phaser.GameObjects.Image | null, xPe: number, yPe: number, rotulo: string): void;
  }
  export function criarCamadaDeRelevo(
    cena: Phaser.Scene, config: ConfigDoMapa, busca: string, debug: EstadoDebug,
  ): LuzDoRelevo | null;
  ```

  No `debug.ts`, um campo **opcional**, escrito **só** quando a flag foi pedida. Com a flag
  desligada, o `window.__cangaco` fica idêntico ao da `main`.

  ```ts
  relevo?: {
    ativo: boolean;
    pxDeMundoPorDegrau: number;
    vertices: [number, number];
    /** rotulo -> fator aplicado: 'predio:<id>', 'unidade:<id>', 'vegetacao:<gx,gy>'. */
    fatores: Record<string, number>;
  };
  ```

- [ ] **Passo 1: `criarCamadaDeRelevo`.**
  - Devolve `null` se não foi pedido (`relevoPedido(busca, dados.ligado)` falso), sem escrever
    nada no debug. Não pergunta pelo renderizador (decisão 14): a D-TELA-06 garante o WebGL.
  - Ativo:
    - `calcularLuz`;
    - `texturasDaLuz`, e duas `CanvasTexture` de `largura × altura` (129×129), opacas (alfa 255
      em todo pixel, para o `ONE_MINUS_SRC_ALPHA` do MULTIPLY ser 0), com `setFilter(LINEAR)`;
    - duas imagens, cada uma com
      `cena.add.image(-tilePx/2, -tilePx/2, chave).setOrigin(0).setDisplaySize(largura·tilePx, altura·tilePx)`,
      que põe o centro do texel (i, j) no vértice (i·tilePx, j·tilePx);
    - a de **sombra** com `.setBlendMode(Phaser.BlendModes.MULTIPLY)`;
    - a de **luz** com o modo próprio:

      ```ts
      const r = cena.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      // uma vez por renderer: o indice fica guardado num WeakMap<renderer, number>
      const LUZ = r.addBlendMode([r.gl.DST_COLOR, r.gl.ONE], r.gl.FUNC_ADD); // c*s + c = c*(1+s)
      imagemDaLuz.setBlendMode(LUZ);
      ```

    - as duas em `.setDepth(DEPTH_DA_LUZ)`, com `DEPTH_DA_LUZ = 3`. A ordem entre elas não muda o
      resultado: cada pixel recebe só uma das duas fora do neutro.
  - O tint: `setTint(tintDoSprite(fatorEm(...), p))` em `instanceof Phaser.GameObjects.Image`, e
    `tingirContainer` desce por `container.list`, recursivo. Todo tint escreve
    `debug.relevo.fatores[rotulo]`.
  - O `tingirSeMudouDeTile` guarda `WeakMap<Image, string>` com o `tileDoPe`.
- [ ] **Passo 2: os 4 ganchos no `WorldScene.ts`** (seção "Os ganchos"). Mais, no `unidades.ts`:
  - `criarCamadaDeUnidades(cena, tilePx, luz: LuzDoRelevo | null = null)`;
  - no `atualizar`, depois do `setPosition` (`:279`):

    ```ts
    luz?.tingirSeMudouDeTile(item.imagem, centro.x + desvio.x, centro.y + desvio.y, `unidade:${id}`);
    ```

- [ ] **Passo 3:** conferir no código que `desenharMedidor` e `desenharBandeira` devolvem
  `Graphics`, `Rectangle` ou `Text`, e não `Image`.
  - Se algum devolver `Image` de UI (o medidor), `tingirContainer` pula esse objeto por uma marca
    explícita (`setData('semLuz', true)` no ponto de criação), e não por posição na lista.
  - A bandeira é objeto do mundo e **recebe** a luz.
- [ ] **Passo 4:** `npm run verify` passa.
- [ ] **Passo 5: regressão rápida com a flag desligada.** Três roteiros que cobrem o que os ganchos
  tocam: `F-TR` (terreno e recurso), `F-VIVO-a` (prédio com pilha) e `F10` (unidade). Saída 0 e
  sha256 dos PNGs iguais à linha de base da Tarefa 0.
  - Se um sha divergir, rodar o mesmo roteiro de novo na linha de base, numa worktree temporária
    na `main`, para separar ruído de captura de mudança real. O resultado vai para as "Notas
    da implementação".
- [ ] **Passo 6: commit.**

  ```
  feat(D-TELA-LUZ-RELEVO): camadas de sombra e luz do relevo e tint dos sprites, atras da flag e do WebGL
  ```

## Tarefa 4: D-TELA-LUZ-RELEVO, o roteiro com a flag ligada

**Arquivos:** `tools/shots/D-TELA-LUZ-RELEVO.js` (novo).

- [ ] **Passo 1: o roteiro.**
  - Reabre com `?pausado&relevo`, como o `_sem-arte.js` faz com `?semArte`.
  - Afirma, pelo `window.__cangaco.relevo`:
    - `ativo === true` (o WebGL já é afirmado pelo roteiro da D-TELA-06);
    - `vertices` igual a `[largura + 1, altura + 1]` do mapa.
  - **Escolhe o lugar pelo dado, sem coordenada digitada.** Lê `data/maps/sertao-128.json` e o
    `.relevo.json`, e acha, perto da vila, um retângulo de tela que contenha **grama, areia e
    rocha**, e um tile de encosta (amplitude = `decliveMaximoEmDegraus`) onde a planta de um
    prédio pequeno passe no `canPlace`.
  - Põe o prédio pelo comando de colocar que os roteiros já usam, e centra a câmera ali.
  - A árvore é uma do mapa dentro do quadro. O serf é o da vila, avançado até entrar no quadro
    (`avancar(n)`), ou o quadro inclui o armazém.
  - **Afirma os fatores:**
    - `fatores['predio:<id>']`, `fatores['vegetacao:<gx,gy>']` e `fatores['unidade:<id>']`
      existem e ficam em `[fatorMinimo, 1]` (o tint nunca passa de `tetoDoTintDoSprite`);
    - o prédio fica numa encosta de **sombra**, e o fator dele é **< 1**, para a captura mostrar o
      tint agindo. A árvore ou o serf numa encosta de **luz** mostra o S1: fator **1**, e o chão
      em volta acima de 1.
  - Avança o bastante para a obra trocar de estágio e afirma que `fatores['predio:<id>']` foi
    escrito de novo (Foco de revisão 2).
  - **Um passo despausado** (`press('p')`, `waitForTimeout(150)`, `press('p')`), para o serf trocar
    de tile e o `fatores['unidade:<id>']` mudar ou se manter coerente com o tile novo. É a lição
    do roteiro pausado (§8).
  - Captura (o mesmo quadro, o mesmo tick, a mesma câmera):
    - `screenshots/D-TELA-LUZ-RELEVO-1.png`: com relevo, geometria de 8 px por degrau (norte 0,83);
    - `screenshots/D-TELA-LUZ-RELEVO-2.png`: com relevo, `?relevoPx=12.8` (norte 0,71). **As duas lado a
      lado decidem a geometria** (decisão 9);
    - `screenshots/D-TELA-LUZ-RELEVO-0.png`: recarregado **sem** `?relevo`, a referência.
  - **O chão plano igual pixel a pixel (decisão 7).**
    - O roteiro escolhe, pelo arquivo de altura, um retângulo de chão de grama **plano**: todo
      vértice dele e da moldura de um vértice em volta tem a mesma altura, então o gradiente é 0
      e o fator é 1 exato. O retângulo não tem sprite nenhum (sem árvore, prédio ou unidade no
      retângulo nem a um tile dele).
    - Decodifica as capturas `-0` e `-1` **no próprio navegador** (`page.screenshot` em base64,
      `Image`, canvas 2D e `getImageData`, sem dependência nova). Afirma que os pixels do
      retângulo são **iguais byte a byte**.
    - Para provar que a asserção acusa, faz a mesma comparação num retângulo de encosta, que tem
      de **diferir**.
  - **A saturação da areia (decisão 10).**
    - O roteiro acha pelo dado um retângulo de **areia** numa encosta de luz (fator > 1) e o
      põe no quadro.
    - Conta, entre `-0` e `-1` (e `-2`), os pixels do retângulo com algum canal em 255 que não
      estava em 255 sem relevo: são os que **saturaram por causa da luz**.
    - Grava a contagem, o total de pixels e a fração em `test-output/D-TELA-LUZ-RELEVO-saturacao.json`.
      O roteiro não reprova por isso: é medida para a decisão.
  - **O salto de brilho da unidade (mudança 6).** O roteiro segue um serf andando por uma
    encosta, despausado em passos curtos. A cada quadro registra `fatores['unidade:<id>']` e o x,
    y desenhado, e grava a série em `test-output/D-TELA-LUZ-RELEVO-tint-da-unidade.json`. Captura duas
    imagens coladas: `screenshots/D-TELA-LUZ-RELEVO-3.png` com o serf no último quadro antes de cruzar o
    tile, e `-4.png` com ele no primeiro quadro depois.
- [ ] **Passo 2:** `CANGACO_SHOT_PORTA=5177 npm run shot -- D-TELA-LUZ-RELEVO` sai 0, com a porta
  conferida antes.
- [ ] **Passo 3: abrir as duas capturas com Read** (evidência da feature atual, §8). O que olhar:
  - encosta clara ao sul e escura ao norte;
  - sprites no mesmo tom do chão, sem recorte;
  - grama, areia e rocha no quadro;
  - nenhuma encosta que pareça parede fora de montanha.

  Se os números de partida (amplitude, `pxDeMundoPorDegrau`, inclinação) derem relevo invisível
  ou exagerado, ajusto **só** `data/relevo.json` e regenero. Os números novos e o motivo vão para
  as "Notas da implementação".
- [ ] **Passo 3b: a geometria e a saturação, para o operador.**
  - `-1` e `-2` lado a lado vão no relatório, com os fatores medidos no norte e no sul de cada
    uma. O operador escolhe, e o número dele vai para `pxDeMundoPorDegrau` no dado.
  - A contagem de saturados vai junto. **Se houver pixel saturado**, o `tetoDaLuzDoChao` entra no
    dado, com o valor que zera a saturação no retângulo medido, e a validação dele já está pronta
    (seção `data/relevo.json`). Se não houver, o campo não entra.
- [ ] **Passo 3a: o salto do tint da unidade.** Abrir `-3.png` e `-4.png`, e ler a série do
  JSON.
  - **Salta** se a diferença de fator na troca de tile for perceptível na captura (o serf muda
    de tom de um quadro para o outro, com o chão em volta contínuo). O número vai junto: a
    diferença de fator na troca contra a maior diferença entre quadros dentro do mesmo tile.
  - **Se saltar**, o tint passa a ser **interpolado pela posição**:
    - `tingirSeMudouDeTile` vira `tingirPelaPosicao`, que retinge quando o fator arredondado
      para o tint (`tintDoFator`) muda, e não quando o tile muda;
    - o custo continua sendo uma conta por unidade por quadro, e um `setTint` só quando o cinza
      muda de degrau (256 degraus);
    - o teste puro da Tarefa 2 ganha o caso: andar meio tile muda o tint sem trocar de tile;
    - a decisão e as duas capturas vão para as "Notas da implementação". O "a cada mudança de
      tile" do pedido original fica registrado como substituído por decisão do operador
      (mudança 6).
  - Se não saltar, fica por tile, com a medida registrada.
- [ ] **Passo 4:** `npm run verify` (só depois de liberado, mudança 3), e depois o commit.

  ```
  feat(D-TELA-LUZ-RELEVO): roteiro do relevo ligado (grama, areia, rocha; serf, arvore e predio na encosta)
  ```

## Tarefa 5: regressão completa, fila e registro

- [ ] **Passo 1: linha de base e flag desligada, em sequência** (decisão 12). Só quando o
  operador disser que a `main` está parada:
  1. **rebase** sobre a ponta da `main`;
  2. **linha de base** sobre essa ponta, numa worktree temporária da `main` (`git worktree add`
     no scratchpad, com o mesmo `npm ci`). A porta 5177 é conferida antes de cada roteiro; porta
     ocupada é parar e reportar, sem matar processo. Cada `tools/shots/*.js` que não começa com
     `_` roda um por vez, com `CANGACO_SHOT_PORTA=5177`, e o resultado vai para
     `linha-de-base.json` no scratchpad: `{ roteiro: { saida, pngs: { nome: sha256 } } }`;
  3. **logo em seguida, os mesmos roteiros nesta branch**, com a flag desligada, no mesmo
     formato.

  A comparação:
  - **código de saída igual em todos**, e sha256 por PNG;
  - PNG divergente: roda de novo na linha de base e classifica como ruído (a `main` diverge dela
    mesma) ou mudança real;
  - mudança real é **defeito desta branch**, e o conserto vem antes de seguir;
  - a tabela de resultado vai para `test-output/relevo-a-regressao.json`.
- [ ] **Passo 2: `BUILD_PLAN.md`**, na Fase D, com as siglas e o nome ao lado:
  - **D-TERRENO-ALTURA (altura só de render no gerador de mapa)**, com o aceite da Tarefa 1;
  - **D-TELA-LUZ-RELEVO (luz do relevo: camadas de sombra e de luz, e tint)**, com o aceite das Tarefas
    2 a 4;
  - na nota da D-TELA-LUZ-RELEVO:
    - ligar a flag por padrão espera a arte de terreno da F-TR;
    - o chão plano é 1,0 exato e a arte é pintada para ele, sem compensação (decisões 7 e 8);
    - o `addBlendMode` é risco no Phaser 4 (decisão 11);
    - o `transladar-mundo.js` não translada a altura;
    - a troca para `Phaser.WEBGL` é item próprio da `main`.
- [ ] **Passo 3: `test-results.json`.** As duas chaves com `passes: true`, só depois do `npm run
  verify` (o hook exige o selo de 15 minutos).
- [ ] **Passo 4: sem `PROGRESS.md` (mudança 4).** As "Notas da implementação", no fim deste
  arquivo, ficam completas. Elas separam o que foi verificado do que é hipótese:
  - os números de geração são de partida;
  - a geometria escolhida (decisão 9) e a medida de saturação (decisão 10);
  - o WebGL do runner foi medido pelo roteiro D-TELA-06, na Tarefa 0;
  - o resultado da conferência do salto do tint.

  Delas sai, **no merge**, o bloco do PROGRESS: já vai escrito lá, pronto para colar.
- [ ] **Passo 5: commit.**

  ```
  docs(D-TELA-LUZ-RELEVO): fila, test-results e notas do relevo A
  ```

- [ ] **Passo 6: relatório ao operador.**
  - O resumo e a tabela de estado.
  - O `git diff --stat main...dellanio/relevo-a`.
  - **Sem merge.**

---

## Autoconferência contra o pedido

| Pedido | Onde |
|---|---|
| Branch `dellanio/relevo-a` da `main`, em worktree própria | feito (`76dbcc8`, worktree `implementacao-relevo`) |
| Só a opção A | Restrições globais; nada de B, C, splatting, vento ou matas em nenhuma tarefa |
| Flag desligada por padrão, nada muda com ela desligada | `data/relevo.json` `ligado: false`; `debug.relevo` só com a flag pedida; Tarefa 3 passo 5; Tarefa 5 passo 1 |
| ~~Sem WebGL, camada e tint desligados~~ saiu (decisão 14) | a D-TELA-06 da `main` exige WebGL; o roteiro dela rodou verde na 5177 |
| Não trocar para `Phaser.WEBGL` | a troca veio da `main` (D-TELA-06); `game.ts` fora da lista de arquivos |
| Linha de base no fim, em sequência (decisão 12) | Tarefa 5, passo 1 |
| Módulo isolado e o mínimo de ganchos no `WorldScene.ts` | 2 módulos novos; 4 ganchos de uma linha |
| Altura só de render, do gerador, lida só pelo render | Tarefa 1; guarda estrutural na Tarefa 2 |
| Relevo suave com teste do declive máximo | `forcarDecliveMaximo` e `declivesForaDoLimite`, com o teste que acusa |
| Luz de cima, inclinada para o sul, sem leste–oeste | `L = (0, sen θ, cos θ)`; o teste de igualdade leste = oeste |
| ~~`k < 1` em `data/`, marcado como hipótese (0,85)~~ substituído: chão plano = 1,0 exato (decisão 7) | `texturasDaLuz` neutra no plano (teste, Tarefa 2); chão plano igual pixel a pixel (roteiro, Tarefa 4) |
| Tint S1, `tetoDoTintDoSprite` = 1,0 (decisão 8) | `tintDoSprite` (teste, Tarefa 2); fatores ≤ 1 (roteiro, Tarefa 4) |
| Geometria 0,83 × 0,71 lado a lado (decisão 9) | `?relevoPx`; capturas `-1` e `-2`; Tarefa 4 passo 3b |
| Saturação da areia medida (decisão 10) | `test-output/D-TELA-LUZ-RELEVO-saturacao.json`; Tarefa 4 passo 3b |
| `addBlendMode` como risco para o Phaser 4 (decisão 11) | `docs/planos/estudo-relevo.md`, hipóteses; Notas |
| Tint em árvore, prédio, recurso e unidade; fixo uma vez, unidade por tile | Tarefa 3; Foco de revisão 2 e 3 |
| `verify` e roteiros iguais com a flag desligada | Tarefas 0, 3 e 5 |
| Roteiro com a flag ligada (grama, areia, rocha; serf, árvore e prédio na encosta) | Tarefa 4 |
| Teste do gerador: determinístico pela semente e dentro do declive | Tarefa 1 |
| Notas neste arquivo (PROGRESS no merge), verify antes de cada commit, commits pequenos | Tarefas 1 a 5; mudanças 3 e 4 |
| Resumo e `diff --stat`, sem merge | Tarefa 5 passo 6 |
| Sigla livre conferida na `main` depois do commit dela | mudança 1; Tarefa 0 passo 0 |
| Porta 5177, verify só liberado, nunca matar processo | mudança 3; Restrições globais |
| Nota para o contrato de arte (decisão 8) | "Texto proposto para o contrato de arte" |
| Conferir o salto do tint da unidade, interpolar se saltar | Tarefa 4 passos 1 e 3a |

---

## Notas da implementação

Preenchidas durante a execução. Separam o **verificado** (com o comando ou o arquivo aberto) da
**hipótese**. O bloco do `PROGRESS.md` sai daqui no merge.

- **Decidido (2026-09-30):** não há `k`. O chão plano é 1,0 exato (decisão 7), e o sprite fica
  preso em 1,0 (decisão 8).
- **Verificado (lido no Phaser 3.90 da árvore da `main`):**
  - o MULTIPLY é `[DST_COLOR, ONE_MINUS_SRC_ALPHA]` e o SCREEN é `[ONE, ONE_MINUS_SRC_COLOR]`
    (`WebGLRenderer.js:797-801`);
  - o `addBlendMode(func, equation)` é público (`:1859`);
  - o shader multiplica textura × tint (`Multi.frag`), então o tint só escurece.
- **Hipótese:** o `[DST_COLOR, ONE]` dá exatamente `c × (1 + s)` na GPU do runner. Quem confere
  é a asserção pixel a pixel do plano e a captura da encosta (Tarefa 4).
- **Risco (decisão 11):** o `addBlendMode` pode não existir igual no Phaser 4. Registrado nas
  hipóteses do `docs/planos/estudo-relevo.md`, para o estudo de migração.
- **Tarefa 0, passo 0 (verificado, 2026-09-30):**
  - rebase sobre a `main` em `e8f704e`, que contém a D-TELA-06 (`4550668`, o jogo exige WebGL:
    `Phaser.AUTO` virou `Phaser.WEBGL`, com o portão `src/render/webgl.ts` antes de o jogo
    carregar);
  - o `BUILD_PLAN.md` da `main` usa D-TELA até a 06, e nenhuma branch local usa 07. O `xx` virou
    **D-TELA-07**. A D-TERRENO-01 continua livre. **Colidiu** depois: a `main` usou a D-TELA-07
    para o sinal de pausado (`5402f09`); a luz foi para a D-TELA-08, e hoje, pela regra nova de
    id, é a **D-TELA-LUZ-RELEVO**, e a altura é a **D-TERRENO-ALTURA** (decisão 16);
  - a cena já publica `__cangaco.renderizador = { tipo, webgl }` (D-TELA-06). A proteção de
    Canvas saiu do plano (decisão 14).
- **Tarefa 0, passo 2 (verificado, 2026-09-30):** a sonda `zz-` **não foi criada**. O roteiro
  da própria `main`, `D-TELA-06`, lê `game.renderer.type` com o jogo rodando, e é a mesma
  pergunta. Rodou com `CANGACO_SHOT_PORTA=5177 npm run shot -- D-TELA-06` (porta conferida livre
  antes, com `curl` saindo 7): **saída 0**, `renderizador: { tipo: 2, webgl: 2 }`, as 7
  afirmações passaram, e nenhum erro de console (`test-output/D-TELA-06-shot.json`). **O
  Chromium do runner tem WebGL; a Tarefa 4 pode mostrar a luz.**
- **`node_modules` próprio nesta worktree (aprovado pelo operador, decisão 13):** a regra do CLAUDE.md é a
  junction para o `node_modules` da `main`. Não usei, porque não há `vite.config` e o cache do
  Vite fica em `node_modules/.vite`: com a junction, o dev server da porta 5177 escreveria no
  mesmo cache que a leva da `main` está usando. Rodei `npm ci` aqui, do mesmo `package-lock.json`:
  136 pacotes, nenhuma dependência nova, e o `node_modules/` é ignorado pelo git.
- **Linha de base:** não rodada, por decisão do operador (decisão 12). Vai para o fim (Tarefa 5,
  passo 1), sobre a ponta da `main` parada. São 84 roteiros hoje (`tools/shots/*.js` sem `_`).
- **Tarefa 1, D-TERRENO-ALTURA (commit `c12c4fa`, depois do rebase sobre `6bc8044`), verificado com `npx vitest run`, um arquivo por
  vez (decisão 15):**
  - `tests/D-TERRENO-ALTURA.test.ts`: 21 de 21. Também `estilo-ui-menu` (12 de
    12), por causa do `relevo` novo em `ARQUIVOS_DA_INTERFACE`, e `F-D3-geografia` (8 de 8), a
    guarda do mapa emitido;
  - `node tools/gerar-mapa.js --conferir` sai 0 nos dois arquivos. O `sertao-128.json` tem o
    **mesmo blob** de antes (`686196f…`, por `git hash-object` e `git rev-parse HEAD:`). O "M"
    que o `git status` mostrou depois de regravar era só LF contra CRLF, e a cópia foi restaurada;
  - a evidência (`test-output/D-TERRENO-ALTURA.json`): degraus de 1 a 18; 15 633
    tiles com limite, dos quais 11 722 planos e 248 encostas no limite de 2 degraus; média no
    miolo de montanha 15,7, de grama 6,1, de água 3,2.
- **Tarefa 2, D-TELA-LUZ-RELEVO, a conta pura (`src/render/relevo.ts`), verificado com `npx vitest run`:**
  - `tests/D-TELA-LUZ-RELEVO.test.ts`: 12 de 12. Também `F04-grid-ortogonal` (17 de 17),
    que guarda o que `src/render/` pode importar;
  - as rampas sintéticas dão os números da avaliação: 0,830 e 1,110 a 8 px por degrau, e 0,714 e
    1,143 a 12,8 px (`test-output/D-TELA-LUZ-RELEVO-geometrias.json`);
  - **no mapa real, a 8 px por degrau, a luz vai de 0,52 a 1,15, mas só no miolo de montanha e
    rocha** (sem limite de declive). Nos vértices tocados só por tipos com limite, medido com um
    `node -e` avulso, ela vai de **0,87 a 1,11**. O 0,83 do norte só aparece com rampa de 2
    degraus nos dois lados do vértice, e o mapa quase não tem isso. Isso pesa na decisão 9: o
    norte real fica mais claro que o da tabela nas duas geometrias, e a captura vai mostrar;
  - o mapa de luz é `Float32`: o 1 do plano é exato, mas um teto como 1,05 volta como
    1,0499999…. O teste do teto usa tolerância; os neutros exatos (255 e 0) não dependem disso;
  - `Float32Array`, `Uint8Array` e o JSON importado **não passaram por `typecheck` nem `lint`**:
    esses rodam no `verify`, quando for liberado. Até lá, a tipagem é hipótese.
- **Renome para os ids novos e o primeiro `verify` (2026-09-30), depois do rebase sobre a `main`
  em `6bc8044`:**
  - os dois testes renomeados passam sozinhos: `D-TELA-LUZ-RELEVO` 12 de 12 e `D-TERRENO-ALTURA`
    21 de 21, e as três evidências foram regravadas com os nomes novos;
  - o 1º `verify` reprovou no **lint**: dois `any` nas quebras do `D-TERRENO-ALTURA.test.ts`. Ficou
    tipado (`RelevoCru`), sem `eslint-disable`;
  - o 2º e o 3º `verify`: `typecheck`, `lint` e `validate:data` (15 arquivos, 0 erros) verdes, e
    **1 teste de 2 129 reprovado**, nos dois: `tests/F-VIVO-e-ocioso.test.ts`, "aceite 1", por
    **timeout de 5 000 ms** (5 130 ms e 5 014 ms). Esse teste roda 6 000 ticks da sim com o
    timeout padrão do Vitest;
  - **o que se sabe:** sozinho, o arquivo passa, 7 de 7, em 5,4 s e 6,0 s de duração total. Esta
    branch não muda nada em `src/sim/` (`git diff main --stat -- src/sim` vazio), e o teste não
    importa nada do relevo. A máquina tinha 36 processos `node` na hora;
  - **hipótese, não conferida:** a mesma suíte na `main` reprova igual com a máquina carregada.
    Não rodei a suíte da `main` para conferir;
  - **o commit do renome espera:** sem o selo do `verify`, não commitei. O teste é de outra
    feature (F-VIVO-e), e a correção dele (um `timeout` explícito, como o do F09, que o §8
    permite porque timeout não é asserção de tempo) é decisão do operador.
- **4º `verify` (máquina livre: 24 `node`, nenhum gastando CPU em duas leituras seguidas, CPU a
  9–20%):**
  - `typecheck`, `lint`, `validate:data` verdes; `npm run test` **2 129 de 2 129**;
  - `test:transladado` reprovou em dois arquivos:
    - `F-VIVO-e-ocioso`, "aceite 1", **timeout de novo** (5 844 ms). **Sozinho** (`--reporter=verbose`,
      duas vezes em cada suíte), o "aceite 1" leva **1 785 e 1 461 ms** na suíte normal e
      **1 604 e 1 481 ms** na transladada (arquivo inteiro 3,4–4,0 s). Na suíte inteira, 5,0–5,8 s:
      é a disputa entre os workers do Vitest, não a máquina de fora nem esta branch. A correção é
      da `main` (decisão do operador);
    - **`D-TERRENO-ALTURA`, 5 casos: defeito desta branch.** No mundo transladado da F18c-1c, o
      `require` do gerador passa pelo `fs.readFileSync` trocado, e o gerador vê o mapa andado
      (160 × 160), enquanto o `.relevo.json` do disco não é transladado (129 × 129). O teste
      comparava os dois mundos;
  - **conserto:** as guardas 1 a 3 medem o relevo que o gerador emite sobre o mapa que ele mesmo
    monta, e valem nos dois mundos. O caso "o mapa do jogo não muda" saiu, porque duplicava o do
    F-D3. Sobra **um** caso que compara com o disco, "o que a semente emite hoje é, byte a byte, o
    arquivo versionado", no `describe` "o arquivo publicado". Na suíte normal, 21 de 21; na
    transladada, 20 de 21, só esse caso;
  - **esse caso é contrato do arquivo publicado**, a mesma categoria do F-D3 e do F18b que o
    operador pôs "fora de vez" do mundo transladado (2026-09-26, `vitest.transladado.config.mts`,
    `FORA_DO_MUNDO_TRANSLADADO`). Pôr uma linha nova nessa lista é tirar um caso de uma
    verificação (§10), então **espera a decisão do operador**. Até lá, nada é commitado.
- **`FORA_DO_MUNDO_TRANSLADADO` (aprovado pelo operador, 2026-09-30):** o caso "o que a semente
  emite hoje é, byte a byte, o arquivo versionado" do `D-TERRENO-ALTURA` entrou na lista, com o
  comentário citando a regra do F-D3 (2026-09-26): contrato do arquivo publicado, não do mundo.
  Conferido: transladada 20 passam e 1 pulado; normal 21 de 21. **Espera para o commit:** a
  correção do timeout da F-VIVO-e na `main`. Depois dela vêm o rebase, o `verify` e o commit do
  renome com o teste reestruturado.
- **Rebase sobre a `main` em `b2b5c73` (o timeout explícito de 20 s na F-VIVO-e e em outros três
  testes), sem conflito.** Stash marcado `relevo-a-wip-renome`, aplicado pelo SHA e depois
  apagado; a árvore conferiu igual ao `relevo-a-wip.patch` (ignorando as linhas `index`), e o
  `.patch` foi apagado depois do commit. **Checks localizados** (decisão 17), suíte normal e
  transladada: `D-TELA-LUZ-RELEVO` 12 e 12; `D-TERRENO-ALTURA` 21, e 20 + 1 pulado;
  `F04-grid-ortogonal` 17 e 17; `estilo-ui-menu` 12 e 12; `F-D3-geografia` 8, e 7 + 1 pulado (o
  pulo antigo dele). `tsc --noEmit` do projeto, `eslint` nos arquivos alterados e `validate:data`
  (15 arquivos, 0 erros): verdes.
- **Tarefa 3, D-TELA-LUZ-RELEVO, as camadas e o tint (verificado com os checks da decisão 17):**
  - `src/render/camada-de-relevo.ts`, novo: sem o pedido, devolve `null` sem criar nada nem
    escrever no debug. Com o pedido, cria duas `CanvasTexture` de 129 × 129, opacas e com filtro
    linear, e duas imagens no depth 3: a sombra em `MULTIPLY` e a luz no modo
    `[DST_COLOR, ONE]` (`renderer.addBlendMode`, registrado uma vez por renderer num `WeakMap`).
    Não há caminho de Canvas (decisão 14): o renderer vem por cast, com a D-TELA-06 garantindo o
    WebGL;
  - **o tint só vai em `Image`**, recursivo nos containers. Conferido no código do
    `criarPredio` da `main` atual: medidor, bandeira, placa de pausado, canteiro, lote e
    placeholder são retângulo, texto ou polígono, e ficam sem tint. Recebem tint o corpo do
    prédio, as pilhas, o quadro de trabalho e os animais. **A bandeira fica sem luz** (é
    retângulo), ao contrário do que a Tarefa 3, passo 3, previa;
  - `src/render/debug.ts`: o campo **opcional** `relevo?` (`RelevoNoDebug`), escrito só com o
    pedido: `pxDeMundoPorDegrau`, `vertices`, `faixa` e `fatores` por rótulo;
  - os ganchos no `WorldScene.ts` (10 linhas): o import, o campo `luz`, a criação logo depois da
    camada de recursos e antes do primeiro `atualizarPredios`, o `this.luz` passado à camada de
    unidades, o tint da vegetação ao nascer e o do prédio no fim de `criarPredio`. No
    `unidades.ts`: o parâmetro opcional `luz` e o `tingirSeMudouDeTile` logo depois do
    `setPosition`;
  - checks: `tsc --noEmit` e `eslint` verdes; `D-TELA-LUZ-RELEVO` e `F04` verdes nas duas suítes;
  - **fumaça com a flag desligada, porta 5177 conferida antes de cada roteiro:** `F-VIVO-a`
    saída 0; `F10` **saída 1 na primeira**, por `page.goto: Timeout 30000ms` antes do jogo
    carregar (a primeira subida do Vite depois do rebase), e **saída 0 na segunda**. Não é a
    comparação com a linha de base, que fica para o fim (decisão 12).
- **Tarefa 4, o roteiro `tools/shots/D-TELA-LUZ-RELEVO.js`, rodado na porta 5177 (conferida
  livre antes de cada corrida): saída 0, nenhum erro de console.** O que ele afirma e mede, no
  quadro da vila a zoom 0,5:
  - **chão plano igual pixel a pixel (decisão 7):** um tile de grama plana, (20,30), com toda
    a moldura de vértices na mesma altura, nada em pé por perto e sem HUD por cima (conferido no
    navegador com `elementFromPoint`): **900 de 900 pixels iguais**, a 8 e a 12,8 px por degrau.
    A encosta de controle, (26,26), **difere** em 779 e 846 pixels: a comparação acusa;
  - **areia de luz (decisão 10):** 4 tiles, 3 600 pixels, **0 saturados** nas duas geometrias
    (`test-output/D-TELA-LUZ-RELEVO-medidas.json`). Pela decisão 10, o `tetoDaLuzDoChao` não entra;
  - **tint:** árvore e lajedo do quadro tingidos ao nascer (fatores 1,03–1,06 nas árvores, que
    estão em encosta de luz, e 1 no lajedo plano). **A pedreira** ficou em (30,27), na encosta de
    sombra mais forte que cabe no quadro com rua até a vila: **fator 0,979**. A obra foi
    retingida já com sprite (1 `Image`, 4 tintagens) antes da captura `-4`;
  - **o que precisou de conserto no caminho**, todos no roteiro e não no jogo:
    - a busca da areia ficava no miolo do quadro e marcava como ocupado todo recurso, inclusive
      os 274 `fish` do açude. Passou a ler do manifesto os que viram sprite em pé (`tree` e
      `rock`);
    - a rua exigia um tile de folga em volta dos prédios e descartava a encosta do açude;
    - a primeira prova do retingimento passava com a obra ainda em "marcação no chão", sem
      nenhuma `Image`. O debug ganhou `relevo.imagens` (quantas `Image` a última tintagem
      atingiu), e o roteiro espera o sprite.
- **Geração ajustada na captura (passo 3 da Tarefa 4):** com amplitude 4 e célula de ruído de 12
  tiles, o quadro da vila saía quase liso (25% do chão com alguma inclinação, 1,6% no teto). Medi
  seis combinações com o próprio gerador e fiquei com **amplitude 12 e célula 10: 67,5% e 8,2%**,
  degrau máximo 26, ainda com o teto de 2 degraus. Amplitude 16 punha um quinto do chão no teto.
  Os números estão no `data/relevo.json` com o motivo; o `pxDeMundoPorDegrau` não mudou, porque
  é decisão do operador (decisão 9). Com o relevo novo, o miolo do quadro deixou de ter um 2×2
  plano, e a busca passou a 1 tile no quadro visível inteiro, só onde o canvas está descoberto.
- **Capturas abertas (Read):** `-2` (8 px) e `-3` (12,8 px), lado a lado para a decisão 9. A
  ondulação aparece como manchas suaves de luz e sombra na grama, mais marcadas a 12,8 px, sem
  parede nem degrau duro. A `-4` mostra a pedreira na margem do açude e a rua em L. Os recortes
  do serf (`-serf-antes-da-troca` e `-depois`) **não foram abertos**: a troca medida nesse quadro
  foi de 2 níveis de cinza.
- **Decisão 6, o salto do tint da unidade: SALTA, e o tint passou a seguir a posição.** Medido no
  mapa inteiro (`tests/D-TELA-LUZ-RELEVO.test.ts`, evidência
  `test-output/D-TELA-LUZ-RELEVO-salto-do-tint.json`): entre centros de tiles vizinhos em chão
  andável, a diferença de fator tem p95 de 0,020 a 8 px e 0,034 a 12,8 px, mas chega a **0,24, 61
  níveis de cinza**, no chão encostado na serra. A captura da vila não pega esse caso, então a
  medida veio do mapa. Pela regra da mudança 6, `tingirSeMudouDeTile` virou `tingirPelaPosicao`:
  o fator é o bilinear sob o pé a cada quadro, e o `setTint` só roda quando o cinza muda. O teste
  puro ganhou o caso "meio tile anda e o cinza muda sem trocar de tile", e o `tileDoPe` saiu (sem
  uso). O "a cada mudança de tile" do pedido original fica substituído por essa regra.
- **Sincronização e `verify` liberados pelo operador (2026-09-30):** rebase sobre a `main` em
  `d372d04`, sem conflito. Máquina conferida antes (25 `node`, nenhum gastando CPU, CPU a 27%).
  **`npm run verify` verde**: `typecheck`, `lint`, `validate:data` (15 arquivos, 0 erros),
  `test` **2 138 de 2 138**, `test:transladado` **2 136 e 5 pulados** (os 4 antigos mais o
  contrato do arquivo publicado do `D-TERRENO-ALTURA`). O selo `.verify-ok` foi criado. **Não
  é o `verify` final da decisão 17**, nem marca `passes`: a linha de base, a comparação com a
  flag desligada e as duas capturas da geometria esperam o operador liberar a máquina.
