# BUG-C — a pedreira do roteiro da F22 nasce sem veio

> Plano escrito antes do conserto. O conserto em si já estava escrito no
> `BUGS.md` desde o turno H; o que faltava era a **decisão** que o operador pediu
> nesta sessão: cenário no lugar errado, ou alcance pequeno demais?

## A decisão: é (a), cenário no lugar errado

O item deixou as duas hipóteses abertas. A medida separa uma da outra.

### O que foi medido (mapa `sertao-128`, semente 20260924)

Transformada de distância de Chebyshev a partir de todos os 311 tiles de `rock`,
sobre os 11519 tiles pisáveis fora da margem de borda:

```
distância até a rocha mais próxima: média 25,7 · mediana 23 · p90 51 · máx 66
<=  3 tiles:  8,6% da área jogável
<=  6 tiles: 14,5%          <- o alcance de hoje
<= 12 tiles: 26,5%
<= 20 tiles: 45,0%
```

E a rocha é **agrupada, não espalhada**: 11 aglomerados, de 88 e 74 tiles os dois
maiores, 5 o menor. O lajedo da vila é um dos de 13.

### Por que isso é (a) e não (b)

O número que importa não é a distância a partir de um ponto **qualquer** — é
quanto uma pedreira colhe **plantada na jazida**, que é onde o jogador a planta,
porque desde a F-T2a ele vê a rocha na tela antes de plantar. Medido: uma
pedreira encostada no lajedo da vila alcança os **13 tiles inteiros**, 195 de
pedra a `rendimentoPorTile = 15` — praticamente o `veio: 200` fixo que a F15a
tinha antes de o veio sair do prédio e ir para o chão.

O alcance 6 está fazendo exatamente o que a F-T2a quis que ele fizesse: **o lugar
importa**. Subir para 12 dobraria a área plantável (26,5%) ao preço de apagar a
escolha — uma pedreira drenaria o aglomerado inteiro de longe. Isso não é
conserto de bug, é mudar o desenho, e não foi pedido.

A pedreira do roteiro da F22 está a **12 tiles** do lajedo, no meio do pasto, a
leste da escola. Ela não está longe porque o alcance é curto; ela está longe
porque a geometria do roteiro foi escrita na F15a, quando o veio morava dentro do
prédio e o lugar não importava. É cenário.

**Nada vai para `data/`. `quarry.colheita.alcance` continua 6.**

## O conserto

Espelhar a pedreira do roteiro para **oeste** do armazém, mantendo a mesma ideia
de layout ("uma rua só serve os três"), e afirmar a pré-condição no próprio
roteiro.

| hoje | depois |
|---|---|
| `pedreira = { gx: escola.gx + largEs + 1, ... }` → (38,31) | `pedreira = { gx: armazem.gx - largQu - 1, ... }` → (25,31) |
| rua de `armazem.gx` (29) a 40 | rua de `pedreira.gx` (25) a `escola.gx + largEs - 1` (36) |
| corte em 37, entre escola e pedreira | corte em 28, entre pedreira e armazém |

Medido para a âncora (25,31): caixa `gx 25..27 × gy 31..32`, tudo grama, linha de
porta `gy 33` toda grama, sem rocha na linha da rua, e **13 tiles de `rock` ao
alcance 6** — o lajedo inteiro. A folga de 1 tile até o armazém não é estética: é
ela que dá ao corte da rua um tile onde cair sem encostar em porta de ninguém.

A caixa da pedreira cobre 3 tiles do lajedo — (25,31), (26,31) e (25,32).
Conferido que isso é legal: `placement.ts` recusa por terreno, sobreposição,
estrada e porta, e **não** por recurso; e `systems/build.ts` não apaga recurso
nenhum ao erguer. O prédio em cima da pedra colhe a pedra: `tilesDeColheita`
varre a caixa expandida pelo alcance, footprint incluído.

## Tarefas

### Tarefa 1 — o espelho e a pré-condição

1. `tools/shots/F22.js`: bloco de geometria espelhado, com o motivo escrito.
2. Uma afirmação nova, **antes** de plantar: a âncora escolhida tem `rock` ao
   alcance, contado do `data/maps/sertao-128.json` com o alcance de
   `data/production.json` e o tamanho de `data/buildings.json`. Nenhuma
   coordenada digitada. É a pré-condição do cenário, e pré-condição não se deixa
   implícita — foi ela que faltou por três sessões.
3. `npm run shot -- F22` → saída 0, com o aviso único `sem-trabalhador`.

### Tarefa 2 — o fecho

1. `npm run verify` verde.
2. **BUG-C sai do `BUGS.md`** no mesmo commit que o corrige (CLAUDE.md §12).
3. `PROGRESS.md`: a decisão (a)/(b) com a medida que a sustenta.
4. Commit `fix(BUG-C): ...`.

## O que este conserto não faz

- **Não mexe em `data/`.** Nenhum número de balanceamento muda.
- **Não mexe no mapa.** O lajedo continua onde está.
- **Não mexe em `src/`.** O `veio-esgotado` estava certo o tempo todo: aquela
  pedreira nunca ia produzir nada.
