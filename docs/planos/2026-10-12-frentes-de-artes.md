# Execução das seis frentes de artes — 2026-10-12

Pedido do operador: continuar e provisionar todas as seis frentes. Branch codex-artes, worktree irmã, sem push ou merge antes da homologação. A ordem original do CSV permanece; provisionamento não significa agentes ou geração em segundo plano.

| Frente | Execução provisionada | Portão e dependências |
| --- | --- | --- |
| Próximas artes | A05 Moinho/madeira, A06 Padaria/madeira, A07 Armazém/madeira. Um prédio e um commit de entrega por vez, aceite antes da arte. | Master atual como referência, canvas/pés/anchors preservados; dois ensaios por item; PNG/teste/captura aberta/verify:rapido0. |
| Crescimento e animações | A08 árvore, A09 milho, A10 cana, A11 cavalos, A12 Emboscador, A13 Aguilhadeiro; depois atividades dos prédios, na prioridade do CSV. | Auditar o consumidor e o atlas atual antes da geração; não converter unidades, não gerar quadro sem integração possível, não mudar src/sim/. |
| Cenário | Variações e transições C01–C09, depois brejo/litoral e rua, na ordem do CSV. | Montagens de vizinhos e comparação em0,5/1/2; só substituir arte com defeito comprovado. Números e escolha determinística em data/render. |
| Montanhas minerais | Conservar tentativas e medições reprovadas; inventariar o contrato atual depois do rebase e documentar uma solução por massa contínua com desgaste localizado. | Não instalar atlas reprovado nem fazer terceira geração sob o orçamento encerrado. Redistribuição das duas vilas depende de emenda explícita à identidade do mapa; não afrouxar hash/guarda nem alterar sim. Bloqueio fica separado das tarefas executáveis. |
| Homologação | Manter índice incremental com antes/depois, capturas abertas e decisões em branco; reunir Padre/Igreja/relógio/árvore seca/bodes/rua; disponibilizar som de vitória existente para audição do operador. | Aprovação técnica não é aprovação visual/auditiva. Enfeites já validados nesta conversa não pedem nova aprovação por rotina. |
| Integração | Rebase sobre main a cada cinco tarefas e antes do fechamento; preservar as duas entradas em conflitos; repetir verify completo sobre código atualizado. | Sem tocar arquivos não commitados da outra sessão; sem merge/push/remoção de worktrees alheias. Merge de arte só depois da homologação; a fila não fecha com verde parcial. |

## Primeiro lote

Começar por I-ARTE-MOINHO-EM-OBRA/A05. O mill atual tem entrada de milho e saída de fubá, plataformas vazias e zona de trabalho; a fase madeira conserva tudo isso como geometria, sem mercadoria ou trabalhador pintado. Obra não recebe animação de produção. Registrar rebase e validação com novo SHA, sem apresentar a verificação de2026-10-10 como atual.

## Limites preservados

Som: somente índice/audição para homologação; nenhuma nova produção sonora. Campanha, logística e código de sim permanecem da outra sessão. Itens desconsiderados/adiados/condicionados não são retomados. Dúvidas não impeditivas vão para PROGRESS/Perguntas em aberto, conforme modo autônomo; não pedir aprovação de rotina para seguir tarefas já autorizadas.

## Estado da atuação

- Próximas artes: A05 Moinho06547fc7, A06 Padariaae480f29, A07 Armazémd9ecbda2 entregues tecnicamente, com27 capturas/pranchas abertas e homologação pendente.
- Crescimento/animações: auditoria confirma consumidores existentes em crescimento.ts e animais.ts. A08 exige contrato explícito para muda/crescendo_1/crescendo_2 e entradas de vento antes de gerar/adicionar estados. Guarda anterior da árvore permanece intacta nesta entrega.
- Cenário: sequência de trabalho reservada no CSV, sem candidatas novas instaladas nesta rodada.
- Montanhas minerais: bloqueios medidos mantidos; não foram feitas novas gerações ou redistribuição. Solução por massa contínua deve receber novo aceite/orçamento antes de retomar.
- Homologação: índice atualizado com o novo lote; som atual em assets/sons/victory.mp3 disponível para o operador ouvir. Não registrar aprovação auditiva sem decisão dele. Enfeites já validados não são reabertos.
- Integração: branch rebaseada sobre main ef391cf7; verify completo0 no código a5c12e7e (350/2988 normal,350/2986 transladado,5 pulos preexistentes). Correção de checkout LF da paleta passou na guarda original e teste Git real. Sem merge/push.

Próxima execução: A08 e depois A09/A10, após o aceite de estados. O provisionamento é uma fila documentada; não há worker ou agendamento externo ativo.
