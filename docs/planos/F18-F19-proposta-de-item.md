# Proposta de item — F18 e F19 (para aprovação do operador)

**Status: proposta.** Nada implementado, e nada escrito no `BUILD_PLAN.md` até
você aprovar. Data: 2026-09-24.

As duas estão vazias na fila: `BUILD_PLAN.md:1346` e `:1347` são só o cabeçalho,
sem escopo, sem aceite e sem evidência.

---

## 0. O que foi conferido no arquivo (fato, com caminho)

| Fato | Onde |
|---|---|
| `farm` existe: 4×3, `desbloqueadoPor: sawmill`, `trabalhador: farmer` | `data/buildings.json` |
| a fazenda produz **do nada**: `entra: {}`, `sai: { corn: 1.22 }` | `data/production.json` |
| `mill`: `corn → flour`; `bakery`: `flour → loaves` | `data/production.json` |
| `produzir()` só pergunta por pausa, receita, estrada, insumo e veio | `src/sim/systems/especialistas.ts:170-201` |
| **"campo" não existe em `src/sim/`**, em forma alguma | busca em `src/sim/` |
| o especialista **nunca anda depois de ocupar**: movimento só em `indo_ocupar` | `src/sim/systems/especialistas.ts:1-118` |
| `farmer` e `baker` são civis treináveis | `data/units.json` |
| estoque inicial tem `loaves 15`, **não tem** `corn` nem `flour` | `data/economy.json` |
| tarefas de insumo entre prédios já existem e são genéricas | `src/sim/systems/jobs.ts:84-89,158` |

**Dois dados de campo já existem e ninguém os lê** (achado que o item tem de
resolver, senão viram folclore):

- `data/terrain.json` → `campos`:
  `{ milho: { custo: {}, tilesPorFarm: 15 }, uva: { custo: { timber: 1 }, tilesPorWineyard: 9 } }`.
  Carregado em `src/sim/data/loader.ts:274`, e **sem nenhum leitor** em `src/`.
- `data/production.json` → `wineyard`: `campos: 9`, `timberPorCampo: 1`.
  **Os mesmos dois números, num segundo arquivo**, também sem leitor.

Os dois não podem sobreviver ao item: um é a fonte, o outro sai. Proposta:
fica `terrain.json` (campo é geometria de mapa e lá já estão milho e uva
juntos), e `production.json` perde `campos`/`timberPorCampo`.

**Tema (só tela, `sim/` não lê):** `wineyard` = **Canavial**, `wine` =
**Cachaça**, `farm` = **Roçado de Milho**, `farmer` = **Roceiro**, `mill` =
**Monjolo**, `flour` = **Fubá**, `bakery` = **Casa de Forno**, `loaves` =
**Cuscuz**. Os ids da sim continuam `farm`, `corn`, `wineyard`, `wine`.

---

## 1. A sua correção, e o que ela derruba

Quem ara e planta é o **fazendeiro**, o especialista. Com isso o molde da
estrada planejada (`estradasPlanejadas` + JobBoard + laborer) **deixa de
servir**, por três motivos concretos e não por gosto:

1. `estradasPlanejadas` só nasce de **comando do jogador** (`PlaceRoad`). Campo
   derivado da fazenda não tem comando — o mapa nasceria com um estado que
   nenhum comando produz, e o `sim/` passaria a criar coisa sozinho (§10).
2. A tarefa `'assentar-estrada'` é reclamada por um laborer **ocioso**. O
   fazendeiro não é ocioso: ele é **ocupante** de um prédio, e a FSM dele nunca
   reclama tarefa depois de ocupar.
3. Tile de estrada é do **mapa** e não pertence a prédio nenhum. Campo precisa de
   **dono** — sem isso, dois roçados vizinhos dividem tile e ninguém sabe quem
   colhe.

**Registro de divergência:** o GDD §5.4 diz "campo de milho: arado por laborer",
mas a linha está marcada **[proposta]**, não [fonte]. A sua correção passa a
valer; o item registra a divergência e **eu não mexo no GDD** — a linha é sua
para atualizar, ou o item aponta para ela.

---

## 2. Onde o campo mora (ponto 1 do seu pedido)

| Opção | O que é | Custo | Veredito |
|---|---|---|---|
| **A** | contador no prédio: `producao.campos: number` | ~0 (um número) | campo não existe no mapa: nada para o jogador ver, nada para desenhar. Vira flag |
| **B** | **área da fazenda**: `state.campos: Record<tileKey, { farm, estagio }>`, semeada quando a obra vira `'completo'` | 1 campo de estado novo + 1 sistema pequeno | **recomendada** |
| C | plano do jogador (molde da estrada) | — | derrubada pela sua correção |

**Recomendação: B.** A chave é o tile (`"gx,gy"`, o mesmo formato de `estradas`
e `estradasPlanejadas`), o valor tem **dono** (`farm`: id do prédio) e
**estágio** (inteiro). Serializável, comparável, sem `Map` de objeto.

O que o molde da estrada **ainda empresta**, e vale dizer: o formato da chave, a
lição do contador duplo no debug (F18d-2: "não tem campo" e "tem campo no
estágio 0" não podem ser o mesmo `0` na ponte) e a limpeza na demolição — campo
sem fazenda **some junto** com ela, como o canteiro some.

---

## 3. Quem escolhe o lugar (ponto 2)

**Derivado da fazenda, sem comando do jogador.** O jogador escolhe *onde fica a
fazenda*; a área vem junto, como no original. Regra determinística proposta, sem
RNG e sem varredura larga: anéis crescentes ao redor do footprint, em ordem fixa
(linha, depois coluna), pegando tile arável — não é estrada, não tem prédio, é
andável — até `tilesPorFarm` (15, do dado).

Decisões que ficam **registradas**, com a interpretação conservadora já escolhida
caso você não queira decidir agora:

- **não coube 15**: nasce com os que couberem; produz com **≥ 1**.
- **o jogador constrói por cima depois**: o tile de campo **se perde** em
  silêncio (a fazenda encolhe). Campo não bloqueia construção nem passagem.
- **rendimento**: **binário** na Fase B — tem campo, produz no ritmo do dado; não
  tem, não produz. Rendimento proporcional ao número de campos é **balanceamento**
  e vai para `BALANCE_LOG.md`, nunca item a item.

---

## 4. O fazendeiro sai do prédio? (ponto 3)

| Opção | O que muda | Custo |
|---|---|---|
| **(i) não sai** | `produzir()` ganha **uma** pergunta ("esta fazenda tem campo colhível?"); um sistema pequeno avança o estágio dos tiles dela | 1 ramo + 1 sistema + 1 campo de estado. **Zero FSM nova** |
| (ii) sai | FSM nova (`indo_ao_campo`, `arando`, `semeando`, `colhendo`, `voltando`), o ocupante anda enquanto o prédio continua "ocupado" | 5 estados, e **todo predicado que lê `ocupante`** passa a ter de responder "ocupado, mas fora" — inclusive o painel da F16b, o alerta da F22 e a demolição |

**Recomendação: (i) na Fase B, com (ii) registrada como saída.** É o mesmo
argumento que você usou para mandar a F18g para o fim da fila: o ganho de ver o
roceiro andando é **visual**, o custo é de feature grande em `sim/`, e o jogo
ainda não tem comida. Se um dia (ii) entrar, ela não invalida nada de (i): os
tiles, os estágios e o dono continuam iguais — o que muda é **quem** avança o
estágio.

---

## 5. O ciclo do milho (ponto 3, segunda metade)

**Estágio por tile**, um inteiro, com as durações em `data/`:
`arado (0) → semeado (1) → crescendo (2) → maduro (3) → colhido → volta a 0`.
Colher **consome** o estágio: o tile volta ao começo e precisa ser arado de novo.
É a rotação do original **sem terreno variado** — não existe fertilidade, não
existe tile bom e tile ruim; o que roda é o relógio do próprio tile.

A alternativa barata (campo **permanente**, só porta de entrada) tem um defeito
que mata: depois do primeiro tick o campo não faz mais nada, e o aceite não
consegue distinguir "campo" de "flag ligada". Se o campo não tem ciclo, ele não
precisava ser tile.

---

## 6. O aceite, escrito para não passar por acidente (ponto 4)

**Duas pernas, as duas obrigatórias, medidas contra o tick 0** — não contra zero:

- **(a) a perna que muda o comportamento.** Fazenda completa, ocupada, ligada por
  estrada, com **ZERO campos** → 600 ticks → `corn` no armazém **igual** ao do
  tick 0, e o rótulo do roceiro é **`esperando_insumo`** — o mesmo estado que o
  veio esgotado já usa (`veioEsgotado`, F15a/D2): o insumo que não vem. Sem
  estado de FSM novo, e sem rótulo novo para causa que já tem um.
- **(b) a perna que prova que não quebrou.** Mesma fazenda **com campos** → `corn`
  no armazém **maior** que o do tick 0, e os estágios dos tiles andaram.

Sem a perna (a), o teste **passa hoje**, sem uma linha de código nova — é
exatamente a armadilha que fez esta proposta existir.

**Guarda estrutural, além do cenário:** um teste que prove que o caminho de
produção da fazenda **consulta os campos** por igualdade de predicado (chamar a
função com e sem campo e comparar o resultado), nunca varrendo o fonte atrás de
substring.

---

## 7. A vinha / canavial (ponto 4, segunda metade)

O tema virou **Canavial** / **Cachaça**, mas o id da sim segue `wineyard` /
`wine`, e `terrain.json` já diz: **9 tiles**, **1 timber por campo**.

Se o milho passa a ser área derivada com dono, o canavial **tem de seguir a mesma
regra** — senão são duas mecânicas para a mesma coisa. Só que o campo de uva
**custa material por tile**, e material que sai do armazém e chega a um **tile**
é exatamente a tarefa com destino-tile da **F18g**, que você mandou para o fim da
Fase B.

**Proposta: a F18 cobre só o milho (custo zero).** O canavial entra **junto com
ou depois da F18g**, e o item registra a dependência. Sem essa linha, a F18 puxa
a F18g para dentro por acidente — que é o oposto da decisão que você acabou de
tomar.

---

## 8. Quebra em sub-itens (não cabe numa sessão)

- **F18-1 — O milho depende do campo (sim).** Estado `campos`, derivação da área
  na conclusão da obra, estágio por tile, a fazenda sem campo não produz,
  demolir a fazenda apaga os campos dela. Aceite: as duas pernas da §6.
- **F18-2 — Os campos e seus estágios na tela (render).** Os quatro estágios
  desenhados, a ponte de debug contando por estágio, screenshot.
- **F18-3 — (só se o playtest pedir)** rendimento proporcional aos campos, e o
  roceiro andando até o tile (a opção (ii) da §4).

---

## 9. F19 — Mill e Bakery: depende da F18?

**Da mecânica de campo, não.** O moinho consome `corn` e a casa de forno consome
`flour`; o sistema de produção é genérico e as **tarefas de insumo entre prédios
já existem** (`src/sim/systems/jobs.ts:84-89`). O teste da F19 pode semear `corn`
no armazém. A dependência real é da **árvore**: `mill.desbloqueadoPor = "farm"`,
então em jogo a fazenda precisa estar de pé — e isso já vale hoje.

**Aviso, e é hipótese nomeada como tal — não medi:** a F19 pode estar na mesma
situação da F18, isto é, **já funcionar sem código novo**. Prédios no dado,
trabalhador `baker` treinável, receita nos dois, tarefa de insumo genérica. Se
for o caso, a F19 é uma feature de **aceite**, não de mecânica.

**Proposta de item para a F19:** a primeira tarefa é **medir** — montar o cenário
`corn → flour → loaves` com entregas e dizer o que falta. Se não faltar nada, o
item vira o teste, a evidência e o registro de que a cadeia já fechava; se
faltar, o que falta vira o escopo. Isso fica **escrito no item**, não descoberto
no meio da sessão.

---

## 10. O que só você decide

1. A correção do GDD §5.4 ("arado por laborer" → fazendeiro): eu atualizo a linha
   ou você prefere que o item só registre a divergência?
2. `tilesPorFarm: 15` é **número exato** ou **máximo**? (proposta: máximo, com
   mínimo 1 para produzir)
3. Rendimento **binário** ou proporcional ao número de campos? (proposta:
   binário; proporcional vai para o `BALANCE_LOG.md`)
4. `campos` fica em `terrain.json` e sai de `production.json`? (proposta: sim)
5. O canavial espera a F18g? (proposta: sim)
6. A quebra F18-1 / F18-2 / F18-3 está aprovada, e a F18-1 é a próxima da fila?
