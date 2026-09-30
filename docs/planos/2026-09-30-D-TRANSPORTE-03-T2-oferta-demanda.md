# D-TRANSPORTE-03 T2 (oferta × demanda, multa do armazém, +20 por unidade) — plano

Proposta: `docs/planos/2026-09-30-D-TRANSPORTE-03-logistica-kam.md`. T1:
`docs/planos/2026-09-30-D-TRANSPORTE-03-T1-importancia-e-arma.md`. Autorização do operador
(2026-09-30): "T2 — casamento oferta×demanda + multa do armazém + 20/unidade. Aceites 3, 4, 5,
6, 9, 10. Cenário longo de novo, delta contra T1."

## Fonte (clone 731a8a4, `HL` = `src/hands/KM_HandLogistics.pas`)

- Multa do armazém, +1000: a oferta que sai do armazém (menos arma do armazém ao quartel) e a
  demanda do armazém (`wtAll`) pagam 1000 no lance (`HL:1587-1590`).
- +20 por unidade: o lance soma 20 × o que o destino já tem daquela mercadoria
  (`CheckWareIn`), menos quartel, armazém e prefeitura (`HL:1612-1618`).
- O lance é em TILES (`EvaluateFast = GetLengthDiag`, `HL:2809-2812`). O nosso custo é A* em
  ticks: o dado fica em tiles e vira ticks no carregamento, vezes o passo a pé na estrada, como
  o `custoPorUnidade_tiles` da colisão civil (`loader.ts:599-601`).

## Desenho

1. **Dado.** `delivery.json` ganha `lance.multaDoArmazem_tiles` (1000) e
   `lance.porUnidadeNaEntrada_tiles` (20), com a fonte. O loader converte uma vez para
   `entrega.lance.ticksMultaDoArmazem` / `ticksPorUnidadeNaEntrada` (`Math.round`). A regra de
   dado exige número finito ≥ 0.
2. **Lance na ordem do serf** (`src/sim/jobs.ts`, `ordenarTarefasDoSerf`). A chave continua
   `(importância, custo, vez, número)`, e o custo passa a ser A* + `lanceDaTarefa`:
   - + multa se a origem ou o destino é armazém, menos `arma-para-quartel`;
   - + porUnidade × `entrada[mercadoria]` do destino completo que não é armazém nem quartel.
   `custoDaTarefa` continua sendo só o caminho (quem mede caminho não muda).
3. **A origem do insumo entre as ofertas** (`src/sim/systems/jobs.ts`). `origemDoInsumo`
   troca `origemMaisPerto` só em `gerarTarefasDeInsumo`: armazém (ligação + multa) ou casa
   completa do mesmo lado, que não é armazém, quartel nem o destino, com oferta livre na `saida`
   (ligação). O menor vence; empate, `predios.ordem`. `ORIGEM_ESPERADA_POR_TIPO` dos dois insumos
   vira `'qualquer'`.
   - Oferta livre da casa = `disponivelNaOrigem` (a `saida` menos o que está RECLAMADO), menos
     o que este mesmo passo já apontou para ela (`usados`). Tarefa aberta de outro destino não
     desconta: aberta não reserva, e descontá-la deu o carvão todo ao primeiro fundidor (a
     regressão do D-PRODUCAO-01b, 20/2/0; com `disponivelNaOrigem`, 10/6/6). O
     `ofertaDaCasaParaDemanda` da primeira versão saiu por isso.
4. **A saída cheia cede à demanda.** `gerarTarefasParaArmazem` e o grupo do saneamento
   (`grupoDeAbertas`) descontam da oferta da `saida` as tarefas de OUTRO tipo que saem da casa
   (aberta ou reclamada). A `saida-cheia` aberta que sobra é cancelada pelo teto, e o insumo leva
   a tora direto. Serraria cheia: não há insumo, a tora vai ao armazém (a queda).

Fora do T2 (PARA REVISÃO no PROGRESS): material de obra, comida da Bodega e ouro da escola
direto da casa (o KaM casa toda oferta com toda demanda; a autorização e os aceites falam da
cadeia de produção); excedente da `entrada` como oferta direta a outro consumidor; reapontar a
aberta de insumo que já saía do armazém quando a casa passa a ter oferta.

## Aceites (teste `tests/D-TRANSPORTE-03-T2-oferta-demanda.test.ts`)

- 3: lenhador → serraria direto; o armazém recebe zero tora enquanto a serraria tem vaga.
- 4: serraria cheia (sem demanda), a tora vai ao armazém.
- 5: lenhador vazio, armazém com tora: a tora sai do armazém.
- 6: viagens de serf por tora entregue na serraria, novo contra velho (velho medido na árvore
  a1dbb5c por sonda, na evidência), com piso entre os dois.
- 8: multa e +20 vêm do dado: cópia adulterada (multa 0) muda a escolha; negativa reprova.
- 9: F-CAL-a não passa fome (o teste existente, verde).
- 10: invariantes, determinismo, nós do A* no cenário do F09 com teto medido.
- BLOQUEANTES: corrida B 15/15 no quartel (`tests/D-TRANSPORTE-03-logistica-kam.test.ts`);
  cenário longo com parado ≤ 13 184 e padaria ≤ 696.
