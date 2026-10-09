# Pedreira e recursos naturais — plano de correcao e aceites

Pedido do operador em2026-10-09: planejar a correcao da pedreira e dos demais recursos naturais e implementar ate passar nos testes. Este pedido autoriza novas rodadas nativas de correcao da arte reprovada; nao autoriza afrouxar o validador. O desgaste da pedra continua localizado.

## Escopo e invariantes

- Worktree codex-sertao-mapa. Sem push; main/noru, .claude/, AGENTS.md e test-results.json intocados.
- Arte, pipeline de derivacao, render e dados de interface. Nao alterar src/sim, regras de exploracao, rendimento, acesso, quantidade ou formato de save/GameState. Importacoes puras para leitura e testes pelo step permitidas. Numeros da apresentacao em data; funil mapa.ts para rendimento.
- Fontes naturais confirmadas no dado: rock, tree, fish, coal, iron_ore e gold_ore. Corn/grapes sao cultivos: inventario e nao-regressao, sem redesenho neste plano. Terrenos e vegetacao sazonal ja entregues sao inventariados; seus contratos existentes continuam valendo. Nao reaplicar o stash do rio.
- Luz unica de cima/levemente sul, sem eixo leste-oeste. Nenhuma recolorizacao, escala, recorte ou opacity para fabricar desgaste/reluzir. Ajuste artistico por geracao nativa; bleed e tratamento tecnico invisivel do PNG.
- Homologacao visual pertence ao operador; passar nos testes e na revisao independente nao a substitui.

## Tarefa1 — I-ARTE-RECURSOS-BORDAS-LIMPAS: diagnostico e derivacao tecnica

1. Inventariar os estados existentes das oito fontes/cultivos, seus arquivos/bases/anchors/dimensoes. Medir luz/alpha com o validador oficial, separando arte ativa legada de nova candidata. Nenhuma especie ou asset novo inventado para preencher o inventario.
2. Implementar bleed deterministico: propagar RGB de pixels visiveis para vizinhos de alpha0, sem alterar qualquer pixel com alpha>0, nem alpha, canvas, pe ou estados. Provar: alpha/RGBvisivel identicos, idempotencia, arquivo vazio preservado e uma sonda sem bleed reprovada pelo proprio validador. Nao mudar suas tolerancias.
3. Distinguir falhas do harness de falhas artisticas, com todos os terrenos reais corretamente informados. O F05a de execucao do CLI conserva o timeout/assercoes; reproduzir isolado e corrigir somente se a causa no codigo for demonstrada.
4. Commit proprio da ferramenta/teste/inventario, com teste dirigido sob trava e verify:rapido0.

## Tarefa2 — I-TELA-SERRA-DESGASTE-LOCAL: luz nativa e retirada local

1. Retomar SOMENTE o rascunho do stash c5120032e6597c0a62fd1a68463d788d23ad0c51. Preservar os documentos posteriores e o stash original. Nao trazer o rio.
2. Reluzir nativamente os cinco atlas, conservando formas/juncoes e reduzindo altura por desenho. As faces sul recebem luz; cristas norte ficam em meio-tom, com oclusao somente em fissuras. Derivar80PNGs128x160 com anchor[0.5,1] e pe157; rampas fixas de juncao preservadas. Aplicar o bleed da tarefa1.
3. Antes de registrar: validador oficial com zeroerro nos80PNGs, inclusive light-direction/alpha-bleed; revisao independente das pranchas inteiros/mistos sobre os terrenos reais nos zooms0.5/1/2 e RGBx0.8. Nova rodada nativa se reprovar; preservar e relatar cada candidata.
4. Registrar bases, prompts, ids/hashes,80derivados/405aliases h-subconjunto-de-m preservando os estados antigos. Teste permanente chama o portao artistico sem afrouxar limites e mede canvas/pe/aliases/selecoes/cache/fallback/step.
5. Shot I-TELA-SERRA-DESGASTE-LOCAL captura volumes12/9/6/3/0 por extracao real e abre evidencias; F-TR/F-SPR/ARTE-VILA/D-SAVE-VILA-PRONTA/F-T1 devem sair0. Verify:rapido0 e commit da feature.

## Tarefa3 — I-ARTE-FONTES-NATURAIS-LEGIVEIS: demais fontes

1. Corrigir coal/iron_ore/gold_ore/fish somente onde o inventario provar defeito. Preservar identidadade, footprint, tamanho/anchor e consumo atual; nenhum rio/montanha novo. Uma fonte por lote de geracao. Para minerios, tres estados nativos presente/reduzido/remanescente, sem substituir o presente legado antes de passar no portao.
2. Arte nova e derivados passam no mesmo validador tecnico original; fontes que ja passam sao preservadas. Nao substituir a vegetacao ja homologada para imitar uma metrica: se suas guardas impedirem uma mudanca artistica necessaria, documentar o conflito e reservar essa mudanca ao operador. Isso nao impede concluir pedreira/minerios/peixes.
3. Bases, prompts, ids/hashes/derivacao versionados e manifesto com oito campos. Sem mudar os estados/caminhos antigos protegidos ou abandonar fallback.
4. Teste PNG/manifesto/origem e sonda invalidapermanente; prancha no shot com os terrenos reais/zooms/tint, aberta e revisada independentemente. Verify:rapido0 e commit proprio.

## Tarefa4 — I-TELA-FONTES-NATURAIS-PELO-VOLUME: consumo dos estados minerais

1. Render puro seleciona os tres desenhos minerais pela proporcao restante por tile. Limiares e escala em data. Rendimento vindo de mapa.ts; zero nenhum sprite. Fish/tree conservam os contratos atuais, inclusive sazonalidade/replantio.
2. Cache por tick/partida e repintura somente na troca de estado, nunca por frame. Sem PNG novo, usa a fonte antiga. Debug le textura real, estagio e contagens.
3. Teste por tabela: limites/zero/parametrizacao/nao-mutacao; extracao pelo step, quantidade/volume de outros tiles conservados; cache/fallback. Roteiro pelo jogo com estado/save valido captura retirada sem escrever na sim pelo render. GuardasF04/F-SPR/recursos/minas existentes passam integralmente.
4. Verify:rapido0 e commit proprio.

## Fechamento

Rodar npm run verify completo e mostrar saida. Se reprovar, diagnosticar/corrigir codigo sem alterar o aceite, timeout, skips, limites ou verificacoes. Registrar verificado/nao verificado, numeros/PNG/logs no PROGRESS da branch. Merge somente conforme autorizacao anterior: main limpa e branch rebaseada com verify completo0. Nao remover nenhuma worktree alheia; homologacao/pendencia de rio nao se presume resolvida.

## Ficha tecnica/orcamento da tarefa3, antes das geracoes
Fontes:coal,iron_ore,gold_ore e fish, cada uma1x1/64x64 e anchor[0.5,1] conforme manifesto atual. Minerios:atlas1x3 com os tres desenhos nativos presente/reduzido/remanescente; mesma linha de apoio na derivacao, sem fabricar desgaste por escala. Fish:cardume original sobre transparencia, preservando fonte de pesca e quantidade. Um id por lote. Orcamento inicial:uma chamada por id, mais ate duas rodadas nativas de correcao por id se o portao acusar defeito. Preservar cada rodada/prompts/id; ao limite, relatar candidata reprovada sem registrar. Bleed tecnico somente no RGB de alpha0. Derivados novos recebem teste do validador original e prova sobre grama/areia/rocha reais0.5/1/2 e RGB0.8. O peixe legado, aberto nesta sessao, parece um amontoado mineral; a nova arte deve representar cardume, nao mineral ou mercadoria no estoque.
