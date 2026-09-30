# D-TRANSPORTE-03 — Logística do KaM: casamento oferta × demanda (BUG-U causa B + BUG-V)

Pedido do operador (2026-09-30): "LOGÍSTICA KaM (BUG-U causa B + BUG-V) — trate como uma
feature só. Não escreva código ainda. Traga: a) auditoria das 12 entradas de
data/delivery.json [...]; b) proposta de modelo [...]; c) aceite escrito [...]; d) quais
medições do BALANCE_LOG ficam inválidas. PARE e espere minha decisão de implementar."

**Estado: proposta. Nenhum código escrito. Espera a decisão do operador.**

Fonte: clone do KaM Remake em 731a8a4. `HL` = `src/hands/KM_HandLogistics.pas`, `H` =
`src/houses/KM_Houses.pas`, `UTB` = `src/units/tasks/KM_UnitTaskBuild.pas`, `UW` =
`src/units/KM_UnitWarrior.pas`.

## O que o KaM faz, em cinco linhas

1. **Oferta** é o que uma casa tem para dar: a saída de toda casa produtora e o estoque do
   armazém (`H:1769`, `H:859`, `AddOffer`). **Demanda** é o que uma casa ou unidade pede
   (`AddDemand`), com uma de cinco importâncias: `diHigh1` ouro→escola, `diHigh2` comida→
   soldado, `diHigh3` comida→Inn, `diHigh4` material de obra, `diNorm` todo o resto
   (`HL:28-35`, atribuídas em `HL:1160-1171`, `UW:294`, `UTB:241`, `UTB:388`,
   `UTB:637-638`).
2. A importância é **filtro estrito**: só os pares da maior importância que existe entram
   no leilão (`HL:551-571`).
3. Dentro da importância, ganha o **menor lance**: distância pela estrada da oferta à
   demanda (`HL:1544`), mais a distância do serf à oferta (`HL:1398-1412`), mais um
   aleatório pequeno (`HL:1554`, `HL:1585`).
4. **O armazém é só mais uma casa, mas com multa:** +1000 no lance se a demanda é o
   armazém (demanda `wtAll`) ou se a oferta sai do armazém, exceto arma armazém→quartel
   (`HL:1587-1590`). Resultado: casa→casa sempre ganha de casa→armazém e de armazém→casa.
5. **Arma prefere o quartel:** entregar arma ao armazém é proibido enquanto algum quartel
   aceita aquela arma (`HL:1238-1258`). E demanda de casa só casa com oferta ligada por
   estrada (`HL:1216-1220`); demanda de unidade anda livre (`HL:1222-1225`).

Ajustes finos que também entram no lance: +20 por unidade que a casa já tem daquele insumo
(`HL:1612-1618`, "Prefer delivering to houses with fewer supply", exceto armazém e
quartel); obra quase pronta primeiro (`HL:1572-1578`); arma armazém→quartel +10000 quando
o quartel já tem mais de 50 daquela (`HL:1631-1637`); pouco insumo de oficina de guerra se
divide igual, não por distância (`HL:1512-1530`, já temos como `divisaoDoEscasso`).

## a) Auditoria das 12 entradas de `data/delivery.json`

"Conferida?" diz se a linha foi escrita com o fonte aberto (o `fonte`/`_doc` da linha cita
arquivo do KaM) ou não.

| nív. | id | modo | o que o KaM faz (arquivo:linha) | bate? | conferida? |
|---|---|---|---|---|---|
| 1 | comida-para-inn | estrada | `diHigh3`, a **terceira** (`HL:1168-1171`). Casa→casa, exige estrada (`HL:1216-1220`) | modo sim; posição **não**. O `"fonte": "maior prioridade no Remake"` está errado (quinto erro de `docs/varredura-kam.md:334`) | **não** — `[fonte]` sem arquivo |
| 2 | comida-para-tropa | livre | `diHigh2` (`UW:294`), acima do Inn; demanda de unidade, livre (`HL:1222-1225`) | modo sim; posição abaixo do Inn é **decisão do operador** (C-COMIDA-01, L1) e o `_doc` declara a divergência | sim (`_doc` cita `UW:294`) |
| 3 | ouro-para-escola | estrada | `diHigh1`, a **primeira** (`HL:1163-1166`) | modo sim; posição **não** (é a mais alta no KaM, aqui é a terceira) | **não** — `[fonte]` sem arquivo, e o conteúdo está trocado |
| 4 | material-para-obra | livre | `diHigh4` (`UTB:637-638`). A obra é demanda de **casa**: casa→casa exige estrada (`HL:1216-1220`) | posição sim (acima de todo `diNorm`); **modo não**: o KaM é `estrada` (o "quarto erro", `docs/varredura-kam.md:317-332`, pergunta ainda aberta no PROGRESS:9958) | **não** na origem (F18d-1a, "fonte: jogo original"); conferida depois pela varredura, que acusou o erro |
| 5 | insumo-producao-parada | estrada | não existe como classe: é `diNorm`, e a preferência por quem tem menos é **+20 por unidade na entrada** (`HL:1612-1618`), não um nível estrito | modo sim; **modelo não**: aqui é nível estrito acima da saída para o armazém | **não** — GDD §6.3 marca `[proposta]` |
| 6 | insumo-producao-baixa | estrada | o mesmo `diNorm` + 20 por unidade (`HL:1612-1618`) | modo sim; **modelo não** (mesma razão) | **não** — `[proposta]` |
| 7 | pedra-para-canteiro | livre | pedra da estrada é demanda de **unidade** (o construtor), `diHigh4` (`UTB:241`), livre (`HL:1222-1225`) | modo sim; posição **não**: no KaM fica com o material de obra, acima de todo insumo. Aqui fica abaixo dos insumos por **decisão do operador** (2026-09-27, lote 2: "não sobe acima dos insumos") | parcial — o nível é decisão do operador; o KaM não foi citado |
| 8 | saida-cheia-para-armazem | estrada | a saída é **oferta**, e o armazém é uma demanda `wtAll`, `dtAlways`, `diNorm` (`H:660`) que paga +1000 (`HL:1587-1590`): só vai ao armazém o que nenhuma casa pede | modo sim; **modelo não**: aqui a saída só tem o armazém como destino (`src/sim/systems/jobs.ts:546-566`) | **não** — `[proposta]` |
| 9 | excedente-para-armazem | estrada | **não existe automático.** Entrada acima do que a casa quer fica na casa; só sai se o jogador põe a casa em "esvaziar" (`dmTakeOut`, `H:832-860`, `H:1866-1878`) | **não** — é regra nossa (nasceu com D-TRANSPORTE-02a, distribuição baixada) | **não** — `[proposta]` |
| 10 | assentar-estrada | livre | não é entrega: é trabalho do construtor na lista de obras (`KM_BuildList`), escolhido por distância | nada a comparar: a linha só dá o `modo` do A* (`_doc` do nível 11 diz isso) | n/a |
| 11 | arar | livre | idem (lista de obras do construtor) | idem | n/a |
| 12 | arma-para-quartel | estrada | `diNorm` (`H:659`), a mesma classe da produção; armazém→quartel **isento** da multa de +1000 (`HL:1587-1590`); arma não vai ao armazém enquanto um quartel aceita (`HL:1238-1258`) | modo sim; **posição não**: aqui é o último nível estrito, e isso é a causa B do BUG-U | **não** — o próprio `_doc`: "A posição no KaM não foi conferida no fonte" |

**Resumo:** das 10 linhas que são entrega (10 e 11 não são), **duas** foram escritas com o
fonte aberto (2, e o modo das de unidade). **Nenhuma** das oito outras cita o KaM. O
problema não é um nível fora do lugar: é que o KaM **não tem escada estrita** para as
entregas normais. Tem cinco classes, e dentro da última (que é quase tudo) decide a
distância com a multa do armazém.

Também conferido e que bate: `distribuicao` (D-TRANSPORTE-02a, `H:2263`, `UpdateDemands`)
e `divisaoDoEscasso` (D-PRODUCAO-01b, `HL:1512-1530`), os dois com o fonte citado no `_doc`.

## b) Proposta de modelo

### O que muda

1. **Oferta e demanda, casadas na geração da tarefa.** O JobBoard continua sendo a única
   porta (CLAUDE.md §5): quem muda é o gerador. Para cada **demanda** aberta (entrada de
   produtor abaixo do alvo, obra, Inn, escola, quartel, tropa, canteiro de estrada, e o
   armazém como demanda permanente), o gerador escolhe a **oferta** de menor lance entre
   todas as casas com a mercadoria na saída **e** os armazéns, e cria a tarefa
   origem→destino com a reserva dupla de hoje. Some a origem única no armazém
   (`origemMaisPerto` passa a varrer ofertas, não armazéns) e some o destino único no
   armazém (a saída vira oferta, e o armazém vira uma demanda entre as outras).
2. **Lance** = distância de caminho da oferta à demanda (pelo `modo` do tipo, como hoje)
   + **multa do armazém** (dado: `delivery.json`, ex.: `multaDoArmazem: 1000`), paga quando
   a demanda é o armazém ou a oferta sai do armazém, **exceto arma armazém→quartel**
   + **20 por unidade já na entrada do destino** (dado), exceto armazém e quartel.
   A distância do serf à origem continua entrando na escolha do serf, como hoje
   (`custoDaTarefa`).
3. **Arma prefere o quartel:** arma não vai ao armazém enquanto algum quartel do lado
   aceita aquela arma. Sem quartel, vai ao armazém como hoje.
4. **Sem aleatório.** O KaM soma `KaMRandom` ao lance; aqui o desempate fica como está
   (`vez` no escasso, depois o número da tarefa), para a sim não gastar o RNG. É o mesmo
   corte que a D-PRODUCAO-01b já fez.

### O que acontece com a escada: vira classe de importância

A escada de 12 níveis estritos **some como ordem**. No lugar dela, cada tipo de tarefa
declara uma de cinco **importâncias** (o filtro estrito do KaM) e o `modo`, que continua
igual. Dentro da mesma importância, decide o lance, não o nível. Os ids ficam (o código e
os testes se referem a eles), e o campo `nivel` sai.

| importância (dado) | KaM | tipos nossos |
|---|---|---|
| 1 | `diHigh1` | ouro-para-escola |
| 2 | `diHigh2` | comida-para-tropa |
| 3 | `diHigh3` | comida-para-inn |
| 4 | `diHigh4` | material-para-obra, pedra-para-canteiro |
| 5 | `diNorm` | insumo (as duas de hoje viram uma), saída para o armazém, arma-para-quartel, excedente (se ficar) |

assentar-estrada e arar saem da escada: não são entrega, e o `modo` deles vai para uma
tabela própria de modos.

**Três decisões do operador que o modelo toca. A proposta não decide nenhuma:**

- **D1 — Inn contra tropa** (C-COMIDA-01, L1: Inn acima da tropa). O KaM põe a tropa
  acima. Proposta: manter a decisão, trocar as importâncias 2 e 3 de lugar, e deixar a
  divergência declarada no `_doc`, como já está.
- **D2 — escola contra Inn.** Hoje o Inn é o primeiro por um `[fonte]` que o fonte
  desmente. Proposta: seguir o KaM (a escola primeiro). Se D1 fica, a ordem é escola >
  Inn > tropa > obra > resto.
- **D3 — pedra do canteiro abaixo dos insumos** (2026-09-27). No KaM ela é `diHigh4`,
  acima de todo insumo. O motivo da decisão foi o lote 2: serf largando a estrada da Bodega
  para levar tábua ao armazém. No modelo novo esse caso some pela multa do armazém (a tábua
  sobrando é `diNorm` + 1000; a comida do Inn é `diHigh3`). Proposta: seguir o KaM (pedra
  junto do material de obra) e medir de novo o cenário do lote 2 antes de fechar. A
  alternativa conservadora é uma sexta classe entre obra e resto, só para ela.

**Fora do escopo, mas vizinho:** o `modo` do material de obra (`livre` aqui, `estrada` no
KaM) é o "quarto erro", pergunta aberta no PROGRESS. Esta feature não mexe nele.

**Excedente (nível 9):** não existe no KaM. Proposta conservadora: ele vira oferta
`diNorm` da casa (pode ir direto a outro consumidor, ou ao armazém com a multa), em vez de
sumir, porque sumir muda o comportamento da D-TRANSPORTE-02a (distribuição baixada) sem
pedido. Marcado como divergência nossa.

### Custo e risco (hipótese, a medir na implementação)

- Casar todas as ofertas com todas as demandas custa caminho. Hoje o gerador mede
  armazém→destino; o novo mede também casa→casa. A `ligacaoEntrePredios` tem cache por par,
  mas o número de pares cresce com as casas. O eixo de medida é determinístico (nós do A*
  expandidos por tick no cenário da F09), nunca relógio (§8).
- Os testes que afirmam a origem no armazém ou o nível estrito vão reprovar. Contagem por
  menção (grep, não compilador): `saida-cheia-para-armazem` em 7 arquivos de teste,
  `insumo-producao-*` em 7, `nivelDoTipo` em 8, `material-para-obra` em 20. A contagem real
  é o que o typecheck e a suíte acusarem, na primeira tarefa da implementação.

## c) Aceite

`tests/D-TRANSPORTE-03-logistica-kam.test.ts`, tudo pelo `step`, sem sistema isolado:

1. **Corrida B do BUG-U:** o cenário da sonda de 2026-09-30 (vila do `createInitialState(1)`,
   Oficina de Armas e Quartel ligados por estrada, um carpinteiro, dois recrutas, encomenda
   de 5 de cada arma, 40 pedras a cada 200 ticks na saída da escola). As 15 armas entram no
   quartel, e os dois recrutas viram soldado antes do teto de segurança. Hoje: 0 de 15.
2. **Arma prefere o quartel:** no mesmo cenário, nenhuma arma entra no armazém enquanto o
   quartel aceita. Sem quartel, as 15 vão ao armazém (o fallback de hoje, a corrida base).
3. **Tora direto:** Lenhador e Serraria ligados, entrada da serraria abaixo do alvo, armazém
   sem tora. A tora sai numa tarefa com origem no lenhador e destino na serraria, e o
   armazém recebe **zero** tora enquanto a serraria tem vaga.
4. **Serraria cheia, a tora vai ao armazém:** o comportamento de hoje continua sendo o
   fallback.
5. **Armazém ainda abastece:** lenhador sem tora, armazém com tora, serraria com vaga. A
   tora sai do armazém (a multa pesa, mas não proíbe).
6. **Razão, não total** (memória "aceite de modelo afirma razão"): viagens de serf por tora
   entregue à serraria, no cenário 3, no modelo novo contra o de hoje. O piso é medido
   entre os dois na implementação (hoje é 2 viagens por tora; o esperado é 1).
7. **Classes de importância:** Inn, escola, tropa e obra com demanda aberta e só um serf
   livre: ele atende pela ordem das importâncias do dado (a ordem de D1/D2/D3 que o operador
   escolher), e dentro da última classe pelo lance.
8. **Guarda estrutural** (dado ↔ runtime): todo tipo de tarefa de transporte tem importância
   no dado, e a multa do armazém e os 20 por unidade vêm do dado (validate:data e teste que
   adultera a cópia).
9. **Não-regressão do lote 2:** o cenário da F-CAL-a não morre de fome (o teste existente
   continua verde sem mudar número).
10. Invariantes do JobBoard e da FSM sem violação; toda tarefa reclamada tem `release`;
    determinismo byte a byte com a mesma semente; nós do A* por tick no cenário da F09 com
    teto medido (eixo determinístico).

## d) Medições do BALANCE_LOG que ficam inválidas

Critério: a medida depende de **por onde a mercadoria passa** ou de **qual entrega o serf
escolhe primeiro**. Conferi abrindo cada entrada; as marcadas "hipótese" eu li só o título
e o primeiro parágrafo.

| linha | entrada | por que cai |
|---|---|---|
| 32 | colisão civil D1b: F-CAL fechado 7486→7997, pedreira 715→827, bodega 522→557 | as duas pontas foram medidas com a pedra e a tábua passando pelo armazém; a linha de base muda |
| 620 | "o arranque do oráculo é lento e é transporte" (primeira pedra no armazém) | a pedra da pedreira passa a ir direto à obra (demanda de casa, sem multa) |
| 650 | "o ritmo da abertura é a reposição de pedra" (armazém a 3 pedras no tick 917) | mesmo motivo: a medida é o estoque do armazém na abertura |
| 988, 1009 | folga de pedra da abertura, remedida com a pedra viajando por tile; pedra inicial 34 → 30 | a folga em **quantidade** continua valendo; os **ticks** das pontas (1319, 2129, 2563…) caem. Hipótese na parte da contagem |
| 1134, 1150 | lote 2: madeira 0,55 → 0,71/min "com a escada consertada" | o argumento é a escada (excedente contra pedra do canteiro); o número fica até medir de novo, a conclusão cai |
| 1223 | `farm.sai.corn` 3.0 → 2.0, o 1:1:1 | a entrada do moinho foi medida com o milho passando pelo armazém |
| 1245 | lote 1, cadeia de comida (`docs/calibracao-fase-b.md`) | vazão da cadeia com duas viagens por insumo. Hipótese: não abri o arquivo do lote |
| 1290 | 1 Fazenda : 1 Moinho : 1 Padaria, moinho 26,2% e padaria 28,8% esperando insumo, "não é logística" | a afirmação "não é logística" foi medida no modelo de duas viagens |
| 753 | metalurgia é o gargalo, o minério empilha no armazém | a razão 2:1 de produção continua; o "empilha no armazém" muda (minério vai direto à metalurgia) |

**Continuam valendo** (não dependem do trajeto do serf): 1321 (a viagem da F-T3 é do
especialista, não do serf), 92 (tempo de colheita derivado da taxa), 583 (as 20 obras são
abastecidas do armazém nos dois modelos), as entradas de combate (C-IA-04, C-TELA-04,
cadência) e a de fome no limiar (40), esta como hipótese.

**Testes de calibração que provavelmente mudam de número** (hipótese, a confirmar rodando):
`tests/F-CAL-a-cenario.test.ts`, `tests/F-CAL-b-calibracao.test.ts`,
`tests/F17b-escada-do-serf.test.ts` (afirma a escada estrita). Pela regra do §12 eles não
se ajustam um a um: a mudança de modelo roda o cenário longo uma vez e o lote de
recalibração decide.
