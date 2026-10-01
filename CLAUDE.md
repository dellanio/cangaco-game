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
7. Commit com a mensagem `feat(<sigla>): <resumo>`. A sigla segue `docs/siglas.md`. Item
   **novo** (desde 2026-09-30): `<FASE>-<MÓDULO>-<NOME-CURTO>`, como
   `feat(D-TELA-LUZ-RELEVO): ...`. Os itens com número (`D-MOVIMENTO-01e`) mantêm o id que têm.
   Módulo só da lista fechada de 11; módulo novo só por decisão do operador. O que fechou antes
   de 2026-09-28 mantém a sigla antiga (`F17g`, `C5`), e a tabela de equivalência está no
   mesmo arquivo.
8. **Sigla nunca aparece sozinha em relatório** (PROGRESS, avaliação, resposta ao
   operador): vem sempre com o nome ao lado, seja antiga ou nova. Exemplo: "F20b (fome e
   morte)".
9. **Id de item novo descreve o conteúdo** (regra do operador, 2026-09-30; substitui a regra
   de reserva do mesmo dia). Formato `<FASE>-<ÁREA>-<NOME-CURTO-DO-CONTEÚDO>`, em maiúsculas
   com hífen, sem número sequencial: `D-TELA-LUZ-RELEVO`, `D-TERRENO-ALTURA`. A área é um dos
   11 módulos. O nome diz o que o item faz, **nunca** o nome de branch ou worktree. Quem cria
   o item confere com `git grep` na `main` que o id não existe; não há commit de reserva. A
   ordem de execução continua sendo a ordem da lista no `BUILD_PLAN.md`. Vale para item novo,
   e item antigo não se renomeia. **Exceção única, por ordem do operador (2026-09-30):** os dois
   itens do relevo, D-TELA-08 → `D-TELA-LUZ-RELEVO` e D-TERRENO-01 → `D-TERRENO-ALTURA`. Motivo:
   três colisões de número (BUG-V, D-TELA-06, D-TELA-07).
10. **O aceite vai num commit próprio, antes do código** (regra do operador, 2026-09-30). O
    critério de aceite (novo ou mudado) entra no `BUILD_PLAN.md` ou no plano da feature num
    commit só dele, e só depois vem o commit do código. "Escrito antes do código" dentro do
    mesmo commit não se prova pelo git.

### Uma sessão só na `main` (regra do operador, 2026-09-25)

- **Nunca duas sessões na `main`.** Quem chegar segundo trabalha em branch, num
  worktree irmão (`git worktree add ../cangaco-game-<branch> <branch>`, com
  `node_modules` por junction), e mergeia **quando a outra terminar**.
- "Terminar" é `git status` limpo na `main`, com o commit da outra sessão feito.
  Arquivo modificado e não commitado é sessão em curso: **não commite, não
  reverta, não toque**. Se precisar da `main` limpa, espere ou trabalhe em branch.
- O erro que esta regra mata não é abrir a branch, é **voltar para a `main`
  depois**, com o diretório "parecendo" livre. Foi assim que a calibração da
  Fase B (2026-09-25) rodou `npm run verify` em cima de um número que outra
  sessão estava girando, e quase leu a falha como sua. Antes de qualquer commit
  na `main`: `git status`, e só arquivos seus na lista.

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
- Não-regressão é rodar os roteiros e conferir o código de saída. Abra
  screenshot com Read só da feature atual: imagem é o que mais pesa na
  janela de contexto.
- **Medida de relógio é evidência da sessão, nunca asserção** (decisão do operador,
  2026-09-24). Tempo de parede, `performance.now()` e razão entre dois tempos
  **não entram em `expect`**: eles vão para `test-output/<feature>.json` e ficam lá
  como número da corrida. Asserção permanente usa **eixo determinístico** — nó do A*
  expandido, contagem de alocação, número de tarefas, execução contra acerto de cache.
  O motivo é medido: a razão de tempo da F-T2b saiu 2,58 / 4,74 / 4,97 / 8,79 em
  corridas da mesma árvore, e isolada dá 0,32 — razão entre duas medidas de ~10 µs
  em máquina compartilhada **não tem patamar**, e teto que dobra a cada corrida não
  protege nada: ensina a afrouxar. No mesmo teste, o eixo de nós deu 1,054 nas quatro.
  **`timeout` de teste não é asserção de tempo** e continua valendo: ele existe para o
  caso travar, não para afirmar desempenho (`tests/F09-sistema.test.ts`, 20 s, é esse
  uso). Isto revoga a regra antiga do `BUGS.md` de "alargar o teto com o número
  medido"; alargar era o conserto enquanto a asserção existia.
- **Roteiro que exercita painel roda pelo menos um passo despausado.**
  `tools/shot.js` abre a página com `?pausado`, e `page.click()` aperta e solta
  no mesmo instante: nessa condição o laço nunca redesenha entre o `mousedown` e
  o `mouseup`. Uma classe inteira de defeito — redesenho que destrói o nó sob o
  dedo, foco perdido, evento que nunca chega — fica verde por construção, e foi
  assim que o BUG-B passou por todo roteiro existente. Se o roteiro clica em
  `#painel-predio`, `#menu-build`, `#alertas` ou `#hud`, pelo menos um passo
  despausa (`press('p')`), usa `mouse.down` / `waitForTimeout(150)` /
  `mouse.up` em vez de `page.click()`, e pausa de volta. O inventário de quem
  ainda não cumpre está em `PROGRESS.md` (2026-09-24).
---

## 9. Arte e assets

Toda criação ou alteração de arte raster deste repositório usa a skill local
`skills/pianco-art-pipeline/SKILL.md`. Ela fixa perspectiva, proporções,
prompts, derivação e portões visuais para que agentes diferentes produzam o
mesmo jogo, não estilos paralelos.

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
- **Base e derivado entram no git.** A base fica em `assets/base/<id-neutro>/` e o
  derivado que o jogo carrega em `assets/sprites/<id-neutro>/`; `*.png` é ignorado,
  com negação para `assets/**/*.png`. O jogo carrega **só** `assets/sprites/`: a base
  é registro de geração e não entra no bundle.
- **Arquivo de asset não se abre com Read em sessão de código.** Imagem só entra no
  contexto quando é evidência da feature atual, como a §8 já manda para screenshot.
  Para conferir dimensão, leia o cabeçalho do arquivo; não abra o PNG.

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
npm run test:longo      # a suite longa: os arquivos *.longo.test.ts, normal e transladada; grava o selo
npm run selo:longo      # confere o selo da suite longa: sai 1 se o commit dele nao e o HEAD
npm run typecheck
npm run lint
npm run validate:data   # valida data/*.json contra o schema
npm run shot -- <nome>  # Playwright: roteiro + screenshot
                        # NA NUVEM (claude.ai/code), sempre com as duas variaveis:
                        #   CANGACO_SHOT_NUVEM=1 CANGACO_CHROMIUM=/opt/pw-browsers/chromium npm run shot -- <nome>
                        # Sem a primeira, a fonte do Google falha por certificado do proxy e o
                        # favicon da 404: erro de console reprova todo roteiro antes de comecar.
                        # Sem a segunda, o Chromium pinado do Playwright nao existe no container.
                        # Nao rode `playwright install`. (Registrado em 2026-09-29.)
npm run sim -- <cenário> --ticks 600   # roda a sim sem tela e imprime o estado
```

Comandos de sessão: `/codex <tarefa>` delega trabalho mecânico ao Codex ·
`/bug <relato>` registra um bug sem corrigir.

**A suíte longa (decisões do operador, 2026-09-30 e 2026-10-01).** Teste de sim longa mora num
arquivo `*.longo.test.ts`, sai do `verify` e roda em `npm run test:longo`. O filtro é pelo **nome do
arquivo** (`exclude` do `verify`, `include` da suíte longa; `tests/helpers/suite-longa.ts`), e não
pelo título. `tests/LONGO-lista.test.ts` confere a lista dos longos.
**Nenhuma leva fecha sem `npm run test:longo` verde, rodado sozinho na máquina, antes do
avaliador.** "Sozinho" quer dizer sem outra suíte, roteiro ou sessão rodando teste ao mesmo tempo.
O teste longo continua inteiro e afirma o mesmo; só muda em qual suíte ele roda.
Mover teste para a suíte longa é decisão do operador, como foi a dos cinco primeiros.

**A trava de testes entre worktrees (regra do operador, 2026-10-01).** Só uma sessão roda teste
de cada vez na máquina, em qualquer worktree. Antes de rodar vitest, `verify` ou roteiro, a sessão
confere o arquivo de trava comum, `%LOCALAPPDATA%\Temp\cangaco-testes.lock` (fora das worktrees;
`CANGACO_TRAVA` troca o caminho). Se ele existe, espera. Se não, cria com a branch, o horário e o
comando, roda e apaga ao terminar, inclusive em falha. Trava com mais de 90 minutos é abandonada e
pode ser tomada.
- Quem faz isso é `tools/trava-de-testes.js`, e os scripts `test`, `test:transladado`,
  `test:longo`, `verify` e `shot` já passam por ele.
- **Teste avulso também passa pela trava:** `node tools/trava-de-testes.js npx vitest run <arquivo>`.
  `npx vitest` direto não confere a trava.
- O caminho não é o `%TEMP%` da sessão: nas sessões do Claude ele aponta para um scratchpad
  diferente em cada sessão, e a trava não seria comum.
- É reentrante: quem segura a trava passa `CANGACO_TRAVA_DONO` aos filhos. O `verify`, que chama
  `npm run test`, não espera por si mesmo.
- Processo encerrado à força não apaga a trava. É para isso que existe o limite de 90 minutos.
- **Sinal de vida (decisão do operador, 2026-10-01; substitui os 90 minutos).** Quem segura a
  trava atualiza o horário dela a cada 60 s (`vivoEm`). Trava sem atualização há mais de 10 min é
  abandonada, e a próxima sessão a toma. **Aceite:** (1) a regra pura, por tabela: atualizada há
  9 min vale, há mais de 10 não vale, trava sem `vivoEm` conta pelo `inicio`; (2) um comando que
  dura mais que o sinal (ex.: 2 sinais) tem o `vivoEm` avançando enquanto roda; (3) **processo
  morto sem soltar → liberada em 10 min**: um processo que pega a trava e é encerrado à força deixa
  o arquivo, e uma segunda sessão o toma quando ele passa de 10 min sem atualização, e não antes.
  O teste usa o relógio injetado; o 2 e o 3 rodam com os tempos reduzidos por variável de
  ambiente, e a proporção 60 s : 10 min fica afirmada no dado do script.
- Uma worktree só respeita a trava depois de ter este script, ou seja, depois do rebase sobre a
  `main` que o trouxe.

**O selo da leva (decisão do operador, 2026-10-01).** `npm run test:longo` grava em
`test-output/test-longo.json` o commit testado (`git rev-parse HEAD`), se a árvore estava limpa, se
havia outro teste rodando na máquina (medido no início e no fim) e o resultado. **O avaliador roda
`npm run selo:longo` antes de qualquer outra coisa e se recusa a começar se ele sair diferente de
0**: commit do selo diferente do `HEAD`, suíte vermelha, árvore suja (na corrida ou agora) ou outro
teste rodando. Por isso a `test:longo` é a **última** coisa antes do avaliador: qualquer commit
depois dela, inclusive de PROGRESS, invalida o selo e pede uma nova corrida. O registro da corrida
no PROGRESS entra no commit seguinte à avaliação, com o hash que o selo mostrou.

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

---

## 15. Referência do KaM Remake (registrado em 2026-09-30)

- Clone local: `D:\projetos-pessoal\kam_remake`, no commit
  `731a8a47a4a02fac3d20326fdfed0fba7d1f845b` (`731a8a4`).
- Repositório ativo: `github.com/reyandme/kam_remake`. O `Kromster80/kam_remake`, que é o
  remote configurado no clone, está congelado desde 2022.
- **Toda citação do KaM cita `arquivo:linha` deste commit**, com o caminho a partir da raiz do
  clone (`src/houses/KM_Houses.pas:904`, não `KM_Houses.pas:904`): o clone tem três
  `KM_Houses.pas` e dois `KM_Units.pas` (cópias em `Utils/PathFinder` e `Utils/RVO2`). Citação
  sem arquivo:linha, ou de outro commit, é hipótese até ser conferida aqui.
- **Nunca faça `pull`, `fetch`, `checkout` nem nenhuma escrita nesse clone.** Ele é só
  leitura; mover o commit invalida todas as citações já escritas.
