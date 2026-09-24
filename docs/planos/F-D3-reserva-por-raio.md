# F-D3 — Reserva por raio em volta da vila (gerador de mapa)

> Plano escrito antes do código, como manda o turno do operador. O item está em
> `BUILD_PLAN.md` (`#### F-D3`); o escopo e o aceite vêm de lá intocados.

## O que está errado hoje, medido

`tools/gerar-mapa.js` protege **duas regiões** em grama:

1. o quadrante noroeste inteiro até o tile 71 (`LIVRE_A_PARTIR_DE = 72`) —
   31,6% do mapa;
2. uma moldura de 8 tiles em volta do mundo (`MARGEM_DE_BORDA`).

A moldura tem motivo escrito e continua valendo. O quadrante é que é a forma
errada de uma necessidade certa: a vila precisa caber, e por isso o mapa inteiro
em volta dela virou grama até 4,5 km de distância.

**A medida da abertura** (feita fora do navegador, com a mesma aritmética que a
cena usa — `centerOn(centroDaVila)` e o canvas de 1020×682 lido de
`test-output/F18b-shot.json`, onde o scroll inicial é (1602, 1675)):

```
retângulo visível na abertura: gx 25,03..40,97 · gy 26,17..36,83
terreno visível:  { "grama": 176 }          → 1 tipo
recurso visível:  { "rock": 4 }             → 1 tipo (a ponta do lajedo da vila)
```

O aceite pede **≥ 3 tipos de terreno** e **≥ 2 tipos de recurso** nesse
retângulo. Hoje são 1 e 1. Não é opinião sobre paisagem: é a conta.

## A decisão de desenho

### A reserva

Troca-se a faixa por uma **reserva por raio em volta da vila**, e "a vila" é o
conjunto de tiles que ela ocupa — os footprints dos prédios iniciais de
`data/economy.json` mais o tile de spawn —, não o centro dela.

Isso importa e é a única decisão de forma do plano. Um **disco** em volta do
centro (33, 31) precisaria de raio ≥ 4,25 só para cobrir o footprint mais
distante, e com folga de 2 tiles chegaria a 6 — o que empurraria a reserva até
`gy 25`, **acima do topo da tela** (`gy 26,17`). Um disco não deixa nada
visível. O buffer em volta dos tiles ocupados acompanha a forma da vila e libera
a faixa norte, que é exatamente onde há espaço.

- `raio` vem de `data/terrain.json` (`geracao.reservaDaVila.raio`), não do `.js`.
- Distância de Chebyshev (o quadrado em volta), porque é assim que o jogador lê
  "dois tiles de folga" e é como o footprint é medido.
- Dentro da reserva o gerador escreve **só grama e nenhum recurso**. Uma regra,
  sem exceção — e é o que a guarda automatizada afirma.

Com `raio = 2` a reserva é `gx 27..38 × gy 28..34` ∪ `gx 28..32 × gy 35..36`
(o spawn). O **lajedo da vila** (disco de rocha-recurso em (24,31)) fica fora
dela e continua onde está: ele é o que a pedreira corta na abertura.

### Onde a geografia nova pode entrar

Sumir com a faixa não põe nada perto da vila: o lago, a serra, a areia do sul e
os campos arados estão todos escritos em coordenada fixa, longe. A variedade da
abertura tem de ser **autoria**, e o lugar dela não é livre: é onde os cenários
de teste não moram.

Varredura dos pares `gx:/gy:` literais em `tests/`, `tools/shots/` e `src/`:
70 pares distintos, 55 deles no miolo. Eles se concentram em `gy 30..45`
(o pátio dos cenários, ao sul e a leste da vila) e em `gy ≤ 20`. **A faixa
`gy 21..27` entre `gx 18` e `gx 43` não tem nenhum.** E as linhas 26 e 27 dessa
faixa estão dentro do retângulo visível.

Só `agua`, `rocha` e `montanha` são intransponíveis (`terrain.intransponivel`):
areia e campo arado não quebram colocação. Recurso hoje não bloqueia nada — mas
**árvore vira obstáculo na F-T2b**, então árvore obedece à mesma disciplina de
coordenada que o terreno intransponível.

Entram duas coisas, as duas na faixa norte:

| feature | o que dá | onde |
|---|---|---|
| **o açude** — lâmina d'água com praia | `agua`, `areia`, recurso `fish` | elipse a norte, água em `gy 22..27`, praia em volta |
| **o mato do nascente** — aglomerado de árvore | recurso `tree` | disco a nordeste, `gy 21..27` |

Com o lajedo já existente a oeste, a abertura passa a mostrar grama + água +
areia (3 terrenos) e rock + fish + tree (3 recursos). Os números exatos saem da
medida, não daqui: a elipse tem ruído de semente, e o plano não finge saber onde
cada tile caiu.

### O que isto custa, escrito

Sem a faixa, os 14 aglomerados de floresta aleatórios passam a poder cair no
miolo do mapa, inclusive no pátio dos cenários. Hoje isso não quebra nada
(árvore não bloqueia), mas **na F-T2b vai**. Isso vira **Nota no item da F-T2b
do `BUILD_PLAN.md`**, não só linha do `PROGRESS.md`: quem pegar a F-T2b precisa
ler que o mapa mudou de contrato.

## Arquivos

| arquivo | responsabilidade |
|---|---|
| `data/terrain.json` | `geracao.reservaDaVila.raio` — o número, com o `_doc` do porquê |
| `tools/data-rules.js` | regra nova: a reserva existe, é inteira ≥ 0 |
| `tools/gerar-mapa.js` | a faixa sai; a reserva entra; o açude e o mato entram |
| `data/maps/sertao-128.json` | regravado pela mesma semente (20260924) |
| `tests/F-D3-geografia.test.ts` | as duas guardas permanentes (aceite 2 e 3) |
| `tools/shots/F-D3.js` | a medida da abertura no estado vivo (aceite 1) |
| `BUILD_PLAN.md` | a Nota da F-T2b |

Nenhum arquivo de `src/` é tocado — a F-D3 não é feature de integração, e a
medida do aceite 1 já existe no estado publicado (`terrenoVisivel` e
`recursosVisiveis`, da F-T1 e da F-T2a).

## Tarefas

### Tarefa 1 — a reserva vira dado, e a faixa sai

1. `data/terrain.json`: bloco `geracao` com `reservaDaVila.raio` e `_doc`.
2. `tools/data-rules.js`: `validarGeracaoDoTerreno` — o bloco existe, o raio é
   inteiro ≥ 0. Provar que a regra **acusa**: raio `-1` reprova com a mensagem
   escrita; restaurar por igualdade de hash.
3. `tools/gerar-mapa.js`: `LIVRE_A_PARTIR_DE` some. Nasce
   `tilesDaVila()` (footprints de `economy.json` × `tamanho` de
   `buildings.json`, mais o spawn) e `naReserva(gx, gy)`. `por()` e
   `ehGramaLivre()` passam a consultá-la; o cabeçalho é reescrito.
4. Ainda **não** regravar o mapa: a Tarefa 1 termina com o gerador rodando e o
   `--conferir` reprovando de propósito.

### Tarefa 2 — a geografia da abertura

1. O açude e o mato, com coordenada e raio escritos no gerador junto do motivo
   (são autoria, como o lago e a serra já são — o que é **dado** é a reserva).
2. `node tools/gerar-mapa.js` e medir com o script de bancada até o retângulo da
   abertura ter ≥ 3 terrenos e ≥ 2 recursos com folga (não no fio).
3. Conferir que nenhum dos 55 pares literais da varredura caiu em terreno
   intransponível ou em árvore.

### Tarefa 3 — as guardas permanentes

`tests/F-D3-geografia.test.ts`:

1. **mesma semente = mesmo arquivo**: `serializar(montarArquivo())` igual, byte
   a byte, ao `data/maps/sertao-128.json` do disco (aceite 3). É o
   `--conferir` virado teste, e por isso ele passa a rodar no `npm run verify`.
2. **a vila cabe** (aceite 2): a partir de `createInitialState()`, nenhum tile
   de footprint dos prédios iniciais e nenhum tile de estrada inicial tem
   terreno intransponível nem recurso. Usa `ehTransponivel` e `recursoNoTile`
   — o predicado do runtime, não uma releitura do JSON.
3. **a reserva vale**: todo tile a até `raio` de um tile da vila é grama e não
   tem recurso. O raio vem de `gameData.terreno`; o teste não digita 2.
4. Provar que cada guarda acusa antes de fechar.

> `state.estradas` nasce vazio (`src/sim/state.ts`) — conferido, não suposto.
> A perna "nem sob a estrada inicial" do aceite é hoje verdadeira por vacuidade;
> a guarda é escrita varrendo `state.estradas`, de forma que ela passe a valer
> sozinha no dia em que a vila nascer com estrada.

### Tarefa 4 — o roteiro, a não-regressão e o fecho

1. `tools/shots/F-D3.js`: na abertura, ainda no tick 0, ler `terrenoVisivel` e
   `recursosVisiveis` do estado publicado e afirmar ≥ 3 e ≥ 2 (ignorando a chave
   `esgotado`, que é estado de recurso e não tipo). Screenshot da abertura.
2. Não-regressão: `npm run shot -- F-T1`, `F-T2a`, `F16b` — saída 0.
   `F22` compara-se contra a falha conhecida do BUG-C, não contra 0.
3. `npm run verify`, `test-results.json`, `PROGRESS.md`, commit.

## O que este plano não faz

- **Não corrige o BUG-C.** A pedreira de (38,31) continua sem veio ao alcance
  se a geografia nova não passar por perto. O item diz que a correção espera a
  F-D3 para não mover a pedreira duas vezes: aqui a F-D3 só **mede** se o
  defeito sobreviveu, e registra o número.
- **Não mexe no lago, na serra, na areia do sul nem nos campos arados.** Eles
  continuam onde estão, com as mesmas coordenadas.
- **Não muda `src/`.**

---

## O que a execução mudou no plano (2026-09-24)

Este plano foi escrito antes do código, e três decisões dele não sobreviveram à
medida. Ficam aqui com o motivo, porque o texto acima seria mentira sem isto.

### 1. `raio = 2` virou `raio = 3`, por medida

Com 2, o `F06-build` reprovou com `motivo: 'terreno'`: uma **pedreira** (3×2)
plantada um tile acima do armazém caía na água do açude, porque a reserva
deixava só duas linhas livres ao norte. A folga não existe para o prédio que já
está de pé — existe para o **vizinho que o jogador vai plantar ao lado dele**.
Três é o menor número em que o teste passa.

### 2. "Dentro da reserva o gerador escreve só grama e nenhum recurso" virou duas regras

A regra única reprovou a `F-T2a` (`expected 12 to be 13`): o anel apagou o tile
(24,29) do lajedo da vila, que é a ponta de pedra que a pedreira da abertura
corta. O aceite 2 nunca falou do anel — ele fala do **footprint**. Então:

| região | terreno | recurso |
|---|---|---|
| `OCUPADOS` — footprint dos prédios iniciais + spawn | só `terrenoPermitido` | **nenhum, nunca** |
| `RESERVADOS` — o anel de `raio` em volta | só `terrenoPermitido` | só `recursoPermitido` |

- `terrenoPermitido: ["grama", "areia"]` — areia se pisa e se constrói, então a
  praia do açude pode entrar na folga. Quem garante que a lista continua segura
  não é o bom senso de quem a edita: é a regra de `validate:data` que **recusa**
  qualquer terreno que `terrain.intransponivel` liste.
- `recursoPermitido: ["rock"]` — o que a folga barra é o que **impede a vila de
  funcionar**: terreno que não se pisa e recurso que vira obstáculo (a árvore, a
  partir da F-T2b). Pedra é matéria-prima, e é exatamente o que a abertura
  precisa ter ao alcance.

### 3. A faixa fazia três trabalhos, não um

Tirá-la expôs os outros dois, que ninguém tinha escrito em lugar nenhum:

1. manter a vila construível — o que o plano previa;
2. manter o mundo dos cenários de teste em grama uniforme — o açude inundou a
   porta de três cenários (`F10-desempate`, `F10-falhas`, `F18e`) antes de as
   bordas dele virarem `gx ≥ 27` e `gy ≥ 24`, cada borda com a medida ao lado
   no gerador;
3. **limitar o tamanho do arquivo de mapa** — os 14 aglomerados de floresta
   passaram a pegar todos, a camada de recurso foi a 1133 tiles / 44,1 KB e
   estourou o teto de 40 KB que a `F-T2a` mede. Viraram 10, e isso está no
   `BALANCE_LOG.md`.

A faixa `gy 21..27` que o plano dizia livre não era: as coordenadas dos cenários
não são só literais, elas também são **computadas** (a `F18e` anda `dx = 12` a
partir de (10,20); a `F10-falhas` planta no terceiro tile de um caminho vivo), e
um retângulo de prédio 3×3 custa **quatro** linhas de mapa — três de prédio mais
a linha da porta, embaixo. Varredura de par literal não enxerga nada disso.

### 4. Uma guarda que passava sem olhar

O oráculo de propriedade da `F10-astar` tratava **todo tile livre como grama** —
e acertava só porque a faixa mantinha o quadrado inteiro do sorteio em grama.
Ele agora lê o terreno pelo nome (`tipoDoTile`) e indexa as tabelas de custo do
JSON por conta própria, nunca os vetores já indexados do A*, para que os dois
ainda possam discordar. Isto é conserto de guarda, não de asserção.

### 5. O aceite 1 não se mede contando chaves

`contarTerrenoVisivel` e `atualizarRecursos` (`WorldScene.ts`) **zeram todo tipo
conhecido** antes de contar, para o roteiro poder afirmar `agua === 0` sem se
preocupar com chave ausente. Logo `Object.keys(terrenoVisivel).length` é
constante: contar chave daria 6 terrenos numa tela inteira de grama e o aceite
passaria sozinho. O tipo presente é a chave com **contagem maior que zero**, nos
dois roteiros que a F-D3 tocou.

### 6. O BUG-C sobreviveu, medido

Zero tiles de `rock` ao alcance 6 da pedreira de (38,31), o mesmo de antes; o
mais próximo está em **(26,31), a 12 tiles**. O lajedo da vila não se mexeu (13
tiles, `gx 22..26 × gy 29..33`). O conserto já escrito no `BUGS.md` continua
válido e deixou de esperar a F-D3.
