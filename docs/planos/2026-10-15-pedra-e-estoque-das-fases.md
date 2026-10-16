# Pedra em todas as fases e o estoque inicial (2026-10-15)

Pedido do operador (2026-10-15): "as fases da campanha não possuem os recursos naturais como pedra. Faça uma
análise do nível de dificuldade incremental em cada uma das fases seguindo a lógica do KaM Remake (ex.: apenas a
partir da fase X tem ferro e carvão para construir dinheiro e armas de ferro). Porém em todas as fases do jogo
pedra deve existir. Preste atenção também ao balanceamento dos recursos iniciais do jogador (pedra, madeira e
comida)."

## 1. O que a medida mostra (verificado, sonda de 2026-10-15)

Pedra declarada no mapa de cada fase (`recursos.rock`, 15 pedras por tile, `data/resources.json`) e quantos desses
tiles o jogador vê no tick 0 (`ehDescoberto` sobre `criarFase`):

| Fase | Modo | Tiles de pedra | Pedra no mapa | Vistos no início | Pedra mais perto do armazém | Estoque de pedra |
|---|---|---|---|---|---|---|
| 1 Piancó | construir | 16 | 240 | **0** | 28 tiles | 10 |
| 2 Patos | construir | 65 | 975 | **0** | 27 | 20 |
| 3 Soledade | construir | 61 | 915 | 21 | 17 | 30 |
| 4 Boqueirão | construir | 30 | 450 | 4 | 3 | 25 |
| 5 Campina Grande | construir | 68 | 1 020 | **0** | 17 | 25 |
| 6 Areia | construir | 45 | 675 | **0** | 24 | 25 |
| 7 Itabaiana | lutar | 20 | 300 | 0 | sem armazém | — |
| 8 Santa Rita | construir | 42 | 630 | 21 | 27 | 20 |
| 9 João Pessoa | lutar | **0** | 0 | 0 | sem armazém | — |
| 10 Cabedelo | lutar | **0** | 0 | 0 | sem armazém | — |

A rua custa 1 pedra por tile (`data/terrain.json > estrada.custoStonePorTile`). Na fase 1, lenhador, pedreira e
serraria custam 7 pedras (`data/buildings.json`), e o jogador começa com 10: sobram 3 pedras de rua para um lajedo a
28 tiles. **A pedreira não se liga ao armazém, e a economia da fase 1 trava por construção.** O desenho da campanha
(`docs/planos/2026-10-10-campanha-dez-fases.md` §3) já pedia "a poucos tiles, árvore e pedra para os dois primeiros
prédios"; o gerador não cumpriu nas fases 1, 2, 5 e 6.

## 2. A lógica do KaM

O clone do KaM Remake não tem as missões da campanha original (são dados do jogo de 1998), então nada aqui é citação
conferida: é **referência de design**, hipótese até ser conferida numa fonte.
- A pedra e a madeira são a base de toda missão de construir: aparecem perto do início sempre.
- O minério segue a liberação: o carvão e o ouro chegam com o garimpo e a fundição de ouro, e o ferro chega quando
  a missão libera a mina e a fundição de ferro. Depois de liberado, o recurso volta nas missões seguintes de
  construir, longe do início.
- A dificuldade cresce pela pressão do inimigo e pelo terreno, não por esconder o recurso básico.

## 3. A curva da campanha (o que cada fase libera e o que o mapa precisa ter)

| Fase | Libera (cadeia nova) | Minério no mapa (regra) | Pressão inimiga (medida) |
|---|---|---|---|
| 1 | pedra, madeira, armas de pau | nenhum | 6 no mapa + 3 ondas (12) |
| 2 | comida, couro | nenhum | 12 no mapa, prazo |
| 3 | ouro, carvão, fundição de ouro | ouro e carvão | 30 no mapa + 1 onda |
| 4 | peixe, açude, torre | ouro e carvão | 6 ondas (36) |
| 5 | feira | ouro e carvão | 12 ondas (36) |
| 6 | ferro, ferraria | ouro, carvão e ferro | 28 no mapa |
| 7 | armas de ferro (lutar) | — | 23 no mapa |
| 8 | cocheira (cavalaria) | ouro, carvão e ferro | 20 no mapa, prazo |
| 9, 10 | (lutar) | — | 20 e 26 no mapa |

Regra: **antes da fase 3, nenhum minério; da 3 em diante, ouro e carvão em toda fase de construir; da 6 em diante,
também ferro.** O minério fica sempre longe do início (a convenção do desenho), a pelo menos 25 tiles do armazém.
Hoje faltam ouro e carvão nas fases 4, 5 e 8, ouro na 6, e ferro na 8.

## 4. O estoque inicial

Critério:
- **pedra** = o núcleo (lenhador + pedreira + serraria, 7) + a rua até o lajedo da vila (até 12) ≈ 20 na fase 1;
  +5 por degrau da campanha, até 30, porque cada fase abre mais cadeias de uma vez. Nunca desce entre fases de
  construir seguidas, exceto a 8, que é uma incursão com prazo e começa com cavalaria.
- **madeira**: 25 na fase 1, 30 do ato I ao II, 35 a partir da fase 5 (mais cadeias para abrir).
- **comida** (pão + linguiça): pelo menos uma refeição por unidade inicial (civis e militares).

| Fase | Pedra antes → depois | Madeira antes → depois | Comida antes → depois (unidades) |
|---|---|---|---|
| 1 | 10 → **20** | 25 | 10 (10) |
| 2 | 20 → **25** | 30 | 18 (17) |
| 3 | 30 | 30 | 25 → **28** (27) |
| 4 | 25 → **30** | 30 | 30 (25) |
| 5 | 25 → **30** | 35 | 32 (29) |
| 6 | 25 → **30** | 30 → **35** | 35 → **40** (39) |
| 8 | 20 → **25** | 30 → **35** | 40 (20) |

O ouro inicial não muda.
