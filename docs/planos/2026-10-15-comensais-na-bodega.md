# Os comensais à mesa da Bodega (2026-10-15)

Pedido do operador (2026-10-15): "as unidades estão praticamente só encostando no inn e já ficam saciadas.
Precisa ter o tempo de alimentação delas, de preferência animação delas sentadas na mesa comendo".

## 1. O que já foi entregue

`I-COMIDA-REFEICAO-COM-TEMPO` (sim): o civil fica `comendo` 58 ticks por comida na escala 2 (11,6 s numa refeição
de duas comidas), parado e invisível dentro da Bodega. O tempo é o do KaM
(`src/units/tasks/KM_UnitTaskGoEat.pas:139`).

## 2. A arte (Codex)

Uma figura genérica de comensal sentado, voltada para a direita (a tela espelha), em 4 quadros de 64x96 em
laço, no estilo pintado das unidades e com a luz única de cima, levemente do sul. O pedido inteiro está no
prompt entregue ao Codex (as candidatas ficam em `cangaco-game-candidatos/arte/units/comensal/`). Genérica de
propósito: o KaM desenha o comensal pelo tipo da unidade (`TKMHouseInn.UpdateEater`), mas aqui são oito tipos de
civil, e uma figura só resolve a primeira versão. Uma figura por tipo é versão seguinte.

## 3. A tela (depois da arte)

- Os lugares: quatro, dois em cada mesa, ao lado das âncoras de estoque das mesas que já existem
  (`assets/manifest.json > inn.ancoras.estoque.entrada`, as mesas da `I-TELA-PILHAS-NAS-MESAS-DA-BODEGA`). O
  manifesto ganha `inn.ancoras.comensais` com os quatro pontos e o lado para onde cada um olha.
- Quem senta: as unidades `comendo` cujo tile é o da porta da Bodega, na ordem de `unidades.ordem`, até os
  quatro lugares. Com mais comensais que lugares, os de sobra continuam invisíveis (a sim não tem teto de
  assentos; ver a pergunta abaixo).
- A animação roda pelo relógio da tela, como as outras de unidade.

## 4. Pergunta em aberto (para o operador)

O KaM tem 6 lugares na estalagem (`src/houses/KM_HouseInn.pas:11`), e quem chega com a casa cheia sai com fome.
Aqui não há teto (a D6 da F20b, de quando a refeição durava um tick). Com a refeição durando, o teto passa a
mudar o jogo: limita quantos comem ao mesmo tempo e pede mais de uma Bodega numa vila grande. Fica sem teto até a
decisão.
