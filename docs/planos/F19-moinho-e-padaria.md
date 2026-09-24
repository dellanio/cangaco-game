# F19 — Moinho e Padaria (cadeia do pão)

> Plano escrito **depois** da Tarefa 1 e por causa dela. O item da fila manda
> MEDIR antes de implementar, e a medição mudou o escopo: a cadeia já funciona
> inteira. O que sobra é prová-la, registrar o que ela expôs, e não inventar
> trabalho para preencher o item (decisão do operador, 2026-09-24).

## Tarefa 1 — MEDIR (feita; é o que este plano reporta)

**Pergunta:** a cadeia `corn → flour → loaves` roda sem uma linha de código
novo? A produção é genérica desde a F15a e as tarefas de insumo entre prédios
existem desde a F15b; o dado de `mill` e `bakery` está em `production.json`
desde sempre.

**Como:** sonda descartável (`tests/zz-probe-F19.test.ts`, apagada), com o
cenário 1 Fazenda : 1 Moinho : 1 Padaria — a proporção que o próprio
`production.json` publica como oráculo —, todos ocupados, ligados à mesma
estrada e a um armazém, com 4 serfs. 12 000 ticks.

**Resposta: roda inteira, e nada faltou.**

| medida | valor |
|---|---|
| primeiro milho | tick 546 |
| primeiro fubá | tick 885 |
| primeiro cuscuz | tick 1256 |
| cuscuz em 12 000 ticks | 68 |
| moinho esperando insumo | 3 144 ticks (26,2 %) |
| padaria esperando insumo | 3 457 ticks (28,8 %) |
| fazenda esperando insumo | 0 |
| gavetas no fim | todas vazias (nenhuma fila acumulou) |

O dado bate com o GDD §5.2 linha a linha (Mill 3×3, Baker, `corn → flour`;
Bakery 3×3, Baker, `flour → 2 loaves`), o tema já traz **Fubá** e **Cuscuz**, e
a corrente de desbloqueio `farm → mill → bakery` já está em `buildings.json`.

### O que a medição EXPÔS

**(a) O oráculo 1:1:1 ficou otimista — por causa da F18.** `production.json`
publica `farm_por_mill: 1` e `mill_por_bakery: 1` e diz, no `_doc`, que um
cenário que respeite as proporções *"não pode acumular fila infinita nem deixar
prédio ocioso"*. Ele deixa: 26 % e 29 %. A conta fecha e a causa é conhecida —
a fazenda entrega um milho a cada **321** ticks (246 do ciclo + os 300 do
plantio diluídos em 4 colheitas), e o moinho consome um a cada **246**. Ocioso
previsto: 23,4 %. Os ~3 % a mais são a viagem do serf. **Balanceamento, e vai
em lote** (`BALANCE_LOG.md`), não se conserta item a item.

**(b) Prédio parado por falta de insumo não tem alerta.** As causas da F22 são
`sem-trabalhador`, `sem-estrada`, `veio-esgotado` e `sem-campo`. Uma padaria sem
fubá — para sempre, porque o moinho caiu — fica muda. Durante 29 % do tempo
isso é o regime normal da cadeia, então a causa nova precisaria de um limiar, e
isso é **desenho**: vira Nota na F20, que é onde a fome torna o silêncio caro, e
o operador decide.

## Tarefa 2 — a cobertura permanente

A sonda prova o momento, não o amanhã (CLAUDE.md §8). Vira teste.

- `tests/helpers/producao-cenario.ts`: `cenarioDaCadeiaDoPao()` — a mesma
  disposição, com auto-conferência (`exigirLigado` nos três).
- `tests/F19-cadeia-do-pao.test.ts`:
  1. **a cadeia fecha**: partindo de zero fubá e zero cuscuz *na linha de base*,
     o cuscuz aparece — e os três marcos vêm do dado, não digitados;
  2. **o elo do meio é real**: sem o moinho, a mesma vila não faz um cuscuz. É
     o que impede o teste de passar por a padaria fabricar pão do nada;
  3. **a vazão é limitada pela FONTE**: o cuscuz entregue fica dentro do teto
     que a fazenda permite (2 pães por milho), e acima de 85 % dele — o que
     afirma, junto, que o transporte não é o gargalo e que nada se perde;
  4. **nenhuma fila infinita**: as gavetas no fim estão abaixo do teto;
  5. **o jogador alcança a cadeia**: `opcoesDoMenuBuild` libera `mill` com a
     fazenda completa e `bakery` com o moinho completo.
- `test-output/F19.json` com a série medida.

## Tarefa 3 — fechar

- `BUILD_PLAN.md`: **escrever o item**, que hoje é um cabeçalho vazio, com o que
  a medição decidiu; Nota na F20 (o silêncio do prédio sem insumo).
- `BALANCE_LOG.md`: o oráculo 1:1:1 contra os 26 %/29 % medidos.
- `PROGRESS.md`, `test-results.json` depois do `verify`, commit.

**Sem screenshot, e o motivo é o mesmo da F18**: nada muda na tela e o harness
não constrói prédio — moinho e padaria estão atrás de `farm`, que está atrás de
`sawmill`. O que a tela mostraria já está no HUD genérico de mercadorias.
