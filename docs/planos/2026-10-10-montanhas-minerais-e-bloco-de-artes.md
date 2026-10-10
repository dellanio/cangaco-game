# Montanhas minerais, carvao no chao e fila autonoma de artes

Pedido do operador: primeiro entregar ouro/ferro em montanhas perto das vilas e carvao como solo escuro atravessavel; depois executar automaticamente o bloco de artes. Branch codex-artes; sem push, sem src/sim, sem merge antes da homologacao. A codex-pacote-serraria ja foi integrada e encerrada em cf2d9b45. A outra sessao trabalha na main; nunca tocar suas alteracoes nao commitadas.

## Ordem

0. CSV reconciliado contra os arquivos reais, em commit so do CSV: coluna status adicionada, status_inicial preservado, 90 linhas conservadas. Arte existente nao e gerada de novo sem defeito comprovado.
1. I-ARTE-MONTANHAS-DE-OURO-E-FERRO — forma conectada e veios identificaveis.
2. I-ARTE-JAZIDA-DE-CARVAO-NO-CHAO — solo escuro com fragmentos de carvao.
3. I-TERRENO-MINERAIS-PERTO-DAS-VILAS — distribuicao real e carvao atravessavel.
4. I-TELA-MONTANHAS-MINERAIS-CONTINUAS — integrar arte e desgaste local ao render.
5. I-ARTE-ACUDE — arte do reservoir, antes das demais tarefas da fila; implementacao de gameplay pertence a outra sessao.
6. Conferir I-ARTE-CAATINGA-NA-SECA e I-TELA-CAATINGA-PELA-ESTACAO existentes. Facheiro conserva hastes/bracos, so palidez; nao regenerar entrega ja concluida.
7. CSV: P0, P1, P2, ordem original dentro da prioridade. Nao executar desconsiderados, adiados ou condicionados. Unidades mantem atlas atual, sem conversao. Som fora do bloco. Itens de sim/campanha/logistica/dicas e o codigo do Acude pertencem a outra sessao.

## Execucao autonoma

### Registro de execucao: montanhas minerais
I-ARTE-MONTANHAS-DE-OURO-E-FERRO: **bloqueado** apos duas tentativas nativas do ouro e revisao independente; costuras verticais retas da grade continuam visiveis (pleno x219-222/y130-282, reduzido x553-557/y156-322). Ferro tentativa1 tambem reprovado. Nenhuma candidata aplicada ao jogo. O item de render continuo espera arte que passe no aceite; distribuicao/carvao podem seguir independentes. Evidencia externa em cangaco-game-candidatos/arte/2026-10-autonomo/{gold_ore,iron_ore}-montanha/.


Sem perguntas ao operador durante a execucao. Opcoes nao cobertas: escolher conservadora, registrar em PROGRESS.md sob Perguntas em aberto (para a homologacao), seguir. Duas tentativas honestas por item; falha medida leva a desfazer somente mudancas nao commitadas desse item, registrar bloqueio no CSV/PROGRESS e seguir. Nunca afrouxar guardas, prazos, hashes, lint ou typecheck. Rebase sobre main a cada cinco tarefas concluidas, preservando entradas de ambos os lados no manifesto. Nao rebasear sobre alteracoes nao commitadas da outra sessao.

Arte: diretor + uma especialidade por lote + contrato + ferramentas; estilo pintado, luz de cima levemente do sul. Referencias aprovadas atuais; nunca restaurar os dois assets _estilo apagados, nem usar escola rural rejeitada ou arte de 1998. Geracao nativa, candidatas externas, base/derivado versionados na entrega. Cada item recebe aceite em BUILD_PLAN, teste que mede PNG, captura em jogo aberta, verify:rapido zero antes do commit e status do CSV com hash e aguarda homologacao. Toda nova candidata tem prompt, hash, origem, validacao, tentativas e proximo passo no controle.

Sem reservoir em buildings.json: produzir candidata/entrada pronta fora do manifesto ativo; registrar dependencia de codigo da outra sessao e retomar depois do rebase, sem dispensar o validador.

Ao esgotar a fila: rebase, verify completo, mostrar resultado, docs/homologacao/2026-10-artes.md com antes/depois e aprovar/reprovar em branco; incluir padre, Igreja, relogio, arvore seca, bodes, enfeites, caatinga e pedra da rua pendentes. Listar git log main..codex-artes; nao mergear.
