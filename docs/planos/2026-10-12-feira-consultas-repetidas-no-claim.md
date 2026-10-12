# Feira — consultas repetidas durante a escolha de transporte

Pedido do operador, 2026-10-12: corrigir o código após o timeout de F35(b)
no `verify:rapido`, mantendo os testes e o limite de cinco segundos.

## Diagnóstico

O `verify` completo passou; o rápido reprovou F35(b) por timeout.
Os sete testes de F35 passam isoladamente. O perfil de CPU do cenário com
vinte serfs aponta consultas repetidas de ocupação (`tarefaReclamadaPor`) e
de tarefas em curso na Feira (`serfsNaFeira`) durante `reclamarMelhor`.
O perfil é evidência de diagnóstico em `test-output/diagnostico-feira/`,
não um critério de tempo novo e não comprova a correção.

## Escopo e aceites

1. Reutilizar as consultas de ocupação e contagem por Feira somente durante
   uma chamada de `reclamarMelhor`, sobre o mesmo estado. Não guardar cache
   no `GameState`, não alterar a serialização e não compartilhar respostas
   entre unidades ou chamadas sucessivas.
2. Com várias candidatas recusadas pelo teto da Feira, a consulta ao quadro
   para ocupação da unidade e contagem daquela Feira ocorre uma vez por
   escolha. Medir leituras do quadro por um observador determinístico;
   nenhuma asserção de relógio.
3. Preservar primeira recusa, ordem de escolha, limite de `maxSerfs`, reservas,
   transição `reclamada`/`carregando` e liberação. Uma nova chamada precisa
   observar imediatamente qualquer alteração do quadro.
4. F35 completo e os testes dirigidos do JobBoard passam no mundo normal e
   transladado; `npm run verify:rapido` e `npm run verify` passam com os
   limites e os critérios existentes, sem mudar timeout, workers ou skips.

## Tasks

1. Registrar este plano em commit próprio antes da correção.
2. Acrescentar proteção determinística para as consultas repetidas e a
   atualização entre chamadas; corrigir apenas o JobBoard; registrar a
   verificação em `PROGRESS.md`; commit próprio da correção.
3. Versionar a capa candidata e seu prompt na `main` em commit separado.
   Essa task não aplica a candidata ao menu, não homologa a arte e não faz push.

Não alterar `test-results.json`, `.claude/`, `AGENTS.md`, dados de balanceamento
ou critérios já existentes. Não fechar outros bugs a partir deste diagnóstico.
