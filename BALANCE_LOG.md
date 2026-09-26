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

- [2026-09-24] o terreno passou a existir (F-T1) e viagem deixou de ser linha reta | medido: a
  travessia de 36 tiles ao redor do lago custa **292 ticks** contra **252** no mesmo trajeto sem
  terreno (`test-output/F-T1.json`), 16% a mais só por contornar | `data/maps/sertao-128.json`,
  `terrain.json.custoDeMovimento`
- [2026-09-24] `areia 1.50` e `campoArado 1.45` saíram do papel: até a F-T1 o A* nunca os alcançava,
  e agora a faixa de areia do sul e as duas manchas de solo arado cobram de verdade | ninguém
  calibrou esses dois números contra jogo nenhum — eles vêm da proposta | `terrain.json`
- [2026-09-20] o bônus efetivo da estrada é 1,4 e não 1,30: estrada 5 ticks/tile, grama 7 (6,5 arredonda para 7)
  | `custoDeMovimento.grama` 1.30 a `tickHz` 10 e escala de movimento 2.0, com um único `Math.round`
  | data/terrain.json, data/time.json (não é bug do loader: é a granularidade de 10 Hz)
  | **decidido pelo operador: fica** — corrigir exigiria mudar `tickHz`, que mexe em tudo, e o excesso favorece a
  estrada, que é a direção certa. Só reabrir se `tickHz` mudar por outro motivo.
- [2026-09-23] a estrada PERDE para a grama acima de ~34° de inclinação, e a F18d (entrega de construção em
  modo livre) tornaria isso visível: a rua vira opcional em metade dos traçados
  | passo medido do dado: estrada reta 5 ticks, grama reta 7, grama DIAGONAL 9 — e no modo `'estrada'` a
  diagonal não liga (`tests/F10-astar.test.ts:315`), então a rua é 4-conectada. Para `dx × dy` (`dx ≥ dy`),
  estrada custa `5dx + 5dy` e a perna livre `7dx + 2dy`; empatam em `dy/dx = 2/3`. Aritmética sobre
  `terrain.json` × `time.json` × `units.json`, NÃO `npm run sim`.
  | data/terrain.json (`custoDeMovimento`), data/time.json (`escalas.movimento`)
  | **decidido pelo operador, 2026-09-23: NÃO se conserta com número.** Subir `custoDeMovimento.grama` de 1,30
  para ≥1,45 faria a rua ganhar em todo ângulo, mas desacelera serf, laborer e especialista em 15% para
  consertar geometria. A saída é a **F18e — Estrada diagonal**, promovida do `IDEIAS.md` para a fila por causa
  desta medição. Reabrir só se, com a diagonal ligada, a rua ainda perder em algum ângulo — aí sim é número.
  | **FECHADO na F18e, 2026-09-24, REMEDIDO com o A\* rodando (não mais aritmética):** `test-output/F18e.json`,
  `dx = 12`, `dy` de 0 a 12 — a estrada ganha da grama nos treze ângulos, por 24 ticks constantes (a rua anda
  os mesmos passos da grama e paga 2 ticks a menos em cada um, reto ou diagonal). Não há mais ponto de virada,
  e `custoDeMovimento.grama` fica em 1,30. O teste que mede está em `tests/F18e-diagonal.test.ts` e roda no
  `npm run verify`: se algum ângulo voltar a perder, ele acusa.

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
  | **[2026-09-23] confirmado por sonda:** em 4000 ticks da abertura, os serfs fizeram 88 escolhas e em
  **zero** tick havia tarefa de obra E tarefa para o armazém abertas ao mesmo tempo. A escada de
  `delivery.json` está certa e é inerte na Fase A: nunca há o que desempatar. Ver `PROGRESS.md`,
  "Sonda do operador — prioridade do serf ocioso".
- [2026-09-23] **"timber acima do inicial" demora 3184 ticks, e quase tudo é a dívida das plantas**: as quatro
  plantas debitam 13 timber ANTES de qualquer produção, então o saldo só passa os 40 iniciais depois de 14
  tábuas entregues. A primeira tábua chega no tick 1488 e a serraria entrega ~1 a cada 120 ticks a partir daí.
  | não é número errado: é o custo de reconstituir o estoque | data/buildings.json, data/production.json
  | medido, `test-output/F17.json`. Registrado porque a leitura ingênua ("a vila levou 5 min para produzir
  madeira") é falsa: a vila produziu a primeira tábua em 2,5 min; os outros 2,8 min foram pagar as plantas.

- [2026-09-23] **o enquadramento dos roteiros poe a obra parcialmente ATRAS do painel "Construir"**: foi validado
  na F16b, quando a obra era um retangulo simples e a sobreposicao nao escondia informacao nenhuma. Depois disso
  a obra ganhou o medidor de material (F17b) e o canteiro de nivelamento (F17d), e a F17e acrescenta cinco
  estagios visuais — o mesmo canto da tela passou a carregar quatro leituras em vez de uma.
  | nao e numero: e a geometria do cenario dos roteiros (posicao das plantas em relacao ao painel lateral)
  | tools/shots/F16b.js, tools/shots/F17b.js, tools/shots/F17d.js
  | **se a F17e precisar mostrar os seis estagios num screenshot, o enquadramento e o primeiro lugar a olhar.**
  Observacao do operador a partir do que relatei ao fechar a F17d; a evidencia ate aqui afirma sobre NUMERO
  (dataset e `window.__cangaco`), nao sobre pixel, entao nenhum aceite escrito depende da sobreposicao hoje.

- [2026-09-24] a pedreira deixou de render o mesmo em qualquer lugar (F-T2a) | medido: `200` fixo
  virou **195** numa jazida densa e **15** numa ponta de rocha isolada, com
  `resources.json.tipos.rock.rendimentoPorTile = 15` e `quarry.colheita.alcance = 6`
  (`test-output/F-T2a.json`) | `data/resources.json`, `data/production.json`
- [2026-09-24] o alcance 6 da pedreira é o número que decide se o lugar importa, e ele nunca foi
  calibrado | com alcance 6 a caixa de colheita tem 13×13 tiles e o melhor sítio do mapa padrão dá
  13 tiles de rocha; alcance menor estreita a escolha, maior a apaga | `data/production.json`
  (`quarry.colheita.alcance`) — **não mexer sozinho**: anda junto com `rendimentoPorTile` e com a
  densidade que `tools/gerar-mapa.js` semeia
- [2026-09-24] `ticksPorUnidadeRegenerada = 3000` (5 min de jogo) está no dado e **nenhum tipo o
  usa**: os três são `nunca`. Número sem efeito hoje | quando o primeiro `porTempo` nascer, é o
  primeiro a conferir | `data/resources.json`

- [2026-09-24] a floresta do mundo foi **re-limitada de 14 para 10 aglomerados** (F-D3) | a faixa
  `LIVRE_A_PARTIR_DE = 72` descartava em silencio os aglomerados que caiam no quadrante noroeste —
  quatro dos catorze, na semente 20260924. Sem a faixa, os catorze passaram a pegar e a camada de
  recurso saltou para **1133 tiles / 44,1 KB**, acima do teto de 40 KB que a F-T2a mede. O teto
  existia, era o descarte que o cumpria sem ninguem saber. Com 10, a camada fica em **935 tiles**
  (`rock 311 · tree 350 · fish 274`) | `tools/gerar-mapa.js` (`for (let i = 0; i < 10 ...)`) —
  **o numero e limite de tamanho de arquivo, nao de densidade de floresta**: o dia em que o teto da
  F-T2a subir, ele volta a ser escolha de paisagem

- [2026-09-24] **duas pedreiras que dividem o mesmo lajedo nao se revezam: uma produz e a outra
  parece parada sem motivo** | nao e numero errado e nao e pendencia tecnica — e o que o jogador ve.
  Desde a F-T2c o tile e reserva exclusiva de quem esta cavando nele (o aceite pede isso), e o
  desempate e a ordem de `unidades.ordem`: o mesmo pedreiro pede primeiro a cada ciclo, entao a
  segunda pedreira fica em `esperando_insumo` ate o tile secar, sem alerta e sem explicacao na tela.
  Nao e espera indefinida (o tile seca e as duas passam a esgotadas pelo mesmo predicado), e por isso
  nao e bug: e leitura. | `data/production.json` (`quarry.colheita.alcance` 6),
  `data/resources.json` (`rock.rendimentoPorTile`) e a densidade que `tools/gerar-mapa.js` semeia —
  **os tres decidem com que frequencia dois alcances se sobrepoem com UM unico tile em comum**
  | **round-robin entre predios fica FORA**: e mudanca de design, nao ajuste de numero.
  **Verificar no playtest, antes de qualquer coisa:** com a densidade de rocha que o gerador produz
  hoje (311 tiles de rock no mapa padrao) o caso pode ser raro — duas pedreiras vizinhas costumam ter
  varios tiles proprios, e o desempate so aparece quando a intersecao e de um tile so. Se for raro,
  nao se mexe em nada. Se for comum, o primeiro numero a olhar e o alcance, que ja esta neste diario
  como nao calibrado. | observado no aceite da F-T2c (`test-output/F-T2c.json`), em cenario montado
  de proposito para forcar a disputa; **nao medido em partida**

- [2026-09-24] **a terra arável do mapa é pouca e fica longe da vila** | medido: **130 tiles** de
  `campoArado` no mapa inteiro (0,8% de 128²), em dois blocos, o maior com 65 tiles no nordeste —
  a **~80 tiles** da vila de abertura (`tools/shots/F18.js`, `test-output/F18-shot.json`). Toda
  fazenda vai nascer longe, e a estrada até ela é o custo real da comida. É o mesmo formato do
  problema da rocha que virou a F-TP (11 lajedos, 85,5% do mapa sem nenhum ao alcance), e o número
  a olhar é do **gerador de mapa**, não da receita | `data/maps/sertao-128.json`
- [2026-09-25] **o número acima, refinado, e a conclusão dele é mais dura: não existe fazenda
  possível perto da vila** | medido nesta sessão varrendo as 16 384 posições do mapa com o alcance
  real da receita (`farm.colheita.alcance_tiles = 4`, do footprint): **748 posições** (4,6 %) têm
  ao menos um tile arável ao alcance, e a mais próxima do armazém da abertura está a **37 tiles**
  (Chebyshev; a mancha mais próxima começa em 42). A fazenda posta na aldeia, ocupada e ligada por
  estrada, fica **3000 ticks com as gavetas vazias** e o alerta `sem-campo`. O ajuste aqui não é de
  número de receita: ou o gerador espalha terra arável, ou o jogador ganha ferramenta para criá-la —
  e o operador já decidiu pela segunda (`docs/planos/campo-desenhado-pelo-jogador.md`) |
  `data/maps/sertao-128.json`, `tools/gerar-mapa.js`
- [2026-09-25] **a mesma queda, medida no oráculo e não só no cenário de teste** | `npm run sim --
  oraculo --ticks 3000/6000/9000`: o estoque de `stone` sai de **30** no tick 1 (linha de base, não
  zero) e sobe **+11, +12, +12** por bloco de 3 000 ticks, ou seja **~250 ticks por pedra** —
  2,4 pedras por minuto com uma pedreira. Contra os **167** de `ticksDoCiclo` é **1,50×**, e a
  diferença para o 1,59× do cenário de teste é exatamente o que o item acima diz: a viagem é
  geografia. O número "antes" **não existe medido** neste cenário — o plano supunha um "pedra por
  minuto da F19" e o `grep` não achou nenhum —, então o par honesto é
  `ticksDoCiclo` (dado) contra intervalo de entrega (medido), e não uma corrida velha contra uma
  nova | `production.json:predios.quarry`
- [2026-09-25] **o oráculo não serve para medição longa: a população morre de fome nele** | medido
  na mesma corrida: aos **11 500** ticks os quatro ocupantes estão nos prédios; aos **12 000** não
  há um civil vivo e as quatro tarefas de `ocupar` estão abertas, com **15 pães e 10 carnes
  paradas no armazém**. Não é bug da F20 nem da F-T3: `cenarioOraculo`
  (`tests/helpers/producao-cenario.ts`) **não tem Bodega**, e desde a F20a comer exige `inn`
  completa (`src/sim/systems/fome.ts`, `ehBodegaCompleta`) — comida em armazém sem Bodega é comida
  que ninguém alcança. A consequência prática é de medição: **12 000 ticks de oráculo medem uma
  aldeia que morreu no meio**, e foi por isso que a medida acima para em 9 000. O aviso está escrito
  também no próprio `cenarioOraculo`, que é onde a próxima sessão vai medir | `condition.json:inn`,
  `tests/helpers/producao-cenario.ts:cenarioOraculo`
- [2026-09-25] **a metalurgia é o gargalo da cadeia do ouro, e o minério empilha no armazém** |
  medido na F21 (`test-output/F21.json` e `test-output/zz-probe-F21.json`, cenário
  `cenarioDaCadeiaDoOuro`): `gold_mine` entrega 1 minério a cada **300** ticks e `coal_mine` 1
  carvão a cada **250**, mas `metallurgists` consome 1 de cada a cada **600** e devolve 2 de ouro.
  A razão de produção para consumo fica em ~**2:1** nos dois insumos, e o excedente **não some**:
  aos 8 000 ticks o armazém tinha `coal 15, gold_ore 11, gold 24` — onze minérios parados que a
  metalurgia nunca vai alcançar. Ou as minas são lentas demais para justificar duas, ou falta uma
  segunda metalurgia no aceite do jogador. **Não mexi em número nenhum** (Fase B congelada desde a
  F18) | `production.json:predios.{gold_mine,coal_mine,metallurgists}`
  **Resolvido pelo operador em 2026-09-25, e não é defeito**: duas minas para uma metalurgia **é o
  desenho**, e vem do GDD §4.5 — a fundição consome minério **E** carvão, então precisa das duas
  alimentando; a mesma seção já prevê *"+1 Farm cada 5 prédios que consomem milho; idem Coal
  mine"*. Os 11 minérios parados aos 8 000 ticks são **proporção a calibrar**, e ficam aqui com o
  resto até o ajuste em lote. Nada a corrigir item a item
- [2026-09-25] **a primeira moeda de ouro só chega ao armazém no tick 1030** | medido na F21: carvão
  em 250, minério em 300, os dois na metalurgia em 362 e 697, primeiro ouro fundido em **981**,
  primeiro ouro guardado em **1030**. A 10 Hz e na escala `economia` 2.0 isso é ~1 min 43 s de
  relógio para a primeira moeda com a cadeia inteira já construída e abastecida — sem contar o
  tempo de construir os quatro prédios. Como a escola cobra **1 de ouro por unidade**
  (`economy.schoolhouse.custoOuroPorUnidade`), o ouro de abertura (20) é que sustenta a aldeia
  inteira até lá; a cadeia não é alternativa ao estoque inicial no começo de partida |
  `production.json`, `economy.json:schoolhouse`
- [2026-09-25] **alcance 6 do pescador: o açude da vila dura 620 ciclos, e o lago grande é quase
  todo enfeite** | `fishermans.colheita.alcance_tiles` nasceu **6** na F-T4a, e o número é *a
  calibrar*, não medido contra nada. O que está medido: a cabana em (31,27), na margem sul do açude
  da vila, vê **31 tiles** ao alcance — os 31 do açude inteiro — e a linha do painel abre em **620
  unidades** (31 × `fish.rendimentoPorTile` 20). Um ciclo tira **1** unidade e entrega 1 peixe
  (620 → 619 na captura `F-T4a-2`), então **uma cabana leva 620 ciclos para secar o açude da
  vila**. No mapa inteiro há **274 tiles de cardume / 5 480 unidades nominais**, mas só **95 tiles
  / 1 900 unidades** são alcançáveis por qualquer cabana: o cardume mora em **2 lagos** (243 e 31
  tiles) e o grande tem **70 tiles de margem em 243**. Água nunca vira andável (`fish.regime:
  nunca` apaga a entrada), então o interior do lago grande é **permanentemente** inútil — ao
  contrário da árvore, que ao ser cortada abre o anel seguinte (350 tiles, 12 capoeiras, **301
  alcançáveis hoje e 350 no fim**). Os dois parafusos, quando o lote for ajustado: `alcance_tiles`
  (mais alcance = mais margem, não mais lago) e `fish.rendimentoPorTile` (20). Alcance menor que 6
  não é neutro: a **margem** é que limita a cabana, não o lago |
  `production.json:fishermans`, `resources.json:fish`, `test-output/F-T4a.json`

- [2026-09-25] **o minério do mapa inteiro cabe em 56 tiles, e uma mina alcança no máximo 12
  deles** | os três `rendimentoPorTile` da F21b (carvão 15, ferro 12, ouro 8) nasceram *a
  calibrar*: são proporção entre si (o carvão é o que mais se gasta, o ouro o mais raro), medida
  contra nada. O que está medido: o gerador semeia **25 tiles de carvão / 375 unidades**, **20 de
  ferro / 240** e **11 de ouro / 88** (`test-output/F21b-veios-no-mapa.json`), e **100 % deles são
  alcançáveis** — o veio nasce na saia da serra, nunca no miolo. Isso é o mundo **inteiro**: não há
  segundo depósito. Um ciclo da mina de carvão leva **300 ticks** (4 ciclos em 1 200,
  `test-output/F21b-mina-esgota.json`) e consome **1** unidade do tile, e o melhor ponto legal de
  cada mina alcança **12 tiles de carvão (180 unidades), 10 de ferro (120) e 10 de ouro (80)**.
  Logo **uma mina de carvão bem plantada seca o que alcança em ~54 000 ticks — 1 h 30 de relógio a
  1x** —, e o mapa todo dá 375 ciclos de carvão para a partida inteira. Se isso for curto demais,
  os dois parafusos são `rendimentoPorTile` (multiplica o estoque sem mexer no mapa) e o tamanho
  do veio em `tools/gerar-mapa.js:VEIOS_DE_MINERIO` (muda o mapa e exige regerar). O terceiro,
  `alcance_tiles` 6, não ajuda: a encosta é que limita, como no açude do pescador |
  `resources.json:coal,iron_ore,gold_ore`, `tools/gerar-mapa.js`, `test-output/F21b-*.json`

- [2026-09-25] **46 tiles de rocha viraram veio, e a pedra do mapa caiu de 311 para 265** | o
  minério nasce na saia da serra, e tile de saia já tinha `rock`. Nenhuma pedreira da abertura
  perde nada (o lajedo da vila está intocado, e as duas contagens de `tree`/`fish` saíram idênticas
  byte a byte), mas o estoque de pedra **do mapa inteiro** é 15 % menor do que era antes da F21b.
  Não mexi em nada por isso: entra aqui para o lote, junto com `rock.rendimentoPorTile` (15) |
  `data/maps/sertao-128.json:contagemDeRecursos`
- [2026-09-25] **FORMA dos lajedos depois do veio: nenhum ficou pequeno demais para uma pedreira
  de alcance 6** | pedido do operador no mesmo dia, com o argumento certo — "pedreira depende de
  lajedo aglomerado, e a medição do BUG-C mostrou que **forma decide, não média**", então a queda
  de 311 para 265 não responde sozinha. Medido no mapa inteiro, versão de antes contra a de agora
  (`test-output/F21b-lajedos-depois-do-veio.json`): dos **11** aglomerados de rocha, **9 estão
  intocados** (inclusive o da vila); só o 1 (88 tiles, 26 viraram veio) e o 2 (74, 20 viraram) foram
  atingidos, e o veio os **fragmentou**, não os encolheu por igual — 11 aglomerados viraram **25**,
  o 1 quebrando em 24/8/8/6/6/4/2/2/2 e o 2 em 19/10/9/8/4/2/2. O que importa para o jogo é a
  posição da pedreira, e por ela nada morreu: das **13 964** posições legais do mapa, as que têm
  ao menos uma rocha alcançável em 6 caíram de **1 737 para 1 736** — **uma única** posição,
  (87,106), perdeu a última rocha, e ela tinha exatamente 1. A melhor pedreira do mapa foi de
  **56 para 55 tiles** (840 → 825 unidades) e 549 posições perderam alguma rocha (pior caso −15,
  em (106,94)). A média por posição com rocha caiu de 14,7 para 12,8 — e é justamente a média que
  o BUG-C ensinou a não usar sozinha. **Conclusão: nada a ajustar.** Fica registrado porque o
  fragmento de 2 tiles é pedreira que esgota em 30 unidades, e isso é do lote de
  `rock.rendimentoPorTile` | `tools/gerar-mapa.js:VEIOS_DE_MINERIO`, `data/resources.json`
- [2026-09-25] **a folga de 4 de pedra na abertura é TENSÃO, não acaso — o número
  fica, e o que estava errado era a pergunta** | pedido do operador no mesmo dia:
  *"folga de 4 é acaso ou é tensão de design? Meça: com os 30 de pedra e rua de 26,
  quantos tiles de estrada sobram para o jogador ligar o quinto prédio que ele
  construir? Se for zero, o número está errado."* **A resposta da pergunta como ele a
  escreveu é ZERO** (`test-output/F-T4b-folga-de-pedra.json`): `custoStonePorTile` 1,
  estoque inicial 30, a rua da abertura 26 tiles = 26 de pedra, e o arranque mínimo
  (woodcutters 2 + quarry 2, as duas únicas que não dependem de nada) come os 4 que
  sobram — `tilesDeRuaQueSobramNoTick0: 0`. **Mas esse zero é o da rua INTEIRA de uma
  vez, que é a ponta cara de uma escolha que existe.** Medido contra a regra da sim, e
  não por conta minha (`test-output/F-T4b-escalonado.json`, sonda desta sessão): ligar só
  a pedreira (que produz pedra) e a PRIMEIRA casa de lenhador (que desbloqueia a
  serraria) custa **18 tiles**, e `predioLigadoAoArmazem` devolve `true` para as duas
  no **tick 168** — sobram **8** de pedra, ou seja 8 tiles para o quinto prédio, sem
  esperar produção nenhuma. Ligar tudo no tick 0 deixa 0; ligar em duas etapas deixa
  8. **É exatamente a tensão do KaM que o operador descreveu: o jogador escolhe entre
  ligar tudo agora e guardar pedra, e as duas pontas estão medidas.** E a vila NÃO
  perde antes do primeiro clique: mesmo na ponta cara ela se liga (a F17 fecha a Fase
  A no tick 4266), o estoque toca 0 no tick 617, fica em 0 de ~750 a ~2000 e volta a
  subir com a pedreira — 19 no tick 6000. **Conclusão: nada a ajustar em
  `estadoInicial.estoque.stone`.** — **SUPERADA no mesmo dia pela decisão do
  operador (entrada abaixo): o número virou 34.** A medida acima continua válida como
  descrição do que 30 fazia; a conclusão "nada a ajustar", não. O que fica de dívida é que a folga de 4 é IGUAL ao
  arranque mínimo de 4: é fio de navalha, não ladeira. Um tile a mais na rua, ou 1 de
  pedra a mais em quarry/woodcutters, torna a abertura impossível — e é por isso que o
  orçamento agora estoura no gerador com as duas medidas na mensagem
  (`tools/geometria-da-abertura.mjs`), em vez de sair `sem-pedra` três passos depois.
  **Como refazer as duas medidas:** as sondas eram testes temporários e saíram no
  mesmo commit — o que fica é o JSON. A da folga percorre 6 000 ticks da abertura
  amostrando `estoqueDosArmazens(s)['stone']`; a do escalonado emite um `PlaceRoad`
  com os 18 tiles (`21,33`..`29,33` mais o ramo `30,33`..`34,29`), planta quarry e
  woodcutters, roda até `predioLigadoAoArmazem` devolver `true` para as duas e lê o
  estoque. **Cuidado medido na sessão:** `PlaceRoad` deixa a rua *planejada*, não
  assentada — perguntar a ligação no tick 1 devolve `false` para tudo e parece
  resposta. Se um dia o lote mexer aqui, mexa nos três juntos: estoque inicial,
  `custoStonePorTile` e o `stone` das duas casas do arranque | **nada girado** |
  `data/economy.json:estadoInicial.estoque.stone`,
  `data/terrain.json:estrada.custoStonePorTile`, `data/buildings.json`
  (quarry.stone, woodcutters.stone)

- [2026-09-25] **a folga da abertura subiu de 4 para 8 de pedra por decisão do
  operador: 30 → 34 em `estadoInicial.estoque.stone`** | ele decidiu contra a conclusão
  da entrada acima, e o motivo dele não é ritmo: *"a tensão que você mediu continua
  existindo — as duas pontas passam a ser 4 e 12... O que some é o fio de navalha: hoje
  um tile a mais na rua torna a abertura impossível, e isso é ausência de margem, não
  decisão."* É o único item deste diário girado fora de lote, e de propósito: o que ele
  ajustou foi a **margem** do fio de navalha que a medida anterior apontou como dívida,
  não um número de ritmo. **Medido depois de mexer** (`test-output/F-T4b-folga-8.json`,
  sonda desta sessão, janela de 5 300 ticks, critério de Fase A igual ao da F17 — quatro
  prédios completos, ocupados, ligados e o timber acima da linha do tick 0):
  · **ponta A, ligar tudo no tick 0** — rua de 26 tiles, sobram **4** para o quinto
  prédio, a Fase A fecha no **tick 3992**, o estoque toca **0 no tick 875**, fica em 0
  por **367 ticks** e volta ao positivo no **1023**, nenhuma recusa;
  · **ponta B, escalonar** (18 tiles: pedreira + primeira casa de lenhador) — sobram
  **12**, a Fase A fecha no **4741**, toca 0 no **968**, fica em 0 por **1311 ticks**,
  volta no **2060**, nenhuma recusa.
  **A escolha continua existindo** (4 contra 12, e a ponta que guarda pedra paga 749
  ticks de Fase A mais lenta), então não volto para 6. O que mudou de qualidade: a ponta
  A deixou de ser zero — quem liga tudo ainda tem 4 tiles de rua na mão.
  **Ressalva medida, e ela enfraquece a tensão:** rodei uma terceira ponta que escalona
  **e guarda** margem de 8 antes de comprar o resto da rua, e saiu **idêntica à B**
  (`tickDoRestoDaRua: 1` nas duas) — com 34 de pedra os 8 tiles restantes já cabem no
  tick 1 mesmo guardando 8, ou seja "escalonar" virou questão de um tick, não uma
  aposta. A tensão sobrevive na escolha de **geometria** (quanto de rua comprar), não
  mais numa espera. Se o lote quiser a aposta de volta, o parafuso é o mesmo trio da
  entrada acima | **girado: `stone` 30 → 34** |
  `data/economy.json:estadoInicial.estoque.stone`

- [2026-09-25] **HIPÓTESE, registrada a pedido do operador ao fechar o Lote 1: pedreira,
  lenhador e minas têm o mesmo padrão da fazenda, e o conserto deve ser o mesmo** | as taxas
  de `quarry` (1,8/min → 167 ticks), `woodcutters` (0,55 → 545), `gold_mine`, `coal_mine`,
  `iron_mine` e `fishermans` foram calibradas antes de a caminhada existir (F-T3), e desde
  então o intervalo de entrega é `1 + ida + ticksDoCiclo + volta` — pedreira **~250-266**
  medido contra 167 do dado (entradas acima, 2026-09-25). Na fazenda, o diagnóstico foi que a
  colheita sozinha já ocupava o orçamento inteiro de quem consome (moinho 246), e por isso
  nenhum outro parafuso fechava; o conserto foi recalibrar a COLHEITA para que colheita +
  viagem + plantio diluído coubessem no ciclo do consumidor, com a viagem dentro da conta de
  propósito. **A hipótese:** se a colheita da pedreira também ocupa o orçamento inteiro de quem
  consome pedra (obra e estrada não têm ciclo de consumo fixo, então o "consumidor" ali é o
  ritmo de abertura do GDD §1.3 — 8 a 10 min para os 16 prédios), o conserto é o mesmo:
  encurtar `ticksDoCiclo` de modo que ciclo + viagem devolva o intervalo de entrega que o
  número original descrevia. Para a madeira, o consumidor É fixo (serraria 273), e a proporção
  2:1 da F15b foi medida antes da F-T4b pôr o lenhador para andar: é o primeiro lugar a
  re-medir. **Não medido; não é decisão.** *(MEDIDA no mesmo dia, na entrada seguinte: de pé para a
  MADEIRA, e CAI para a pedra — a viagem da pedreira depende do lugar, não do prédio.)*
  Entra no próximo lote junto com
  `rock.rendimentoPorTile`, `alcance` e o resto das entradas de pedreira e minas acima |
  `production.json:predios.{quarry,woodcutters,gold_mine,coal_mine,iron_mine,fishermans}`,
  `docs/calibracao-fase-b.md` (o método)

- [2026-09-25] **MEDIDO, a pedido do operador: a hipótese acima vale para a MADEIRA e não
  vale para a PEDRA — e o que ela erra é achar que existe um número por prédio** | sonda
  temporária na **abertura de verdade** (`aberturaDaFaseA`, a mesma do F17, semente do
  dado), 12 000 ticks, intervalo entre eventos `goods-produced` do mesmo prédio, já
  descontada a rampa (o primeiro evento de cada um é o marco, não entra em intervalo):
  **pedreira 211,2** (204–222, 53 entregas) contra **167** do `ticksDoCiclo` = **1,26×**;
  **lenhador 690,3 e 652,6** (dois prédios) contra **545** = **1,27× e 1,20×**; **serraria
  341,8** contra **273**, com **mínimo exatamente 273** e máximo 512.
  **(1) A pedra não repete o caso da fazenda.** A hipótese esperava a viagem comendo o
  orçamento inteiro; ela come **26 %**, não os ~60 % que o número antigo sugeria (266
  contra 167, medido na fixture da F15a). A diferença **não é do prédio, é do LUGAR**: na
  fixture a pedreira estava a 7 tiles do lajedo; na abertura ela nasce **colada** nele,
  pela regra de posição da F-T4b. Um `ticksDoCiclo` calibrado para "ciclo + viagem" ficaria
  certo num mapa e errado no outro, e é isso que o `alcance_tiles: 6` já queria dizer.
  **Girar `quarry.sai.stone` não está justificado por esta medida.**
  **(2) O que a medida ACUSA é a proporção 2:1 da madeira**, e esse sim é o padrão da
  fazenda: a serraria consome uma tora a cada **273** e os dois lenhadores entregam uma a
  cada **~335** (dois fluxos de ~670 intercalados). O mínimo 273 é a serraria andando
  cheia; a média 341,8 é ela **esperando insumo ~20 % do tempo**, e é isso que o
  `esperando_insumo` do painel mostra hoje na abertura. **2:1 não sobrevive à caminhada
  do lenhador (F-T4b): o par entrega 81 % de uma serraria.** O parafuso é `woodcutters.sai
  .tree_trunk` (ou a proporção), não `sawmill`, que já anda no ciclo do dado quando tem
  tora. | **não girei nada** — é medição, e o lote 2 ajusta em bloco; a hipótese acima fica
  de pé para a madeira e **cai para a pedra**, com o motivo escrito | `production.json`:
  `quarry.sai.stone`, `woodcutters.sai.tree_trunk`, `proporcoesDeReferencia`;
  sonda em `test-output/zz-pedreira.json` (temporária, apagada — o que ficou são estes números)

- [2026-09-25] **A calibração do lote 1 medida NA ABERTURA (F-CAL-b): a fazenda entrega 1,7×
  o que o moinho mói, e o milho sobe sem parar** | `test-output/F-CAL.json` (guarda permanente:
  `tests/F-CAL-b-calibracao.test.ts`), 36 000 ticks da vila da F-CAL-a, 26 civis (6 + 20 do
  ouro). Milho no armazém a cada 1000 ticks, do 12 000 ao 36 000: 29, 34, 40, 46, 51, 58, 63,
  70, 76, 82, 87, 94, **99** — **+3 por 1000, constante**; é regime, não rampa (o Moinho ocupa
  em 4062 e de 12 000 em diante fica **100 %** em `trabalhando`, zero `esperando_insumo`).
  Intervalo entre milhos **143** (padrão 103, 103, 103, 253) contra **246** do ciclo do moinho:
  a afirmação (a) do aceite reprova por 42 % e a (c) por 99 contra 1. As (b) e (d) passam com
  folga: moinho 0,2 % e padaria 0,15 % em espera, zero morte, 110 loaves sobrando. **O termo
  que mudou é a caminhada, e só ela** — a tabela do doc refeita nos dois cenários:

  | fase por milho | longe (`cenarioDaCadeiaDoPao`) | abertura (`vilaDaCalibracao`) |
  |---|---|---|
  | colhendo | 100 | 100 |
  | ida (`indo_colher`) | 54 | **1** |
  | volta (`voltando`) | 50 | **1** |
  | plantando (150 ÷ 4) | 36 | 37 |
  | **total** | **247** | **143** |

  **A causa está em `src/sim/aproximacao.ts:43-53`, e é regra, não defeito:** o alvo da colheita
  é *"o próprio tile primeiro (custo zero para quem já está nele), depois os oito vizinhos
  andáveis"*, e o A* escolhe o mais barato. Na abertura o campo começa em y=34, a Chebyshev 1
  da porta (37,33): o roceiro fica em `colhendo (37,33)`, **na rua, sem dar um passo** (traço
  tick a tick na sonda). No cenário longe o campo fica ao NORTE e ele contorna o footprint (7
  tiles, 54 ticks por perna). A frase do doc *"a caminhada é a mesma com o campo colado e com
  o campo longe: é a saída pela porta e o contorno do footprint, não a distância"* está
  **falsa** e foi marcada lá: o `farm.sai.corn 3,0` foi calibrado com ~105 ticks de caminhada
  na conta, e o campo na porta — que é o que todo jogador vai fazer — tem caminhada zero.
  | **Nenhum número girado, por ordem do operador** ("se crescer sem parar... eu decido. Não gire
  número sem eu ver"). As saídas que a medição deixa prontas, para ele escolher: **(i)** girar
  `farm.sai.corn` de 3,0 para ~1,46 (colheita 100 → ~205 ticks; 205 + 37 + 2 + 2 ≈ 246 com o
  campo na porta) — aí o campo longe volta a ~350 por milho e a fazenda do norte fica 43 % mais
  lenta que o moinho: a conta só fecha para UMA geometria, qualquer que seja o número; **(ii)** mudar a regra de aproximação
  para tile pisável (rocha, milho): o alvo é **só o tile**, os vizinhos ficam para o que
  bloqueia (árvore, água) — a caminhada passa a ser ≥ 2 tiles em qualquer geometria e o doc
  volta a valer, mas é `sim/`, e a F-T3 escreveu a regra atual de propósito ("uma regra só para
  os dois casos"); **(iii)** aceitar que 1 Roçado alimenta 1,7 Moinho quando o campo é colado e
  reescrever (a) e (c) com a medição ao lado, deixando `proporcoesDeReferencia` dizer isso. A
  (b) e a (d) passam em qualquer das três. | `production.json:farm.sai.corn`,
  `production.json:proporcoesDeReferencia`, `src/sim/aproximacao.ts`,
  `docs/calibracao-fase-b.md`

- [2026-09-25] **A folga de pedra da abertura, remedida com a pedra viajando por tile
  (F18g): o limiar é 27 para 26 tiles, e o guarda do gerador ficou pessimista por 3** |
  `test-output/F18g-sonda-pontas.json` (sonda temporária, apagada; os números ficaram).
  A abertura com a rua de 26 tiles, estoque inicial variado e o guarda desligado: **34
  fecha a Fase A em 1319** (estoque toca 0 no tick 1012), 30 em 2129, 28 em 2563, **27 em
  2691, 26 TRAVA** — 23 tiles de pé, pedreira e segunda casa de lenhador em obra aos
  12 000 ticks, zero recusa de comando. O mecanismo: a carga de pedra da rua (nível 8)
  nasce no tick do comando, e o material da obra (nível 3) só nasce depois do
  nivelamento; nesse intervalo os serfs levam a pedra para o canteiro, e a pedreira —
  que é quem produziria o resto — nunca recebe as 2 dela. A "folga de 4" da entrada de
  2026-09-25 (34 − 26 − 4) media uma **recusa** que não existe mais; o que ela mede agora
  é a distância ao **travamento**, e a conta `rua + 4` está 3 acima do limiar medido. |
  **Nenhum número girado.** O guarda fica como está, de propósito: o limiar de 1 é de
  ordem de tick (a obra da pedreira ganha a corrida por uma pedra), e um guarda no fio
  da navalha não é guarda; a mensagem dele passou a dizer o que protege. A ponta
  "escalonado" (18 tiles, 12 de folga) não foi remedida — a tensão entre as duas
  escolhas deixou de ser "cabe / não cabe" e virou "quanto tempo a vila fica sem pedra",
  que é balanceamento do lote 2 (pedreira, lenhador, minas). | `data/economy.json:
  estadoInicial.estoque.stone`, `tools/geometria-da-abertura.mjs`, `data/delivery.json`
  (o nível da `pedra-para-canteiro`)

- [2026-09-26] **As pontas da abertura remedidas depois da F18g: a escolha NÃO
  sobreviveu — ligar tudo no tick 0 domina toda ponta escalonada** | sonda temporária
  (`tests/zz-sonda-pontas-pos-f18g.test.ts`, apagada no commit que registra isto; os
  números ficaram). Estoque de pedra varrido de 34 para baixo até travar, janela de
  12 000 ticks, critério igual ao da tabela de 2026-09-25 (F17 `criterio-fechado` mais
  os quatro ligados). Controle: a ponta A trava em 26 e fecha em 27, como a F18g mediu.
  · **A, rua inteira no tick 0** (26 tiles): com 34 fecha no **4208** (era 3992); limiar **27**.
  · **B, escalonar pela pedra disponível** (15 tiles — a poda desta sonda achou uma rua
    mínima 3 tiles menor que os 18 de antes; o resto quando `pedraDisponivel` cobre):
    o resto entra no **tick 1** — o comando não desconta mais pedra, então não há o que
    esperar. Fecha no **4891**; limiar **28**. **C** (guarda 8) é idêntica à B.
  · **D, escalonar de verdade**: o resto só quando os 15 tiles estão de pé (tick 206).
    Fecha no **4856**; limiar **27**.
  O "4 contra 12" deixou de existir: nada é pago no tick 0, então nada "sobra na mão".
  Nenhuma ponta escalonada compra margem (limiar 27 ou 28, contra 27) nem tempo (≥ 648
  ticks mais lenta). A tensão que motivou o 30 → 34 sumiu com a F18g; o que resta é o
  limiar, e ele é o mesmo nas pontas. **Os 1319 ticks da entrada da F18g não se comparam
  com esta tabela** — lidos do texto dela, eles medem a última ligação, não o critério
  da F17 (hipótese pela redação, a sonda dela foi apagada). | **Nenhum número girado.**
  Se o lote quiser a escolha de volta, o parafuso é o mesmo trio de antes | 
  `data/economy.json:estadoInicial.estoque.stone`, `data/delivery.json`

- [2026-09-26] **Pedra inicial 34 → 30, POR DECISÃO DO OPERADOR, e as três pontas fecham
  com 30** | O operador escreveu: "a tensão que eu defendi dependia do pagamento à vista, e o
  pagamento à vista era o defeito". A sonda temporária foi a das pontas pós-F18g, reconstruída
  e apagada no mesmo commit. Janela de 12 000, critério da F17 mais os quatro ligados,
  varrida de 30 para baixo.
  · **A**, a rua inteira no tick 0: fecha no **4404** (com 34 era 4208), e o limiar é **27**.
  · **B**, 15 tiles, e o resto entra no tick 1: fecha no **5193**, limiar **28**.
  · **D**, o resto só com os 15 de pé (tick 206): fecha no **5158**, limiar **27**.
  Os limiares são os mesmos de antes. A margem ficou em 3 (A e D) e 2 (B). O guarda de
  `tools/geometria-da-abertura.mjs` exige 30 (rua 26 + reserva 4) e passa no limite exato.
  **Ressalva:** a Fase A demora ~200 ticks a mais na ponta A com 30. Nenhum outro número foi girado. |
  `data/economy.json:estadoInicial.estoque.stone`

- [2026-09-25] **A faixa da fazenda nas geometrias do jogador: 143 a 346 ticks por milho,
  e no alcance máximo a fazenda NÃO sustenta o moinho** | `test-output/F-CAL-b2-sonda.json`
  (sonda apagada), a vila da F-CAL-a por 36 000 ticks, só o campo mudando de lugar.
  Pedido do operador ao escolher a saída (iii): o aceite descreveria a FAIXA — a fazenda
  sustenta o moinho com o campo colado e no alcance máximo, e o milho não cresce sem
  limite no segundo. Medido:

  | campo | ticks por milho | 1 Roçado alimenta | moinho esperando | milho máx. | mortes |
  |---|---|---|---|---|---|
  | colado à porta (sul) | 143 | 1,72 moinho | 0,1 % | 98, subindo | 0 |
  | atrás, a 1 tile | 299 | 0,82 moinho | 10,1 % | 5 | 0 |
  | atrás, a 4 tiles (alcance máx.) | 346 | 0,71 moinho | 22,5 % | 4 | 0 |

  **A metade "sustenta nas duas" é FALSA, não vazia**: no alcance máximo o moinho fica
  22,5 % esperando (o critério (b) é 10 %), e já a 1 tile atrás passa do limite. A
  metade do milho vale nas duas (no longe ele fica em 0 a 4, porque o moinho come tudo)
  e a da fome também (26 civis, zero morte). A faixa é de **2,4×**, e o que a abre não
  é a distância, é o LADO da porta: a 1 tile atrás o roceiro já contorna o footprint
  (156 de caminhada contra 2). As distâncias 2 e 3 não mediram calibração — a vila
  morreu por um travamento de regra (BUG-G, `BUGS.md`), e os números delas estão fora.
  | **Nenhum número girado; o número volta à mesa, pela regra que o operador deixou**
  ("se 'sustenta nas duas' virar afirmação vazia, pare e me diga"). O que a medida dá
  para ele decidir: a colheita é o único termo livre (100 ticks); para o alcance máximo
  fechar em 246 ela teria de cair para ~0, então nenhum `farm.sai.corn` faz as duas
  pontas sustentarem o moinho — ou o aceite aceita que o campo mal posto não sustenta
  (e (b) vale só para o campo do lado da porta), ou o termo que muda é a caminhada.
  | `production.json:farm.sai.corn`, `production.json:proporcoesDeReferencia`,
  `docs/calibracao-fase-b.md`
- [2026-09-26] o Canavial deixou de fazer cachaça do nada (F-CANA). Agora ele precisa de
  partido de cana arado, planta, anda e colhe, com os números do milho copiados de
  propósito. | medido (`test-output/F-CANA.json`): **791 ticks** até a primeira cachaça,
  com dois partidos colados na porta; antes era um ciclo de receita, sem campo. A cachaça é
  comida (`economy.comida`, `condition.restauracaoPorComida.wine 0.30`), e o efeito na
  bodega não foi medido. | `production.json:wineyard.sai.wine`,
  `resources.json:tipos.grapes.reposicao`, `resources.json:tipos.grapes.rendimentoPorTile`
- [2026-09-26] o `timber: 1` por plantio da videira (antigo `timberPorCampo`, guardado nas
  notas do `wineyard`) **não entrou** em `grapes.reposicao.custo`. O custo sai da gaveta de
  entrada, e o Canavial não tem `entra`, então ninguém entregaria a tábua e o plantio
  esperaria para sempre. Pôr o custo exige `wineyard.entra.timber` junto. | `production.json:wineyard`
- [2026-09-26] a mina colhe sem sair (`colheita.aDistancia`, F-CANA). O ciclo do minério
  ficou mais curto pelo tempo da ida e da volta ao veio, que não foi medido. | `production.json:*_mine.sai`

---

## Ciclos fechados

### Lote 1 — cadeia de comida (fechado em 2026-09-25, branch `calibracao-fase-b`)

**O diário deste lote vive em `docs/calibracao-fase-b.md`**, arquivo próprio porque foi escrito
enquanto outra sessão editava este aqui; ficou como arquivo, com este ponteiro, do mesmo jeito
que o histórico das features ficou em `docs/historico/`. Lá estão a medição por fase do
roceiro, a conta dos dois números, a tabela de antes e depois e o que NÃO mudou.

- **Números girados:** `production.json:farm.sai.corn` 1,22 → 3,0 e
  `resources.json:corn.reposicao.segundos_base` 60 → 30. **A frase:** a taxa de 2014 pressupunha
  que colher era o ciclo todo; desde a F18 (plantio) e a F-T3 (caminhada) a colheita sozinha
  (246) ocupava o ciclo inteiro do moinho (246), e a fazenda entregava um milho a cada 432 ticks.
  Depois: 249 (campo longe) / 243 (campo colado) ticks por milho, moinho 2 % em
  `esperando_insumo`, milho nunca acima de 1 no armazém.
- **[2026-09-25] a vila agora sustenta ~35 civis só com cuscuz, contra o colapso total de
  antes.** Medido em 36 000 ticks numa vila 1 Roçado : 1 Moinho : 1 Padaria com Bodega: antes,
  20 civis viviam e 27 morriam TODOS (o roceiro primeiro, no tick 26 400); depois, 27 vivem com
  cuscuz sobrando e 39 vivem com a Bodega vazia 22 % do tempo — o teto por conta é 4 800 ÷ ~130
  ≈ 37. **É o primeiro número que diz que o jogo é jogável até o fim de uma partida:** os 26
  civis que o ouro inicial treina cabem numa cadeia só.
- **Não mudou, e por quê:** `corn.aradura` (20 ticks, uma vez na vida do tile), `alcance_tiles`
  e o número de tiles (o roceiro é serial e usa 1 tile de 37), `rendimentoPorTile` (4), moinho,
  padaria e `condition.json`. A caminhada (~100 ticks por milho, igual com o campo colado ou
  longe) fica na conta de propósito: o original também tinha fazendeiro andando.
- **Ainda aberto, do mesmo padrão:** pedreira, lenhador e minas também ganharam a viagem em cima
  de `ticksDoCiclo` (pedreira 167 → ~250 medido). Fora deste lote; as entradas deles continuam
  em "Observações abertas".

<details>
<summary>Observações arquivadas deste lote (texto original, na ordem em que entraram)</summary>

- [2026-09-24] **a fazenda ficou ~30% mais lenta, e o plantio é ~23% do tempo dela** | medido no
  aceite (`test-output/F18.json`), em ticks e não em minutos, porque a escala `economia: 2` de
  `time.json` já está dentro dos dois números: plantar um tile custa **300 ticks**
  (`corn.reposicao`) e cada colheita **246** (`farm.ticksDoCiclo`), com `rendimentoPorTile: 4` — o
  ciclo fechado de um tile é 300 + 4×246 = **1284 ticks por 4 milhos**, ou **321 ticks/milho** contra
  os **246** de antes da F18. A taxa declarada (`sai: { corn: 1.22 }`) continua valendo *durante* a
  colheita; o que a derruba é o plantio, que é tempo que não existia. **Meu palpite no plano era
  "metade do tempo"; a medição diz 23%** — fica registrado para não virar folclore.
  Nota do formato: como o roceiro replanta **o mesmo tile** assim que ele seca (a varredura do
  plantio tem a mesma ordem da colheita, de propósito), a fazenda alterna 300 parada / 984
  produzindo para sempre e **nunca encadeia** os outros ~36 tiles aráveis ao alcance. **Não mexi em
  número nenhum**: os três candidatos (`reposicao.segundos_base`, `rendimentoPorTile` e a ordem da
  varredura do plantio) mudam a comida, e comida é a F20 — o lote se ajusta lá, com o pão junto |
  `resources.json:tipos.corn.reposicao`, `production.json:receitas.farm`

- [2026-09-24] **a proporção 1 Fazenda : 1 Moinho : 1 Padaria deixa os dois últimos ociosos, e a
  culpa é do plantio** | medido em 12 000 ticks no cenário da F19
  (`test-output/F19.json`): o moinho passa **26,2 %** e a padaria **28,8 %** do tempo em
  `esperando_insumo`; a fazenda, **0 %**. A conta fecha e não é logística: a fazenda entrega um
  milho a cada **321** ticks (246 do ciclo + os 300 do plantio diluídos nas 4 colheitas do tile) e o
  moinho consome um a cada **246** — ocioso previsto de 23,4 %, mais ~3 % de viagem do serf. O
  oráculo do próprio dado (`production.json:proporcoesDeReferencia`, com `_doc` dizendo que um
  cenário que as respeite *"não pode … deixar prédio ocioso"*) **é o que está desatualizado**, e
  desatualizou na F18, quando o campo passou a exigir aração. Dois caminhos, e os dois mexem em
  comida: subir `farm_por_mill` para ~1,3 (mais fazendas por moinho) ou baixar o custo do plantio.
  **Não mexi em nada** — é o mesmo lote da entrada acima e da F20. **A premissa morta está marcada
  no próprio dado** (`proporcoesDeReferencia._aviso`, decisão do operador em 2026-09-24): quem
  abrir o arquivo para calibrar precisa ver ali que a tabela descreve o jogo de 1998, não este, e
  que só os ramos que dependem da fazenda foram afetados — `woodcutters_por_sawmill`, calibrado na
  F15b, continua de pé | `production.json:proporcoesDeReferencia`,
  `resources.json:tipos.corn.reposicao`

- [2026-09-24] **a cadeia da carne é mais faminta de milho do que o oráculo diz, e o elo que não
  depende da fazenda está certo** | medido em 20 000 ticks no cenário 1 Fazenda : 1 Malhada : 1 Casa
  de Carne (`test-output/F19b.json`): a fazenda entrega um milho a cada **328** ticks (61 em 20 000),
  a Malhada quer **4 milhos por 600 ticks** — um a cada 150 —, e a razão real fica em **2,19
  fazendas por Malhada** contra o **1,63** que `proporcoesDeReferencia` publica. Consequência no
  cenário mínimo: o criador passa **55 %** e o carneador **86 %** do tempo em `esperando_insumo`
  (o roceiro, 0 %). A causa é a MESMA das duas entradas acima — o custo do plantio que a F18
  introduziu —, e por isso esta entrada não é um problema novo: é o terceiro ramo do mesmo. Já o
  elo que **não** passa pela fazenda bate: o açougue consome um bode a cada 200 ticks e a Malhada
  entrega um a cada 600, exatamente os **3** de `swine_farm_por_butchers`. **Não mexi em número
  nenhum** — o operador fechou o lote: *"a Fase B inteira está com proporções desatualizadas desde
  a F18, e vale calibrar de uma vez quando a cadeia de comida fechar"* | `production.json:predios.swine_farm`,
  `production.json:proporcoesDeReferencia`, `resources.json:tipos.corn.reposicao`

- [2026-09-25] **a F-T3 cortou a vazão de todo prédio de colheita, e o corte é a viagem** | com o
  especialista saindo do prédio, o intervalo entre duas entregas deixou de ser `ticksDoCiclo` e
  passou a ser `1 (transição) + ida + ticksDoCiclo + volta`. Medido: a **pedreira** do cenário de
  teste entrega uma pedra a cada **266** ticks contra os **167** de `ticksDoCiclo` — **1,59×** mais
  lento (`test-output/F-T3.json`, transições em 1 / 50 / 217 / 266); a **fazenda**, cujo tile fica
  mais longe, sobe de **246** para **351** ticks por colheita, e sobre isso ainda pesam os **300**
  ticks de plantio a cada quatro colheitas (`test-output/F-T3-ciclo-do-rocado.json`,
  `tests/F18-rocado.test.ts`). A distância é geografia, não dado: mesma receita, cenários
  diferentes, intervalos diferentes — o que antes era um número do arquivo agora depende de onde o
  jogador põe o prédio, e **essa é a mecânica pretendida** (*"colher pedra de dentro do prédio é a
  mesma coisa que me incomodou na estrada instantânea: o jogo esconde o trabalho"*). O efeito no
  balanceamento é que toda proporção da Fase B ficou **mais** desatualizada do que as três entradas
  acima já diziam: elas mediam a fazenda antes da caminhada. **Não mexi em número nenhum**, pelo
  mesmo fechamento de lote do operador (2026-09-24): *"a Fase B inteira está com proporções
  desatualizadas desde a F18, e vale calibrar de uma vez quando a cadeia de comida fechar"*.
  Quando o lote for calibrado, a conta nova tem de incluir a viagem — corrigir `ticksDoCiclo` para
  compensar distância seria esconder de novo o trabalho que a feature existe para mostrar |
  `production.json:predios.quarry`, `production.json:predios.farm`,
  `production.json:proporcoesDeReferencia`

- [2026-09-25] **arar três tiles e esperar o primeiro milho custa 706 ticks** | medido na F18h
  (`test-output/F18h.json`): `PlowField` de três tiles de grama no tick 1, primeiro tile arado e
  alerta `sem-campo` sumindo no tick **79** (20 ticks de aradura por tile + ida do laborer),
  primeiro milho na gaveta no tick **706**. O grosso não é arar — é o ciclo do roceiro sobre terra
  em pousio: o campo nasce com `quantidade: 0` e a `reposicao` do milho é de 300 ticks. A 10 Hz
  isso é ~1 min 10 s entre o gesto do jogador e o primeiro grão, com um laborer só e a fazenda já
  de pé. Se o número incomodar, os dois parafusos são `corn.aradura.segundos_base` (4,0) e
  `corn.reposicao.segundos_base` (60) — e o segundo pesa 15× mais que o primeiro |
  `resources.json:corn`

- [2026-09-25] **A vazão do campo é o gargalo da cadeia de comida, e agora está medida ponta a
  ponta** | o operador mandou juntar três medidas que estavam soltas em três sessões, porque
  contam a mesma história: (1) **706 ticks** da ordem de arar até o primeiro milho na gaveta
  (F18h, entrada de 2026-09-25 acima) — o grosso não é arar (alerta `sem-campo` some no tick 79),
  é o campo nascer com `quantidade: 0` e esperar a `reposicao`; (2) `corn.reposicao.segundos_base`
  (60) pesa **15×** `corn.aradura.segundos_base` (4,0) — é o parafuso que manda; (3) **o milho no
  armazém nunca passou de 1 em 6 000 ticks** (`test-output/minimo-de-estoque.json`), e o moinho
  ficou **6 000 de 6 000 ticks com a gaveta vazia**, pedindo 5. O milho não se acumula em lugar
  nenhum: ele é consumido no instante em que chega, e o moinho passa a partida inteira em
  `esperando_insumo`. **Isso mata a hipótese de que o sintoma do Moinho e da Padaria (26 % e 29 %
  em `esperando_insumo`) fosse alvo de pedido baixo** — o alvo já é 5 pela regra de classe, e o que
  falta é milho existir. Por isso o estoque mínimo de ouro foi recusado e foi para `IDEIAS.md` em
  vez de virar feature. **Nenhum número girado**, por ordem do operador: a cadeia se calibra
  inteira quando fechar | `resources.json:tipos.corn.reposicao`, `production.json:predios.farm`,
  `resources.json:tipos.corn.aradura`

</details>

---

## Oráculo de calibração

Antes de mexer em qualquer taxa, rode o cenário longo e confira contra as
proporções da seção 4.5 do GDD. Um cenário que as respeite **não pode**:

- acumular fila infinita em nenhum prédio
- deixar trabalhador ocioso por muito tempo
- ter `saida_cheia` persistente (isso é logística, não produção — a correção é
  mais serfs ou mais estrada, não mexer na taxa)
