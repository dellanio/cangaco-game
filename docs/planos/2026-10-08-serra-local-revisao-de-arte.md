# Serra localizada — revisao das primeiras candidatas

Decisao: desgaste localizado, aceite anterior ao codigo em c1d41935.

## Verificado

- Candidatas externas, sem alteracao de assets/manifest.json nem sprite ativo.
- Primeira geracao: exec-3fdcc9a1-36eb-4207-845f-ca010f5119c0.
- Revisao nativa: exec-73d67aa5-9ece-42d5-8708-70193ebe5809.
- Pasta: D:/projetos-pessoal/cangaco-game-candidatos/arte/D/rock/serra-local-20261008/.
  geracao.json e geracao-revisao2.json preservam prompts, referencias e SHA256.
- Cada folha 1122x1402, 4x4 configuracoes cardinais do volume intacto.
- prova-juncoes-volume15.png mostrou blocos separados. Derivacao com envelope
  unico 80x100 em tiles64 eliminou faixas largas, mas nao as costuras.
- prova-juncoes-revisao2.png mostrou melhora do material (granito fraturado
  no lugar de discos/colunas), com apoio externo. Revisao independente voltou
  a reprovar: cortes verticais atravessando lajes, aberturas alinhadas e corte
  horizontal reto na borda inferior direita. As provas foram abertas.
- Revisor: agente revisao_peixe, somente leitura. Homologacao nao ocorreu.
- Regra pura em rascunho: 5 testes verdes, incluindo extracao pelo step e
  alteracao somente local; validador recusa dado ausente/limites/volumes/escala
  invalidos. verify:rapido 0: 46 arquivos, 586 testes, 123 segundos.
- Terceiro ensaio tecnico: envelope fixo96x120, com deslocamentos pequenos
  deterministas por tile, constantes durante todo desgaste. Prova aberta:
  prova-juncoes-envelopes-irregulares.png. Revisao independente: apoio coerente
  e sem faixas de grama, mas cortes verticais/degraus mostram os modulos.
- verify completo no rascunho saiu0: typecheck/lint, 32 dados sem erros,
  325 arquivos/2904 testes normais; 325 arquivos/2902 transladados e cinco
  skips preexistentes. Log: test-output/serra-local-verify.log.

## Nao entregue

Arte das juncoes ainda reprovada. Os quatro volumes menores nao foram gerados.
O render ativo nao usa a regra em rascunho. Nenhum sprite ou manifesto novo
foi registrado; nenhum estado da sim ou mapa mudou nesta tarefa. Os testes
de selecao nao sao prova de aparencia, de repinturas ou da integracao em tela.
O roteiro da nova feature e as provas visuais completas continuam pendentes.
Nao existe commit feat desta feature nem autorizacao visual inferida.

O rio/ponte bloqueado esta preservado no stash e86da16760b4aabd6800a684c3c3d8ff6eff4df5.
Nao reaplicar o rio durante esta tarefa. Main/noru/test-results.json intocados.

## Retomada autorizada em 2026-10-09 — correcao nativa de luz
Os cinco atlas foram reluzidos nativamente, preservando as geometrias e os patamares. O validador original passou com success:true/errors:[] nos 80 derivados, depois do bleed tecnico que conserva alpha/RGB visivel. Origem candidata: D:/projetos-pessoal/cangaco-game-candidatos/arte/D/rock/serra-luz-20261009/. Revisao independente favoravel: sul iluminado, sem frestas de grade, apoio dos volumes mistos e distincao6/3 nos tres zooms/tint0.8. Nao confundir com homologacao do operador. Os registros anteriores acima sao historicos da rodada reprovada, nao o estado desta nova candidata.
Integracao retomada na propria branch, sem src/sim/mapa/save. Testes dirigidos: 3 arquivos/42 testes verdes, incluindo guarda artistica permanente para80PNGs. Shot I-TELA-SERRA-DESGASTE-LOCAL saiu0; demais nao-regressoes em andamento. As cinco geracoes e seus prompts/referencias/hashes estao em assets/base/rock-serra-local/geracoes.json.
