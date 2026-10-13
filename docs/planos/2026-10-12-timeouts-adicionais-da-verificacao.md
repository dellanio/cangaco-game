# Diagnóstico e correção dos timeouts adicionais

Pedido do operador, 2026-10-12: após a correção das consultas da Feira,
criar um plano separado para os novos itens identificados. Este plano não
autoriza afrouxar verificação e não altera a fila de `BUILD_PLAN.md`.

## Estado inicial e evidências

A correção de F35 tem seis regressões novas e passou nos quatro arquivos
dirigidos do JobBoard, normal e transladado: 97 testes em cada mundo. O cenário
com 30 tarefas caiu de 1.230 para 90 leituras. O aceite global do plano de F35
continua pendente: o `verify` após a correção reprovou em F05a e F24a, e não
executou a suíte transladada completa. Não considerar a Feira homologada nem
integrar à `main` enquanto os portões obrigatórios estiverem reprovados.

Há sete casos em seis arquivos. São falhas observadas; suas causas ainda não
foram isoladas. Passar numa corrida posterior não prova uma correção de causa.

| Item | Arquivo e caso | Limite existente | Observação |
|---|---|---|---|
| Rebrota 1 | `F-REPL-a-toco-rebrota.test.ts`: mata de 2 tiles, com e sem reposição | 10.000 ms | Timeout no rápido antes da correção de F35, inclusive numa corrida em que os outros casos passaram |
| Rebrota 2 | `F-REPL-a-toco-rebrota.test.ts`: toco sob estrada e sem estrada | 15.000 ms | Timeout no rápido antes da correção de F35 |
| Abertura | `F17-aceite.test.ts`: quatro prédios completos, ocupados, ligados e timber entregue | 5.000 ms | Timeout no rápido antes da correção de F35 |
| Couro | `F24b-cadeia-do-couro.test.ts`: sem Curtume, couro cru presente e nenhum curtido ou gibão | 5.000 ms | Timeout no rápido antes da correção de F35 |
| CLI inicial | `F05a-estado-inicial.test.ts`: `npm run sim -- inicial --ticks 0` | 30.000 ms no subprocesso e no caso | `spawnSync cmd.exe ETIMEDOUT` no completo após a correção de F35 |
| Armas | `F24a-armas.test.ts`: save/load no meio do rodízio | 5.000 ms | Timeout no completo após a correção de F35 |
| Vazão do lenhador | `LOTE3-fases-quatro.test.ts`: `woodcutters`, vazão em 6.000 ticks igual ao modelo anterior (+/-1) | 5.000 ms | Timeout no rápido após a correção de F35 |

Evidências locais (ignoradas pelo Git, não são aceites novos):

- `test-output/diagnostico-feira/antes-da-correcao-verify-rapido.json`: cinco
  reprovações, incluindo F35; quatro são os primeiros itens desta tabela.
- `test-output/diagnostico-feira/verify-completo-corrigido.log`: saída do
  completo após a correção; duas reprovações, F05a e F24a.
- `test-output/diagnostico-feira/verify-rapido-corrigido.log`: rápido após a
  correção; três reprovações, rebrota 1, CLI inicial e vazão do lenhador.
- `test-output/F35-consultas-reclamada.json` e
  `test-output/F35-consultas-carregando.json`: limite estrutural de leituras.

## Contratos imutáveis

### Retomada do diagnóstico em 2026-10-12

Branch `fix/feira-consultas-do-claim`, HEAD
`1706299b285cc8c516961856686dd259722d5917`, com a correção da Feira ainda
na árvore de trabalho. Os seis arquivos juntos passaram no normal (53 testes,
28,65 s) e no transladado (52 testes, uma exclusão preexistente, 23,35 s).
Nenhum dos sete timeouts reproduziu nessas corridas dirigidas. Isso não fecha
os itens nem demonstra uma correção de causa.

Logs: `test-output/diagnostico-timeouts/normal.log` e `transladado.log`.
Uma terceira corrida dos seis arquivos, com profiler iniciado antes da
importação de cada arquivo, também passou (53 testes). Perfis individuais e
`perfis-resumo.json` ficam no mesmo diretório ignorado. Workers, limites e
cenários não foram alterados. As sondas normais usam diretórios separados de
evidência; a configuração transladada mantém o diretório que já declara.

Concentrações observadas (amostras próprias, não orçamento de operações):
rebrota em `avancarNevoa` (661); lenhador em `predioQueContrata` (668),
`step` e `distanciaPorEstrada`; abertura, armas e couro têm custo distribuído
entre `step`, importação e consultas. Isso aponta onde investigar, mas não
comprova recomputação redundante nem define ainda um aceite estrutural.

O comando real `npm run sim -- inicial --ticks 0`, sob a trava e com uma
sonda de fases externa ao código, encerrou com código zero. No processo da
simulação: criação do servidor Vite de 182 a 530 ms, importação de `state.ts`
de 530 a 7.438 ms, importação de `tick.ts` até 7.871 ms, fechamento até
7.947 ms. O log mostra o otimizador de dependências do cliente iniciado.
Evidência: `cli-fases.jsonl` e `cli-real.log`. Hipótese: preparação do Vite
contribui para o timeout sob carga; falta isolar a contribuição do otimizador
e reproduzir a falha. Não alterar o runner com base apenas nessa hipótese.

A task 1 permanece aberta: falta causa comprovada, proteção determinística
correspondente e o commit do aceite. Nenhum código adicional foi corrigido
nesta retomada.

O `npm run verify` desta retomada saiu 0: typecheck e lint aprovados,
35 arquivos de dados e dez fases sem erros, normal 341 arquivos/2.976 testes
aprovados, transladado 341 arquivos/2.974 testes aprovados com cinco exclusões
preexistentes. Log: `test-output/diagnostico-timeouts/verify.log`.
Não atribuir esse verde a uma correção dos sete timeouts.

Sonda do CLI sem descoberta/otimização de dependências do cliente, sem
alterar arquivo versionado: `state.ts` ainda levou 6.880 ms, e o processo
da simulação encerrou em 7.788 ms. O custo não desapareceu; a hipótese de
que apenas o otimizador explica a demora não se confirmou. Log:
`cli-sem-otimizador.log`, fases no mesmo `cli-fases.jsonl`.

- Manter limites de relógio, workers, exclusões, skips, cenários, sementes e
  critérios existentes. Não reduzir janelas, amostras ou ticks para passar.
- Rebrota: manter a janela de 12.000 ticks, a diferença com/sem reposição, o
  bloqueio sob estrada e zero unidades dentro de árvores.
- F17: preservar o teto de 5.300 ticks, os quatro prédios, ocupantes, rede e
  timber entregue. Não substituir comandos por injeção de estado.
- F24b: preservar o contraexemplo sem Curtume, a janela de 2.000 ticks após
  o primeiro couro cru, ausência de produtos finais e invariantes da cadeia.
- F05a: preservar a invocação real por `npm run sim`, a saída da tabela e o
  código zero. Não substituir o comando por uma simulação falsa. A exclusão
  já existente deste subprocesso no mundo transladado não pode ser ampliada.
- F24a: preservar a corrida de 2.600 ticks, save no tick 1.900, encomendas e
  igualdade byte a byte com/sem save. Não trocar hashes ou o formato do save.
- LOTE3: preservar a corrida de 6.000 ticks, produção positiva, diferença de
  no máximo uma unidade em relação ao modelo anterior e os guardas de fases.
- Nada em `test-results.json`, `.claude/` ou `AGENTS.md`; nada de push.

## Tasks — um commit por task executável

### 1. Reproduzir e separar custo de simulação, importação e subprocesso

Rodar os seis arquivos pelas configurações normais do projeto, pela trava:

```powershell
node tools/trava-de-testes.js npx vitest run tests/F-REPL-a-toco-rebrota.test.ts tests/F17-aceite.test.ts tests/F24b-cadeia-do-couro.test.ts tests/F05a-estado-inicial.test.ts tests/F24a-armas.test.ts tests/LOTE3-fases-quatro.test.ts
node tools/trava-de-testes.js npx vitest run tests/F-REPL-a-toco-rebrota.test.ts tests/F17-aceite.test.ts tests/F24b-cadeia-do-couro.test.ts tests/F05a-estado-inicial.test.ts tests/F24a-armas.test.ts tests/LOTE3-fases-quatro.test.ts -c vitest.transladado.config.mts
```

Respeitar a exceção transladada existente do CLI. Registrar branch, HEAD,
limites, fila da trava, nomes dos casos, saída e código de retorno. Comparar
os casos isolados com os portões do projeto sem mudar sua configuração.
Cronometragem é evidência, nunca asserção. Usar `CANGACO_EVIDENCIA_DIR` nas
sondas novas, com diretórios distintos para normal e transladado.

O perfil deve incluir a importação/preparação: F24b roda uma cadeia dentro do
`describe`, antes dos `it`; medir só o corpo do teste omitiria esse custo.
F05a exige diagnosticar também o processo filho e a resolução de `npm.cmd`.
Se o timeout não reproduzir, registrar isso e a incerteza; não fechar o item.

**Aceite da task:** matriz dos sete casos, logs e perfil que identifique onde
o trabalho se concentra; nenhum teste ou limite alterado. Atualizar este plano
com diagnóstico e critério estrutural de custo, em commit antes de código.

### 2. Corrigir a causa comprovada nos dois casos de rebrota

Usar o perfil da task 1. Reduzir somente recomputação comprovadamente redundante;
manter o mesmo percurso de ticks e decisões. Acrescentar proteção determinística
de operações, que reprove antes da correção; não usar teto de tempo como prova
de desempenho. Conferir recursos, replantios, estrada, FSM e estado final.

**Aceite:** F-REPL-a inteiro aprovado normal e transladado, resultado preservado
e redução de trabalho comprovada; validar consumidores do trecho alterado.

### 3. Corrigir a causa comprovada na abertura da Fase A

Preservar a cadeia inteira por comandos. Perfil e guardas devem cobrir o elo
efetivamente responsável pelo custo, sem mexer em balanceamento ou geometria.

**Aceite:** F17 inteiro aprovado normal e transladado, marcos e entrega
preservados, com proteção da redução de recomputação identificada na task 1.

### 4. Corrigir a causa comprovada no contraexemplo do couro

Preservar a cadeia completa e o contraexemplo sem Curtume. Separar preparo
do cenário e corpo do teste; a correção não pode transferir trabalho para fora
do teste com a finalidade de escapar do limite.

**Aceite:** F24b inteiro aprovado normal e transladado, inclusive ausência de
curtido/gibão, conservação e invariantes; proteger o custo redundante identificado.

### 5. Corrigir a causa comprovada no CLI inicial do Windows

Diagnosticar onde o subprocesso espera: lançamento, importação ou criação do
estado. Preservar o caminho público `npm run sim` e sua compatibilidade real;
nenhuma troca de comando no teste ou nova exclusão para esconder a falha.

**Aceite:** F05a inteiro aprovado no normal e demais casos no transladado,
saída e código de retorno preservados; evidência do comando real encerrando.

### 6. Corrigir a causa comprovada no save/load das armas

Medir as três corridas do guarda de determinismo, os comandos de encomenda e
a serialização. Preservar a igualdade de estado e a semântica das encomendas.

**Aceite:** F24a inteiro aprovado normal e transladado, incluindo igualdade
byte a byte; proteção estrutural do trabalho redundante identificado na task 1.

### 7. Corrigir a causa comprovada na comparação de vazão do lenhador

Medir as corridas atual e do modelo anterior no mesmo cenário, preservando
as fases e a janela integral. Nenhum ajuste em rendimento, descanso, viagem
ou tolerância para fazer a comparação passar.

**Aceite:** LOTE3-fases-quatro inteiro aprovado normal e transladado, com
vazão, fases e diferença máxima de uma unidade preservadas; proteger o custo
redundante identificado na task 1.

### 8. Fechar os portões e integrar a entrega pendente

Rodar `npm run verify:rapido` antes de cada commit e `npm run verify` no
fechamento. Todas as camadas devem passar; repetir verde não substitui explicar
as reprovações. Registrar saída e riscos restantes em `PROGRESS.md`.
Conferir o aceite global ainda pendente da Feira, a capa candidata e a limpeza
da `main` antes de qualquer integração autorizada. Quem marca feature é o operador.

## Limites de execução

Este documento é planejamento; as tasks acima ainda não foram executadas como
plano. As corridas anteriores constituem diagnóstico inicial e não fecham itens.
Não escolher uma implementação só para obter uma corrida verde. Se o perfil
apontar mudança de comportamento, balanceamento, hardware/configuração de teste
ou refatoração ampla não coberta aqui, parar e reportar antes de alterar código.
Se várias falhas tiverem uma causa comum comprovada, registrar a dependência e
o conjunto de aceites coberto antes de implementar; não fazer remendos cegos.

## Diagnóstico causal e aceite estrutural — 2026-10-12

A task 1 identifica custos redundantes, sem afirmar que cada timeout histórico
teve uma causa exclusiva. Os perfis e sondas preservam todos os limites de teste.

1. CLI: o perfil do processo filho concentra 4.312 amostras em `FSWatcher`.
   Desativar apenas o observador na sonda externa reduz o carregamento de
   `state.ts` de 6.908 para 533 ms e o processo da simulação de 7.966 para
   1.582 ms, mantendo a saída e código zero. Remover apenas o otimizador não
   removeu o custo. O CLI executa uma corrida e fecha; não precisa observar
   arquivos. Aceite permanente: o servidor criado pelo runner usa `watch: null`,
   comprovado por um processo com Vite instrumentado, e o comando real de F05a
   permanece íntegro e passa. Nenhuma dependência, comando ou timeout muda.
2. Consulta de contratação: `tiposContratadosEm` percorre a lista e, para cada
   elemento, busca o mesmo elemento novamente. Sonda: seis tipos, 27 leituras
   de entradas. Aceite: no máximo N leituras para N tipos; ordem, referências,
   prefeitura por padrão, Igreja explícita, dados injetados e ausência de cache
   persistente preservados. `ehPredioDeContratoCompleto` não precisa construir
   uma lista para responder sim/não e deve parar no primeiro tipo correspondente.
3. Névoa: ao conferir um array de descoberto de outra linha/save, o fallback
   varre todos os 16.384 tiles, embora só 348 estejam visíveis no estado inicial.
   Isso aparece nos cenários de rebrota que alternam estados/dados e no save/load.
   Aceite: conferir somente os tiles com contagem positiva, com índice derivado
   fora do GameState, mantido por carimbo/descarimbo; nenhuma consulta à contagem
   para tile invisível no fallback. Comparar a contagem e o índice a uma visão
   nova após movimento, morte, mudança de lado, obra completa/demolida e load.
   Preservar descoberto monotônico, byte a byte e o custo por olho que mudou.

Evidências ignoradas: `causas-antes.json` (27 leituras e 16.384 consultas),
`cli-child.cpuprofile`, `cli-sem-watch.log`, `cli-fases.jsonl` e os seis perfis.

Dependências de execução: task 2 corrige a varredura da névoa; task 3 corrige a
consulta de contratação compartilhada por abertura, couro, armas e lenhador.
Tasks 4, 6 e 7 verificam seus contratos completos sobre essas correções comuns,
sem inventar uma mudança distinta para cada sintoma. Task 5 corrige o observador
no CLI. Cada correção executável tem commit próprio, depois deste aceite.
A task 6 conserva e repete três vezes o guarda original de save/load.
A matriz final exige os seis arquivos normais/transladados e o verify completo.
Uma corrida verde não prova ausência futura de pressão de CPU: fechamento aqui
significa remover os custos demonstrados e proteger os comportamentos e custos
com testes permanentes, sem afirmar reprodução de todos os timeouts históricos.

## Ampliação autorizada pelo operador — 2026-10-12

O operador respondeu `autorizado` à inclusão dos três timeouts do rápido:
F18 (evidência do roçado, 5 s), F17f (arquivos e dimensões, 5 s) e F-VIVO-a
(pilhas do armazém em 6.000 ticks, 10 s). Todos os critérios existentes ficam
intactos; nenhum worker, timeout, janela, hash, exclusão ou skip muda.

### Diagnóstico dos três casos novos

Os três arquivos juntos passaram em ambos os mundos (42 testes cada).
A corrida normal com perfil também passou. Logs `novos-perfil.log` e
`novos-transladado.log` em `test-output/diagnostico-timeouts/`. A falha histórica
continua registrada no rápido da contratação; o verde dirigido não a apaga.

Sonda `causas-novas-antes.json`: a consulta negativa de requisito militar leu
nove tipos; o saneamento de 20 tarefas, sem mudança do quadro, enumerou e
ordenou o mesmo quadro 24 vezes; a verificação de dimensões leu 22.673.191 bytes
para 960 referências a 547 PNGs distintos. Só 24 bytes de cada PNG são usados.
Os perfis concentram trabalho em requisitos do Quartel (F18), enumeração e
saneamento de tarefas (F-VIVO-a) e abertura/leitura de arquivos (F17f).
Isso comprova trabalho redundante, sem atribuir a cada timeout uma causa única.

### Correções executáveis e aceites adicionais

1. Consulta booleana do Quartel: preservar a interseção entre mercadorias
   publicadas e requisitos militares; responder com pesquisa direta e parada
   na primeira correspondência, sem construir a lista inteira a cada pergunta.
   O export de lista ordenada permanece intacto. Guarda RED: consulta de uma
   mercadoria ausente lê zero tipos; correspondência no primeiro tipo lê um
   tipo. Comparar toda mercadoria publicada e desconhecidas com a regra antiga,
   incluindo dados injetados mutáveis, e executar F18 e consumidores militares.
2. Saneamento: reutilizar a lista ordenada somente dentro de uma chamada de
   `sanearTarefas`, enquanto a referência do quadro de tarefas não muda.
   Recomputar após liberação/cancelamento; outra chamada consulta novamente.
   Devolver cópia ao consumidor que pode inverter a lista. Guarda RED: quadro
   estável de 20 abertas com demanda suficiente ordenado uma vez (antes: 24).
   Preservar ordem por número, maior excedente primeiro, reservas e liberações;
   validar excesso, remoção, dados injetados e JSON/load nos testes do JobBoard.
   Executar os 6.000 ticks e o limite de uma troca por 100 ticks de F-VIVO-a.
3. Cabeçalho PNG: extrair a leitura de dimensões para helper de verificação que
   lê só os 24 bytes usados pela regra original, fecha o descritor em sucesso
   e erro e rejeita cabeçalho curto/inválido. Reutilizar dimensões apenas para
   o mesmo caminho dentro deste teste; todas as referências do manifesto ainda
   afirmam existência e igualdade com suas próprias dimensões declaradas.
   Guarda determinístico de bytes e aberturas, casos de leitura parcial,
   arquivo ausente e cabeçalho inválido. Nenhum PNG, manifesto, dimensão ou
   asserção existente é retirado ou alterado; F17f inteiro em ambos os mundos.

Cada correção tem commit próprio após este aceite. O CLI já tem aceite anterior
(`0c0f5528`) e pode ser corrigido para remover a pressão de observação de arquivos
antes dos novos casos. A contratação pendente é preservada e será commitada
após seu portão verde. As novas correções são dependências da task 8 (fechamento),
que ainda exige o completo, a capa versionada e integração local limpa sem push.
