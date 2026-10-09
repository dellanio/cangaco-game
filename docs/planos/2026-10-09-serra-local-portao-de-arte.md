# I-TELA-SERRA-DESGASTE-LOCAL — desgaste localizado: parada no portao de arte

## Verificado em 2026-10-09

- Rascunho de render integrado e exercitado na propria worktree, sem alteracao em src/sim/, mapa, saves ou GameState.
- Cinco volumes nativos15/12/9/6/3,80PNGs128x160, pe157 e anchor[0.5,1].405aliases altura/chao; estados antigos preservados.
- Testes dirigidos sob trava:3arquivos/41testes verdes (incluindo F04 e F-SPR). Log:test-output/serra-integracao-dirigidos-20261009.log.
- `npm run shot -- I-TELA-SERRA-DESGASTE-LOCAL` saiu0:7capturas de jogo mais3pranchas zoom0.5/1/2, normal/RGBx0.8. Extracao real atravessou12/9/6/3/0; zero removeu o sprite; outros volumes permaneceram integros. Sem tick, nenhuma selecao/repintura nova.
- Captura aberta:screenshots/I-TELA-SERRA-DESGASTE-LOCAL-4-extracao-local-volume-9.png. Prova externa zoom0.5 aberta; revisor independente abriu provas0.5/1/2.
- Revisao independente aprovou continuidade, apoio e legibilidade. A aprovacao de iluminacao foi retirada depois de confrontar o validador: faces sul escuras nao contradizem o contraste sul negativo.

## Reprovado e nao entregue

- Validador oficial de sprites em modo trial saiu1:62 `light-direction`,80 `alpha-bleed`. Exemplo:v15:h0 contraste sul-15.9 e331pixels de borda transparente sem bleed. Nao houve mudanca de tolerancia, teste, calibracao ou verificacao.
- A ausencia de terreno `grama` no primeiro harness foi corrigida na configuracao do harness; o resultado final tem somente os142erros artisticos acima. Limites permaneceram os originais.
- Relatorio final:D:/projetos-pessoal/cangaco-game-candidatos/arte/D/rock/serra-local-20261008/validacao/report.json. Fontes/prompts/candidatas ficam na mesma pasta.
- O plano exige preservar candidatas reprovadas e reportar. A integracao foi retirada do estado ativo e preservada inteira no stash `c5120032e6597c0a62fd1a68463d788d23ad0c51`, incluindo bases, derivados, manifesto, regra, teste e roteiro. Nao usar `stash pop` indiscriminado: o rio permanece em outro stash.
- Backup adicional:D:/projetos-pessoal/cangaco-game-integracao-preservada-20261008/sertao-retomada/serra-integracao-20261009. Capturas e logs ignorados pelo git tambem foram copiados. Os PNGs reprovados nao estao nos assets ativos.
- Falta corrigir a iluminacao nativamente e o bleed, passar o portao tecnico, revisar novamente, retomar o rascunho e rodar todas as nao-regressoes do aceite. Homologacao e do operador.
- Nao existe commit feat da serra, merge ou encerramento de worktree. Main e noru foram preservadas. O rio/ponte nao foi reaplicado.

## Verificacao da branch sem a candidata

`npm run verify` no HEAD866921eb, depois de guardar o WIP, saiu1. Typecheck/lint/validate:data passaram (31arquivos/0erros). A suite normal reprovou F05a-estado-inicial: o comando ponta a ponta `npm run sim -- inicial --ticks 0` excedeu o timeout existente de30000ms. O selo .verify-ok nao foi criado; a suite transladada nao foi executada. Log:test-output/serra-preservada-verify-20261009.log. Nao alterei o timeout, teste ou codigo para contornar esta falha. Este teste nao homologa nem verifica a integracao da serra guardada. Nenhum merge permitido.

## Atualizacao de2026-10-09: bloqueio artistico corrigido
Nova rodada nativa passou no validador original nos80PNGs e na revisao independente. Os142achados da candidata inicial sao historicos; nenhum limite mudou. A integracao retomada passou nos dirigidos42testes, nos seis roteiros exigidos e no verify:rapido(94arquivos/1055testes). Derivacao versionada reproduz80PNGs identicos. Fechamento completo do novo pacote/homologacao visual ainda pendentes; nao inferir merge pelo verde rapido. Evidencia atual em PROGRESS e docs/planos/2026-10-09-pedreira-e-recursos-naturais.md.

