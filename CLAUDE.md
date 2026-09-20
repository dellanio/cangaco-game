# CLAUDE.md — cangaço

Leia este arquivo por inteiro antes de qualquer ação. Ele tem precedência sobre
qualquer inferência sua a partir do código existente.

---

## 1. O que é este projeto

Um RTS medieval isométrico que roda no browser, inspirado em *Knights and
Merchants* (1998). As mecânicas estão em `docs/GDD.md`. A fila de trabalho está
em `BUILD_PLAN.md`. O estado atual está em `PROGRESS.md`.

O jogador **não** controla civis diretamente. Ele posiciona plantas, estradas e
campos; a IA dos habitantes faz o resto. Só militares recebem ordem direta.
Se você se pegar implementando "selecionar aldeão e mandar construir", pare e
releia a seção 0 do GDD.

---

## 2. As três invariantes

Estas três regras existem para que o trabalho seja verificável sem um humano
olhando a tela. Quebrar qualquer uma delas invalida a sessão.

1. **A simulação é pura.** `src/sim/` não importa `phaser`, não toca em `window`,
   `document`, `canvas` ou `performance`. Roda em Node, num teste, sem tela.
2. **A simulação é determinística.** Passo de tempo fixo. Todo aleatório vem de
   um RNG semeado (`sim/rng.ts`). Mesmo estado inicial + mesma lista de comandos
   = mesmo estado final, byte a byte. Nunca use `Math.random()` nem `Date.now()`
   dentro de `sim/`.
3. **Os números vivem em dados, não em código.** Custo, tempo, capacidade,
   receita e proporção ficam em `data/*.json`. Se você precisou digitar um número
   mágico em um `.ts` de `sim/`, ele está no arquivo errado.

---

## 3. Arquitetura

```
src/
  sim/            núcleo determinístico. TypeScript puro. ZERO dependência de engine.
    state.ts        o GameState inteiro, serializável em JSON
    commands.ts     os comandos que o jogador pode emitir (união discriminada)
    tick.ts         step(state, commands) -> state. A única porta de entrada.
    systems/        um arquivo por sistema: build, haul, produce, eat, combat
    jobs.ts         JobBoard: criação, claim, release, reserva
    units/          FSMs por tipo de unidade
    rng.ts          RNG semeado (mulberry32 ou xorshift)
  render/         Phaser. Lê o estado, desenha. Não decide nada.
    scenes/
    grid.ts         conversão grid <-> tela, depth sorting
  ui/             HUD, menus, painéis. Emite comandos, não muta estado.
  input/          mouse/teclado -> commands.ts
data/             buildings.json, units.json, recipes.json, costs.json
assets/           sprites, atlas, manifest.json
tests/            testes headless da sim
tools/            scripts de harness, captura de screenshot, validação de dados
```

**O fluxo é sempre:** input → comando → `sim.step()` → novo estado → render lê.
Nunca o inverso. Render e UI jamais escrevem em `GameState`.

---

## 4. Stack

- TypeScript estrito (`strict: true`, sem `any` em `sim/`).
- Vite para build e dev server.
- Phaser 3 **apenas** em `src/render/`. A projeção é **top-down 3/4 sobre grid
  ortogonal**, como no jogo original: use o tilemap ortogonal da API de Tilemap.
  Não instale plugins isométricos e não use tiles em losango. A arte é desenhada
  em ângulo; o grid por baixo é quadrado.
- Vitest para testes.
- Playwright para screenshot e verificação visual.
- Sem framework de UI pesado. HTML/CSS sobre o canvas resolve o HUD.

Não adicione dependência nova sem registrar o motivo em `PROGRESS.md`.

---

## 5. Regras de simulação

- Tick fixo de **10 Hz** (`TICK_MS = 100`). Render interpola entre ticks; a sim
  nunca usa delta variável.
- Toda duração é medida em ticks, nunca em milissegundos, dentro de `sim/`.
- **Escala de tempo.** Durações e taxas ficam em `data/*.json` em segundos ou por
  minuto, na escala 1.0, e cada uma declara a qual grupo pertence: `economia`,
  `movimento`, `construcao` ou `combate`. Os multiplicadores estão em
  `data/time.json`. A conversão para ticks acontece **uma vez, no
  carregamento**, com `Math.round`, produzindo inteiros. Converter em tempo de
  execução quebra o determinismo. Nenhum sistema lê `escalas` diretamente.
- **Velocidade de jogo** (1x, 2x, 3x escolhido pelo jogador) é coisa do render e
  do laço externo. Ela acelera o relógio, nunca entra na simulação e nunca
  altera balanceamento. Não confundir com escala de tempo.
- `GameState` é serializável: nada de função, classe com método, `Map` com chave
  objeto, ou referência circular. Isso é o que permite salvar, comparar e testar.
- Toda mudança de estado acontece dentro de `step()`. Se um sistema precisa de
  efeito colateral (som, partícula), ele emite um **evento** na lista
  `state.events`, e o render consome. Sim não chama render.

### IA dos habitantes

- Cada unidade é uma FSM com estado explícito em `unit.fsm` (string) e
  `unit.fsmData` (objeto serializável). Sem `setTimeout`, sem promise, sem async.
- Nenhuma unidade escolhe tarefa sozinha varrendo o mundo. Toda tarefa passa pelo
  **JobBoard**:
  - uma tarefa é criada com origem, destino e recurso;
  - a unidade faz `claim(jobId)`, que é atômico dentro do tick;
  - o `claim` **reserva** a unidade de recurso na origem e a vaga no destino;
  - `release` devolve as reservas em caso de falha (caminho bloqueado, prédio
    demolido, unidade morta).
- Toda tarefa reclamada precisa ter caminho de volta: se `release` não for
  chamado em algum ramo de erro, é bug, não detalhe.

---

## 6. Fluxo de uma sessão

1. Leia `PROGRESS.md` do topo. Ele é a sua memória; nada fora dele sobrevive.
2. Leia `NEXT_FINDINGS.md` se existir — são as reprovações da sessão anterior e
   têm prioridade sobre a fila.
3. Leia `STEER.md` se existir, e `BUGS.md`: bug de severidade `trava` tem
   precedência sobre a fila.
4. Pegue **uma** feature de `BUILD_PLAN.md` — a primeira com `passes: false` em
   `test-results.json`. Uma por sessão. Não adiante a próxima.
5. Implemente, escreva o teste, rode, capture a evidência.
6. Atualize `PROGRESS.md`: o que fez, o que decidiu e por quê, o que ficou aberto.
7. Commit com a mensagem `feat(F##): <resumo>`.

Se a feature se revelar maior do que uma sessão, **não improvise**: quebre em
sub-itens dentro de `BUILD_PLAN.md`, registre em `PROGRESS.md` e entregue o
primeiro. Feature pela metade sem registro é o pior resultado possível.

No PROGRESS.md, separe o que foi verificado do que foi concluído. Um
achado que você não confirmou abrindo o arquivo ou rodando o comando
entra como hipótese, nomeada como tal — nunca como fato. Sessões
futuras leem esse arquivo como verdade e não têm como distinguir.

---

## 7. Definition of Done

Uma feature só pode ser marcada `"passes": true` em `test-results.json` quando
**todas** as condições abaixo valem:

- [ ] `npm run test` verde, incluindo o teste novo específico da feature.
- [ ] `npm run typecheck` e `npm run lint` sem erro.
- [ ] O critério de aceite escrito em `BUILD_PLAN.md` foi verificado com
      evidência aberta pela ferramenta Read: log de resultado, JSON de estado ou
      screenshot em `screenshots/`.
- [ ] `npm run validate:data` passa (dados batem com o schema).
- [ ] Nenhum import de `phaser` em `src/sim/`.
- [ ] Commit feito.

"Compilou" não é pronto. "O teste unitário passou mas a tela está preta" não é
pronto. Se você não abriu a evidência, você não sabe, e o hook vai recusar a
escrita.

---

## 8. Evidência

- Teste headless da sim: `npm run test` grava o resultado em
  `test-output/<feature>.json`.
- Verificação visual: `npm run shot -- <cenário>` sobe o dev server, roda o
  roteiro do Playwright e salva em `screenshots/<feature>-<n>.png`.
- Para qualquer feature que muda o que aparece na tela, screenshot é
  obrigatório. Não descreva o que você acha que apareceu.
- Prova por arquivo temporário (probe) demonstra que a regra funciona no
  momento, não que continua funcionando. Ela vale como evidência da
  sessão; a proteção permanente é a regra automatizada que roda no
  `npm run verify`. Registre as duas como coisas distintas, e nunca cite
  o probe como se fosse cobertura contínua.
---

## 9. Arte e assets

- Nenhum asset do jogo original de 1998 entra aqui, em nenhuma forma: nem sprite,
  nem som, nem mapa, nem texto, nem como referência de transferência de estilo.
  Mecânica e estilo, sim. Cópia, não.
- **Camada temática.** Os ids da simulação são neutros e em inglês (`quarry`,
  `serf`, `loaves`). Os nomes que o jogador vê vêm de `data/theme-sertao.json`.
  `sim/` **nunca** lê o arquivo de tema: ele alimenta só a tela e o pipeline de
  arte. Nenhuma regra pode depender do tema.
- **Imagem base versionada.** Nenhum asset novo nasce de prompt solto. Cada
  personagem e cada prédio tem um PNG canônico em `assets/base/`, e toda geração
  futura deriva dele — por referência de estilo, rotação ou inpainting. Guarde
  junto o id ou a semente que a ferramenta devolveu. Sem isso não há como voltar
  e ajustar um frame sem refazer o conjunto inteiro.
- Todo asset tem entrada em `assets/manifest.json` com: `id`, `tipo`,
  `footprint` em tiles, `tamanho` em px, `anchor`, `estados`, `licença` e
  `origem` (id da base ou semente que o gerou).
- **Placeholder é comportamento normal, não é falha.** Se o PNG não existe, o
  render desenha um retângulo com o `id` escrito. O jogo nunca quebra por asset
  faltando, e você nunca fica bloqueado esperando arte.
- Não gere nem baixe arte por iniciativa própria. Arte entra por decisão humana.

---

## 10. Anti-padrões (recusar, mesmo se parecer mais rápido)

- Lógica de jogo dentro de `Scene.update()` ou de um `Sprite`.
- Sprite ou objeto do Phaser guardando estado de jogo.
- `Math.random()` ou `Date.now()` em `sim/`.
- Número de balanceamento hardcoded em `.ts`.
- Unidade varrendo o mapa para escolher tarefa sem passar pelo JobBoard.
- Prédio que nasce sem comando do jogador. A cidade não se expande sozinha.
- Refatoração ampla não pedida. Se você acha que precisa, escreva em
  `PROGRESS.md` e pare.
- Tocar em `src/render/` e `src/sim/` na mesma feature, salvo quando o
  `BUILD_PLAN.md` disser explicitamente que a feature é de integração.
- `git push --force`, reescrever histórico, mexer em `.claude/`.
- - Desativar, ignorar ou excluir código da verificação para fazer o `npm run verify` passar. Configure a regra para o caso legítimo, ou pare e reporte. Ampliar `ignores`, usar `skip` em teste ou `eslint-disable` é mudança de escopo, não correção.

---

## 11. Superpowers, Codex e política de crédito

**Superpowers** (se instalado) cuida da disciplina **dentro** de uma feature:
plano de implementação, TDD red-green-refactor, revisão. A fronteira é rígida:

> `BUILD_PLAN.md` é o backlog e a ordem. O Superpowers **não** decide o que
> construir, **não** reordena a fila e **não** reescreve critério de aceite.
> O `writing-plans` produz o plano de implementação de uma feature já
> escolhida; o critério vem do BUILD_PLAN, intocado.

Não use `subagent-driven-development` nem `dispatching-parallel-agents` — são os
componentes mais caros em token e o orçamento aqui é semanal.

**Codex** recebe só trabalho mecânico já especificado, pelo comando `/codex`.
A tabela de roteamento está lá. O resumo: `sim/` nunca sai daqui.

**Crédito é finito.** Sessões curtas, uma feature por vez, disparadas pelo
operador. Nada de loop desatendido rodando por horas. Em feature grande, use
plan mode antes de escrever código — revisar plano é muito mais barato que
desfazer implementação. Nunca faça leitura ampla do projeto: delegue a um
subagente, que gasta contexto próprio e devolve só o resumo.

## 12. Bugs, balanceamento e ideias

Três destinos, e eles não se misturam:

| O que é | Arquivo | Efeito |
|---|---|---|
| Quebra um critério de aceite escrito | `BUGS.md` | severidade `trava` interrompe a fila; `errado` vira a chave para `false` |
| Número parece errado (lento, caro, fácil) | `BALANCE_LOG.md` | acumula; ajusta em lote, nunca um de cada vez |
| Ideia nova ou mudança de design | `IDEIAS.md` | congelado até `F17-aceite-fase-a` passar |

`/bug` registra sem corrigir. Bug corrigido **sai do `BUGS.md` no mesmo commit
que o corrige** — o histórico do git é o arquivo morto, e o arquivo fica curto.

Balanceamento nunca se corrige item a item: ajustar o milho quebra o pão,
ajustar o pão quebra a fome. Junte as observações, mude os números juntos, rode
o cenário longo uma vez.

## 13. Comandos

```bash
npm run dev             # Vite dev server
npm run verify          # typecheck + lint + validate:data + test; cria .verify-ok
npm run test            # Vitest, headless, sem browser
npm run typecheck
npm run lint
npm run validate:data   # valida data/*.json contra o schema
npm run shot -- <nome>  # Playwright: roteiro + screenshot
npm run sim -- <cenário> --ticks 600   # roda a sim sem tela e imprime o estado
```

Comandos de sessão: `/codex <tarefa>` delega trabalho mecânico ao Codex ·
`/bug <relato>` registra um bug sem corrigir.

**O portão:** `test-results.json` só aceita escrita depois de `npm run verify`
passar, e o selo vale 15 minutos. Isso é hook, não pedido educado — o agente não
consegue marcar feature como pronta sem ter verificado.

---

## 14. Controles do operador

- `AGENT_STOP` na raiz: pare imediatamente, sem terminar o que está fazendo.
- `STEER.md`: leia, aplique, apague o arquivo.
- Dúvida de escopo ou de regra de jogo que o GDD não responde: **não invente**.
  Escreva a pergunta em `PROGRESS.md` sob `## Perguntas em aberto`, implemente a
  interpretação mais conservadora e siga.
