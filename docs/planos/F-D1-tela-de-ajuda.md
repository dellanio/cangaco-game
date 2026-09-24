# F-D1 — A tela de ajuda — plano de implementação

> **Para quem executa:** os passos usam caixa (`- [ ]`). Uma tarefa por vez, com
> teste e commit próprios.

**Objetivo:** o jogo **anuncia** quais teclas e gestos existem, em vez de o
jogador descobrir por acaso ou por alguém contar. Sobreposição aberta por `H` e
`F1`, mais um lembrete discreto na primeira partida.

**Arquitetura:** o coração não é a tela, é o **inventário**. Hoje as teclas moram
espalhadas em `if`s dentro de `input/teclado.ts` e `input/teclas-do-tempo.ts`, e
uma tela escrita à mão seria uma segunda cópia que diverge na primeira feature
que acrescentar tecla. Então: um módulo `src/input/atalhos.ts` declara os
atalhos; os dois ouvintes passam a casar a tecla **pela declaração**; a tela lê a
mesma declaração. O guarda que fecha a corrente é comportamental — para **cada**
entrada do inventário, o teste dispara a tecla num `EventTarget` do Node e afirma
que **alguma coisa aconteceu**.

**Stack:** TypeScript estrito, Vitest (ambiente `node`, sem DOM), Playwright.
Sem dependência nova.

**Fila:** `BUILD_PLAN.md`, item `F-D1`, aprovado pelo operador no turno H.

## Restrições globais

- `src/sim/` **não é tocado**. Ajuda é interface: `ui/` e `input/`.
- Nenhum texto de jogador digitado em `.ts`: tudo de `data/theme-sertao.json`.
- `GameState` não ganha campo. A marca do "já vi a dica" é `localStorage`, que é
  de `ui/`.
- Nota de integração já escrita no item: pode tocar `ui/` **e** `input/`.
- Um único ouvinte de `keydown` para a página continua valendo (comentário de
  `input/teclado.ts`): a ajuda **não** registra um segundo.

## A corrente que prova "a tela não mente"

Três elos, cada um com seu guarda — nenhum deles sozinho basta:

1. **inventário → comportamento** (`tests/F-D1-ajuda.test.ts`): para cada atalho
   declarado, disparar a tecla produz efeito observável. Se alguém declarar `B`
   sem implementar, este teste reprova.
2. **inventário → tema** (mesmo teste): todo id do inventário tem rótulo no tema,
   e todo rótulo do tema tem id — a ida e a volta, como a F22 já faz.
3. **inventário → tela** (`tools/shots/F-D1.js`): a lista do DOM tem exatamente
   as teclas que a ponte `window.__cangaco.atalhos` publica, na mesma ordem.

O elo 3 sozinho seria circular (tela e ponte saem da mesma fonte); ele existe
para pegar a tela **filtrando** ou escrevendo à mão. Quem prova honestidade é o
elo 1.

## Estrutura de arquivos

- **Criar** `src/input/atalhos.ts` — `ATALHOS` (teclas) e `GESTOS` (mouse), com
  `id` neutro e `grupo`. Sem DOM, sem `window`: testável headless.
- **Modificar** `src/input/teclado.ts` — casa a tecla pelo inventário; ganha o
  `H`/`F1` e o `Esc` que fecha a ajuda antes de cancelar a ferramenta.
- **Modificar** `src/input/teclas-do-tempo.ts` — casa a tecla pelo inventário.
- **Criar** `src/ui/ajuda.ts` — monta a sobreposição a partir do inventário e do
  tema; dona do lembrete e do `localStorage`.
- **Modificar** `index.html` — `<aside id="ajuda" hidden>`, o lembrete dentro do
  `#hud`, e o CSS dos dois.
- **Modificar** `data/theme-sertao.json` — seção `ajuda`.
- **Modificar** `src/main.ts` — monta a ajuda e a entrega ao `ligarTeclado`.
- **Modificar** `src/render/scenes/WorldScene.ts` — só a ponte de depuração
  (`window.__cangaco.atalhos`), para o roteiro comparar.
- **Criar** `tests/F-D1-ajuda.test.ts`, `tools/shots/F-D1.js`.

## Tarefa 1 — O inventário, e o guarda comportamental

- [ ] **Passo 1: o teste que falha primeiro.** Em `tests/F-D1-ajuda.test.ts`:
      para cada `atalho` de `ATALHOS`, ligar `ligarTeclado` e
      `ligarTeclasDoTempo` num `EventTarget` do Node com dublês, disparar cada
      tecla do atalho e afirmar que o dublê do grupo dele foi chamado. Roda
      vermelho: `src/input/atalhos.ts` não existe.
- [ ] **Passo 2: `src/input/atalhos.ts`.** Uma entrada por atalho que **existe
      hoje** — `Escape`, `r`, `p`, `+`/`=`, `-` — mais a `h`/`F1` desta feature.
      Nada de `B`, `F`, `Delete`, `1..9`: o item proíbe listar tecla que não
      existe.
- [ ] **Passo 3: os dois ouvintes passam a ler o inventário.** A comparação de
      tecla deixa de ser literal no `if` e vira `casa(atalho, evento)`. O
      comportamento não muda — os testes da F06 e da F11a continuam verdes, e são
      eles a prova de que não mudou.
- [ ] **Passo 4:** `npx vitest run tests/F-D1-ajuda.test.ts tests/F06-build.test.ts tests/F11a-teclas-e-aviso.test.ts` verde.
- [ ] **Passo 5:** commit.

## Tarefa 2 — A tela, o tema e o lembrete

- [ ] **Passo 1: o teste da ida e volta do tema.** Todo id de `ATALHOS`/`GESTOS`
      tem rótulo em `theme-sertao.json:ajuda`, e todo rótulo tem id. Vermelho.
- [ ] **Passo 2: a seção `ajuda` no tema**, com título, rótulo por id, texto do
      lembrete e o rodapé de "como fechar".
- [ ] **Passo 3: `src/ui/ajuda.ts` e o HTML.** Monta a lista uma vez, no
      nascimento (como `ui/alertas.ts`), e só alterna `hidden` depois — o painel
      da F16b ensinou o preço de recriar DOM. O lembrete vive **no `#hud`**, não
      sobre o canvas: sobreposição nova na célula do canvas mexeria nas medidas
      de retângulo que os roteiros da F06 e da F22 afirmam.
- [ ] **Passo 4: `H`/`F1` no `teclado.ts`**, com `preventDefault` no `F1`
      (senão abre a ajuda do navegador) e o `Esc` fechando a ajuda **antes** de
      cancelar ferramenta ou seleção — com a ajuda aberta, é ela que o `Esc`
      fecha.
- [ ] **Passo 5:** `npm run verify` verde.
- [ ] **Passo 6:** commit.

## Tarefa 3 — O roteiro e a evidência

- [ ] **Passo 1: `window.__cangaco.atalhos`** publicado no POST_RENDER, junto do
      resto da ponte.
- [ ] **Passo 2: `tools/shots/F-D1.js`.** Passos: (1) o lembrete está visível na
      primeira partida; (2) `H` abre, e a lista do DOM bate com a ponte, tecla a
      tecla e na ordem; (3) `H` de novo fecha; (4) `F1` abre e **a página não
      navegou**; (5) `Esc` fecha, e com a ajuda aberta o `Esc` **não** cancelou a
      ferramenta que estava na mão; (6) recarregar: o lembrete não volta.
      **Pelo menos um passo despausado** (CLAUDE.md §8): abrir e fechar a ajuda
      com o laço andando, que é a condição em que o jogador vive.
- [ ] **Passo 3:** `npm run shot -- F-D1`, screenshot aberto com Read.
- [ ] **Passo 4:** não-regressão por código de saída: `F06`, `F11a`, `F13b`,
      `F22`(¹), `F04`.
- [ ] **Passo 5:** `npm run verify`, `test-results.json`, `PROGRESS.md`, commit.

(¹) `F22` já falha por causa do **BUG-C**, diagnosticado e aguardando a F-D3. A
comparação é com a falha conhecida, não com saída 0.
