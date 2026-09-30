# Lote de recalibração: D-TRANSPORTE-03 T2 (oferta × demanda) + BUG-X (especialista dentro) — plano

Pedido do operador (decisões da manhã, 2026-10-01): "depois do BUG-X, planejar o lote de
recalibração do BALANCE_LOG juntando T2 e BUG-X". **Só plano. Nenhum número muda nesta
sessão**, e o lote não começa antes das três decisões da seção "Pré-condições".

## O que entra e o que não entra (conferido)

- **T2 muda o trajeto da mercadoria, não o número.** A branch `wip/D-TRANSPORTE-03-T2`
  (`ebb2182`) casa a oferta com a demanda de casa, e por isso a tábua e a pedra deixam de
  passar pelo armazém. A medida dela está em `PROGRESS.md`, "2026-10-01 — T2", com a tabela
  base / T1 / T2 de 20 000 ticks.
- **BUG-X não mudou a sim.** `git diff --stat 1416d1b^ 1416d1b` não tem `src/sim`. O teste do
  BUG-X mede 0 bloqueios de serf pelo especialista, com a colisão ligada ou desligada. A parte
  de sim do BUG-X, "casa fechada: sai e perde a posse", **não existe**: ela depende de o
  operador derrubar a F16c (c) ("o ocupante fica"), pergunta aberta no PROGRESS. Entra no lote
  **só se** essa decisão sair antes. Sem ela, o BUG-X contribui com zero para o lote.
- **Não entram:** as entradas de combate (bodoqueiro, cadência, C-IA-04, C-TELA-04) e a fome no
  limiar. Não dependem do trajeto nem da casa. Ficam para um lote de combate.

## Entradas do BALANCE_LOG que o lote revisita

A tabela das entradas cuja premissa cai com o T2 já está no plano do D-TRANSPORTE-03
(`docs/planos/2026-09-30-D-TRANSPORTE-03-logistica-kam.md`, seção "Entradas do BALANCE_LOG",
linhas 32, 620, 650, 988/1009, 1134/1150, 1223, 1245, 1290 e 753 do BALANCE_LOG). O lote
lê essa lista e não a repete. A ela se somam duas observações novas, que entram no
BALANCE_LOG quando o lote abrir:

1. **Serraria: a parada muda de rótulo.** Medido: parada de 2 705 na base e 3 529 no T2. A
   leitura da leva noturna é que o `saida_cheia` virou `esperando_insumo`, porque a tábua
   passou a sair mais depressa e a tora é que limita. **Isso é hipótese:** ninguém mediu a
   soma parada + `saida_cheia` por árvore. É a primeira medida do lote.
2. **Tábua a −2,04 % (98 → 96) e tora 51 → 50.** Com 20 000 ticks e uma semente, 2 tábuas
   podem ser ruído de fase. A segunda medida do lote é a mesma conta em 3 sementes.

## Pré-condições (decisões do operador, nenhuma tomada aqui)

1. **Métrica do aceite 2 do T2.** A escolha é entre "parada ≤ base + 5 %" (reprova a
   serraria) e "parada + `saida_cheia` ≤ base + 5 %", ou outra. Sem a métrica o merge não
   acontece, e o lote mede em cima da árvore errada.
2. **Tolerância da produção.** −2 % numa semente ou a média de 3 sementes.
3. **F16c (c).** Se cair, o BUG-X ganha a parte de sim (a casa fechada tira o ocupante),
   e ela entra neste lote **antes** da medida. Se ficar, o lote segue sem BUG-X.

## Procedimento (quando as pré-condições saírem)

A regra do §12 vale: juntar, girar tudo junto, rodar o cenário longo **uma vez**.

- **Tarefa 1 — linha de base.** Na `main` depois do merge do T2 (e da casa fechada, se
  entrar), rodar a vila da calibração por 20 000 ticks em 3 sementes. Por casa: parada,
  `saida_cheia` e `esperando_insumo`. Por cadeia: produção entregue (o acumulado, não o
  saldo; ver "medição contra a linha de base"). Gravar em `test-output/`. Nenhuma asserção
  de relógio.
- **Tarefa 2 — os testes de calibração que mudam.** Rodar `tests/F-CAL-a-cenario.test.ts`,
  `tests/F-CAL-b-calibracao.test.ts` e `tests/F17b-escada-do-serf.test.ts` e listar quem
  reprova, com o número. **Não ajustar um a um.** A lista é a entrada da Tarefa 3.
- **Tarefa 3 — candidatos a giro, escritos antes de girar.** Para cada entrada que caiu,
  vai numa tabela o número suspeito, o arquivo em `data/`, o valor atual, a direção e o
  motivo medido. Candidatos prováveis, **hipótese** até a Tarefa 1:
  - `woodcutters` (a tora limita a serraria);
  - a pedra inicial (30), porque a pedra passa a ir direto à obra;
  - `farm.sai.corn` (2,0), só se o 1:1:1 da cadeia do pão sair do lugar.

  O operador aprova a tabela; o giro é um commit só.
- **Tarefa 4 — o cenário longo, uma vez.** Com os números girados: vila da calibração,
  20 000 ticks, 3 sementes; `npm run verify`; o F-CAL inteiro. As entradas revisitadas
  fecham no BALANCE_LOG, em "Ciclos fechados", com a tabela antes/depois. As abertas que
  este lote resolve saem da seção de abertas.

## Aceite do lote

- As entradas da lista do D-TRANSPORTE-03 que caíram estão remedidas ou marcadas no próprio
  BALANCE_LOG. Ver "premissa morta se marca no próprio dado".
- Parada por casa e produção por cadeia, nas 3 sementes, dentro da métrica que o operador
  escolheu, afirmadas num teste permanente, pelo eixo determinístico (contagem de ticks e de
  unidades entregues).
- Um único commit de números, com a tabela da Tarefa 3 na mensagem ou no PROGRESS.

## Fora de escopo

- Qualquer mecanismo novo. O lote gira número; mecanismo novo volta para o BUILD_PLAN.
- O `TETO_DE_NOS` do T2 (condição b do merge). É guarda de desempenho do A*, não de
  balanceamento, e faz parte do merge, não do lote.
