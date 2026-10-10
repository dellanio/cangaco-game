# Controle da producao autonoma de artes — codex-artes

## Contrato atual (2026-10-10)

Referencias: predios aprovados atuais; nao usar nem restaurar assets/base/_estilo/serf-D.png ou storehouse-front-D.png, nem escola rural rejeitada. Estilo pintado para cenario/vegetacao/predios; unidades continuam nos atlas atuais. Luz unica de cima, levemente do sul. Candidatas em D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/<id>/; base/derivado/manifesto conforme aceite. Registro de cada chamada com prompt, referencias, caminho, hash e portoes tecnicos/visuais.

Lote inicial, especialidade pianco-natural-resources: gold_ore-montanha, iron_ore-montanha, coal-chao. Orcamento inicial: no maximo duas chamadas nativas por id (uma primeira tentativa e uma correcao), dois ensaios de aceite por tarefa. Cada id tem tres volumes/estados na mesma composicao, com camera/canvas/pivo comuns. Sem troca silenciosa de ferramenta ou geracao por script. Revisao independente do gerador depois dos portoes tecnicos. Homologacao do operador fica para o fim.

O controle antigo da noru foi consultado somente em leitura; aquela worktree e seu controle nao recebem nenhuma alteracao desta sessao. Rebase a cada cinco entregas; verificar controles AGENT_STOP/STEER entre itens.

## Fila e contadores

### coal-chao — tentativa 2/2, bloqueado na montagem
- Edicao nativa da tentativa1: corrigir luz sul nos tres estados, norte mais escuro e facetas sul claras; conservar chao plano/camera/escala/contorno; sem eixo leste-oeste ou halo. ID exec-3e8ad0e0-e677-41f1-81db-35c682152845.
- Candidata externa coal-chao/atlas-2.png; SHA256 917770033E2C86BFF4EC1B78FDEE09AC8D32A177BD54A631D486F02C5977221C.
- Validador original passa (errors[]), quatro testes novos/legados passam. Roteiro sai0, duas capturas abertas em screenshots/I-ARTE-JAZIDA-DE-CARVAO-NO-CHAO-{1-prancha-tres-estados-tres-zooms,2-jazidas-adjacentes-e-desgaste-misto}.png.
- Revisao independente reprova montagem3x3: zoom2 x650-952/y53-351 mostra nove circulos separados por solo claro; mesmo defeito em0,5/1. Contraste passa, continuidade nao. Nenhuma terceira chamada.
- Item bloqueado. Mudancas nao commitadas de arte/manifesto/teste/roteiro/derivador desfeitas apenas nesta worktree; evidencias/testes candidatos preservados externamente. Nenhuma guarda existente alterada. Contadores finais deste lote: ouro2/2, ferro1/2, carvao2/2.


### coal-chao — tentativa 1/2
- Geracao nativa exec-c494753e-dac2-4501-b97c-a550d97fb264; candidata externa coal-chao/atlas-1.png.
- SHA256 6758DC7CE5A491DED8955E1D8F7FB5CFFCAD81492438CB6B6F2064B4D4F60CE3.
- Prompt: original pintado, tres celulas iguais, solo escuro com fragmentos angulares embutidos e relevo baixo; tres densidades da mesma jazida no chao, pe/escala comuns, luz cima levemente sul, alfa com borda natural; sem montanha, pilha alta, pixel art, texto ou assets historicos.
- Derivacao 64x64, todas as tres silhuetas60x48, pe62. Validador artistico original reprova luz sul nos estados reduzido (delta -0,8) e remanescente (-0,7). Nenhuma regra alterada. Segunda tentativa corrige luz nativa.
- Teste/roteiro/flag de derivacao em stash exclusivamente desta tarefa enquanto o controle e commitado; nao sao entrega nem exclusao de verificacao existente.


### Ouro — tentativa 2/2, bloqueio do item de montanhas
- Edicao nativa da atlas-1 limpa: remover linhas retas/quadros nas bordas conectadas, continuidade geologica, manter 48 celulas, camera, tres alturas e luz; nao escalar globalmente.
- ID exec-dab928b5-84d2-4ad7-9434-b80c0e913a8a; arquivo externo gold_ore-montanha/atlas-2.png; SHA256 46CA8F65E953417DF90C03E2DB597BC69EDB5E7F4A9812FD3E0B1E5468AEAE9E.
- Revisao independente reprova: pleno x219-222/y130-282, reduzido x553-557/y156-322, remanescente x840 e x904/y150-302 expoem a grade.
- I-ARTE-MONTANHAS-DE-OURO-E-FERRO bloqueado apos duas tentativas honestas. Ferro tentativa1 tambem reprova grade em x154/x218 e faixa de solo y261-285. Arte/manifesto originais intactos. Teste novo e derivador nao commitados foram retirados da branch e preservados na candidata externa; nenhuma guarda existente foi removida ou alterada.
- Proximo: I-ARTE-JAZIDA-DE-CARVAO-NO-CHAO. Contador ouro2/2, ferro1/2, carvao0/2.


### iron_ore-montanha — tentativa 1/2
- Geracao nativa em 2026-10-10; referencia limpa volume-15.png da serra.
- Prompt: 48 modulos em 12x4, tres blocos 4x4 com mascaras N1/E2/S4/W8; ferro em rocha cinza-avermelhada, hematita/magnetita escura e manchas ferruginosas, luz superior/sul sem eixo lateral; pleno, bancada extraida, remanescente redesenhados, pe/envelope comuns; margens transparentes, sem texto, predios ou referencia de 1998.
- Candidata externa: D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/iron_ore-montanha/atlas-1.png. ID/hash na ficha de origem externa antes de integracao. Ainda sem homologacao.
- ID exec-1c1feee3-a58c-4f0a-9f92-c29eb4239ba6; SHA256 B984C92B76AADA8BCA303E37E91DD984C99FE8B6DD69682D9CFC265B0C06275D. 48 modulos medidos, pe157, alturas decrescentes em todas as conexoes.

### Revisao do ouro, primeira tentativa
- 57736 pixels vermelhos do bruto tinham alfa abaixo de 24; nenhum com alfa >=24. Derivacao elimina-os com o limiar vigente da serra.
- 48 modulos 128x160, apoio157 e todas as 16 alturas estritamente decrescentes por estado.
- Revisao independente: reprova costuras verticais no plato reduzido x489/y116-189 e remanescente x839/y124-190. Feather maior foi ensaiado sem resolver completamente; segunda geracao nativa sera dirigida as bordas conectadas.


### gold_ore-montanha — tentativa 1/2
- Ferramenta nativa image_gen; id exec-f56c11fa-b60e-4429-8628-ca8217ef927b.
- Referencia limpa: assets/base/rock-serra-local/volume-15.png (camera/material/geometria dos 16 modulos).
- Prompt: atlas original pintado, ouro em veios ocre discretos na rocha cinza-marrom; 12 colunas por 4 linhas, tres blocos 4x4 com mascaras cardinais N=1/E=2/S=4/W=8; pleno, bancada extraida e remanescente apoiado; luz unica superior levemente sul, sem componente lateral, transparencia, sem texto, sem assets historicos; mesmo envelope/camera/escala/pivo e apoio. Nunca encolher globalmente a intacta.
- Arquivo: D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/gold_ore-montanha/atlas-1.png, 2172x724.
- SHA256: B0E4BB37D980184BDC350EE4D493BD302F83D46D673FA78A8B19AA2D8F5B56B8.
- Status: candidata, revisao independente em andamento, ainda sem derivacao nem homologacao.


O CSV tem 90 itens; esta reconciliado em 381529af. Primeiro minerais, depois Acude, conferencia da caatinga e P0/P1/P2. Nenhuma chamada de geracao deste novo lote foi realizada ainda. Ouro 0/2; ferro 0/2; carvao 0/2. Novos lotes recebem orcamento explicito antes da primeira chamada, respeitando as duas tentativas honestas por item.

## 2026-10-10 — I-ARTE-ACUDE: cheio e vazio (candidatas)
- Aceite anterior à geração: d881ee8. Ficha: reservoir, prédio 4x3, front top-down 3/4; sem trabalhador, estoque, fumaça, bandeira ou animal; atividade visual = nível da água. Entrada sul livre. Luz superior/sul sem eixo lateral. Referência verbal de materiais: pedreira atual, sem usar referências antigas rejeitadas.
- Cheio: exec-ac140032-8988-4be4-aaed-6865377c246d, SHA256 3A743A0B976F2372236169011C1211519057E7A941A357D9D8F1BBA96FABAAC6. Prompt: açude de terra e pedra do sertão dos anos 1930, bacia irregular cheia e sangradouro, margens marrons secas, pintura texturizada, transparência, sem texto/pessoas. Revisão independente aprovou candidata; derivados ainda pendentes.
- Vazio: edição precisa do cheio, exec-204feb43-064c-46c6-8b0a-07cbd4dda49f, SHA256 9FE8631FF9AAF0F2D79573D2980FAD7E4D146CCBDF6458FA477A00B623A5691F. Prompt: alterar só água para fundo de barro rachado e sangradouro seco, conservar barragem, silhueta, luz e registro. Aberta. Próximo: níveis baixo/medio e obra, derivação registrada, medição e prova em jogo.
- Arquivos preservados externamente em D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/reservoir/{cheio,vazio}-original.png. Arte ainda não aplicada; nenhuma aprovação do operador presumida.
