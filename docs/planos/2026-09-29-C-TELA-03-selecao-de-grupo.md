# C-TELA-03 — seleção de grupo pela caixa (ui + input)

Pedido do operador (2026-09-29): "Não consigo pegar o exército inteiro — tenho que mover um por
um." **Aceite:** um roteiro que arrasta sobre a tropa de 18 e move os 18.

## O que a F26b (selecionar pela tela) já faz

- O **clique esquerdo de mão vazia** pega o soldado sob o pixel, acertando pelo quadrado
  desenhado dele (`render/acerto.ts`, `unidadesNoPonto`). Com **shift**, soma ao grupo.
- O **arrasto** de mão vazia além de `LIMIAR_DA_CAIXA_PX` (8 px) vira uma caixa
  (`input/colocar.ts`), e a caixa pega **quem tem o CENTRO desenhado dentro dela**
  (`unidadesNaCaixa`).
- O **botão direito** manda o grupo inteiro: `MoveUnits` com todos os ids, ou
  `AttackBuilding` sobre o prédio inimigo. A sim move os 18, o que medi com uma sonda
  headless: 18 de 18 em `marchando`, para três destinos, sem recusa.

## O que falta: medido, não suposto

Rodei o roteiro com o arrasto do jeito que a mão faz, despausado e com o botão seguro:

| arrasto | pegou |
|---|---|
| começando **em cima** do cabra do canto | **15 de 18** |
| de baixo-direita para cima-esquerda, com folga | 18 |
| com a câmera afastada (zoom 0,75), com folga | 18 |

1. **A caixa exige o centro.** A mão começa a caixa em cima do soldado da ponta, porque é
   ali que a tropa "começa". Com isso o centro dele, e o centro de todos da mesma fileira
   ou coluna, fica fora da caixa. A tropa de 18 é um bloco de 9×2 colado: sobra sempre
   uma fileira ou uma coluna. É o "move um por um": o que ficou de fora tem de ser pego
   depois.
2. **A tela de ajuda (H) não conta** que a caixa e o botão direito existem. Ela só lista a
   câmera e o tempo. O próprio `atalhos.ts` registra que o operador só descobriu o arrasto
   da câmera "quando alguém contou".

## O desenho

- `unidadesNaCaixa` passa a pegar a unidade cujo **quadrado desenhado** (lado
  `tilePx × LADO_DA_UNIDADE_EM_TILES`, o mesmo do clique) **toca** a caixa. O clique e a
  caixa passam a concordar: o que o clique acerta, a caixa que passa por cima também pega.
  É o padrão de RTS: encostou no boneco, pegou.
- `input/atalhos.ts` ganha o grupo `tropa`, com dois gestos:
  - `selecionar-tropa`: "Botão esquerdo, arrastando", que pega os cabras dentro da caixa
    (com shift, soma);
  - `ordenar-tropa`: "Botão direito", que manda o grupo marchar, ou atacar a casa inimiga.
- `data/theme-sertao.json` (`ajuda.grupos`, `rotulos`, `gestos`) recebe os textos. O
  F-D1 (tela de ajuda) já prende tema e inventário um ao outro.

Isto não toca `sim/`.

## Testes

- `tests/C-TELA-03-selecao-de-grupo.test.ts`:
  1. Uma caixa que começa no centro do soldado do canto de um bloco de 9×2 pega os 18.
  2. Uma caixa que só encosta na borda do quadrado pega; uma que passa a um pixel dele
     não pega.
  3. O inventário tem os dois gestos no grupo `tropa`.
- F26b (seleção pela tela): o teste "a caixa pega quem tem o centro desenhado dentro"
  vira "pega quem o quadrado toca". A asserção fica mais estrita: acrescento o caso que o
  centro reprovava e o quadrado aprova, e mantenho o que fica longe.
- Roteiro `tools/shots/C-TELA-03.js`, **aceite**: três caixas despausadas (em cima do
  cabra, ao contrário, afastada), todas com 18, e depois o botão direito. Os 18 marcham e
  os 18 saem do tile em que nasceram.

## PARA REVISÃO

- A caixa que toca pode pegar um soldado vizinho que o jogador não queria, quando as
  tropas estão coladas. É o padrão de RTS, e o shift ou o clique corrigem. Se o playtest
  mostrar pega demais, a troca é um limiar de sobreposição.
- A seleção por duplo-clique ("todos do mesmo tipo na tela") não entra: o operador pediu
  a caixa.

## Revisão durante a execução

O quadrado que toca **não bastou**: o teste headless deu 15 de 18. O desvio do anel da F18f
desalinha vizinhos da mesma fileira em até meio tile (raio de ¼ de tile para cada lado), e
o quadrado cobre só ¼ de cada lado. Troquei o alvo pelo **tile desenhado** (o tile
interpolado, sem o desvio): o anel nunca tira o desenho do tile, então caixa de soldado a
soldado pega o bloco. O clique continua no quadrado, porque ali a precisão importa.
