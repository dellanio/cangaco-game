# Diário de balanceamento

Observações sobre ritmo, custo e dificuldade. **Não são bugs** e não entram em
`BUGS.md`.

**Por que separado:** balanceamento corrigido um de cada vez nunca converge —
você ajusta o milho, quebra o pão, ajusta o pão, quebra a fome. Acumule dez
observações, ajuste os dez números juntos, rode o cenário longo uma vez.

Fechado o ciclo, arquive o lote e esvazie a seção de abertas.

---

## Modelo

```markdown
- [data] o que senti jogando | número suspeito | arquivo
- [2026-10-03] pedra acaba antes do 3º prédio | quarry 1.8/min parece baixo | production.json
```

---

## Observações abertas

- [2026-09-20] o bônus efetivo da estrada é 1,4 e não 1,30: estrada 5 ticks/tile, grama 7 (6,5 arredonda para 7)
  | `custoDeMovimento.grama` 1.30 a `tickHz` 10 e escala de movimento 2.0, com um único `Math.round`
  | data/terrain.json, data/time.json (não é bug do loader: é a granularidade de 10 Hz)
  | **decidido pelo operador: fica** — corrigir exigiria mudar `tickHz`, que mexe em tudo, e o excesso favorece a
  estrada, que é a direção certa. Só reabrir se `tickHz` mudar por outro motivo.
- [2026-09-20] 4 serfs levam 5538 ticks (~9 min a 1x) para entregar os 100 materiais de 20 obras de uma vez
  | logística lenta se o jogador planta muitas obras juntas; layout sintético do teste de carga, não partida
  | data/units.json (velocidade a pé 1.0 tile/s) e o número de serfs treinados
- [2026-09-22] com várias obras plantadas e NENHUM material entregue ainda, os laborers acabam todos na ÚLTIMA obra
  plantada, depois de um tempo | sugere que largam a tarefa no meio e reclamam outra — `esperando_material` é o
  único estado que libera (`'pedido-da-unidade'`, que reabre), e sem material nenhuma obra é trabalhável
  | src/sim/systems/laborers.ts, data/construcao.json (`laborersMaximosPorObra`)
  | **verificar na F17**, com estradas e serfs entregando de verdade, ANTES de decidir qualquer regra de
  prioridade — pode desaparecer sozinho quando houver material. Observação do operador; não confirmada por
  execução minha.
  | **[2026-09-23] VERIFICADO na F17, com material chegando — o efeito continua, mas a causa suposta cai.**
  Em 20 amostras seguidas (tick 50 a 1000, de 50 em 50) os DOIS laborers estavam sempre na MESMA obra: nunca
  houve 1+1, e `laborersMaximosPorObra` 4 nunca foi atingido porque só existem 2 laborers. O que NÃO se
  confirmou é "largam a tarefa no meio": cada obra vai até o fim antes de o par migrar — p15 completa no 265,
  p14 no 504, p13 no 786, p47 no 1046. Não é abandono, é atendimento em SÉRIE.
  A ordem é o inverso da ordem de plantio (as três primeiras nascem no mesmo tick 1; eles pegam a última).
  Efeito para o jogador: quem planta A, B, C vê C subir primeiro e A por último. Custo real medido: nenhum —
  serializar 2 laborers é mais rápido que dividi-los. É questão de legibilidade, não de vazão.
  | medido, `test-output/F17.json` (`amostras[].laborersPorObra`, `ordemDeConclusao`)
- [2026-09-22] o veio da Quarry rende 200 pedras: ~33400 ticks, ~55 min de produção contínua na escala 2.0
  | `quarry.veio.rendimento` 200, número de PARTIDA aprovado pelo operador, nunca medido em partida
  | data/production.json
  | **calibrar na F15b**, junto com o resto do lote. A referência é o original: constroem-se várias pedreiras e
  elas se esgotam ao longo da partida — se uma só durar a partida inteira, o número está alto. Aprovado como
  ponto de partida, não como valor final.
  | **[2026-09-23] MEDIDO no cenário oráculo (não mais aritmética):** com veio 20 a pedreira zera no tick 3340 e
  com veio 40 no tick 6680 — 167 ticks por pedra nos dois, exatamente o `ticksDoCiclo`, sem intercepto. O
  pedreiro nunca para no meio (a gaveta escoa pelo nível 6), então a taxa teórica **é** a taxa real neste
  cenário. **Extrapolação declarada:** 200 × 167 = 33400 ticks = 3340 s ≈ **55,7 min de tempo de jogo a 1x**.
  É extrapolação linear de duas medições, não uma corrida de 33 mil ticks — o operador pediu assim para não
  gastar a sessão; se o número parecer fora de escala com o jogo rodando, vale a corrida longa.
  Nenhuma taxa mudou nesta sessão: a decisão do número fica para o lote.
- [2026-09-23] **a proporção 2:1 do GDD §4.5 bate quase no tick**: 2 Woodcutter's a 545 ticks/tronco dão um tronco
  a cada 272,5 ticks, e a Sawmill consome um a cada 273 (`ticksDoCiclo`). Em 3000 ticks o carpinteiro ficou em
  `esperando_insumo` 661 ticks — todos em UMA sequência, no arranque, e zero depois que a primeira entrega
  chegou. | data/production.json | medido, `test-output/F15.json`; o atraso do arranque é logística (o primeiro
  tronco leva 628 ticks para chegar ao armazém), não taxa. Não mexer na receita por causa dele.
- [2026-09-23] **o arranque do oráculo é lento e é transporte, não produção**: primeira pedra no armazém no tick
  207, primeiro tronco no 628, primeiro timber no 968 (≈100 s de jogo até o primeiro timber existir).
  | data/units.json (velocidade a pé), quantidade de serfs | medido, `test-output/F15.json`. Com 4 serfs a fila
  do quadro NUNCA acumulou: em todas as amostras de 100 em 100 ticks havia zero tarefa `aberta`. Se houver
  ajuste a fazer, é no arranque, não na vazão.
- [2026-09-23] **veio esgotado deixa o especialista parado para sempre**: no tick em que o veio zera sai
  `vein-exhausted` e o pedreiro entra em `esperando_insumo` e fica — 1000 ticks depois continua lá, ocupando a
  pedreira. | src/sim/systems (ocupação), não é número | medido com veio curto (zerou no tick 835). Não quebra
  critério escrito nenhum (o aceite fala de `ocioso`), então não é bug: é buraco de desenho, registrado em
  `IDEIAS.md`. Importa para a calibração do veio — quanto mais curto o veio, mais cedo aparece.
- [2026-09-23] **a regra da porta proíbe empilhar prédios em coluna**: a checagem é simétrica (a borda sul precisa
  estar no mapa e livre), então o de baixo cobriria a porta do de cima e o de cima teria a própria porta coberta
  — dois prédios não podem se encostar na vertical, nos dois sentidos. Encostar na horizontal continua valendo.
  A vila pode sair mais esparsa do que o GDD §1.3 sugere. | não é número: é a regra `porta-sem-saida`
  | src/sim/placement.ts, docs/GDD.md §1.3 e §5.1
  | **decidido pelo operador (2026-09-23): a regra fica.** Razão dele: encostar na vertical de fato quebraria a
  entrega, e recusar no clique é melhor que o jogador descobrir que o prédio nunca recebe material — é fiel ao
  original, porta ao sul e estrada obrigatória.
  | **verificar na F17**, montando a abertura recomendada (2 Woodcutter's, 1 Quarry, 1 Sawmill) e vendo se cabe
  confortavelmente. **Se ficar apertado, a saída é reduzir a porta a UMA coluna em vez da borda sul inteira —
  não afrouxar a regra.** Nota pareada no item F17 do `BUILD_PLAN.md`.
  | **[2026-09-23] MEDIDO na F17: coube, e a regra da porta não custou um tile sequer.** Os quatro prédios
  ficaram ENCOSTADOS na horizontal, em fila única — (16,31), (19,31), (22,31), (25,31) — terminando colados no
  armazém, com uma rua reta só na linha de porta (y=33, 19 tiles). A regra proíbe empilhar em coluna, e a
  abertura recomendada não pede coluna nenhuma: uma fila na linha de porta é o arranjo natural e também o mais
  barato em estrada. **Não medi o caso apertado de verdade** (vila grande, várias fileiras) — isso só aparece
  na Fase B, com fazenda e minas. A redução da porta a uma coluna continua sendo a saída SE aparecer; nada
  nesta medição pede que ela aconteça agora.
  O que ficou apertado foi a PEDRA, não o espaço: 19 (rua) + 9 (plantas) = 28 das 30 iniciais.
  | medido, `test-output/F17.json` (`geometria`)
- [2026-09-23] **o ritmo da abertura não é a construção, é a REPOSIÇÃO de pedra**: os quatro prédios da Fase A
  sobem, ocupados, em 1077 ticks (~1,8 min a 1x) — dentro folgado dos 8–10 min que o GDD §1.3 dá para a abertura
  INTEIRA (16 prédios). Mas no tick 917 o armazém chegou a **3 pedras**, com 2 de folga sobre o que a vila gastou,
  e a pedreira repõe uma a cada ~162 ticks (bate com o `ticksDoCiclo` 167 do item do veio). Continuar o §1.3 a
  partir daqui (3 Quarries, mais Woodcutter's) é esperar pedra, não plantar.
  | `quarry` (produção por minuto), `custoStonePorTile` da estrada 1, `estadoInicial.stone` 30
  | data/production.json, data/terrain.json, data/economy.json | medido, `test-output/F17.json`
  (`menorNoArmazem`, `marcos`). A serraria só desbloqueia no tick 504 (precisa de um Woodcutter's COMPLETO),
  então a cadeia da madeira é serial por desenho — isso não é o gargalo; a pedra é.
- [2026-09-23] **"timber acima do inicial" demora 3184 ticks, e quase tudo é a dívida das plantas**: as quatro
  plantas debitam 13 timber ANTES de qualquer produção, então o saldo só passa os 40 iniciais depois de 14
  tábuas entregues. A primeira tábua chega no tick 1488 e a serraria entrega ~1 a cada 120 ticks a partir daí.
  | não é número errado: é o custo de reconstituir o estoque | data/buildings.json, data/production.json
  | medido, `test-output/F17.json`. Registrado porque a leitura ingênua ("a vila levou 5 min para produzir
  madeira") é falsa: a vila produziu a primeira tábua em 2,5 min; os outros 2,8 min foram pagar as plantas.


---

## Ciclos fechados

_(nenhum ainda)_

---

## Oráculo de calibração

Antes de mexer em qualquer taxa, rode o cenário longo e confira contra as
proporções da seção 4.5 do GDD. Um cenário que as respeite **não pode**:

- acumular fila infinita em nenhum prédio
- deixar trabalhador ocioso por muito tempo
- ter `saida_cheia` persistente (isso é logística, não produção — a correção é
  mais serfs ou mais estrada, não mexer na taxa)
