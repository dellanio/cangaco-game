# Plano — fome do militar e comando Feed (desbloqueia a F28-IA, ponto 5)

> **Sigla nova (2026-09-28, `docs/siglas.md`): C-COMIDA-01 (fome militar, antes F-FEED).** Ela destrava C-IA-01 (IA alimentar tropas, antes F28-IA ponto 5). O nome deste arquivo fica, porque o PROGRESS o cita.

> **Status: ESPERA APROVAÇÃO DO OPERADOR.** É plano de implementação: nada foi
> implementado. Escrito por um subagente de planejamento em 2026-09-28, com o fonte do
> kam_remake (clone `reyandme/kam_remake` no scratchpad) e o código do repo.
> [verificado] = conferido abrindo o arquivo; [hipótese] = leitura. As lacunas que o GDD
> não responde estão marcadas **PARA DECISÃO DO OPERADOR**, cada uma com a proposta
> conservadora.

## 0. Onde as coisas estão hoje [verificado]
- **Na sim, só o civil drena.** `drenaCondicao` (`src/sim/condicao.ts`) devolve `ehCivil`,
  e o comentário dela diz que é o único lugar a mudar quando o Feed existir. O
  `sistemaDaFome` (`src/sim/systems/fome.ts:204`) pula o militar.
- **O dado do militar existe, mas não age:**
  - `condition.json: duracaoCondicaoCheia_min_base.militar = 60` (escala `economia` 2,0 →
    30 min efetivos → 18 000 ticks);
  - o loader já calcula `ticksCondicaoCheia.militar`, `ticksNoLimiar.militar` e
    `ticksRestauradosPorComida.militar`;
  - todo militar nasce cheio.
- **Dois testes travam o comportamento atual:**
  - `tests/F20b-fome.test.ts:110-121` ("o militar NAO drena");
  - `tests/F20c-marcador-de-fome.test.ts:76-81` ("quem nao drena nunca acende o marcador").
- **O grupo militar do jogador é só estado de interface** (`src/input/selecao-militar.ts`).
  Os comandos de tropa recebem uma lista de unidades.
- **A IA tem grupos persistentes:** as `PosicaoDeDefesa` em `GameState.ia`.
- **O JobBoard não conhece lado.** O operador mandou consertar na fila C, item C7.
- **Civil não pode ser atacado:** o combate filtra por `hpMaximoDoTipo !== null`. O serf só
  morre de fome.
- **Não existe painel de grupo militar.** O GDD §7.2 o lista como P1: "Tipo, quantidade,
  condição, Halt/Split/Link/Formação/Feed/Storm".
- **O marcador de fome da F20c reexporta `emAlertaDeFome` da sim.** Quando o militar
  drenar, o marcador acende nele sem mudar `src/render/`.
- **Ordem do tick:** IA → marcha → combate → torre → cerco → sanearTarefas → fome → serfs
  → laborers → especialistas → escolas → feira → gerarTarefas.
  - Morte em combate acontece **antes** do saneamento.
  - Morte **por fome** acontece **depois** do saneamento.

## 1. Regras, com fonte
Caminhos relativos a `src/` do kam_remake.

| # | Regra | Fonte |
|---|---|---|
| R1 | O militar **sente fome**: drena 1 tick por tick; a cheia é `ticksCondicaoCheia.militar`. | GDD §4.3, §11.3; `condition.json`. KaM: todo `TKMUnit` drena (`units/KM_Units.pas:2600-2604`), e o guerreiro herda (`units/KM_UnitWarrior.pas:1120`). |
| R2 | O militar **não vai à Bodega**. | GDD §4.3; `condition.json: regraMilitar`. |
| R3 | O militar **morre a 0**, como o civil. | GDD §11.3. KaM: `if fCondition <= 0 then Kill` (`units/KM_Units.pas:2607-2608`). |
| R4 | O militar **enche com 1 item qualquer**: a entrega põe a condição em `cheia`. | GDD §4.3; `regraMilitar`. KaM: `fToUnit.Feed(UNIT_MAX_CONDITION)` (`units/tasks/KM_UnitTaskDelivery.pas:515-518`). "Qualquer" são as comidas de `restauracaoPorComida` (`res/KM_ResTypes.pas:39`). |
| R5 | **Feed** é ordem ao grupo. Cada membro **só pede** se estiver abaixo de 55 % da cheia e ainda não tiver pedido. Pedir de novo não duplica. | GDD §2.4, §4.3. KaM: `TKMUnitWarrior.OrderFood` (`units/KM_UnitWarrior.pas:290-296`), com `TROOPS_FEED_MAX = 0.55` (`common/KM_Defaults.pas:373`); o grupo chama cada membro (`units/KM_UnitGroup.pas:1459-1469`). |
| R6 | **Um serf leva uma comida a cada militar que pediu**, pelo JobBoard. | GDD §4.3, §6.3. KaM: `AddDemand(nil, Self, wtFood, 1, dtOnce, diHigh2)` (`KM_UnitWarrior.pas:294`). |
| R7 | **A entrega a unidade em campo anda livre**, sem estrada. | Decisão do operador de 2026-09-23 (F18d-1a: "unidade em campo → livre"). KaM: `hands/KM_HandLogistics.pas:1222-1225`. |
| R8 | **O alvo anda.** O serf vai até onde o militar estava. Ao chegar, se o militar estiver a mais de 1 tile, recalcula o caminho e continua. | KaM: `KM_UnitTaskDelivery.pas:490-496`. |
| R9 | **Militar que morre cancela o pedido.** | KaM: `hands/KM_Hand.pas:2080-2081`. |
| R10 | **A IA alimenta a posição** quando ninguém dela está lutando e a **menor** condição dos membros está abaixo de 6/45 ≈ 0,1333 da cheia. Ela dá o mesmo Feed, e cada membro aplica a regra dos 55 %. | KaM: `TKMGeneral.CheckArmy` (`ai/KM_AIGeneral.pas:316-327`); `Group.Condition` é o mínimo (`units/KM_UnitGroup.pas:471-478`); `UNIT_MIN_CONDITION = 6*60` de `UNIT_MAX_CONDITION = 45*60` (`KM_Defaults.pas:371-372`). |
| R11 | **A fome não muda o combate.** | `docs/varredura-kam.md`, frente 1. |

### Lacunas (PARA DECISÃO DO OPERADOR)

**L1. Degrau da escada.**
- O KaM ordena: ouro→escola > comida→soldado > comida→Inn > material.
- Na nossa escada, a comida→Bodega está em 1 e o ouro em 2.
- **Proposta:** `comida-para-tropa` entra no **nível 2**, logo abaixo da Bodega, e os
  níveis de baixo descem um.
- **Alternativa fiel ao KaM:** nível 1. Essa quebra `tests/F20a-bodega.test.ts:69`.

**L2. Que comida o serf leva.**
- O KaM sorteia com viés para a mais abundante.
- **Proposta, sem RNG:** a comida com mais unidades livres no armazém; no empate, a ordem
  de `restauracaoPorComida`.

**L3. De onde a comida sai.**
- **Proposta:** só de **armazém completo do mesmo lado**, o mais perto do militar.
- O KaM aceita qualquer casa que ofereça comida. Isso fica fora.

**L4. Alvo morreu com a comida na mão.**
- O KaM desvia a entrega para outro soldado que pediu.
- **Proposta:** `destino-sumiu`, e o serf devolve ao armazém pelo `devolvendo` que já
  existe.

**L5. Condição com que o soldado nasce.**
- No KaM é 60 % (`TROOPS_TRAINED_CONDITION`).
- **Proposta:** continua nascendo cheio. Nenhum número novo.

**L6. Feed quando ninguém do grupo está com fome.**
- No KaM é silencioso.
- **Proposta:** o comando é aceito e o estado não muda, com um `command-rejected`
  `'sem-fome'` para a tela dizer "Ninguém com fome".

**L7. A sobra de ataque da IA.**
- **Proposta:** o ponto 5 vale só para as posições de defesa.

**L8. A IA sem economia.**
- Nenhum cenário atual dá armazém, comida e serf à IA.
- Com R1, a tropa da IA morre em 30 min efetivos se ninguém alimentar.
- **Proposta:** R1 vale para todos os lados, e isso vai para o BALANCE_LOG.

**L9. Pausa de entrega.** No KaM são 5 ticks (`SetActionLockedStay(5)`). **Proposta:** não
adotar; a entrega dura 1 tick, como toda entrega do serf.

**L10. Aviso "tropa com fome" no HUD.** Fica fora; vai para `IDEIAS.md`, ou vira o sub-item
opcional (f).

**L11. Nome do comando.** **Proposta:** `FeedUnits`, no padrão de `MoveUnits`.

## 2. Dados
| Arquivo | Campo | Situação | Valor e fonte |
|---|---|---|---|
| `condition.json` | `duracaoCondicaoCheia_min_base.militar` | já existe; passa a ter efeito | 60 min, GDD §11.3 |
| `condition.json` | `limiares.alertaVisual`, `limiares.morte` | já existem; passam a valer para o militar | 0,35 e 0,0 |
| `condition.json` | **novo** `militar.pedeComidaAbaixoDe` | fração da cheia, sem escala | **0,55**, KaM `TROOPS_FEED_MAX` |
| `condition.json` | **novo** `militar.iaAlimentaAbaixoDe` | fração da cheia, sem escala | **0,1333** = 6/45, KaM. **PARA DECISÃO**: o nosso `civilVaiComer` já diverge do KaM (0,50 contra 0,133). |
| `delivery.json` | **nova linha** `comida-para-tropa` | `modo: "livre"` | nível pela L1, com os demais renumerados |
| `units.json` | `militares._comum.vaiAoInn`, `alimentadoPor` | já existem, sem leitor | não ligar agora |

- `ticksRestauradosPorComida.militar` perde leitor, porque R4 enche direto. **PARA
  DECISÃO:** remover.
- **Regras novas:**
  - `0 < iaAlimentaAbaixoDe < pedeComidaAbaixoDe < 1`;
  - `comida-para-tropa` tem `modo` `livre`.
- **Nenhuma duração nova.**

## 3. Simulação
### 3.1 Estado e save: sem subir a versão
- **`Unidade.pedidoDeComida?: true`**, opcional; ausente quer dizer "sem pedido" (o
  `fRequestedFood` do KaM). Ele mantém o pedido vivo quando falta comida.
- **Nova `TarefaComidaParaTropa`:**
  ```ts
  { tipo: 'comida-para-tropa'; estado: 'aberta'|'reclamada'|'carregando';
    mercadoria: string; origem: string /* armazem */; destinoUnidade: string }
  ```
  - O campo é `destinoUnidade`, não `destino`, para `predios.porId[t.destino]` não
    compilar contra ele (molde do `destinoTile` da F18g).
  - Ela entra em `TarefaDoSerf`, e o compilador obriga a linha em
    `GAVETA_DE_ORIGEM_POR_TIPO`, `ORIGEM_ESPERADA_POR_TIPO` e `UNIDADE_ELEGIVEL_POR_TIPO`.
- **A versão do save (4) não sobe:** só entra campo opcional e variante aditiva, e um save
  v4 é estado válido das regras novas.

### 3.2 Comando `FeedUnits { unidades }`
- **Arquivo:** `src/sim/systems/alimentar.ts`.
- **Recusas:** as da marcha (`sem-unidades`, `unidade-inexistente`, `unidade-nao-militar`,
  `lados-diferentes`) mais `sem-fome` (L6).
- **Efeito:** grava `pedidoDeComida` em quem está `<= pedeComidaAbaixoDe` e sem pedido. Sem
  evento de sucesso.

### 3.3 A tarefa `comida-para-tropa` no JobBoard
- **Gerador** (depois de `gerarTarefasDeComida`): para cada militar com pedido e **sem**
  tarefa apontando para ele:
  - origem: o armazém do mesmo lado, alcançável a pé até o militar, com comida livre, o de
    menor caminho;
  - `armazemMaisPertoDoTile` e `tileAlcancavelDaPorta` passam a receber o tipo;
  - sem origem, o pedido espera.
- **Reserva:**
  - 1 unidade na `saida` do armazém;
  - no destino, no máximo 1 tarefa por `destinoUnidade`.
- **Claim:**
  - `serf.lado === militar.lado`: **o primeiro filtro de lado do JobBoard**, que o C7
    generaliza;
  - sobra na origem ≥ 1;
  - o militar existe e tem pedido;
  - há custo.
- **Saneamento:**
  - militar ausente → `destino-sumiu`;
  - sem pedido → `destino-completo`;
  - a aberta vale enquanto houver sobra e caminho.
- **FSM do serf:** nenhum estado novo. Em `passoEntregando`:
  - alvo ausente → devolve;
  - alvo a mais de 1 tile → recalcula até o tile atual (R8);
  - sem caminho → devolve;
  - adjacente → enche a condição, apaga o pedido e emite **`unit-fed`**.

| Ramo | Quem detecta | Efeito |
|---|---|---|
| Militar morre em combate ou pela torre | `sanearTarefas` no mesmo tick | cancela; se o serf carrega, devolve |
| Militar morre de fome | `morrer`, que passa a liberar as tarefas com `destinoUnidade` | idem, no mesmo tick |
| Militar se move | `passoEntregando` | recalcula; não libera |
| Militar inalcançável | aberta, reclamada e carregando, cada uma no seu passo | cancela ou devolve; o pedido persiste |
| Comida acabou | `abertaVale` / `passoCarregando` | recria depois; o pedido persiste |
| Armazém demolido | `motivoIndividual` | `origem-sumiu` |
| Serf morre | `morrer` → `liberar` | reabre ou devolve |
| Serf de outro lado | claim | `unidade-invalida` |

### 3.4 O militar com fome
- `drenaCondicao` passa a ser `classeDaUnidade !== null`.
- `precisaComer` passa a exigir `ehCivil`.
- `resumoDeCondicao` separa civis e militares.
- O militar drena e morre com o `morrer` que já existe. Não há efeito no combate.

### 3.5 A IA, ponto 5
- Depois de `defenderEPosicionar`, para cada posição: se ninguém está lutando e o mínimo
  está abaixo de `iaAlimentaAbaixoDe`, aplica `FeedUnits` aos membros.
- Só dispara se houver membro a pedir, para não gerar `sem-fome` todo tick.

## 4. Interface
- **Marcador de fome sobre o militar:** acende sozinho quando a (c) entrar.
- **Painel de grupo militar mínimo:**
  - `src/ui/painel-grupo.ts`, com o corpo `'grupo'` em `barra.ts`;
  - mostra a quantidade por tipo, a condição do grupo (o mínimo, como no KaM) e "N
    esperando comida";
  - tem o botão **Alimentar**, que envia `FeedUnits`;
  - diz "Ninguém com fome" quando o comando volta `sem-fome`.
- **Seletor puro:** `resumoDoGrupo(state, ids)`.
- Halt, Split, Link, Formação e Storm não entram.

## 5. Sub-itens (uma sessão cada; ordem a → b → c → d, e **e** depois de **c**)
Ligar o dreno antes de o Feed funcionar seria o travamento de regra que `drenaCondicao`
proíbe.

- **F-FEED-a — dado, comando e pedido.**
  - Faz: os dois campos novos com regra, a linha `comida-para-tropa` com renumeração,
    `FeedUnits`, `pedidoDeComida?` e `resumoDoGrupo`.
  - Aceite:
    - pede a 50 % e não a 60 %;
    - dois Feed deixam um pedido só;
    - as recusas deixam o estado igual;
    - o save faz a viagem byte a byte, e o save v4 carrega;
    - a regra de dado reprova `ia >= pede`.
- **F-FEED-b — a tarefa.**
  - Faz: gerador, reserva, claim com lado, saneamento, FSM com alvo que anda, entrega e
    `unit-fed`. O militar ainda não drena; o teste baixa a condição à mão.
  - Aceite:
    - entrega e enche;
    - com o militar marchando, recalcula e entrega;
    - um caso para cada ramo da tabela;
    - invariantes a todo tick;
    - conservação de bens descontando `unit-fed`;
    - determinismo;
    - nunca duas tarefas por militar.
- **F-FEED-c — a fome do militar.**
  - Faz: R1 a R3, com `morrer` liberando as tarefas.
  - Aceite:
    - drena 1 por tick;
    - não vai à Bodega;
    - morre a 0 e o pedido cai no mesmo tick;
    - o ciclo marcha → fome → Feed → cheio fecha.
  - **Muda os aceites da F20b e da F20c, e precisa do seu visto.**
- **F-FEED-d — painel e botão (só UI).**
  - Aceite headless mais screenshots com roteiro despausado: o grupo a 30 % com marcador,
    o serf com pão a caminho e o grupo cheio.
- **F-FEED-e — a IA, ponto 5.**
  - Aceite:
    - acima de 13,3 % não pede;
    - abaixo, pede e é alimentado;
    - com um membro lutando, ninguém pede;
    - o serf do jogador nunca atende a IA;
    - determinismo.
- **F-FEED-f (opcional):** o alerta de tropa com fome no HUD.

## 6. Riscos
1. **JobBoard sem lado.** O C7 da fila C resolve antes do Feed.
2. **Morte por fome depois do saneamento.** `morrer` precisa liberar as tarefas que apontam
   para o morto.
3. **Perseguir um alvo que anda.** Recalcular só na chegada e no bloqueio, como no KaM; o
   custo se mede em nós do A*.
4. **Renumeração da escada.** Mudam os literais de `tests/F15b-entrega.test.ts:48-52`.
5. **Os aceites da F20b e da F20c mudam na (c).**
6. **Cenários longos com militar.** Depois de 18 000 ticks sem comida, o militar morre.
7. **A IA sem economia (L8)** passa a perder tropa para a fome.
8. **A conservação de bens** precisa descontar `unit-fed`.
9. **Classificação por forma.** `ehTarefaDoSerf` passa a olhar o tipo.
10. **`tileAlcancavelDaPorta`** está fixo no tipo da pedra e passa a receber o tipo.
