# BUG-X (especialista trabalha fora da casa, na porta) — plano

Pedido do operador (2026-09-30): registrar e trazer plano com aceite antes de código; medida
antes/depois de o especialista na porta bloquear serf; os três casos de saída do KaM; se a
unidade pode ser selecionada enquanto está dentro. Ordem: depois do D-TRANSPORTE-03 T2 e
antes do lote de recalibração do BALANCE_LOG. **Nenhum código antes da aprovação.**

## O que o código faz hoje (conferido em arquivo:linha)

- O especialista chega à porta e a posse passa ao prédio com a unidade onde o caminho
  acabou (`src/sim/systems/especialistas.ts:146-149`). O fim do caminho é a borda sul do
  footprint (`src/sim/footprint.ts:32-39`, `bordaSul`). As trocas de rótulo
  (`trabalhando` / `esperando_insumo` / `saida_cheia`) não mexem na posição
  (`especialistas.ts:206-208`, `comFsm`).
- A COLISÃO já o trata como dentro: `src/sim/colisao.ts`, `POSICAO_DO_ESTADO`, põe
  `trabalhando`, `esperando_insumo`, `saida_cheia` e `comendo` em `'dentro'`; só
  `ocioso` é empurrável. Hipótese a medir (Tarefa 1): o especialista na porta **não**
  bloqueia serf hoje, e o defeito é só de desenho.
- A TELA desenha toda unidade de `estado.unidades.ordem` (`src/render/unidades.ts:252-253`),
  sem olhar se está dentro.
- SELEÇÃO: civil não é selecionável em nenhum estado. `src/main.ts:92-100`
  (`soldadosDoJogador`) filtra o acerto para militar do jogador; clique sobre civil cai no
  prédio do tile. Esconder o especialista não tira seleção nenhuma. Clicar a casa continua
  abrindo o painel do prédio, que já mostra o ocupante (`src/ui/painel-predio.ts:397-405`;
  a referência antiga, `WorldScene.ts:1441-1453`, estava errada — achado do avaliador).
- CASA FECHADA: o nosso "fechar" é o `pausado` da F16c, e a decisão do operador
  (2026-09-23, `docs/planos/F16c-pausar.md` §3) é que o ocupante **fica**, no rótulo
  `trabalhando` (`src/sim/state.ts:537-551`). O KaM tira o trabalhador da casa fechada.

## Os três casos de saída do KaM, contra o nosso

```text
| Caso do KaM                           | Hoje aqui                                   | Depois do BUG-X                   |
|---------------------------------------|---------------------------------------------|-----------------------------------|
| trabalhar fora (lenhador, roça, pesca)| indo_colher/colhendo/voltando/semeando: fora| igual, visível                    |
| mostrar fome                          | vaga o prédio (ocupante=null) e anda: fora  | igual, visível                    |
| casa fechada                          | pausado: fica, rótulo trabalhando (F16c)    | fica, INVISÍVEL; decisão abaixo   |
```

## Desenho (interpretação conservadora)

Só tela, composta de dado que já existe, sem campo novo na sim:

- **Regra de visibilidade.** Uma unidade não é desenhada quando é o `ocupante` de um prédio
  completo e `ocupaTile(u)` é `false` (`src/sim/colisao.ts`, função pura que a tela pode
  ler, como já lê `sim/condicao`). Laborer `nivelando`/`martelando` também é `dentro`, mas
  não é ocupante de prédio: continua visível no canteiro (a obra se vê trabalhar).
- A função fica em `src/render/visibilidade.ts`, pura, testada em Node; a camada de
  unidades (`unidades.ts`) filtra por ela antes de desenhar e antes de montar a lista do
  acerto (`acerto.ts`, entrada `UnidadeDesenhada`), para que clique e desenho não divirjam.
- A casa já anima pelo ocupante (`quadroDeTrabalho`, F-VIVO-b). Isso não muda.
- Posição na sim não muda: o tile da porta continua sendo a posição lógica (é de onde ele
  sai para colher ou comer). Mover a posição para dentro do footprint seria sim + render e
  mexeria em caminho e colisão; fica fora.

## Decisões do operador (2026-10-01), todas do KaM

- **Casa fechada:** o trabalhador sai e fica visível (`KM_Units.pas:529-600`). Entregue a
  parte de tela (ocupante de prédio pausado se desenha). A parte de sim (sair e perder a
  posse) contradiz a F16c (c) e ficou como nota no item F16c do BUILD_PLAN, à espera.
- **Comendo:** anda visível até a Bodega e fica invisível lá dentro. Conferido no fonte
  antes de implementar: `KM_UnitTaskGoEat.pas:99-135` (fase 1 anda até
  `PointBelowEntrance`, fase 2 `SetActionGoIn(gdGoInside, fInn)`, come dentro). Bate.
- **Caso 2:** anima só enquanto está dentro (`ROTULOS_DE_DENTRO` em `trabalho.ts`).

## Decisões que esperavam o operador (texto original do plano)

1. **Casa fechada.** Manter a F16c (fica dentro, invisível) ou seguir o KaM (sai ao
   pausar)? O plano segue a F16c; mudar é item de sim à parte.
2. **Comendo na Bodega.** `comendo` é `'dentro'` na colisão, mas o comensal não é
   `ocupante` da Bodega. Pela regra acima ele continua visível na porta da Bodega. O KaM o
   esconde. Estender a regra ao `comendo` (a Bodega como casa dele no instante) é uma
   linha a mais na função; o plano deixa de fora até a decisão.
3. **F-VIVO-b caso 2** (pergunta em aberto do PROGRESS): com o especialista invisível
   dentro, o prédio que anima enquanto o cabra está no lajedo continua como está; o BUG-X
   não responde essa pergunta, só tira a figura da porta.

## Tarefas e aceite

- **Tarefa 1 — medida ANTES (sonda + teste).** Pelo `step`, na vila da calibração, 8 000
  ticks: conte os ticks em que um serf teve o passo recusado ou replanejado por unidade
  num tile de porta ocupado por especialista `dentro`. Afirmação esperada: **0** (a
  colisão já o trata como dentro). Se sair > 0, a hipótese cai, o defeito é também de sim,
  e **paro e reporto** antes de seguir (a correção muda de natureza).
- **Tarefa 2 — `visibilidade.ts` + teste.** Tabela: ocupante em `trabalhando` /
  `esperando_insumo` / `saida_cheia` → invisível; o mesmo em `colhendo`, `indo_comer`,
  `voltando` → visível; laborer `martelando` → visível; ocupante de prédio pausado →
  visível (decisão do operador acima; o "invisível" da versão proposta caiu). Contraprova: a regra acusa um especialista `trabalhando` que a tela antiga
  desenharia.
- **Tarefa 3 — camada de unidades e acerto.** Filtro nas duas listas. Teste: o acerto não
  devolve unidade invisível sob o ponto.
- **Tarefa 4 — screenshot** (`tools/shots/BUG-X.js`): serraria ocupada produzindo, porta
  vazia; lenhador fora colhendo, visível. Passo 0 mede a posição da unidade no DOM de debug,
  não por olho (regra "causa visual só vale medida"). Um passo despausado, 150 ms segurado,
  se o roteiro clicar a casa (CLAUDE.md §8).
- **Medida DEPOIS.** A contagem da Tarefa 1 repetida: igual (a sim não mudou). Se a
  Tarefa 1 der > 0, esta vira a prova de que caiu.
- Aceites de verificação: `npm run verify` verde; nenhum arquivo de `src/sim` tocado
  (`git diff --stat`); o screenshot aberto como evidência da feature.
