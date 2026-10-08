# Plano de fechamento do projeto

> Decisao do operador de 2026-10-08: BUG-T/BUG-TROPA-DE-24-PRESA (ordens 99/187) desconsiderado em b460c61; nao reabrir, investigar ou contar como pendencia. Estes documentos sao o inventario historico de 2026-10-07. Integracao somente documental; main e noru-novos-sprites nao recebem candidatos da escola rejeitada nem restauracao de assets/base/_estilo/.

Pedido do operador em 07/10/2026: planejar todas as pendências e iniciar em worktree.
Branch: `fix/fechamento-projeto`. Não fazer push nem alterar test-results.json.

## Processo e limites

Uma tarefa por vez, com aceite em commit anterior ao código, evidência, PROGRESS e
um commit de implementação por tarefa. Não reordenar BUILD_PLAN.md. Este pacote
define a execução solicitada pelo operador. Não excluir ou afrouxar verificações.
Decisão de design ainda ausente impede somente a tarefa dependente. Situação fora
do aceite: parar e reportar, sem improvisar. Homologação humana não é teste automatizado.

As quatro alterações não commitadas da main ficam intactas. A correção militar
~~do HEAD é parcial: os achados das ordens 99/187 constam na sessão anterior e devem~~
ser reproduzidos antes de qualquer alegação de conclusão. Não usar a antiga passagem
com soldados mortos como evidência de movimento.

## Ordem e aceites

| Tarefa | Entrega e aceite | Dependência / limite |
|---|---|---|
| 01 Clima na vista | Executar docs/planos/2026-10-07-clima-na-vista.md: inverno/seca nos zooms 0,5/1/2, câmera deslocada, atualização pausada, capturas e asserções de limites. | Render e roteiro somente. |
| 02 Verificação transladada | Corrigir saves incompatíveis e cenários de minas. Mundo normal e deslocado passam com as mesmas regras; nenhum skip novo, exclusão ou coordenada absoluta que invalide translação. | Diagnosticar fixtures e gerador antes de escrever aceite técnico adicional. |
| ~~03 Marcha militar~~ | ~~Reproduzir ordens 99/187 e integrar a fixture reforçada da main sem modificá-la. 400 ordens para 18 e 24 soldados, todos vivos por ordem, zero sobreposição e nenhuma marcha depois de 1500 ticks. Cobrir passos já iniciados em emenda de aceite antes do código; sem teleporte.~~ | ~~Plano BUG-T existente e emenda dedicada.~~ |
| 04 Obreiro no canteiro | Trabalhador nivelando, esperando material ou martelando ocupa tile. Civis aguardam sem sobreposição; construção e entrega concluem. Roteiro F18f passa, captura aberta e testes de colisão/construção passam. | Decisão já recebida. Especificar reservas de entrada em aceite próprio. |
| 05 Logística congestionada | Reproduzir carga infinita; tábuas e armas obtêm atendimento sem perder conservação, reservas ou prioridades legítimas. Corridas normal e congestionada verificam produção/entrega, não apenas gravam zero. | Operador decide envelhecimento de tarefas ou teto de atendimento consecutivo. Não inventar parâmetro. |
| 06 Roteiro de mercadoria | Preservar aceite de fallback sem arte mediante fixture deliberada sem PNG/ícone; machado real continua exibindo arte. Captura e roteiro D-TELA-03 passam. | Não retirar cobertura de fallback. |
| 07 Ataques militares | Estilingue do Emboscador legível e arma do Aguilhadeiro consistente ao norte, com contato visual dos frames e capturas em jogo; preservar atlas e manifest válidos. | Ler skills locais de arte; confirmar geração disponível e referência canônica. |
| 08 Machado PixelLab | Gerar pela ferramenta solicitada, registrar origem, aplicar no manifest, validar dimensão/transparência e abrir evidência em jogo. | PixelLab disponível; não substituir provedor sem decisão. |
| 09 Luz do relevo | Reproduzir diferença estável, localizar causa e preservar comparação/evidência do aceite D-TELA-LUZ-RELEVO. Testes e capturas aprovam somente o resultado medido. | Investigar antes de habilitar ligado:false ou mudar iluminação. |
| 10 Açude | Executar etapas 3/4/5/7 de docs/planos/2026-10-05-acude-e-clima.md: prédio, água, irrigação, interface e arte. Custo igual à fazenda, trabalhador Roceiro; sim determinística e integração demonstrada. | Fechar footprint, desbloqueio, implantação e vínculo de irrigação com operador antes de sim. Não refazer clima entregue. |
| 11 Comida | Tornar explícito e consistente o significado da barra/HUD; cenário com 10 no armazém e 5 na Bodega prova a regra escolhida. | Operador decide estoque total ou disponível no armazém para a barra. |
| 12 Vitória | Integrar som com licença adequada documentada e testar disparo único, volume e ausência de erro; fornecer amostra para audição. | Seleção CC0 e homologação auditiva. |
| 13 Homologações | Preparar evidências de Padre, árvore seca, cabras, água/solo e menu lateral, e amostras dos cortes de áudio. Registrar aprovado/reprovado e corrigir reprovações em tasks separadas. | Aprovação humana; não declarar concluído por screenshot automática. |
| 14 Tutorial e jornal | Revisar dicas contra comportamento real. Prédio desocupado por cinco minutos dispara aviso no cenário visual e não antes; abrir captura. | Preservar aceite existente; textos ambíguos exigem decisão. |
| 15 Balanceamento climático | Medir economia com clima em cenário longo, registrar BALANCE_LOG e propor lote de ajustes com impacto em comida/armas/tempo. | Não ajustar números isolados nem usar antigo cenário sem clima como prova atual. Aprovar lote antes de alterar dados. |
| 16 Fechamento da escaramuça | npm run verify verde, testes longos e todos os roteiros sob trava; build validado, evidências abertas e pendências reavaliadas. | Sem selo com falha. Operador marca features. |
| 17 Playtest e publicação | Preparar build e roteiro, coletar relatórios externos, triar e corrigir problemas, fornecer pacote publicável/link verificável. | Jogadores externos e publicação pelo operador; não enviar convites nem publicar sem autorização. |
| 18 Campanha completa | Converter pianco-campanha-10-missoes.md em tasks por missão: dados, mapa inicial, objetivos, vitória/derrota, progressão e persistência. Testar cada missão e sequência completa. | Operador define módulo/id e aprova aceites das dez missões antes da implementação. |

## Fora do fechamento aprovado

Multiplayer, editor e reputação são ideias, não requisitos aprovados de publicação.
Este plano não promete conclusão de tarefas humanas por execução autônoma.

## Estado inicial

Plano escrito antes de novas alterações de código. Primeira tarefa executável: 01.
Resultado completo anterior: verify reprovado; nenhuma declaração de projeto pronto.

## Execução inicial

Task 01 iniciada: compensação de zoom implementada e seis combinações de estação/zoom
verificadas com tick pausado, limites projetados e capturas dos extremos abertas.
Task não concluída: asserção anterior do jornal falha também no roteiro original.
BUG-JORNAL-NOTICIA-TRANSICAO-SECA registrado. Parada pelo limite de escopo;
não excluir asserção nem corrigir o jornal sem emenda de aceite em commit separado.
