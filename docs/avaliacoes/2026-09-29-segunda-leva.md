# Avaliação da segunda leva (2026-09-29): commits e89b0a6..55c80b8

Feita pelo subagente `evaluator` (só leitura), a pedido do operador: *"Ninguém além do autor
conferiu estas."* Relatório transcrito pelo autor, sem edição de conteúdo.

**Veredito: NEEDS_WORK.** Três achados `errado`, os três confirmados por sonda; nenhum
`trava`. A suíte está toda verde.
- A **C5 (colisão militar)** fez regredir o ataque a prédio (F-CERCO-a): só 2 soldados
  golpeiam, e o resto do grupo fica parado em `indo_atacar` para sempre. Bisect até o commit
  da C5.
- A **C7 (lado no JobBoard)** deixou uma escolha de armazém sem filtro de lado: a estrada
  que o jogador planeja perto da vila da IA nunca recebe pedra.
- O **peacetime da C-IA-03b** deixa passar `HireMercenary` (o equipar da prefeitura), que o
  KaM citado bloqueia.

O resto é aprovado com ressalvas, incluindo a série D-MOVIMENTO-01 (colisão civil): com a
chave desligada, nenhuma parte do mecanismo age.

## O que o avaliador conferiu

### Rodado de fato (HEAD 55c80b8, árvore limpa antes e depois)
- `npm run verify` com EXIT 0:
  - typecheck, lint e `validate:data` (14 arquivos) sem erro;
  - vitest com 164 arquivos e 1857 testes;
  - a suíte transladada com 1856 testes e 4 skipped.
- Oito roteiros com EXIT 0, rodados com as variáveis da nuvem: C2, C4, C-COMIDA-01d,
  C-IA-03c, F26b, F34, F25b e F28b.
- `grep` das invariantes em `src/sim`:
  - não há `phaser`, `Math.random`, `Date.now`, `window`, `document` nem `performance`;
  - o único `Math.random` é um comentário, em `state.ts:1366`.
- Nenhum número mágico em `sim/` novo: o `1000` de `projeteis.ts` e `torre.ts` é unidade de
  milésimos que já vem convertida do loader.
- Nove sondas em `scratchpad/aval2/sondas/` (fora do repositório). As árvores antigas foram
  extraídas por `git archive`.

### Screenshots abertas
- C2-1 e C4-1.
- C-COMIDA-01d-1 e -2.
- C-IA-03c-1 a -4.
- F26b-5, F25b-2, F28b-1 e F34-2.

### Não rodado
- O roteiro F-ESC (C10): para ele, só o teste verde foi conferido.
- A retomada do ataque a prédio no KaM depois do revide: hipótese.

## Achados `errado`

### 1. C5 quebra o ataque a prédio: só 2 golpeiam, o resto fica em `indo_atacar` para sempre
Confirmado por sonda, com bisect. A sonda dá uma ordem única de `AttackBuilding` contra um
armazém inimigo.

| Commit | 4 soldados, após 300 ticks | após 600 ticks | 12 soldados |
|---|---|---|---|
| e89b0a6 / e895944 (pai da C5) | 4 atacando | hp 22 | prédio cai antes de 300 |
| 84aeb6c (C5) / HEAD | 2 atacando + 2 em `indo_atacar` | hp 294 | 2 + 10 em `indo_atacar` |

- **Causa:**
  - `units/movimento.ts:136`: "destino com militar parado → para ali perto" zera o caminho;
  - `systems/cerco.ts:169`: `passoIndoAtacar` replaneja pelo A\*, que ignora unidades, e
    devolve o mesmo tile ocupado do anel, embora haja tiles livres nele.
- **Onde aparece:** o log da C-IA-03c mostra `{"indo_atacar":10,"atacando":2}` por mais de
  2000 ticks. Alcança a F-CERCO-a, a F26b, a C-IA-03c e o ataque da IA (F28-IA ponto 6).
- **Por que a suíte não pegou:** nenhum teste conta quantos soldados chegam a golpear.

### 2. C7: a pedra da estrada sai do armazém de outro lado, e a tarefa fica aberta para sempre
Confirmado por sonda (`s4-estrada`).
- Na escaramuça, 2 tiles de estrada abaixo da porta do armazém da IA.
- As tarefas `pedra-para-canteiro` nasceram com origem `p9`, do lado 1, e seguem `aberta`
  depois de 1500 ticks, com 0 assentado.
- **Causa:** `systems/jobs.ts:708`, `armazemMaisPertoDoTile` chama `armazensCompletos(state)`
  sem o lado.
- Contradiz o próprio plano da C7 ("fica aberta para sempre").
- **Não é defeito de jogo:** `pedraDisponivel` somando os dois lados. Hoje só os testes da
  F09 a leem.

### 3. C-IA-03b: `HireMercenary` passa em paz
Confirmado por sonda (`s1-paz`): com a prefeitura completa e 8 de ouro, em paz, sai
`unit-trained`.
- **Causa:** `sim/paz.ts:46-58` recusa só 4 ordens.
- O KaM citado (`KM_GameInputProcess.pas:153-155`) inclui `gicHouseTownHallEquip`.
- O comentário "a sim ainda não tem" é falso, porque a F36 existe. O PROGRESS registra
  "equipar no quartel e na prefeitura".

## Achados `feio`
- A bandeira do bando fica solta no capim quando o sprite é menor que o lote (F25b-2, F28b-1).
- O inimigo só se distingue pelo rótulo, porque o sprite tem o lenço vermelho do jogador
  (C-IA-03c-2).
- Em paz, o botão direito e o treino no quartel não dão retorno: não há aviso `em-paz` na
  UI, e o botão do quartel fica habilitado.
- C2b: a flecha no ar quase não se lê sobre a pedra (C2-1).
- Da primeira rodada: F34-2 diz "Você perdeu … o quartel" para quem nunca teve quartel.

## Ressalvas e hipóteses
- **BUG-P muda features anteriores sem cobertura:**
  - depois do revide, a ordem de `AttackBuilding` se perde;
  - o `AttackUnit` troca de alvo e não retoma o original;
  - hipótese: o KaM mantém `goAttackHouse`.
- **C2a:** "pedras gastas = mortos" (F28b) pode ter deixado de valer, porque a pedra que chega a tile
  vazio não mata. Hipótese.
- **C9:** o laço pode rodar 1 ou 2 ticks depois do fim no mesmo quadro (`laco.ts:95`).
  Hipótese.
- **C3:** os recrutas soltos nascem empilhados. O commit toca `sim/` e `ui/`.
- **D-MOVIMENTO-01d:** a fixture da F20b-4 foi espalhada com a chave desligada, e o caso "nove
  na mesma porta" deixou de ser exercitado.
- **Fome assimétrica:** declarada no andaime L8.

## Por feature
- **Fila C** (todos entregáveis, merecem chave):
  - PASS: C1, C2a (com ressalva), C2b, C3 (com ressalva), C4, C6, C8, C9 e C10 (só pelo
    teste);
  - NEEDS_WORK: C5 (achado 1) e C7 (achado 2).
- **D-MOVIMENTO-01** (01a, 01c, 01d, 01g, 01h, 01j, e os docs 01b e 01i): PASS. Com
  `ligada: false`, os sistemas retornam cedo (`colisao.ts:275/358/412`),
  `custoDeUnidadesNaRota` é `undefined` e o `reclamarMelhor` escolhe a mesma tarefa.
- **C-COMIDA-01a a 01f e C-IA-01:** PASS. Nas sondas, 18 cabras comem até o tick 401, e o
  save com a comida em curso é idêntico.
- **C-IA-03a:** PASS.
- **C-IA-03b:** NEEDS_WORK (achado 3).
- **C-IA-03c:** PASS. Rubrica: perspectiva 4, estilo 4, legibilidade 3, retorno 3,
  acabamento 3. Determinismo: duas corridas de 4000 ticks idênticas.
- **BUG-O:** PASS.
- **BUG-P:** PASS no que conserta, com a ressalva acima.
- **c5cd419** (remoção de `ticksRestauradosPorComida.militar`): PASS.
