# F18 — Roçado de milho: o campo vira tile, e o roceiro ara o que colhe

> Plano de implementação da feature já escolhida. O critério de aceite é o que
> está no `BUILD_PLAN.md`, intocado. Escrito antes de qualquer código.

**Objetivo:** a fazenda deixa de produzir milho do nada. Ela passa a depender de
**tile arável ao alcance**, colhe dele, o esgota, e o roceiro — **dentro do
prédio**, que sair é a F-T3 — ara e semeia o tile de volta.

---

## 0. O que foi conferido no arquivo antes de decidir (não herdado de proposta)

| Fato | Onde | Consequência |
|---|---|---|
| `farm` produz `corn` **sem `colheita`** na receita | `data/production.json` | hoje a fazenda tira milho do nada; é o que o aceite tem de matar |
| o terreno `campoArado` existe e tem **130 tiles**, em **dois blocos de 65** (bbox 108,22–117,30 e 73,58–82,66) | `data/maps/sertao-128.json` | há terra arável no mapa, e ela é **longe da vila** (armazém em 29,30). O aceite roda onde a terra está |
| `terrain.json.campos.milho.tilesPorFarm = 15` e `production.json.wineyard.campos/timberPorCampo` | `data/` | **sem leitor** (grep em `src/`). O item manda: ganham leitor ou saem |
| `camadaDoTipo` monta o conjunto de tiles a partir de `dados.mapa.recursos[tipo]`, memoizado por `GameData` | `src/sim/recursos.ts` | a camada de recurso é **estática**. Tile de milho criado em tempo de execução seria invisível para `tilesDeColheita` |
| `recursosIniciais` semeia todo tile com `def.rendimentoPorTile` | `src/sim/recursos.ts` | sem um campo novo, o milho nasceria **maduro**, de graça |
| `codigoDoRecurso` pinta `quantidade <= 0` com `codigoEsgotado` | `src/render/mapa.ts` | o campo em pousio já tem desenho: é o mesmo "havia recurso aqui" do toco |
| `src/ui/alertas.ts` monta uma linha **por causa de `CAUSAS_DE_ALERTA`**, no nascimento | `src/ui/alertas.ts:39` | causa nova aparece no painel **sem tocar em `src/ui/`** |
| só `tests/F06-build.test.ts` e `tests/F12-desbloqueio.test.ts` citam `farm`; ninguém afirma o texto "O veio secou" | `tests/`, `tools/` | superfície de regressão pequena |

---

## 1. As decisões, com o motivo

**D1 — O tile arável é o TERRENO `campoArado`, e a camada de milho é DERIVADA
dele no carregamento.** Não edito o arquivo de mapa nem o gerador: o mapa é
emitido com semente, e mexer no gerador arrisca deslocar rocha, árvore e cardume
e quebrar fixtures que não têm nada com esta feature. `resources.json` ganha
`tipos.corn.terreno = "campoArado"`, e o carregador monta `mapa.recursos.corn` a
partir das linhas do mapa. Isso **dá o leitor** que faltava ao terreno arado
(hoje ele só existe na matriz de custo, que o A* nem alcança) e mantém uma
verdade só: onde é arável é o terreno que diz.

**D2 — O campo nasce em POUSIO (`quantidadeInicial: 0`), não cheio.** Regime
`porAcao`: entrada com `0` significa "arável, por semear" — exatamente a
distinção que `resources.json` já documenta para a árvore cortada. O primeiro
ciclo de toda fazenda é de **plantio**, e não de milho grátis. `rendimentoPorTile`
continua sendo quanto o tile dá quando está maduro.

**D3 — "Espera crescer" é a DURAÇÃO do ciclo de plantio, não relógio por tile.**
O tile guarda só `quantidade`; pôr `maduroEm` em cada tile custa um campo de
estado por tile e é o que `regenerar` já se proíbe ("sem relógio por tile"). Arar,
semear e esperar crescer viram **um ciclo** do roceiro, com duração em
`resources.json`. É a interpretação conservadora do CLAUDE.md §14, e é a mesma
abstração de tempo que a Nota do próprio item já assume enquanto o roceiro não
sai do prédio.

**D4 — A reserva do tile em plantio mora no PRÉDIO (`producao.plantio`), e não
numa tarefa nova do quadro.** É desvio consciente do que a F-T2c fez para a
colheita, e o motivo é que os dois casos são diferentes: tarefa de colheita
existe porque **duas pedreiras** podem mirar o mesmo tile, e ela carrega um
caminho de `release` a errar. Aqui o único pretendente possível é o próprio
prédio que está plantando, não há viagem, e demolir o prédio **some com a
reserva** sem nenhum ramo de erro. O que a F-T2c conquistou continua valendo
porque `tilesReservadosParaColheita` passa a devolver a **união**: tiles de
tarefa de colheita **mais** tiles em plantio. Duas fazendas vizinhas continuam
sem poder trabalhar o mesmo tile.

**D5 — Um predicado só, dos dois lados: TILE TRABALHÁVEL.** Um tile ao alcance é
trabalhável quando tem entrada daquele recurso **e** (tem o ciclo inteiro **ou**
o tipo tem `reposicao`, isto é, este prédio pode repô-lo). `semRecursoAoAlcance`
passa a perguntar isso. Sem isso a fazenda em cima de 65 tiles arados pararia
como "veio esgotado" no tick seguinte à primeira colheita, e esperaria o que ela
mesma iria plantar — é o travamento de regra que já mordeu antes.

**D6 — A prévia da F-TP conta pelo mesmo predicado, e por isso `src/render/` não
muda.** A contagem já vem de `colheitaAoAlcanceDaCaixa`, dentro de `sim/`;
mudando o predicado lá, a prévia da fazenda passa a dizer "N ao alcance" sobre
terra arada em pousio, que é o que o jogador precisa ver antes de plantar. Para
a pedreira nada muda (rocha não tem `reposicao`, então trabalhável = tem pedra).
**Esta feature não toca em `src/render/` nem em `src/ui/`** — só `sim/`, `data/`,
`tests/` e `tools/`.

**D7 — Causa de alerta PRÓPRIA: `sem-campo`.** "O veio secou" numa fazenda é
mensagem de pedreira. As duas situações têm predicados que se excluem por
construção — o recurso do prédio **tem** `reposicao` (campo) ou **não tem**
(veio) — então dá para separar compondo o estado que já existe, e separar é o que
o item pede ("o teste afirma a causa"). `src/ui/alertas.ts` gera a linha sozinho a
partir de `CAUSAS_DE_ALERTA`; o custo é uma entrada no tema e um `case` em
`selectors.ts`.

**D8 — Os números órfãos SAEM, e o que eles diziam vira o que tem leitor.**
`terrain.json.campos` inteiro sai: `tilesPorFarm` deixa de ser verdade (quantos
tiles a fazenda alcança é `alcance_tiles` × mapa) e `custo` vira
`resources.json.tipos.<t>.reposicao.custo`, que **tem** leitor (o ciclo de
plantio cobra). Em `production.json.wineyard`, `campos` e `timberPorCampo` saem
como campo e ficam como **frase** em `notas`: prosa não é regra fantasma, e o
número da uva não se perde para quando o Wineyard existir.

---

## 2. Arquivos

- `data/resources.json` — tipo `corn`; campos novos por tipo: `terreno`,
  `quantidadeInicial`, `reposicao { segundos_base, custo }`.
- `data/production.json` — `farm.colheita`; `wineyard` perde dois campos.
- `data/terrain.json` — `campos` sai.
- `data/theme-sertao.json` — cor e nome do milho; rótulo da causa `sem-campo`.
- `tools/data-schema.js` — os caminhos novos; `validate:data` tem de reprovar
  quem esquecer.
- `src/sim/data/types.ts` — `TipoDeRecurso` ganha os três campos.
- `src/sim/data/loader.ts` — deriva `mapa.recursos[tipo]` do terreno; converte
  `reposicao.segundos_base` em ticks **uma vez**, no carregamento.
- `src/sim/recursos.ts` — `tileTrabalhavel`, `reporNoTile`, união da reserva,
  `recursosIniciais` com `quantidadeInicial`.
- `src/sim/producao.ts` — `semRecursoAoAlcance` pelo predicado novo.
- `src/sim/state.ts` — `producao: { progresso, plantio }`.
- `src/sim/systems/especialistas.ts` — o ciclo de plantio.
- `src/sim/selectors.ts` — causa `sem-campo`.
- `tests/F18-rocado.test.ts` — o aceite.
- `tools/shots/F18.js` — o campo na tela.

---

## 3. Tarefas

### Tarefa 1 — o dado: milho, terra arada e o que some
Escrever `corn` em `resources.json` (`regime: porAcao`, `terreno: campoArado`,
`quantidadeInicial: 0`, `rendimentoPorTile`, `reposicao`), `farm.colheita` em
`production.json`, tirar `terrain.json.campos` e os dois campos do `wineyard`,
pôr cor/nome do milho e rótulo de `sem-campo` no tema, e atualizar
`tools/data-schema.js`. **Verificação:** `npm run validate:data` verde e um teste
que afirma que o schema **reprova** `reposicao` sem `segundos_base` (o guarda tem
de acusar, não só deixar passar).

### Tarefa 2 — carregar: a camada de milho derivada do terreno
`TipoDeRecurso` ganha os campos; o carregador monta `mapa.recursos.corn` varrendo
as linhas do mapa, na ordem de leitura (oeste→leste, norte→sul), e converte
`segundos_base` em ticks com `Math.round`. `recursosIniciais` passa a usar
`quantidadeInicial ?? rendimentoPorTile`. **Verificação:** teste afirmando 130
tiles de milho, todos com `quantidade 0`, que as listas de `rock`/`tree`/`fish`
**não mudaram**, e que a ordem da camada é a mesma em duas cargas.

### Tarefa 3 — o predicado: tile trabalhável
`tileTrabalhavel(state, chave, colheita, minimo, dados)` em `sim/recursos.ts`;
`melhorTileDeColheita` e `colheitaAoAlcanceDaCaixa` passam por ele;
`semRecursoAoAlcance` idem. **Verificação:** pedreira não muda de resposta em
nenhum caso (os testes da F-T2a/c continuam verdes, sem edição), e fazenda com
tile arado em pousio ao alcance **não** está esgotada.

### Tarefa 4 — o ciclo do roceiro
`producao` ganha `plantio: TileDeGrid | null`. Em `produzir`: com plantio em
curso, o relógio corre até `ticksDoPlantio` e no fim o tile vai a
`rendimentoPorTile`; sem tile colhível mas com tile reponível livre, começa um
plantio (cobrando `reposicao.custo`); sem nenhum dos dois, `esperando_insumo`.
`tilesReservadosParaColheita` devolve a união. **Verificação:** cenário headless
de uma fazenda: planta, colhe, esgota o tile, replanta o mesmo tile, volta a
colher — afirmando a sequência de `quantidade` do tile tick a tick.

### Tarefa 5 — o alerta com nome próprio
Causa `sem-campo` em `CAUSAS_DE_ALERTA` e `temCausa`. **Verificação:** fazenda
sem nenhum tile arado ao alcance alerta `sem-campo` e **não** `veio-esgotado`;
pedreira sem rocha alerta `veio-esgotado` e **não** `sem-campo`; e todo rótulo de
causa existe no tema.

### Tarefa 6 — o aceite, escrito como o `BUILD_PLAN.md` pede
`tests/F18-rocado.test.ts`, gravando `test-output/F18.json`:
(a) fazenda posta onde **não há** tile arado ao alcance não produz milho nenhum
em N ticks, e a **causa** no alerta é `sem-campo`;
(b) a mesma fazenda, no mesmo mapa, com terra arada ao alcance, produz milho; a
produção **para** quando os tiles ao alcance zeram e **volta** depois do
replantio — medido contra o tick 0, com o acumulado entregue.

### Tarefa 7 — a tela
`tools/shots/F18.js`: câmera sobre o bloco de terra arada, uma captura com o
campo em pousio e outra depois de o roceiro semear, com a prévia da F-TP sobre a
fazenda dizendo quantos tiles aráveis há ao alcance. Cumpre a §8 (um passo
despausado com `mouse.down`/150 ms/`mouse.up`). Não-regressão por código de
saída: `F22`, `F-T2a`, `F-T2c`.

### Tarefa 8 — fechar
`BALANCE_LOG.md` (a fazenda ficou mais lenta: metade do tempo agora é plantio),
`PROGRESS.md`, `BUILD_PLAN.md` (as Notas que a feature tornou falsas),
`test-results.json` depois do `verify`, commit.

---

## 4. O que esta feature NÃO faz

- **O roceiro não sai do prédio.** É a F-T3, agendada depois da comida.
- **Não mexe no gerador nem no arquivo de mapa.** A terra arada já está lá.
- **Não toca em `src/render/` nem em `src/ui/`.** A prévia e o painel de alertas
  mudam de conteúdo sem mudar de código (D6, D7).
- **Não calibra.** Os números novos são [proposta] e vão em bloco para o
  `BALANCE_LOG.md`, nunca item a item.
