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

## 2026-10-10 — I-ARTE-ACUDE: níveis e obra derivados
- Baixo: exec-904f46d2-1fe6-4cea-8f48-ec57962a0086; edição do vazio, poça de água no fundo sem sangria, geometria externa preservada.
- Médio: exec-7dc03768-bf2b-4038-88aa-2b7eec28bba9; edição do vazio, espelho intermediário com margens secas e sangradouro seco.
- Madeira: exec-1a937f0a-c6a3-4dcf-99f8-807376feb934; edição do cheio, bacia sem água, contenções de madeira e barragem parcialmente montada, mesmo contorno e pés.
- Cinco originais preservados; hashes e arquivos em assets/base/reservoir/geracao.json. Derivação exclusivamente por recorte, registro de bbox quando a ferramenta varia canvas, composição de RGB nativo, alfa canônico, resize Lanczos e bleed RGB sem mudar alfa. Números em data/acude-arte.json. Máscara inclui o sangradouro para não deixar água no vazio.
- Validador artístico original: zero erros após corrigir bleed; nenhuma regra alterada. Pranchas normal/RGBx0,8 nos três terrenos e zooms 0,5/1/2 abertas. Revisão independente aprovou os cinco estados como candidatas. Integração passa no validate:data (35 arquivos/zero erros), e nos 31 testes dirigidos com saída 0. Homologação continua do operador.

## 2026-10-10 — I-ARTE-FAZENDA-EM-OBRA, tentativa1
- Aceite anterior à geração: 8db6e763. Categoria prédio, farm4x3, estado madeira, câmera front top-down3/4, canvas final269x200/anchor[0.5,1]. Sem trabalhador, fumaça ou estoque permanente; plataforma de saída do milho vazia, mastro dinâmico preservado no manifesto.
- Referência única: assets/base/farm/farm-D-yellow-tall-master-2x.png, prédio atual aprovado; não usar referências _estilo apagadas. Prompt: editar somente a Fazenda para fase de madeira, mesmas duas águas do telhado/porta/postes/plataforma/escada/fundação; caibros expostos, trechos de palha e painéis ocre incompletos. Transparência nos vãos, luz superior ligeiramente sul sem eixo lateral; sem pessoas, bens, bandeira ou texto.
- Geração nativa exec-99a375aa-385c-47fc-9dee-f9f3cb9a1a7e. Original preservado em D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/farm-madeira/madeira-original.png. SHA256 9E983A15F735DBB834B16015D2E54798D3ADBAB8F1C51A04A8EBC3AC7DB8852A. Original aberto; próximo: registro geométrico, validação artística, revisão independente, testes e prova em jogo. Não instalado como entrega.

I-ARTE-FAZENDA-EM-OBRA tentativa1 aprovada tecnicamente: registro por alfa128 sem pixels residuais, bbox4,28..266,197;269x200/pé197. Validador zero erros e revisão independente aprovou arquitetura. Prompt integral em assets/base/farm/prompt-madeira-20261010.txt; hashes e original em geracao-madeira-20261010.json. Seis capturas em jogo e três pranchas abertas, roteiro0; verify:rapido0 (50 arquivos/400 testes). Homologação do operador pendente; não gerar tentativa2 sem reprovação.

## 2026-10-10 — I-ARTE-CANAVIAL-EM-OBRA, tentativa1
Aceite6d7b13fa antes da geração. wineyard3x2, canvas250x180/anchor[0.5,1], madeira derivada da casa verde atual. Referência única assets/base/wineyard/wineyard-D-green-cane-tall10-master-2x.png. Prompt: mesma casa/porta/plataforma/escada/prensa de cana, caibros expostos/cobertura parcial/parede verde incompleta, luz superior sul sem lateral, transparência nos vãos; sem uva/videira/pessoas/barril/texto. exec-8915c854-7ed4-458f-97eb-333a48422db7, original preservado em D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/wineyard-madeira/madeira-original.png. Próximo: registro/validação/revisão, ainda não é entrega.

I-ARTE-CANAVIAL-EM-OBRA tentativa1: SHA256 original4F2DE844DEABD70654863813C7CD7A0AC9C7B601CCBF35B04FC442C6B8F0204B. Validador técnico zero erros e revisão independente aprovou arquitetura/porta/prensa/plataforma, luz superior/sul provável. Derivado250x180/pé177, master500x360/pé355. Todas as seis capturas e três pranchas abertas; teste2/2 e roteiro0, verify:rapido0 (51 arquivos/402 testes). Prompt integral e hashes versionados em assets/base/wineyard/. Operador ainda homologa.

## 2026-10-10 — I-ARTE-PESCADOR-EM-OBRA, tentativa1
Aceite6cd2f623 antes da geração. Referência única master azul atual fishermans; mesma porta/plataforma/anexo de varanda/caibros e volume do telhado, paredes azuis incompletas, estoque vazio, luz superior sul sem lateral, transparência; sem trabalhador/peixe/texto/água/terreno. exec-de8fa9cb-65e5-4765-a5d5-041070829e34, original externo em D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/fishermans-madeira/madeira-original.png. Derivado registrado no envelope atual; ainda candidato não homologado. Próximo: validador/revisão e prova em jogo.

Pescador tentativa1: original SHA25633C174BE31CA8147145DDA95FBA4514BF2E058BCC3AFF7B041E3BCF72921A831, validador acusou luz sul invertida Δ-5,2; revisão visual não substitui essa guarda. Segunda geração exec-f2150259-a88e-4373-ac7a-e6c2fef0460f só corrige luz, SHA25694A03901950B4B0F6FFF7F846FCA1216057B5C3988CF014ECD1D2F6853064BC3, preservada externamente em madeira-original-2.png. Validador original zero erros, revisão independente aprovada. Registros em assets/base/fishermans/,192x176/pé175 e384x352/pé351. Prompts integrais preservados. Não fazer terceira geração.

## 2026-10-12 — I-ARTE-MOINHO-EM-OBRA/A05, tentativa1
Aceite7718a3fe antes da geração. Ficha: mill3x3, canvas221x276, anchor[0.5,1], madeira derivada do master atual mill-D-plus15. Atividade da casa na área[0.39,0.6,0.6,0.87], milho em[0.12,0.78], fubá em[0.75,0.78], plataformas vazias; ocupante dentro oculto, sem trabalhador pintado, fumaça/animais não acrescentados. Bandeira dinâmica no ponto existente. Obra não anima produção. Referência KaM somente linha Mill (W2/mastro de pás) não governa a geometria: Piancó preserva sua roda lateral atual. Prompt: mesma torre/telhados/roda/porta/plataformas/pés; caibros, alvenaria e roda incompletos; luz superior sul sem eixo lateral, transparência, sem pessoas/estoque/texto. exec-a328bfba-ac94-43e6-ad22-507c79f70fd0. Original externo D:/projetos-pessoal/cangaco-game-candidatos/arte/2026-10-autonomo/mill-madeira/madeira-original.png; registro em derivados/derivacao.json. Próximo: validar/revisar/capturar. Não é entrega homologada.

A05 tentativa1 aprovada tecnicamente: SHA256original E4D6535D723BFC70AE82BF87AF763949290E38A9F5AF68AEE99D4E6CE2FD9EE6;221x276/pé273/master442x552/pé547. Validador original zero erros, revisão independente aprovada; teste2/2 e roteiro0, nove evidências abertas, verify:rapido0 (53 arquivos/406 testes,65s). Prompts/hashes/base em assets/base/mill/. Homologação visual pendente.

## 2026-10-12 — I-ARTE-PADARIA-EM-OBRA/A06, tentativa1
Aceite21f65105 antes da geração. bakery3x3/canvas192x192, anchor[0.5,1]; referência exclusiva base/bakery/bakery-D-master-2x.png, mesma porta esquerda/forno/vitrine/balcão direito/chaminé/telhado. Receita farinha→pães, ocupante dentro oculto; madeira não anima nem fuma; zonas do manifesto preservadas, sem mercadoria/trabalhador pintados na obra. Prompt: caibros/cobertura/paredes/chaminé incompletos, remover pães do estado madeira, preservar registro, luz superior sul sem lateral. exec-e8eb2fde-4d80-44fd-a311-7aaa24802333. Original externo em bakery-madeira/madeira-original.png. Próximo validar/revisar; não é homologação. Divergência medida no completo atual: vitrine ainda tem pães pintados, apesar da nota dizer apagados; não alterar o completo nesta tarefa, registrar para composição/animação.

A06 tentativa1 tecnicamente aprovada: SHA256original F29797F1B46CC8B292C56EC5517B6CF6FD127659F77979CA3ECDCBB8BB26952C;192x192/pé191,master384x384/pé383. Validador original zero erros e revisão independente aprovada. Teste2/2/roteiro0, nove evidências abertas, verify:rapido0 (54 arquivos/408 testes,50s). Homologação pendente. Pães fixos do completo registrados para tarefa separada, sem alteração nesta obra.
