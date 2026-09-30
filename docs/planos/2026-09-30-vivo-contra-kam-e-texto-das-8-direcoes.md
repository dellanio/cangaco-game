# F-VIVO contra o KaM, e o texto das 8 direções

**Estado: proposta, esperando o operador. Nenhum arquivo citado aqui foi editado.**

> **Na main (2026-09-30):** a seção 4 foi aplicada (fase-animacao §14, nota da F-SPR no
> BUILD_PLAN, BRIEF-ARTE §6/§9), com uma correção: o "Corrigido" de 4.2 errava, porque
> `data/units.json` declara `direcoesDeSprite` no `_comum` dos grupos (civis 4 em `:26`,
> militares 8 em `:106`). O "BUG-V" de C5 é o **BUG-X** do `BUGS.md` da main.

O contrato de prédio para o Codex continua sendo a F-VIVO (o prédio vivo: trabalho, estoque e
animais; `BUILD_PLAN.md:4630`) com o `docs/BRIEF-ARTE.md` §4a. Este documento **não propõe
contrato novo**. Ele lista só onde nós e o KaM diferimos, com uma proposta para cada diferença.

A fonte do lado do KaM é `docs/kam-casas-animacao-e-pilhas.md`, lido no `kam_remake` commit
`731a8a4`. Nenhuma coordenada do KaM foi copiada. Onde a posição importa, a regra é a nossa:
`ancoras` em fração, vindas da arte.

As propostas usam três palavras:
- **manter**: fica como está no nosso contrato;
- **adotar do KaM**: seguir o comportamento do original, sem copiar número nem arte;
- **operador**: a decisão é dele. A recomendação vem ao lado, quando há uma.

---

## 1. O que o KaM tem e nós não

| # | Diferença | KaM | Nós | Proposta |
|---|---|---|---|---|
| A1 | **Estado ocioso da casa** | A casa com o trabalhador dentro e sem trabalhar roda `haIdle`, com 10 a 30 quadros, em 23 das 28 casas (`KM_Houses.pas:2451-2453`, ligado em `KM_UnitTaskGoHome.pas:58` e `KM_UnitTaskMining.pas:423`) | "**Prédio parado não anima**": sem ocupante, sem insumo, com a saída cheia ou pausado, o quadro é `null` (`BUILD_PLAN.md:4754`) | **Operador.** Recomendo adotar só a regra ("ocupado e parado ≠ vazio"). O ocioso pode ser um laço curto do nosso tema, e não é arte do KaM. Depende do BUG-V (seção 3): hoje o ocupante está visível na porta, então a casa ociosa já "mostra" alguém |
| A2 | **Ocioso no caso 1** | Pescador, roça e lenhador não têm `haWork`, mas **têm** `haIdle` (30 quadros) enquanto o trabalhador descansa dentro | caso 1: "nenhuma" animação dentro (`BRIEF-ARTE.md:663`) | **Operador**, junto com A1. Se A1 for adotado, o caso 1 passa a ter o ocioso e só ele. A regra "caso 1 sem trabalho" **se mantém** |
| A3 | **Fogo por dano** | 8 pontos de fogo por casa, e cada 1/8 de dano acende mais um (`KM_Houses.pas:1348-1360`), com 6 quadros cada | O prédio danificado desenha o `completo` inteiro (`WorldScene.ts:1394-1399`). Não achei fogo nem marca de dano no render: `grep` por fogo, incêndio e dano sem resultado | **Operador.** É arte nova e é de combate: não entra na F-VIVO. Se entrar, sugiro 1 laço de fogo genérico em N pontos derivados do `hp`, no molde da fumaça genérica, e não 8 por prédio |
| A4 | **Bandeira animada** | Mastro e 1 a 3 bandeiras com 5 a 10 quadros, em toda casa (`KM_Houses.pas:698`) | Bandeira **estática** do bando, desenhada por código (C-IA-03c, `WorldScene.ts:1567-1574`) | **Manter.** A nossa bandeira responde "de quem é", que é o que importa, e custa zero arte. Animar é polimento |
| A5 | **A escola anima** | School tem `haWork1..5` com 30 quadros cada enquanto treina, e nenhum ocioso | `schoolhouse` não tem receita (`data/production.json`) e **não aparece** em nenhum dos cinco casos nem na lista de "sem receita" (`BRIEF-ARTE.md:669`) | **Operador:** é a lacuna da seção 3, C1. Recomendo adotar do KaM: um laço enquanto há recruta em treino (`escolas.ts`), lido do estado |
| A6 | **A torre tem ocioso** | WatchTower: ocioso de 30 quadros e trabalho de 1 quadro (o arremesso) | A torre está em "sem receita", sem animação (`BRIEF-ARTE.md:669`) | **Manter.** O arremesso é unidade e projétil (`projeteis.ts`), e não camada de prédio. O ocioso cai com A1 |

## 2. O que decidimos diferente de propósito

| # | Diferença | KaM | Nós (decisão) | Proposta |
|---|---|---|---|---|
| B1 | **Pilha por unidade** | Um sprite pronto por quantidade, de 1 a 5, com a posição no próprio sprite (`KM_RenderPool.pas:878-949`) | Uma imagem de **uma** unidade; o render empilha 3 + 2 a partir do ponto (`BUILD_PLAN.md:4640`, `BRIEF-ARTE.md:783`). São 28 imagens, contra 5 × entradas e saídas no KaM | **Manter.** O teto 5 é o mesmo do KaM (`MAX_WARES_IN_HOUSE`) |
| B2 | **Laço de 8 quadros, e a duração vem de repetir** | `haWork1..5` com 10 a 30 quadros, até 5 fases por casa | 8 quadros por laço (4 na luz), 1 a 3 laços por caso (`BUILD_PLAN.md:4641`, `BRIEF-ARTE.md:675`) | **Manter.** É o custo que o operador escolheu (300 quadros de animação, `BRIEF-ARTE.md` "A conta") |
| B3 | **Armazém com 4 pilhas** | O `Store` **não** tem pilha nenhuma | As 4 mercadorias mais abundantes (`BUILD_PLAN.md:4645`, `BRIEF-ARTE.md:752`) | **Manter.** Com o pisca medido, a F-VIVO-a entregou 6 trocas em 6 000 ticks |
| B4 | **As minas são só luz** | As minas têm `haWork` de 15 a 30 quadros (o trabalhador na boca da mina), e a de carvão tem ocioso de 1 quadro | Caso 4: 1 laço de luz, 4 quadros, sem trabalhador desenhado (`BRIEF-ARTE.md`, "Os cinco casos") | **Manter.** Pela regra do zoom, a mudança de luz é o que mais se lê a 0,75 (`BRIEF-ARTE.md` "Medido a 0,75") |
| B5 | **A saída da oficina** | Desenha **por peça encomendada** (`fWareOutPool`, até 20 posições que se repetem de 5 em 5; `KM_RenderPool.pas:923-938`) | Uma pilha por mercadoria de saída, com teto 5 (`BRIEF-ARTE.md` "Pilha das armas") | **Manter.** A encomenda (F24c, Casa do Gibão por encomenda) está no painel, e a pilha diz o que já saiu |
| B6 | **Qualquer prédio pode ter fumaça** | Fumaça só em 6 casas (as três forjas, a padaria, a fundição e o curtume) | Qualquer prédio que declara `ancoras.trabalho.fumaca`. No caso 1, a fumaça é "a única coisa que anima" (`trabalho.ts:116-126`, `BRIEF-ARTE.md` §4a) | **Manter** a regra. **Quem** tem fumaça é escolha de arte, por tema (a casa de farinha tem forno), e não precisa seguir as 6 do KaM |
| B7 | **A fumaça só no trabalho** | É ligada no começo do trabalho (`KM_UnitTaskMining.pas:353`) e sai no ocioso (`KM_Houses.pas:2452`) | Sai do mesmo predicado do quadro de trabalho (`trabalho.ts:124-125`) | **Igual** ao KaM. Fica aqui só porque o pedido citou. Nada a fazer |

## 3. O que ficou sem decisão

| # | Questão | Onde está aberta | O que o KaM diz | Proposta |
|---|---|---|---|---|
| C1 | **A escola** está fora dos cinco casos e da lista de "sem receita" | `BRIEF-ARTE.md:646-672` | anima enquanto treina (A5) | **Operador.** Recomendo pôr a escola na lista com o laço de A5 |
| C2 | **O caso 2 anima com o trabalhador no campo** | `BUILD_PLAN.md:4764-4766`, "pergunta em aberto no `PROGRESS.md`" | Quando o trabalhador sai, a casa vai para `hstEmpty` e **para** de animar (`KM_UnitTaskMining.pas:247-251`) | **Adotar do KaM.** O caminho já está escrito na nota LOTE3-b2: animar só de `ticksDeDescanso + ticksNoTile` até `ticksDoCiclo` |
| C3 | **O curral esvazia entre entregas** de milho | `BUILD_PLAN.md:4797` | Os animais **ficam**: a idade é estado da casa (`fBeastAge`), cresce um animal sorteado por alimentação (`KM_HouseSwineStable.pas:51`), sai ao vender (`:53-61`) e é desenhada sempre que é maior que 0 (`:104-106`) | **Operador.** Adotar ao pé da letra pede idade de animal **na sim**, que é outra feature: sim e não render. Só no render, dá para manter o último curral desenhado enquanto o prédio está ocupado. Recomendo o só-render, com a nota de que o KaM guarda estado |
| C4 | **A feira** (`marketplace`) | Está em "sem receita" (`BRIEF-ARTE.md:669`); o estoque não foi decidido | Não está no `houses.dat` original. O remake desenha **uma** pilha, a da mercadoria de maior quantidade (`KM_HouseMarket.pas:603`) | **Operador.** Recomendo manter sem pilha até a feira ter regra de estoque na sim |
| C5 | **O especialista na porta, visível** (BUG-V) | `BUGS.md`, BUG-V, severidade a classificar | Ele fica dentro, invisível (`KM_UnitActionGoInOut.pas:444`), e descansa dentro (`KM_Units.pas:662-667`) | **Operador.** Decide A1 e A2 junto: com o ocupante dentro, a casa é o único sinal de que ele está lá |
| C6 | **O quadro de trabalho durante o descanso** | O `ticksDeDescanso` é passado dentro, em `trabalhando` (nota LOTE3-b2, `BUILD_PLAN.md`) | O descanso (`WorkerRest`) é ocioso (`haIdle`), e não trabalho | **Operador**, junto com A1. Se A1 entrar, o descanso mostra o ocioso. Se não, a F-VIVO-b segue como está |

---

## 4. O texto das 8 direções

A decisão é do operador, de 2026-09-30: **8 direções para todos a pé, 5 desenhadas com
espelho**. O plano completo está em `docs/planos/2026-09-30-animacao-direcional-de-unidades.md`.
São três lugares que ainda dizem 4 direções para os civis. O terceiro não estava no pedido, mas
o Codex lê esse arquivo.

### 4.1 `docs/fase-animacao-vida-do-mundo.md` §14

**Trecho de hoje:**

```
Direções civis:

north
east
south

west = mirror(east)

Respeite as regras de direção existentes no BRIEF-ARTE.md e
data/units.json.
```

**Texto proposto:**

```
Direções (civis e militares, decisão do operador de 2026-09-30):

8 direções: n, ne, l, se, s, so, o, no.
Desenhe 5: n, ne, l, se, s.
so, o, no = espelho (flipX) de se, l, ne.

Para o espelho valer, a luz vem de cima, sem componente lateral.
A ferramenta e a arma trocam de mão no espelho, e isso é aceito.
Um tipo que o operador reprovar no espelho desenha as 8.

Quadros num atlas por unidade, com o nome
{unidade}/{estado}/{direcao}/{nnnn}.

Plano, custo e ordem:
docs/planos/2026-09-30-animacao-direcional-de-unidades.md.
O piloto é o serf, com sprites de depuração, antes de qualquer arte.
```

O "`carry`" das animações iniciais continua na lista. Vale uma nota ao lado: *"por ora o render
mostra o ícone da mercadoria sobre o serf (plano, leva 1); a carga desenhada no corpo fica para
depois do piloto"*.

### 4.2 A nota da F-SPR (arte das unidades por direção) no `BUILD_PLAN.md:1869-1876`

**Trecho de hoje:**

> **Unidade** (`tipo: "unidade"`, `id` = tipo neutro) usa **um arquivo por direção**, não
> folha. Estado `"<pose>:<direcao>"`, com as direções `n ne l se s so o no`, e hoje só a pose
> `parado`. **Oeste é espelho**: `o`, `no` e `so` sem arquivo usam `l`, `ne` e `se` com
> `flipX`, de modo que 4 direções custam 3 arquivos e 8 custam 5. Quantas direções cada tipo
> tem vem de `data/units.json` (`direcoesDeSprite`: civis 4, militares 8); os mercenários não
> declaram e ficam no retângulo. O `anchor` cai na posição desenhada da unidade.

**Texto proposto:**

> **Unidade** (`tipo: "unidade"`, `id` = tipo neutro): **8 direções para todos os tipos**
> (decisão do operador, 2026-09-30; o A* anda em diagonal, `sim/pathfinding.ts`). As direções
> são `n ne l se s so o no`. **Oeste é espelho**: `o`, `no` e `so` sem quadro usam `l`, `ne` e
> `se` com `flipX`, e por isso 8 direções custam 5 desenhos. A arte parada de hoje continua em
> `estados` (`"<pose>:<direcao>"`, um arquivo por chave). A arte animada entra em atlas, com
> quadros `{unidade}/{estado}/{direcao}/{nnnn}`, pelo plano
> `docs/planos/2026-09-30-animacao-direcional-de-unidades.md`. O `anchor` cai na posição
> desenhada da unidade.
>
> **Corrigido em 2026-09-30:** o texto anterior dizia "civis 4, militares 8" em
> `direcoesDeSprite`, mas `data/units.json` não declara o campo em tipo nenhum (conferido
> em 2026-09-30). O campo passa a ser declarado como 8 nos 28 tipos pela D-TELA-05a do plano.

### 4.3 `docs/BRIEF-ARTE.md` §6 e §9 (não estavam no pedido)

- **§6, linha 975.** Hoje: **"Civis: 4 direções** (`data/units.json`, `direcoesDeSprite: 4`)".
  Proposto: **"Civis: 8 direções, 5 desenhadas com espelho** (decisão do operador,
  2026-09-30)".
- **§9, linhas 1189-1192** ("Duas unidades"). Nas linhas do `serf` e do `laborer`, a coluna
  "Direções" passa de `4` para `8`, e "Desenhos com espelho" passa de `3 (norte, leste, sul)`
  para `5 (norte, nordeste, leste, sudeste, sul)`.
- **Achado para o espelho.** A §6 dá **item na mão** a cada civil (linhas 970-971: "um corpo só
  com uma ferramenta diferente na mão"). É a assimetria que o espelho troca de lado. O texto
  proposto em 4.1 já registra que isso é aceito.

---

## 5. Reconciliação com a `main` (2026-10-01)

As decisões do operador sobre as seções 1 a 3 estão em `docs/planos/2026-09-30-F-VIVO-e-em-diante.md`
(`e5a7e95`). A tabela de itens está no `BUILD_PLAN.md`, em "F-VIVO-e em diante". Conferida contra
a `main` em `8817783`.

| # | Estado |
|---|---|
| A1, A2 (ocioso, também no caso 1) | **resolvido**: F-VIVO-e (`f67e994`), com um laço genérico |
| A3 (fogo por dano) | **decidido, fora da F-VIVO**: vai para a fila depois da C-IA-02 |
| A4 (bandeira animada) | manter (seção 1) |
| A5, C1 (escola) | **aberto**: F-VIVO-h, prioridade baixa |
| A6 (torre) | **resolvido** pela regra da F-VIVO-e, se houver ocupante dentro; hoje não há |
| B1–B7 | manter (seção 2); nada a fazer |
| C2 (caso 2 no campo) | **resolvido**: F-VIVO-f (`85197b8`) |
| C3 (curral) | **aberto**: F-VIVO-g, o curral guarda o último quadro |
| C4 (feira) | **decidido**: fica sem pilha até ter regra de estoque |
| C5 (especialista na porta) | **resolvido**: BUG-X (`1416d1b`). O "BUG-V" daqui é o BUG-X da `main` |
| C6 (descanso) | **resolvido**: F-VIVO-f, com o descanso no ocioso |
| Seção 4 (texto das 8 direções) | **aplicada** (`7aadf98`). A civis em 8 veio na D-TELA-05a (`c53f85a`) |

**Abertos só dois:** F-VIVO-g (curral) e F-VIVO-h (escola), os dois já na fila da `main`.
