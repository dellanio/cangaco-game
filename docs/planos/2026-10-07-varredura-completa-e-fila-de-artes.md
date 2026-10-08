# Varredura do projeto e fila de produção de artes

> Decisao do operador de 2026-10-08: BUG-T/BUG-TROPA-DE-24-PRESA (ordens 99/187) desconsiderado em b460c61; nao reabrir, investigar ou contar como pendencia. Estes documentos sao o inventario historico de 2026-10-07. Integracao somente documental; main e noru-novos-sprites nao recebem candidatos da escola rejeitada nem restauracao de assets/base/_estilo/.

[Certo] Pedido do operador em 07/10/2026: reunir bugs, funcionalidades, fases,
melhorias de cenário e artes para aproveitar a janela de execução e geração.
Worktree: `D:\projetos-pessoal\cangaco-game-fechamento-projeto`.
Branch: `fix/fechamento-projeto`. Plano-base: `2026-10-07-fechamento-projeto.md`.
Este documento amplia o inventário; não reordena BUILD_PLAN.md nem altera seus
aceites. Uma task por vez e um commit de implementação por task, sem push.

## 1. O que foi conferido

[Certo] Fontes atuais: BUILD_PLAN.md, BUGS.md, PROGRESS.md, BALANCE_LOG.md,
IDEIAS.md, test-results.json, planos de clima/Açude e animação, história das dez
missões, assets/manifest.json, dados de prédios/unidades e consumidores de render.
Docs/ESCOPO.md e o antigo plano de marcos são fotos de 01/10, não status atual.
Os seus itens foram cruzados com implementações posteriores.

[Certo] Inventário técnico: [2026-10-07-inventario-assets.json](2026-10-07-inventario-assets.json).
Ele inclui todos os 88 assets, estados, atlas, caminhos, dimensões dos PNGs,
hashes, base e procedência, além de ícones/áudio/trilha. Notas antigas de
"homologação pendente" não foram tratadas como reprovação atual automática.

| Evidência | Resultado conferido |
|---|---|
| [Certo] Assets do manifest | 29 prédios, 29 unidades, 7 terrenos, 1 estrada, 2 entradas de vegetação, 6 recursos, 13 camadas de trabalho, 1 animal; 88 entradas |
| [Certo] Arquivos dessas entradas | 498 caminhos ativos únicos; nenhum ausente; bases declaradas presentes |
| [Certo] Ícones, sons e trilha | 117 entradas adicionais com arquivo; nenhum desses arquivos declarados ausente |
| [Certo] Mercadorias | 28 ícones existentes; machado não está sem arte |
| [Certo] Unidades | 14 civis, 9 militares, 5 mercenários de combate e Padre; todos com atlas |
| [Certo] Aceites registrados | 232 chaves, 229 true e 3 false; isso não cobre bugs reabertos, Açude, campanha ou homologação humana |
| [Certo] Arte de obra | farm, wineyard, fishermans, mill e bakery sem estado madeira no manifest |
| [Certo] Crescimento | tree sem muda/crescendo_1/crescendo_2; corn e grapes sem semeado/muda/verde próprios |
| [Certo] Animais | pigs representa bodes e tem 12 quadros; horses não tem entrada animal |
| [Certo] Trabalho | ocioso, fumaca, schoolhouse, gold_mine, coal_mine, iron_mine, swine_farm e stables sem entrada trabalho própria |
| [Certo] Som configurado sem arquivo | building-hit, peace-ended, victory e music-peace; silêncio é fallback. A trilha de três faixas já existe e exige conferir se music-peace ainda é consumido |

[Certo] Foram montadas e abertas quatro folhas de contato: todos os 29 prédios
completos; 25 amostras de natureza/terreno/recursos/animais; 13 camadas de
trabalho; 73 amostras sul de ações de unidades. Arquivos:
`test-output/auditoria-predios.png`, `auditoria-natureza.png`,
`auditoria-trabalho.png`, `auditoria-unidades.png`. São triagem visual;
não equivalem à revisão de todos os frames/direções nem à homologação em jogo.

## 2. Estado das fases

| Fase | Estado atual e o que falta |
|---|---|
| [Certo] 0 / A — fundação e construção | Sistemas e loop existem. Corrigir ocupação do Obreiro e completar arte de obra; não reconstruir o loop |
| [Certo] B — comida e crescimento | Cadeias implementadas. Falta fechar o balanceamento com clima/irrigação e a definição da barra de comida |
| [Certo] C — militar | Combate, treino, formação e IA existem. Marcha e logística extrema abertos; comandos de grupo e atalhos abaixo ainda precisam de escopo |
| [Certo] D — profundidade | Relevo e consumidores existem. Luz do relevo sem aceite final; máscaras/decoração exigem conferência ou integração específica |
| [Certo] E — entrada, save e entrega | Menu, configuração, gavetas e build existem. Publicação no itch é false; verificação precisa ser verde |
| [Certo] F — névoa e adversário | Implementados. Balanceamento do difícil com tropa de 24 e campanha ainda faltam |
| [Certo] G — animação | Atlas reais existem. Retocar ataques e completar as lacunas de estados/camadas, sem refazer 29 unidades por suposição |
| [Certo] H — áudio | Camada, volume, ambiente e trilha implementados. Sons faltantes e homologação auditiva abaixo |
| [Certo] I — primeira partida | Guiada, dicas e ajuda existem. Playtest externo false; revisar compreensão e fechar reprovações |
| [Certo] Clima / Igreja / Padre | Estações, crescimento, relógio, Igreja, poderes e atlas já existem; Padre espera homologação. Açude e irrigação ainda não existem |
| [Certo] Campanha | Narrativa de dez missões existe; sistema de missão, objetivos, progressão e seus cenários ainda são trabalho separado |

## 3. Ordem para aproveitar geração de artes

[Provável] A melhor utilização da janela é produzir primeiro arte que tem
consumidor e lacuna comprovada, depois cenário com um piloto aprovado, e por
último peças de campanha que dependem de layout. Gerar 29 prédios/unidades
inteiros outra vez desperdiçaria o que já existe e multiplicaria a integração.

1. Fechar o piloto de estilo/luz e preparar briefings e referências por lote.
2. Estados madeira faltantes, crescimento de árvore/culturas e cavalos.
3. Retocar os dois ataques já apontados e harmonizar a madeira do Armazém.
4. Variações de vegetação, decalques e transições de terreno.
5. Animações de trabalho em fallback e recursos esgotando, com consumidor definido.
6. Açude, com footprint e pontos de interação fechados antes da arte final.
7. Identidade regional dos mapas, retratos e telas da campanha.
8. Revisão dos demais assets: regenerar somente os reprovados.

[Certo] "Quantidade de PNGs" não é "quantidade de chamadas de geração".
Frames derivados, masters, espelhos e atlas têm custos diferentes. Não foi
presumido limite de resets, cota, velocidade ou disponibilidade do PixelLab.
Na sessão, geração nativa de imagens está disponível; PixelLab não aparece entre
as ferramentas expostas. A tarefa específica do machado continua dependente
desse acesso; não trocar seu provedor silenciosamente.

## 4. Tasks de arte: lacunas concretas e retoques solicitados

[Certo] Os rótulos A abaixo são tasks deste pacote, não novas siglas oficiais.
Cada uma recebe aceite técnico em commit antes da integração de código.
"Gerar" inclui candidata, master, derivado, origem, validação e prova no jogo.

| Task / prioridade | Arte a produzir ou corrigir | Aceite e dependência |
|---|---|---|
| A01 / P0 | Piloto de conjunto: unidade, árvore e prédio atuais com chão | Selecionar referência canônica e testar 0,5/1/2 e RGB×0,8. A folha aberta mostra graus diferentes de detalhe entre vegetação, prédio e personagem; [Provável] harmonização precisa de piloto, não filtro global |
| A02 / P0 | farm/madeira | Mesmo canvas, silhueta, porta, milho e anchors do completo; obra não muda de geometria ao concluir |
| A03 / P0 | wineyard/madeira | Derivar do completo; manter identidade de cana/cachaça, sem uvas ou videira |
| A04 / P0 | fishermans/madeira | Derivar do completo; entrada e margem de água alinhadas |
| A05 / P0 | mill/madeira | Roda e edificação na mesma posição entre estados; mecanismo não salta |
| A06 / P0 | bakery/madeira | Mesmo telhado, fachada, anchors de trabalho/estoque/fumaça; não embutir estoque permanente |
| A07 / P0 | storehouse/madeira | Substituir madeira provisória pela estrutura do completo aprovado. Divergência registrada no manifest; manter anchors normalizados |
| A08 / P0 | tree: muda, crescendo_1, crescendo_2 | Três derivados específicos, mesma base/linha dos pés e canvas compartilhado. Consumidor de crescimento já existe; hoje encolhe adulta como fallback |
| A09 / P0 | corn: semeado, muda, verde | Três estados próprios. Pronto continua a base madura; transição visual no mesmo tick da simulação |
| A10 / P0 | grapes: semeado, muda, verde | Três estados de cana-de-açúcar; nenhuma videira. Preservar leitura sobre campoCana |
| A11 / P0 | horses: idade1/2/3, quatro quadros cada | 12 quadros de cavalos para Cocheira, mesmo contrato animal dos bodes; pivô fixo, idades legíveis, cinco animais no curral sem fallback |
| A12 / P0 | rogue/atacar — Emboscador | Inspecionar todos os 8 frames por direção e retocar estilingue, mão e trajetória; arma visível no zoom 0,5, sem mudança em combate |
| A13 / P0 | vagabond/atacar — Aguilhadeiro | Corrigir comprimento da vara ao norte ao longo do golpe; revisar sul já retocado e montaria; sem jitter ou alteração de alcance |
| A14 / P1 | schoolhouse/treino | Oito quadros de camada para treinamento; prédio tem consumidor, mas não entrada trabalho. Separar pessoa/efeito do corpo e preservar escola restaurada pelo operador |
| A15 / P1 | trabalho/ocioso | Laço genérico de oito quadros no contrato atual; pilotar aparência neutra adequada a diferentes casas antes de espalhar. Não desenhar civil errado em toda casa |
| A16 / P1 | Trabalho das três minas | Uma task por gold_mine/coal_mine/iron_mine; derivar personagem mineiro e laços do caso dentro, validar abertura/máscara e não só gerar folha solta |
| A17 / P1 | Trabalho de swine_farm e stables | Uma task por prédio, personagem animal_breeder, laços e recorte pela área real; bodes/cavalos continuam camadas independentes |
| A18 / P1 | hand_axe — machado PixelLab | Já tem ícone: gerar a melhoria pedida, preservar id/origem e distinguir do defeito do roteiro D-TELA-03. Uma candidata e prova na carga/pilha/barra |
| A19 / P1 | Açude | Depois da decisão de footprint: madeira/completo e quatro níveis de água. Água móvel em camada separada, barragem fixa; custo da fazenda e trabalhador Roceiro já decididos |
| A20 / P1 | Revisão de luz em 11 prédios | gold_mine, coal_mine, weapons_workshop, marketplace, butchers, tannery, armory_workshop, metallurgists, iron_smithy, weapon_smithy, armor_smithy. Manifest registra ressalvas de luz sul invertida; algumas foram aceitas pelo operador. Reavaliar e regenerar só com reprovação atual |
| A21 / P1 | Homologação pendente | Padre, árvore seca, bodes, água, solo e menu lateral: abrir evidência atual e registrar decisão. Arquivo presente não significa aprovação humana |

## 5. Vegetação, terreno e cenário: pacote visual proposto

[Certo] Há seis estados adultos em tree: juazeiro (`presente`), árvore seca
no slot `umbuzeiro`, mandacaru, facheiro, xique-xique e macambira. Não falta
arte adulta desses seis slots. A árvore seca substituiu o umbuzeiro por decisão
do operador; reintroduzir umbuzeiro vivo é expansão, não conserto.

| Task | Lote de cenário | Critério / integração |
|---|---|---|
| C01 / P1 | Juazeiro: duas silhuetas adicionais | [Provável] reduz repetição de mata. Mesma escala e luz; distribuição determinística, sem alterar quantidade/colisão dos recursos |
| C02 / P1 | Árvore seca: duas variantes | Galhos legíveis a 0,5, sem aparência de cópia espelhada; preservar a escolha de árvore seca |
| C03 / P1 | Mandacaru: duas variantes | Conferir referência botânica limpa; diferenciar braços e massa, não só cor |
| C04 / P1 | Facheiro: duas variantes | Colunas em conjunto com identidade distinta do mandacaru; prova de escala junto a unidade |
| C05 / P1 | Xique-xique: duas variantes | Porte baixo/ramificação identificáveis; não confundir com facheiro reduzido |
| C06 / P1 | Macambira: duas variantes | Bromélia reconhecível, roseta legível e sem ruído de folha fina |
| C07 / P1 | Biblioteca de 20 decalques | Quatro tufos secos, quatro seixos, quatro rachaduras, quatro gravetos/folhas, quatro touceiras baixas. Todos isolados e transparentes. Precisa consumidor determinístico com culling; não adicionar recurso ou obstáculo na sim |
| C08 / P1 | Agrupamento visual de mata e caatinga | Pilotar distribuição sobre recursos existentes. Alterar gerador e oferta de madeira é task de balanceamento separada; não misturar com decoração |
| C09 / P1 | Costuras de grama/areia/água/rocha | Assets atuais existem. Comparar mosaicos 3×3 e máscaras 0–15 no manifest real. Abrir bordas/cantos, zooms e tint; gerar somente transições reprovadas. Métrica ou extrusion sozinha não prova todas as emendas corrigidas |
| C10 / P1 | Rocha/minérios em esgotamento | rock, coal, iron_ore, gold_ore: planejar até três estágios por id a partir da mesma base. Consumidor baseado em quantidade precisa aceite próprio; não cadastrar estágios como espécies aleatórias |
| C11 / P2 | Toco de juazeiro | A sim guarda quantidade zero, mas render atual oculta recurso esgotado. Gerar candidata é possível; integrar exige regra explícita de desenho e espaço preservado para replantio |
| C12 / P2 | Chão sazonal e plantas murchas | Inverno/ seca já têm efeito visual. Plantas murchas são opção do plano do clima, não falta obrigatória. Evitar quatro sets de todo terreno se tint adequado resolve |
| C13 / P2 | Cenário regional do brejo | Candidatas de vegetação mais verde e solo úmido para Areia; preservar luz, tile e leitura das unidades |
| C14 / P2 | Cenário litorâneo | Areia branca, terra escura avermelhada, margens de rio e vegetação regional; mapear ids/transições antes de integrar. Não gerar neve ou gelo |
| C15 / P2 | Pedra/estrada em cenário | Rua já tem arte e conexiones. Provar legibilidade sobre solo novo e caminho assentado/planejado; não reabrir a entrega como "sem sprite" |
| C16 / P2 | Decoração de aldeia/campanha | Cercas, carroça, troncos, barris, embarcadouro e marcos somente após indicar mapa/uso. Sem mercadoria pintada dentro de prédio ou elemento que sugira obstáculo inexistente |

[Provável] O núcleo de lacunas mais simples representa 43 derivados de estado/frame:
5 madeiras faltantes + 1 madeira do Armazém + 3 crescimentos de árvore + 6 de
culturas + 12 cavalos + 8 escola + 8 ocioso. É orçamento de planejamento,
não autorização para 43 gerações nem garantia de 43 assets aprovados. Vegetação
proposta acrescenta 12 variantes adultas e 20 decalques. Trabalhos de minas,
criadores, Açude e campanha têm orçamento separado depois do briefing.

## 6. Revisão de unidades, camadas e efeitos

[Certo] Não estão faltando as animações básicas de todas as unidades. O inventário
contém atlas e estados reais. Revisão de produção usa contatos de todos os
rumos, animação reproduzida, linha dos pés, pivô, arma/roupa/cavalo e leitura em jogo.

| Task | Pendência / proposta | Aceite |
|---|---|---|
| U01 / P1 | Matriz completa dos 29 atlas | Todos os estados declarados e direções consumidas; não gastar em idle/andar/morrer já existente sem reprovação |
| U02 / P1 | scout/knight e demais montados | [Provável] revisar passada das patas, selim e estabilidade; há observação histórica de movimento fraco. Abrir ciclo atual antes de decidir regeneração |
| U03 / P1 | Máscara de facção | Contrato artístico pede máscara separada; auditar consumidor atual antes de gerar 29 séries. Pilotar militia, azul/vermelho, 0,5/1/2; não aprovar troca que apague tecido/sombra |
| U04 / P1 | Camadas de trabalho existentes | 13 entradas com PixelLab presentes. Conferir recorte pela área, pé/escala da rua e janela no prédio; cortes são contrato atual, não motivo para refazer os 13 automaticamente |
| U05 / P2 | Fumaça genérica ausente | A padaria já tem fumaça procedural. Fallback genérico de F-VIVO é outro consumidor: decidir removê-lo/substituí-lo ou produzir seus oito frames, sem duplicar fumaça |
| U06 / P2 | Impactos/projéteis/poderes | Sangue/poeira/faísca, flecha/pedra e poderes do Padre: primeiro revisar procedural existente; sprites adicionais somente com consumidor e legibilidade comprovada |
| U07 / P2 | Mortes e corpos | Quadros de morte existem. Corpos cortados foram aceitos pelo operador; não tratar isso como bug obrigatório. Revisar apenas defeito novo comprovado |

## 7. Bugs, funcionalidades e verificação

| Task | Situação / execução necessária | Aceite ou decisão |
|---|---|---|
| ~~B01 / P0~~ | ~~Tropa 18/24 presa~~ | ~~Incorporar a fixture reforçada da main sem alterá-la; reproduzir ordens 99/187; ampliar plano antes do código para passos iniciados. 400 ordens, todos vivos, sem sobreposição, sem marcha após 1500 ticks~~ |
| B02 / P0 | Armas sob carga infinita | Tábua recebe atendimento e quartel recebe armas; conservar reservas/mercadoria. Operador escolhe envelhecimento ou teto de atendimento consecutivo |
| B03 / P0 | Obreiro ocupa canteiro | Decisão recebida: ocupa. Atualizar colisão/reservas e fila de entrega; F18f sem pilha e obra conclui |
| B04 / P0 | Mundo transladado | Saves de fixtures, dados lidos por CJS e minas em coordenadas absolutas são bloqueios. Corrigir testes/infraestrutura sem ignorar suite, alterar hash publicado ou forçar original em toda corrida |
| B05 / P0 | Roteiro D-TELA-03 | Machado tem ícone. Criar fixture deliberada sem arte para testar fallback, manter teste do machado real; não retirar cobertura |
| B06 / verificado localmente | Película climática e jornal | Zoom compensado; roteiro atualizado à decisão de uma notícia. Clima passou em 0,5/1/2 e jornal passou. Verificação completa ainda necessária; operador marca feature |
| B07 / P1 | Luz do relevo | Comparar com/sem relevo, localizar diferença estável e investigar ligado:false. Não habilitar por suposição nem atribuir tudo às texturas |
| F01 / P1 | Açude: prédio | Custo fazenda/Roceiro definidos; fechar footprint, desbloqueio e implantação antes da sim |
| F02 / P1 | Açude: água | Enchimento por chuva, armazenamento, evaporação/vazão e estados de nível com dados; água não é nova fome/sede de pessoas |
| F03 / P1 | Açude: irrigação | Escolher ligação por distância ou transporte, culturas atendidas e consumo; vazio não irriga, seca com irrigação difere de seca sem ela |
| F04 / P1 | Açude: interface | Nível, vínculo com fazenda, raio/ligação e alerta; prova visual e integração da A19 |
| F05 / P1 | Barra de comida | Operador decide total armazenado ou estoque do armazém. Cenário armazém 10/Bodega 5 explicita resultado na barra/HUD |
| F06 / P1 | Aviso prédio vago cinco minutos | Lógica implementada. Roteiro visual verifica antes/depois, uma notícia e reset quando ocupa; não confundir com bug de jornal resolvido |
| F07 / P1 | Tutorial, dicas e ajuda | Percorrer primeira partida sem conhecimento prévio, clareza das cadeias, fome, paz, estoque e desbloqueios; registrar e corrigir ambiguidades |
| F08 / P1 | Balanceamento climático/econômico | Lote com milho/cana, seca/irrigação e roças por moinho. 14,5% de espera é medição atual com clima, não automaticamente bug contra antigo teto de 10% |
| F09 / P1 | Combate no difícil | Medir tropa de 24 contra fácil/normal/difícil, aproximação sob névoa e poderes do Padre. Ajustar lote aprovado, não números avulsos |
| F10 / P2 | Halt / Split / Link | Lacuna do GDD; definir regras de parar, separar e unir grupos e aceites antes de implementar. Formação já existe |
| F11 / P2 | Atalhos do GDD | B, F, Delete, Ctrl+1..9 e 1..9 não existem na tabela atual. Fechar conflitos com WASD/ajuda e comandos; atalho não aparece na ajuda antes de existir |
| F12 / P2 | Logística fina de prédio | Entrega/esvaziar por casa, recusa de armas/recrutas no quartel, fechamento para trabalhador: lacunas comparadas ao KaM, não regras aprovadas de Piancó |
| F13 / P2 | Outros controles econômicos | Ponto de corte do lenhador, reunião/teto de ouro da Prefeitura e reordenar escola: propor aceites, confirmar consumidor e decisão. Modos do lenhador já implementados |
| F14 / adiado | F-REPL-c plantar tile vazio | Adiado por decisão, não tarefa esquecida. Reabrir somente com aceite e efeito na disponibilidade de madeira |
| F15 / condicionado | Escala de grandes exércitos | Custo all-against-all já medido em 50/100/200. Reavaliar antes de cenário que aumenta unidade; otimização ampla exige plano próprio |
| F16 / P2 | Feedback de obra/estoque/desbloqueio | Auditar animações e efeitos atuais antes de propor pulso do HUD, poeira de martelo ou destaque de botão novo; parte do feedback já existe |

## 8. Áudio, entrega e validação final

| Task | Entrega | Critério |
|---|---|---|
| S01 / P1 | victory | Candidato CC0, origem verificável, aprovação auditiva, recorte e disparo único de vitória |
| S02 / P1 | building-hit | Banco CC0 e teste de dano/limite por quadro/distância; hoje sem arquivo no manifest |
| S03 / P1 | peace-ended | Aviso CC0 e disparo único no fim da paz; não depender apenas do jornal |
| S04 / triagem | music-peace | Conferir consumo após trilha de três faixas. Se substituído, documentar configuração; se consumido, fornecer faixa aprovada, sem duplicar trilha |
| S05 / P1 | Cortes e mixagem | Ouvir sons existentes, transições e volumes em partida; licença e distância não provam qualidade auditiva |
| E01 / P0 | verify completo | Typecheck, lint, 31 dados, suite normal e transladada verdes; nenhum selo com falha |
| E02 / P1 | Longos e screenshots | Sob trava, sem concorrência; suite longa limpa no HEAD e todos os roteiros, uma execução por vez |
| E03 / P1 | Build | Conferir dist, rotas, arquivos, atlas, console e licenças; masters/candidatas não entram no build |
| E04 / P1 | Playtest externo | Pessoas de fora, relatórios reais, triagem/reteste; não marcar por teste automatizado |
| E05 / P1 | Publicação itch | Pacote revisável para operador publicar; link jogável verificado. Não publicar ou enviar convites sem autorização |

## 9. Campanha e suas artes

[Certo] A narrativa existe em `pianco-campanha-10-missoes.md`; a frase antiga
"nada disso está construído" nesse arquivo está desatualizada para economia,
mercado, cavalaria, névoa e combate. O que falta é integrá-los em missões reais.

| Task | Código / design | Artes correspondentes |
|---|---|---|
| M00 / P2 | Escolher id oficial, schema de missão, cenário inicial, objetivos e falhas; save/progressão/desbloqueios | Mapa de campanha e identidade visual piloto |
| M01 — Piancó | Primeira missão e objetivo próprio; onboarding no cenário real | Caatinga da abertura, tela/ilustração de briefing |
| M02 — Patos | Objetivo econômico com prazo, ligado aos dados da missão | Variação regional de vila/solo e briefing |
| M03 — Soledade | Cavalaria inimiga e ouro renovável conforme roteiro | Caatinga mais seca, pontos de recurso e briefing |
| M04 — Boqueirão | Defesa por ondas e água/pesca | Açude/margens de água e mapa defensivo |
| M05 — Campina Grande | Mercado, segundo armazém e objetivo de duração | Feira/aldeia, estrada e briefing |
| M06 — Areia | Cadeia de ferro e terreno verde/brejo | Kit C13 e mapa com identidade úmida |
| M07 — Itabaiana | Regra nova de capturar unidade e objetivo composto; não presumir conversão do Padre equivalente | Retrato/identidade do alvo e locais de interação |
| M08 — Santa Rita | Cavalaria, prazo e mapa amplo | Canavial com kit de crescimento e briefing |
| M09 — João Pessoa | Alvo protegido, torres e mercenários | Cenário urbano/litoral, fachada/props só conforme mapa |
| M10 — Cabedelo | Duas frentes, conclusão, persistência e epílogo | Rio/margens/porto, tela de conclusão |
| M11 / P2 | Briefings, diálogos e epílogo em UI de campanha | Retratos de Severino, Vicente Cabo Branco, Coronel Antônio e Dona Esperança; outros personagens somente após roteiro confirmar uso |
| M12 / P2 | Missões encadeadas e replay determinístico | Dez miniaturas dos mapas, seleção bloqueada/liberada e mapa regional; identidade deriva dos mapas finais |

[Provável] Primeiro gerar um piloto de briefing e quatro retratos é mais útil
que dez cenários de tamanho arbitrário: os mapas, interfaces e resolução ainda
precisam de contrato. Ilustração narrativa não substitui mapa jogável nem asset
isométrico. Cada missão fecha seus próprios testes e evidência antes da próxima.

## 10. Contrato dos lotes e passagem entre resets

[Certo] Aplicar `skills/pianco-sprite-director`, a especialidade pertinente,
`pianco-render-contract` e `pianco-sprite-tools`. Regras atuais prevalecem sobre
nota antiga ou skill arquivada. A matriz técnica confere o consumidor real.

Para cada task de geração, salvar uma ficha contendo:

- id neutro, papel, tipo, estado/direções, tamanho master/derivado, footprint,
  anchor, área de recorte, ferramenta/provedor e referência autorizada;
- prompt exato, ids de geração/personagem, semente se houver, caminhos e SHA-256;
- saída crua preservada, master, derivados, contato e resultado do validador;
- status: não iniciado / candidata / reprovada / validada tecnicamente /
  homologada pelo operador / integrada / verificada em jogo;
- próximo passo concreto e bloqueio, se houver; um reset não repete geração aprovada.

[Certo] Candidatas novas ficam fora do repositório em
`D:\projetos-pessoal\cangaco-game-candidatos\arte\<variante>\<id>\`.
As referências D externas de Armazém e serf existem; conferir os hashes da skill
antes de enviá-las. Elas servem para materiais e volume, não luz antiga.

[Certo] Luz vem de cima, levemente do sul, sem eixo leste-oeste. Terrain é
albedo sem sombra direcional. Referência de geração é limpa, sem contato ou
captura do jogo; capturas entram somente na avaliação de escala/contraste.
Unidade comum usa contrato 64×96 e master 128×192, salvo entrada específica;
árvore adulta tree usa 192×256 e master 384×512. Prédio segue seu manifest.
Preservar pixel art, transparência, bordas, pivô e todos os anchors existentes.

[Certo] Gerar um id por lote e até três variações/estágios quando a especialidade
exige; animação valida um estado por lote e todos os rumos exigidos. Nenhuma
mudança de colisão/velocidade/custo para acomodar imagem. Não cadastrar folha
de depuração como arte final. Não forçar integração de uma candidata reprovada.

### Briefings iniciais prontos para especialização

| Lote | Instrução de produção |
|---|---|
| Madeira de prédio | Derive um esqueleto em construção do master completo aprovado deste id; preserve canvas, porta, silhueta externa, material e anchors. Não desenhe trabalhador ou mercadoria permanente. Gere somente madeira; comparação com completo é QA, não referência de geração |
| Crescimento do juazeiro | Derive muda, juvenil e jovem da mesma espécie/base autorizada; mesma linha dos pés e luz, três portes biologicamente legíveis. Canvas compartilhado transparente; sem encolher arbitrariamente adulta |
| Milho/cana | Produza semeado, muda e verde como estados de plantio em tile ortogonal. Cana é cana-de-açúcar. Preserve densidade por tile, leitura sobre seu chão e transição para pronto atual |
| Cavalos da Cocheira | Animal isolado, três idades, quatro frames de repouso por idade; mesmo pivô. Não incluir cavaleiro, cerca ou chão; cenário de avaliação monta o curral |
| Vegetação regional | Use referência limpa da espécie; luz sul sem lateral, sombra curta, variação de silhueta e material que sobrevive a 0,5. Um id e duas novas variantes; não repetir três cactos só com escala/cor |
| Decalques | Um pequeno elemento seco da caatinga por PNG transparente; aparência albedo quando de chão, nenhum texto/objeto arquitetônico, leitura sem ruído. Aplicação não sugere recurso explorável |
| Açude | Somente após ficha de footprint/porta: barragem fixa e lâmina em camada independente com quatro níveis, sem pessoas embutidas. Distinguir reservatório de fazenda sem inventar mecânica |

## 11. Decisões e dependências que não podem ser inventadas

| Ponto | O que está fechado / o que falta |
|---|---|
| Design de Açude | Custo da fazenda e Roceiro fechados; footprint, desbloqueio, beira d'água e ligação de irrigação pendentes |
| Logística extrema | Problema confirmado; envelhecimento versus limite de atendimento ainda sem escolha |
| Comida na barra | Falta definição de escopo do contador |
| Art direction | Piloto estabelece compatibilidade entre D, unidades PixelLab e terreno atual; não presumir troca geral de estilo |
| Campanha | Id oficial, aceites de missão, tamanho/objetivos e retratos usados na UI |
| PixelLab | Acesso à ferramenta para as gerações específicas; não substituir por outro provedor sem registrar decisão |
| Homologação e publicação | Operador aprova aparência/áudio e marca test-results.json; publicação e playtest dependem de pessoas |

## 12. Não entram como pendência obrigatória

[Certo] Multiplayer, editor, reputação e refeição de seis assentos continuam
ideias/escopo não aprovado. Tela cheia por API foi recusada pelo conflito do Esc.
Terreno variado, névoa, áudio, modos do lenhador, piso de pedra, atlas militares
e mercenários já existem; não copiar a lista antiga do ESCOPO/IDEIAS como ausência.
Escola Noru foi aplicada e revertida pelo operador. Não reaplicar como melhoria
automática. Chão determinístico foi substituído por captura determinística;
não abrir novamente um bug de grão aleatório sem reprodução.

## 13. Próximo pacote recomendado

[Provável] Pacote de arte 1: A01–A13 e C01–C09, task por task, com piloto antes
da expansão. Em seguida A14–A21, C10–C16 e U01–U06. As tasks de campanha ficam
como candidatas/briefings até os contratos de mapa/UI estarem fechados.
[Certo] O pacote de código segue B01–B07, F01–F09 e E01–E05, respeitando
dependências. A task V corrigiu o roteiro do jornal e as fixtures/gerador transladados;
os testes dirigidos e o verify:rapido passaram. O fechamento depende do verify completo.

## 14. Próxima atividade determinada pelo operador

[Certo] Após encerrar esta varredura e sua verificação, executar o pacote
`codex-sertao-mapa` solicitado em 2026-10-07, antes dos pacotes recomendados acima.
Ele está empilhado, ainda não iniciado. A instrução integral do operador é o contrato;
este registro não substitui nem reformula seus aceites.

- Criar `../cangaco-game-codex-sertao-mapa`, branch `codex-sertao-mapa`, a partir
  da main atual no momento da criação, com node_modules por junction.
- Primeiro, task 0: inserir no BUILD_PLAN da nova branch, antes de
  `## Backlog com gatilho`, a seção e os quatro textos de aceite exatamente
  como enviados pelo operador. Commit exclusivo:
  `docs(sertao-mapa): aceites dos enfeites do sertao e da caatinga pela estacao, antes do codigo`.
- Depois, um commit por item, nesta ordem: I-ARTE-ENFEITES-DO-SERTAO (oito
  enfeites), I-TELA-ENFEITES-NO-MAPA (distribuição decorativa determinística),
  I-ARTE-CAATINGA-NA-SECA (pares de vegetação),
  I-TELA-CAATINGA-PELA-ESTACAO (troca gradual pela estação).
- Cada item exige teste próprio sob trava, roteiro de captura, evidência aberta
  e verify:rapido verde. No fim, verify completo, PROGRESS da branch com medidas
  e capturas, lista de commits e parada para merge pelo operador.
- Não alterar src/sim/ ou GameState, main, .claude/, AGENTS.md ou
  test-results.json; sem push. Parar e reportar se houver necessidade de sim,
  impacto do validador sobre outras entradas ou decisão de jogo não coberta.
Não há promessa de executar em background depois de encerrar a resposta.
