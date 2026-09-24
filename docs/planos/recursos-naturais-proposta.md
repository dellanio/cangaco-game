# Proposta — o módulo de recursos naturais (decisão de arquitetura antes da F18)

**Status: proposta. Nada implementado, nada escrito no `BUILD_PLAN.md`.**
Data: 2026-09-24.

Decisão do operador que origina este documento: **os especialistas que colhem
saem do prédio** — fazendeiro ao campo, pedreiro à rocha, lenhador à árvore — e
isso exige **recursos naturais no mapa**, porque sem eles a saída é animação sem
consequência.

Esta proposta **substitui** duas recomendações de
`docs/planos/F18-F19-proposta-de-item.md` (2026-09-24): a §2 de lá propunha
`state.campos` derivado da fazenda, e a §4 propunha o fazendeiro **não** sair do
prédio na Fase B. As duas caem. O documento fica como registro do que foi
considerado.

---

## 0. O que foi conferido no arquivo (fato, com caminho)

| Fato | Onde |
|---|---|
| O mapa é **só duas dimensões**: `mapaPadrao {largura:128, altura:128}` | `data/terrain.json`, lido em `pathfinding.ts:161` e `estradas.ts:461` |
| **Não existe camada de tile no `GameState`.** A única coisa por tile são `estradas` e `estradasPlanejadas`, esparsas, `Readonly<Record<"gx,gy", true>>` | `src/sim/state.ts:709,721` |
| Estado serializado: **29 KB**, o **mesmo** em 64², 128² e 256² | PROGRESS.md, tabela da F18b |
| O A* conhece **dois** terrenos (estrada / grama), "porque o mapa não tem terreno variado" | `src/sim/pathfinding.ts:8-9` |
| O loader já monta a matriz de custo para **quatro** (`estrada`, `grama`, `campoArado`, `areia`); dois nunca são consultados | `src/sim/data/loader.ts:164-186` |
| O veio mora no **prédio**, e o comentário diz o porquê: *"Mora aqui porque nao existe camada de terreno na sim"* | `src/sim/data/types.ts:63` |
| `quarry.veio.rendimento = 200`; `woodcutters` **não tem veio** (tronco do nada); `fishermans` tem `notas: "estoque do lago e finito"` e **nenhum campo** que implemente isso | `data/production.json` |
| `MotivoDeRecusa` já declara `'terreno'`, marcado **inalcançável hoje** | `src/sim/placement.ts:26-33` |
| `woodcutters.modos` existe **sem leitor**, de propósito | `data/production.json`, IDEIAS.md |
| `terrain.json.campos` (15 milho / 9 uva / 1 timber) e o duplicado `production.json.wineyard` — **sem leitor nenhum** | `data/terrain.json`, `loader.ts:274` |
| O especialista **nunca anda depois de ocupar**: movimento só em `indo_ocupar` | `src/sim/systems/especialistas.ts:1-118` |
| GDD Anexo B: *"Não tem geração procedural de mapa no MVP: mapas feitos à mão."* | `docs/GDD.md:824` |
| Os 28 prédios já existem no dado, mina e Fisherman's inclusive | `data/buildings.json` |
| `economy.json.estadoInicial` já carrega uma `semente` e posições fixas da vila | `data/economy.json` |

**Sobre a premissa do pedido.** O estado hoje **não** tem ~1,5 MB: tem **29 KB**,
e é constante em qualquer tamanho de mapa, exatamente porque o mapa não mora
nele. O 1,5 MB é o **custo de pôr o mapa lá dentro** — medi agora, com
`JSON.stringify` sobre 128² = 16 384 tiles:

| Forma | Tamanho |
|---|---|
| `Record` denso, 1 campo por tile | **0,35 MB** |
| `Record` denso, 2 campos | **0,55 MB** |
| `Record` denso, 3 campos com nomes longos | **0,85 MB** |
| Array plano de inteiros (16 384) | **32 KB** |
| `Record` **esparso**, 900 tiles de recurso | **30 KB** |
| (estado inteiro de hoje, para comparar) | 29 KB |

A conclusão que essa tabela força está na §2: a coisa densa e imutável não pode
entrar no estado; a coisa esparsa e mutável pode, e custa o dobro de um estado
inteiro de hoje.

---

## 1. O que existe no mapa

| Recurso | Quem consome | O GDD já prevê? |
|---|---|---|
| **Rocha** | Quarry → stone | **Sim, [fonte]**: §5.2 *"rocha → stone"* |
| **Árvore** | Woodcutter's → tree trunk | **Sim, [fonte]**: §5.2 *"árvores → tree trunk"*; §2.3 dá os modos `cortar`/`replantar` |
| **Veio de ouro** | Gold mine → gold ore | **Sim, [fonte]**, e o GDD é o único lugar que escreve **"(esgota)"** explicitamente |
| **Veio de ferro** | Iron mine → iron ore | **Sim, [fonte]**: §5.2 *"veio → iron ore"* |
| **Jazida de carvão** | Coal mine → coal | **Sim**: §5.2, e §11 decide *"Carvão continua vindo de uma jazida, não de carvoaria"* |
| **Água / cardume** | Fisherman's → fish | **Sim, [fonte]**: §4.2 *"Fish \| Fisherman's (**finito**)"* |
| **Solo cultivável** (milho, uva/cana) | Farm, Wineyard | **Meio**: §5.4 fala de campo arado e §4.2 de *"~15 campos"*, mas nunca diz que o campo é **tile de mapa**. É a parte nova |

**O que é novo, e só isto:** (a) o campo como tile de mapa e não como número no
prédio; (b) o **mecanismo comum** de esgotamento — hoje ele existe uma vez só, e
escondido dentro do prédio.

### O mecanismo, proposto como um só

Cada tile de recurso tem `quantidade` (inteiro) e um **regime de recomposição**
declarado **no dado, por tipo**, não por tile:

| Regime | Quem | O que acontece no zero |
|---|---|---|
| `nunca` | veio de ouro, ferro, carvão, rocha | a entrada **sai** do mapa: o tile volta a ser terreno base |
| `porAcao` | árvore (o lenhador replanta), campo (o fazendeiro ara e semeia) | a entrada **fica**, com `quantidade = 0`: é a diferença entre *cortada* e *inexistente*, e é o que destrava os modos do Woodcutter's |
| `porTempo` | cardume (a decidir — ver §7) | a entrada fica e sobe sozinha, com a taxa em `data/` |

Um mecanismo, três regimes em dado. **Não** três sistemas. O `maximo` e o regime
vêm do tipo; o tile guarda só o número que muda.

---

## 2. Onde mora no `GameState` — duas camadas, e só uma entra no estado

Esta é a resposta central, e ela é **duas coisas**, não uma:

### Camada A — terreno base. **Fora do `GameState`.**

O tipo do tile (grama, areia, água, rocha-de-montanha) **nunca muda durante a
partida**. Ele vive no **arquivo do mapa**, carregado junto com `gameData`,
congelado por `deepFreeze` (`src/sim/freeze.ts`), exatamente como `terrain.json`
hoje. O estado guarda o **id do mapa**, não o mapa.

Três razões, nenhuma estética:

1. **Custo medido.** Denso em `Record`: 0,35 a 0,85 MB, contra 29 KB do estado
   inteiro. A F23 (save/load) copiaria isso a cada save, e o teste de
   determinismo compararia centenas de KB de coisa que, por construção, não pode
   ter mudado.
2. **A regra da casa já diz isso.** PROGRESS.md, sobre o índice de componentes:
   *"Não se guardam componentes no estado: seria dado derivado serializado, que
   poderia ficar inconsistente com os tiles."* Terreno imutável no estado é o
   mesmo erro, maior.
3. **Determinismo fica mais forte, não mais fraco.** O que não está no estado não
   pode divergir. O save guarda `mapa: "<id>"` + o **hash do arquivo**; carregar
   com mapa diferente falha na hora, em vez de divergir 300 ticks depois.

### Camada B — recursos. **Dentro do `GameState`, esparsa.**

```
state.recursos: Readonly<Record<"gx,gy", { tipo: string; quantidade: number }>>
```

Mesma forma e mesma chave de `state.estradas` — o molde **serve aqui** (ao
contrário da `estradasPlanejadas`, que não servia para campo porque exigia
comando do jogador). Esparsa: só os tiles que têm recurso. Medido: 900 tiles =
**30 KB**, o dobro do estado de hoje. É o preço da dinâmica, e é pago uma vez.

**Não é entidade com posição.** Recurso não anda, não tem HP, não tem FSM, e a
pergunta que todo sistema faz é *"o que tem no tile (gx,gy)?"* — o tile já é a
chave, e a resposta é O(1). Entidade obrigaria id próprio, lista e busca por
posição a cada consulta do A* e do JobBoard.

**O que o save/load e o determinismo sentem:**

- é `Record` de string para objeto simples — sem `Map`, sem função, sem
  referência circular. Passa no `compararComESemSave` da F02/F23 **sem código
  novo**;
- +30 KB no JSON, +0 em qualquer teste que já existe;
- **a regra que precisa estar escrita no item:** nenhum sistema pode varrer
  `state.recursos` para escolher alvo. A escolha continua passando pelo JobBoard,
  por menor id de tarefa (GDD §6.3) — varrer o mapa para escolher tarefa é
  anti-padrão listado no CLAUDE.md §10, e recurso no mapa é justamente a maior
  tentação de quebrá-lo desde a F09.

---

## 3. Isto é a mesma coisa que o "terreno variado" do IDEIAS.md?

**Não. São dois, e a sua própria frase é a prova:** *água para o pescador é
terreno; árvore para o lenhador é recurso que some quando cortado.* A distinção
não é temática, é de **onde o dado mora**: terreno é imutável e vive no mapa;
recurso é mutável e vive no estado. Misturar os dois é o que obrigaria o mapa
inteiro a entrar no `GameState`.

Onde eles se tocam — e é por isso que a ordem importa:

- **água** é terreno (já está em `terrain.json.intransponivel`); o **cardume** é
  recurso, e mora sobre tiles de água;
- **montanha/rocha** é terreno; o **veio** é recurso, e mora sobre ela;
- **grama** é terreno; **árvore** e **campo** são recursos sobre ela.

Recurso sempre pousa sobre um terreno compatível. Logo **o terreno vem primeiro**
— sem ele, o recurso não tem onde ser validado.

**Consequência para o IDEIAS.md:** a entrada *"Terreno de mapa variado (água/lago,
rocha, veio na montanha)"* hoje descreve as duas coisas numa linha só. Ela se
divide em duas, e os **dois dependentes registrados** (o motivo `'terreno'` do
`canPlace`; os **modos do Woodcutter's**) se separam junto: o primeiro é de
terreno, o segundo é de recurso.

---

## 4. Como o mapa inicial ganha recursos

**O GDD já decidiu, e a decisão é boa:** Anexo B — *"Não tem geração procedural de
mapa no MVP: mapas feitos à mão"* —, e `IDEIAS.md` congela "Geração procedural de
mapa". Então:

- **Arquivo de mapa versionado**, `data/maps/<id>.json`, validado por
  `npm run validate:data` contra schema, como todo o resto de `data/`.
- **Formato legível e diffável**, porque o git é quem vai revisar isto:
  - camada base como **linhas de caracteres** (`"ggggwwwgg…"`), 128 linhas de 128
    chars ≈ **16 KB de texto** e um diff que um humano lê;
  - recursos como **lista esparsa** `[{ tipo, gx, gy, quantidade }]` — nunca
    16 384 objetos.
- **Gerador por semente é ferramenta, não runtime.** `tools/` pode ter um gerador
  que **emite o arquivo**; o arquivo é o que entra no git e o que o jogo carrega.
  Isso respeita o Anexo B (o artefato é feito à mão, mesmo que a primeira versão
  tenha saído de um gerador) e mantém `sim/` sem gerador dentro. **A semente que
  gerou o arquivo fica no cabeçalho dele** — a mesma disciplina que o CLAUDE.md §9
  já exige da arte: *guarde o id ou a semente que a ferramenta devolveu*, senão
  não há como voltar e ajustar.
- **Identidade regional da campanha = um arquivo por mapa.** É exatamente o que
  campanha precisa, e não custa nada a mais.
- `economy.json.estadoInicial` passa a apontar `mapa: "<id>"`. As posições fixas
  da vila (`storehouse` em 29,30) passam a ser **do mapa**, não da economia — a
  F18c já preparou as fixtures para não dependerem de posição absoluta.

---

## 5. O que isto derruba

1. **O veio dentro do prédio (F15a/D2).** `ReceitaDePredio.rendimentoDoVeio` e
   `PredioCompleto.producao.veio` deixam de ser a fonte. A Nota da F21 previu isto
   e disse *"só o inicializador muda"* — **e isso agora é meia verdade**, porque
   com o especialista saindo quem decrementa deixa de ser o ciclo de produção e
   passa a ser a colheita no tile. É o ponto de maior risco do pacote, e tem de
   estar escrito no item, não descoberto na sessão.
2. **O exploit de demolir-e-reconstruir a Quarry** (IDEIAS.md, achado da F16a:
   200 pedras por meio custo) **morre sozinho**, porque o veio deixa de ser
   semeado na conclusão da obra. A entrada sai do IDEIAS.md no commit da feature.
3. **O lenhador produzindo do nada.** `woodcutters.sai.tree_trunk` sem veio passa
   a consumir árvore — e aí os **modos** (`cortar`/`replantar`/`ambos`)
   destravam: a pré-condição escrita no IDEIAS.md é literalmente esta camada.
4. **O peixe infinito.** `fishermans.notas` diz *"estoque do lago e finito"* e
   nada implementa. Vira estoque do cardume.
5. **O motivo `'terreno'` do `canPlace`** (`placement.ts:33`), declarado e
   inalcançável desde a F06, passa a ser alcançável e ganha teste: Quarry exige
   rocha, mina exige veio, Fisherman's exige água.
6. **A metade não usada da matriz de custo de movimento.** `campoArado 1.45` e
   `areia 1.50` já estão no dado e no loader, e o A* nunca os consulta. Com
   terreno eles passam a valer, e **os tempos de viagem mudam** — isso mexe em
   balanceamento já medido (oráculo da F15b). Vai em bloco para o
   `BALANCE_LOG.md`, nunca item a item.
7. **A FSM do especialista** (`systems/especialistas.ts`): hoje o ocupante nunca
   anda depois de ocupar. Sair obriga **todo predicado que lê `ocupante`** a
   responder *"ocupado, mas fora"* — painel da F16b, alerta de "prédio sem
   trabalhador" da F22, demolição com o ocupante no campo. É o maior custo do
   pacote, e é o que a decisão de hoje comprou conscientemente.
8. **`terrain.json.campos` e o duplicado em `production.json.wineyard`** (15 / 9 /
   1 timber, hoje sem leitor) — ganham leitor ou saem. Não podem seguir os dois.
9. **A proposta F18–F19 de ontem**: §2 (`state.campos` derivado da fazenda) e §4
   (fazendeiro não sai) caem, como dito no cabeçalho deste documento.
10. **Os números de desempenho da F17c/F18b**, *se* árvore for obstáculo. Uma
    floresta densa muda o mapa de obstáculos do A*, e os 94 µs/busca a 128²
    foram medidos num mapa vazio. **Recomendo árvore intransponível** (é o que dá
    forma à floresta e o que o original faz) **com a re-medição como tarefa
    escrita dentro da feature** — medir depois de entregar é como se descobre
    tarde.
11. **O GDD.** §4 ganha uma seção de recursos naturais; §5.4 tem de trocar
    *"campo de milho: arado por laborer"* por fazendeiro. **Alteração de GDD é
    sua**, não minha — aqui fica só a lista.

---

## 6. A fila depois disso

Proposta de três itens novos **antes** da F18, nesta ordem, cada um entregável
sozinho:

- **F-T1 — Camada de terreno base (dado + sim).** Formato e schema do arquivo de
  mapa, carregamento congelado, `tipoDoTile(gx,gy)`, o motivo `'terreno'` do
  `canPlace` alcançável, e o A* usando os quatro custos que o loader já monta.
  Nenhum recurso ainda. *Aceite:* prédio recusado **por terreno** (e não por
  outro motivo — o vocabulário de `MotivoDeRecusa` existe justamente para isso),
  e caminho que **desvia** de água, com o custo medido contra o mapa vazio.
- **F-T2 — Camada de recursos (sim).** `state.recursos`, esgotamento, os três
  regimes, save/load. O primeiro consumidor é a **Quarry**, que já tem
  esgotamento, evento `vein-exhausted` e alerta: só a **fonte** muda, do prédio
  para o tile. *Aceite que não passa por acidente:* demolir e reconstruir a
  pedreira **não** renova o veio — o exploit da F16a é a asserção.
- **F-T3 — O especialista sai do prédio (sim).** A FSM nova, com o **pedreiro**
  como primeiro caso, porque é o único em que **só a locomoção** é nova — o resto
  da mecânica dele já está de pé e medido. Lenhador e fazendeiro herdam.

**E a F18 vira outra coisa:** "Farm e campos de milho" deixa de **inventar** a
mecânica de campo e passa a ser a **terceira consumidora** dela. O campo é tile de
recurso cultivável, o fazendeiro anda até ele, ara, semeia e colhe. O aceite de
duas pernas continua valendo — *fazenda sem campo não produz* —, só que "sem
campo" passa a significar *"sem tile arável alcançável"*, que é condição de mapa
e não número no prédio.

Efeitos no resto da fila: **F19 (Mill/Bakery) segue independente**; **F21 encolhe**
(o contrato herdado do veio já terá mudado na F-T2, sobra ouro, carvão e o
metalúrgico); **F20 (Inn e fome) fica três features mais longe**.

**O custo que eu preciso declarar, porque é o seu próprio argumento:** ao empurrar
a F18g você escreveu *"fidelidade importa, mas não antes de o jogo ter comida"*.
Este pacote põe **três features em `sim/`** antes da comida. Ele é maior que a
F18g. A diferença que justifica — e a decisão é sua — é que a F18g é fidelidade
**visual** com a regra já garantida por duas guardas, enquanto isto é a
**pré-condição** de mecânica de cinco prédios (Quarry, Woodcutter's, as três
minas), de dois dependentes já registrados no IDEIAS.md e do campo da própria
F18. Se o caminho mais curto até a comida pesar mais, o corte possível é **F-T1 +
F-T2 agora e F-T3 depois da F20**: o campo existiria como tile de verdade, com
esgotamento de verdade, e só a caminhada do fazendeiro ficaria para depois.

**Nota de escopo obrigatória:** o **render** do terreno e dos recursos é item
próprio. Pelo CLAUDE.md §10 não se toca `src/render/` e `src/sim/` na mesma
feature sem que a fila diga que a feature é de integração — e isso precisa estar
**escrito no item antes do código**, não inferido depois.

---

## 7. O que só você decide

1. **Árvore é obstáculo?** (recomendo sim, com re-medição do A* dentro da feature)
2. **Cardume: `porTempo` ou `nunca`?** O GDD diz "finito" **[fonte]**; regeneração
   seria invenção nossa.
3. **O corte:** F-T1 + F-T2 + F-T3 antes da F18, ou F-T3 depois da F20?
4. **O formato do arquivo de mapa** — linhas de caracteres + lista esparsa, como
   proposto?
5. **Quem escreve o primeiro mapa**: gerador em `tools/` que emite o arquivo, ou
   mapa desenhado à mão desde o começo?
6. **Rendimento por tile**: a Quarry hoje tem 200 de veio no prédio. Vira 200
   dividido entre os tiles de rocha ao alcance, ou cada tile de rocha tem seu
   próprio estoque e o total depende de onde o jogador plantou? (recomendo o
   segundo — é o que faz **o lugar importar**, que é o ponto da decisão de hoje)
7. **A atualização do GDD** (§4 ganha recursos naturais; §5.4 troca laborer por
   fazendeiro): eu escrevo ou você?
