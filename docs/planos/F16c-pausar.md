# F16c — Pausar produção (sim)

Plano de implementação. Feature escolhida pelo operador; o critério de aceite vem
do `BUILD_PLAN.md` e **não é reescrito aqui** — o §4 deste plano *propõe* uma
emenda e para, porque a segunda cláusula do aceite não é satisfazível hoje sem
andaime.

Ordem do corte da F16 (item F16a do `BUILD_PLAN.md`, decisão do operador de
2026-09-23): **F16a (feita) → F16c (esta) → F16b (painel, integração)**. A F16c
**não toca** `render/`, `ui/` nem `input/` e **não leva nota de integração** —
aquela exceção do §10 está escrita só no item F16b e não se herda.

**Pausar prédio não é pausar o jogo.** A tecla `P` (F11a, `src/laco.ts:42-104`)
para o relógio do laço externo, fora da sim. Esta feature é um campo por prédio
dentro da sim. Por isso o comando se chama `SetBuildingPaused`, e não `Pause`.

## 1. Escopo

**Entra:**
- `PredioCompleto.pausado: boolean`, sempre presente, nunca `undefined`.
- `SetBuildingPaused { predio, pausado }` na união `Command`, tratado em `step()`.
- **Um** leitor, no ciclo de produção (`systems/especialistas.ts`).
- O teste do aceite, a evidência e as notas de contrato que a F16b e a F22 herdam.

**Não entra (declarado, com destino):**
- Os `modos` do Woodcutter's — **andaime hoje**, §4. Registro em `IDEIAS.md`,
  nota no item e nota no próprio dado; nenhuma linha de código.
- Botão, painel, atalho — F16b.
- Pausar **obra** (parar de martelar): não está escrito em lugar nenhum do GDD
  nem da fila. O comando recusa obra, que é a leitura conservadora do §14.
- Ligar/desligar reparo (GDD §2.3, mesma linha `[geral]`): não há HP em queda no
  jogo ainda; não há o que pausar.

## 2. Os fatos que o desenho usa (verificados nesta sessão, com caminho)

1. **O ciclo de produção tem uma porta só.** `produzir`
   (`src/sim/systems/especialistas.ts:170-196`) é quem avança `progresso`,
   consome insumo e deposita; ninguém mais escreve em `producao` ou na gaveta
   `saida` de um produtor. Um `return` no topo dele para o prédio inteiro.
2. **Quem avança o ciclo é o OCUPANTE.** Prédio sem ocupante não produz (F14), e
   "um prédio, um ocupante" torna avanço duplo irrepresentável
   (`especialistas.ts:161-169`). Então "congelar o relógio" e "o ocupante não
   trabalha" são a mesma frase, não duas regras.
3. **O rótulo da FSM é recalculado do prédio a cada tick** (`comFsm`,
   `especialistas.ts:120-124`), e os três rótulos de produção são os do GDD §6.2
   (`tests/helpers/especialista-invariantes.ts:19`). Não existe rótulo gravado
   que discorde do prédio — e é por isso que a pausa **não** vira rótulo.
4. **O destino de uma tarefa de insumo é validado pelo TIPO do prédio**, não pelo
   estado dele: `motivoDoDestino` pergunta `insumosDoPredio(...).includes(...)`
   (`src/sim/systems/jobs.ts:76-78`, `src/sim/insumo.ts:130-139`). Pausar não
   muda o tipo, então **nenhuma tarefa em voo fica órfã** e `sanearTarefas` não
   precisa de ramo novo.
5. **A demanda de insumo é auto-limitada.** `demandaDeInsumo = alvo - estoque`
   (`insumo.ts:82-92`), e o alvo é a gaveta repartida pela receita: enche e para
   sozinha. O espelho disso é `excedenteNaEntrada` (`insumo.ts:97-107`) — se o
   alvo virasse 0, a gaveta inteira viraria excedente e voltaria ao armazém pelo
   nível 7. Esse vaivém é exatamente o que `alvoDeEntrada` existe para impedir
   (`insumo.ts:68-77`).
6. **O escoamento da gaveta `saida` não olha o produtor.** `gerarTarefasParaArmazem`
   (`systems/jobs.ts:341-365`) dispara com `estoque > 0` em qualquer prédio
   completo que não seja armazém. Pausa nenhuma o afeta sem eu escrever um ramo.
7. **O campo novo é obrigatório em 12 literais**, 7 arquivos:
   `src/sim/state.ts:710,:742` (conclusão de obra e nascimento) e
   `tests/F05b-hud-armazens.test.ts`, `F06-build.test.ts`, `F08-estradas.test.ts`,
   `F09-sistema.test.ts`, `F10-ciclo.test.ts`, `F11c-laborer.test.ts`,
   `tests/helpers/jobs-cenario.ts`. O `typecheck` é quem acusa; não há como
   esquecer um.
8. **`modos` está no dado e não é lido por ninguém.**
   `data/production.json:6` declara `"modos": ["cortar","replantar","ambos"]`;
   `grep` por `modos` em `src/sim/data/` e `tools/` não devolve nada, e
   `ReceitaDePredio` (`src/sim/data/types.ts:48-62`) não tem o campo. O carregador
   simplesmente o ignora.
9. **Não existe árvore no mapa, nem camada de terreno.** `data/terrain.json` tem
   custo de movimento, `intransponivel` como lista de nomes e o tamanho do mapa —
   nenhum tile de terreno. É por isso que o veio mora no prédio (`BUILD_PLAN.md`,
   nota F15a/D2 no item F21, linhas 659-668).
10. **A sim de hoje já modela "o lenhador replanta sempre"**: `woodcutters` não
    declara `veio`, e campo ausente = renovável (`src/sim/data/loader.ts:149-157`).
    O `PROGRESS.md` (F15a, D7, linhas 718-721) registra isso com estas palavras.
11. **Precedente de recusa com motivo próprio**: `MotivoDeRecusaDeTreino`
    (`src/sim/escola.ts:17-23`) e a variante `command-rejected` dela
    (`src/sim/state.ts:44-54`). Precedente de comando que **nunca** recusa:
    `DemolishRoad` e `CancelTraining`. Uso o primeiro, §5 Tarefa 2.

## 3. Ponto 1 do operador — a semântica de "pausado"

> **Decisão: pausar congela o relógio de produção daquele prédio, e nada mais.**

Um campo, um leitor, um `return`. As três sub-perguntas, respondidas:

**(a) O que já está na gaveta `saida`: continua escoando, normalmente.** O nível 6
não muda (fato 6): o serf vem, leva e o armazém recebe, com o prédio pausado. O
que já foi produzido é do jogador. Congelar a gaveta criaria mercadoria presa que
**nenhuma regra libera** enquanto o jogador não voltar — o padrão que este projeto
já classificou como travamento de regra, não como balanceamento.

**(b) As tarefas de transporte já criadas: nenhuma é cancelada, e o gerador
continua criando até o alvo de sempre.** Duas razões, nesta ordem: o destino
continua válido porque a validação é por tipo (fato 4), então não há tarefa órfã
nem ramo novo em `sanearTarefas`; e se a pausa zerasse o alvo, o estoque da
`entrada` viraria excedente e voltaria ao armazém pelo nível 7 (fato 5) — pausar
e despausar mandaria a mesma mercadoria de ida e de volta. A demanda para sozinha
quando a gaveta enche: é limitada, não infinita. O serf a caminho **entrega**, em
vez de dar meia-volta com a carga.

**(c) O ocupante: fica onde está, com o rótulo `trabalhando`.** Sem `ocupante:
null`, sem vaga reaberta, sem tarefa `ocupar` nova. Soltar o ocupante faria uma
pausa de dez ticks custar ao jogador a viagem inteira de um especialista de volta,
e o prédio pausado e vago passaria a **anunciar vaga** — puxando alguém para
sentar parado. "Pausado" não vira estado de FSM: ele é composto de
`predio.pausado === true` mais o ocupante, uma fonte de verdade só, no prédio,
como a posse (fato 3). É isso que a F16b mostra e o que a F22 consulta para **não**
alertar.

**O ciclo em curso.** `progresso` congela e não zera; o insumo já consumido no
início do ciclo continua consumido (não há devolução parcial — seria estado novo);
um ciclo PRONTO esperando gaveta não deposita enquanto pausado, e deposita no
primeiro tick depois de despausar. O aceite pede "sem perder nem duplicar
mercadoria": o insumo sai uma vez, o depósito acontece uma vez.

**Por que a pausa é a primeira pergunta de `produzir`**, antes da receita e antes
de `predioLigadoAoArmazem`: é o fato mais específico sobre o prédio e é ação
deliberada do jogador. Um prédio pausado e sem estrada mostra `trabalhando`, não
`saida_cheia` — e o alerta de "sem estrada" da F22 lê o predicado, não o rótulo
(nota já escrita no item F22).

Interpretações **rejeitadas**, com a razão de cada uma:

| Alternativa | Por que não |
|---|---|
| Pausa solta o ocupante | Churn caro e assimétrico: despausar não devolve ninguém. E o prédio vago volta a anunciar vaga. |
| Pausa zera o alvo de `entrada` | Vaivém de mercadoria entre prédio e armazém a cada pausa (fato 5). |
| Pausa congela a gaveta `saida` | Mercadoria presa que nada libera. |
| Pausa cancela as tarefas em voo | Joga fora viagem já feita e exige ramo novo no saneamento, para nada. |
| Estado de FSM `pausado` | Estado novo, e o rótulo passaria a ter duas fontes de verdade. |

**Consequência a observar (não medida hoje):** um prédio pausado continua
segurando o insumo que tem na `entrada`, e ele pode faltar para um gêmeo não
pausado. Não é travamento (a demanda do gêmeo continua no quadro, e o jogador
despausa ou demole), é balanceamento. Se aparecer na F17, vai para o
`BALANCE_LOG.md` com número medido; não invento o número agora.

## 4. Ponto 2 do operador — os modos do Woodcutter's

**O que dá para implementar de verdade hoje: nada com efeito observável.** Os
fatos 8, 9 e 10 fecham a conta. Traduzindo os três valores para o jogo que existe:

| Modo | O que precisaria existir | O que daria hoje |
|---|---|---|
| `ambos` | — | exatamente o comportamento atual |
| `cortar` (só cortar) | estoque finito de árvores no terreno, consumido pela derrubada | só existe `veio`, no prédio; pôr um rendimento no lenhador é inventar número de balanceamento **e** um proxy de terreno — território da camada de terreno, não desta feature |
| `replantar` (só replantar) | árvore para replantar | "não produz nada": é `pausar` com outro nome |

Ou seja: campo em `PredioCompleto`, comando e leitor dariam ao jogador uma escolha
que **não muda nada**, exceto um valor que duplica o botão ao lado. Isso é
andaime. **Não implemento**, conforme a instrução do operador, e registro em três
lugares: `IDEIAS.md` (§12: mudança de design, congelada até a F17), nota no item
F16c do `BUILD_PLAN.md` com a pré-condição escrita, e uma `notas` no próprio
`data/production.json`, ao lado do campo órfão, para que a próxima sessão não
tente ler `modos` achando que alguém esqueceu de ligar.

**Consequência para o aceite, e aqui eu paro.** A segunda cláusula do aceite da
F16c — *"teste que troca o modo do Woodcutter's e confirma que o comportamento do
lenhador acompanha"* — **não é satisfazível honestamente hoje**: para o teste
passar eu teria que fabricar o comportamento que o modo governaria. Proponho ao
operador emendar o item: a F16c entrega `pausar`, e os modos saem do aceite e
viram nota com pré-condição (camada de terreno com árvore, que hoje não tem dono
na fila). **Não reescrevo critério de aceite por conta própria** — a emenda fica
no §7, aguardando ele.

A chave `F16c-pausar-e-modos` em `test-results.json` eu **mantenho** como está:
renomear mexe no arquivo do portão sem ganho nenhum, e a nota do item é quem diz
o que ficou de fora.

## 5. As tarefas, em ordem

TDD em cada uma: teste que reprova primeiro, implementação depois.

### Tarefa 1 — o campo, sem leitor

- `PredioCompleto.pausado: boolean` (`state.ts:205-230`), docstring no molde do
  `ocupante`: sempre presente, nunca `undefined`, porque é isso que mantém o
  estado comparável byte a byte depois de um save/load (F23).
- Nasce `false` em `completarObra` (`:710`) e em `criarPredios` (`:742`).
- Os 12 literais do fato 7 passam a declarar `pausado: false`.
- Teste: todo prédio do estado inicial nasce `pausado: false`, e
  `compararComESemSave` (`tests/helpers/determinism.ts:30`) continua verde com o
  campo — prova que ele sobrevive ao JSON.

### Tarefa 2 — o comando

- `SetBuildingPaused { type, predio, pausado: boolean }` em `commands.ts`.
  **Valor explícito, não toggle**: comando reenviado ou duplicado no mesmo tick
  não pode inverter o estado, e a F16b manda o valor que o botão representa.
- `aplicarSetBuildingPaused` em **`src/sim/systems/pausa.ts`** (arquivo novo,
  molde de `systems/demolicao.ts`), despachado no `switch` de `tick.ts:35-84`.
  Escreve com `comPredio` (`src/sim/units/movimento.ts:38`).
- **Recusa** com `command-rejected` e `MotivoDeRecusaDePausa =
  'predio-inexistente' | 'predio-em-obra'` (molde de `MotivoDeRecusaDeTreino`,
  fato 11). Obra não tem o campo, e pausar obra é feature que ninguém escreveu.
- **Idempotente**: mesmo valor devolve o MESMO estado, sem evento (molde de
  `sanearOcupacao`, `especialistas.ts:58-68`).
- Evento `building-paused { predio, pausado }`, só na mudança: é o gancho de som e
  de tela da F16b, e o §5 do CLAUDE.md manda efeito colateral sair por evento.
- Testes: recusa por id inexistente e por obra (estado inalterado, motivo certo);
  pausar muda o campo e emite um evento; repetir o mesmo valor não emite nada e
  devolve estado idêntico; demolir prédio pausado continua igual à F16a.

### Tarefa 3 — o leitor, e o aceite

Uma linha no topo de `produzir` (`especialistas.ts:170`), com o comentário da
razão. Cenários montados com `tests/helpers/producao-cenario.ts`
(`cenarioDePedreira`, `cenarioDeSerraria`, `progressoDe`, `saidaDe`, `entradaDe`,
`fsmDe`, `comSaida`), em `tests/F16c-pausar.test.ts`:

1. **Pedreira pausada no meio do ciclo**: `progresso` congelado por 200 ticks,
   zero `goods-produced`, `ocupante` intacto, `fsm === 'trabalhando'`. Despausa:
   o ciclo termina, deposita **uma** unidade e `progresso` volta a 0. O total de
   pedra no mapa antes e depois bate — nem perda nem duplicação.
2. **Ciclo PRONTO esperando gaveta, e então a pausa**: nada deposita; despausa
   deposita uma vez só.
3. **Serraria pausada com insumo já consumido**: despausar termina o ciclo **sem
   consumir de novo** (conta a gaveta `entrada` dos dois lados).
4. **Escoamento durante a pausa** (responde (a)): pedreira pausada com pedra na
   `saida` e estrada até o armazém — o nível 6 leva tudo, a gaveta zera, o
   armazém sobe.
5. **Tarefa de insumo em voo para prédio pausado** (responde (b)): nenhuma
   `task-released`, o serf entrega, `entrada` sobe, nenhuma tarefa órfã.
6. **Ocupação** (responde (c)): o `ocupante` continua o mesmo id e **nenhuma**
   tarefa `ocupar` é criada para o prédio pausado.

Em todas as corridas, `violacoesDeInvariantes` (`jobs-invariantes.ts:75`) e
`violacoesDaFsmDoEspecialista` (`especialista-invariantes.ts:25`) conferidas **a
cada tick**, e o número de violações vai para a evidência — molde da F16a.

### Tarefa 4 — a sonda de mutação

Apagar o `if (predio.pausado)` e conferir **quais** casos reprovam; e a mutação
inversa (o leitor com o sinal trocado). Vale como prova **do momento**, registrada
como tal na evidência e no `PROGRESS.md`; quem protege daqui para frente são as
asserções da Tarefa 3. Se algum caso passar com a mutação, a asserção que faltava
entra antes de eu seguir.

### Tarefa 5 — dado, documentação e portão

- `data/production.json`: `notas` no `woodcutters` dizendo que `modos` não tem
  leitor e qual é a pré-condição. `npm run validate:data` segue verde (`notas` já
  existe em outros prédios). **Nenhuma regra nova** em `tools/data-rules.js`: não
  há número novo a validar nesta feature.
- `IDEIAS.md`: os modos, com o tamanho do que falta (camada de terreno).
- `BUILD_PLAN.md`: nota no item **F16c** (o que entrou, o que não entrou, a
  pré-condição); nota no item **F16b** (o botão liga em `SetBuildingPaused` com
  valor explícito, e o painel compõe "pausado" de `predio.pausado` — não há
  rótulo de FSM para ler); nota no item **F22** (o alerta de prédio parado tem de
  ler `predio.pausado` e **não** alertar em pausa deliberada).
- `PROGRESS.md`: decisões, verificado × hipótese, sondas como prova do momento.
- `test-output/F16c.json` via `gravarEvidencia`, aberto com a ferramenta Read.
- `npm run verify` verde, `test-results.json` dentro do selo, commit
  `feat(F16c): <resumo>`.

## 6. Definition of Done (CLAUDE.md §7)

- [ ] `npm run test` verde, com `tests/F16c-pausar.test.ts` dentro.
- [ ] `npm run typecheck` e `npm run lint` limpos.
- [ ] Aceite verificado com evidência **aberta**: `test-output/F16c.json`.
- [ ] `npm run validate:data` verde.
- [ ] Zero import de `phaser` em `src/sim/`.
- [ ] **Sem screenshot**, e isso está escrito no item: a F16c não muda um pixel; o
      botão é da F16b. Roteiros de não-regressão conferidos pelo **código de
      saída**, sem abrir imagem.
- [ ] Commit feito.

## 7. Para o operador (respondo e sigo, ou paro, como ele disser)

1. **Emenda do aceite da F16c** (§4): tirar a cláusula dos modos e trocá-la por
   nota com pré-condição. É critério de aceite — mudança dele, não minha.
2. **A semântica do §3**, se ele quiser vetar qualquer das três respostas. A que
   mais muda o desenho se for vetada é a (c): soltar o ocupante.
3. **O evento `building-paused`**: incluo por padrão como gancho da F16b. É a
   parte mais descartável do plano — a F16b consegue viver lendo o campo.
