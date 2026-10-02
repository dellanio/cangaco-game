# Pedra modular — proposta do piloto, 2026-10-02

Status: comportamento visual proposto; sem integração ou homologação. Substitui o limite de três estados para este piloto autorizado pelo operador.

## Medida do KaM Remake
Clone D:\projetos-pessoal\kam_remake, commit 731a8a47a4a02fac3d20326fdfed0fba7d1f845b.
- KM_Terrain.pas:2593–2603: posições caminháveis ao sul do depósito, livres e alcançáveis.
- :2621–2624: sorteia posição válida e orienta trabalhador ao norte; não garante coleta pelos quatro lados.
- :3687–3705: cinco reduções até terreno sem pedra; :3594–3606 e :3665–3677: atualiza conexões cardinais/diagonais e passagem; :3715: ajusta altura.
- KM_UnitTaskMining.pas:308: retira do depósito ao norte da posição de trabalho.
São medidas do clone, não decisões herdadas de documentação visual.

## Entrada e saída da arte definitiva
Entrada: id rock; quantidade por tile; estágio; vizinhança cardinal/diagonal; relação com terreno; frente de coleta; envelope, anchor e câmera comuns; luz cdcfec5; referência D somente para estilo.
Saída futura: módulos conectáveis por tile, cinco volumes desenhados (15,12,9,6,3), vazio em 0 sem sprite; masters/derivados alinhados; mapa de junções; origem e especificação de estados; contatos em 0,5/1/2 e tint0,8.
Um tile esgotado não conserva lajedo, pedrinhas ou cicatriz mineral obrigatória. Terreno rocha/montanha permanente é uma camada distinta; não prometer que toda montanha desapareça ao retirar rock.
Não encolher o conjunto nem misturar opacidades para simular retirada. A silhueta e o volume recuam localmente e revelam faces naturais. Vizinhos podem ter quantidades diferentes.

## Prova externa desta rodada
D:\projetos-pessoal\cangaco-game-candidatos\arte\D\rock\piloto-modular-2026-10-02\preview-retirada-local.html
Usa recortes da intacta anterior, com cinco cortes por setor, SEM novas gerações. O recorte é demonstração técnica; não cria faces expostas nem junções finais. Os setores da imagem não constituem o mapeamento definitivo de coordenadas de terreno para volume elevado. Nenhum resultado desta página aprova sprites modulares.

## Implementação futura, após revisão
1. Criar ficha de geometria: superfície por tile, volume elevado, crista e frente caminhável. Resolver acesso/depth sem usar arte para mudar colisão.
2. Produzir pequeno kit nativo: módulos interiores, bordas e quinas em cinco estágios. Definir orçamento antes de gerar; não multiplicar cegamente 16 máscaras por 5 estados.
3. Render: invalidar por patamar de quantidade, além de presença; recalcular junções também nas diagonais relevantes. Preservar ids, dados e manifesto existentes.
4. Simulação: avaliar seleção de frentes acessíveis. Não presumir que a regra KaM já exista no Piancó; uma eventual mudança exige item e aceite próprios.
5. Provar em jogo: duas frentes com extração alternada, vizinhos em estágios diferentes, acesso do pedreiro e desaparecimento completo. A captura prova aparência; testes determinísticos provam quantidade e seleção.

## Parada
Esta rodada entrega proposta e demonstração externa. Sem modificar assets, manifesto, render ou simulação. Revisão independente e homologação continuam obrigatórias para os futuros sprites. Sem merge ou push.

## Correção do operador — volume apoiado, 2026-10-02
A demonstração por faixas cortadas de baixo para cima foi reprovada visualmente: elimina o apoio, cria limites retos e faz a rocha parecer suspensa. Preservar o arquivo como registro técnico, não como modelo artístico ou referência de esgotamento.

### Dois eixos distintos
- Frente no mapa: coleta a partir de uma posição acessível; a retirada pode avançar do sul para o norte e alternar entre locais.
- Altura do volume: o topo e as cristas baixam progressivamente. Nunca retirar a base e conservar uma tampa de pedra acima dela. Não confundir topo da imagem com norte do tile: há projeção de volumes elevados.

### Cinco estágios realmente desenhados
- 15: formação íntegra apoiada no chão, com cristas e bancadas naturais.
- 12: perda das cristas superiores e de saliências altas, surgindo novas faces irregulares.
- 9: bancada claramente mais baixa, com volumes laterais distintos; sem linha horizontal uniforme atravessando o conjunto.
- 6: afloramento baixo apoiado, com fragmentação irregular e depressões; continuidade com vizinhos ainda altos onde existir ligação física.
- 3: poucos volumes baixos remanescentes, visualmente próximos do esgotamento; não conservar uma serra inteira em miniatura.
- 0: nenhum sprite de pedra ou detrito obrigatório, só o terreno base.
Os números indicam quantidade, não uma proporção linear obrigatória de altura, área alfa ou volume. Não ajustar escala do PNG para simular esgotamento.

### Forma e contato
Preservar canvas, escala e pivô; as faces e a silhueta mudam dentro desse envelope. Contorno quebrado, fissuras, faces inclinadas e patamares de alturas desiguais seguem fraturas do material. Uma face plana natural é permitida: o que se proíbe é o recorte reto seguindo a grade e a linha uniforme de guilhotina. Não resolver adicionando ruído numa máscara: cada estado deve desenhar sua nova face, apoio e oclusão de contato sob a luz cdcfec5.
A origem da base permanece fixa enquanto existir volume. A extensão lateral pode recuar; apoio não significa preservar artificialmente toda a base intacta até o último estágio. Emenda entre tiles com estágios distintos precisa de face de transição, sem tampas suspensas ou fendas cortadas a régua.

### Portões de aceitação adicionais
1. Em 0,5/1/2, crista/altura percebidamente menor nos cinco patamares, mantendo reconhecimento geológico.
2. Nenhum volume visível suspenso após esgotar um vizinho ao sul; comprovar também sobre areia, onde a linha de apoio é mais evidente.
3. Vista sem grade e sem números: esgotamento deve ser compreendido só pela arte.
4. Sequências alternadas em duas frentes e mosaicos 15/9, 12/6 e 6/3: junções sem cortes retos artificiais.
5. Contraste e contato permanecem legíveis com tint0,8; zero remove todos os pixels do recurso.
O protótipo anterior passou apenas na contagem/retirada; não passa nesses portões visuais. O próximo artefato visual requer geração nativa dos volumes e junções, não novos recortes da intacta.

## Decisão visual: formação única, 2026-10-02
O operador reprovou repetir12 pequenos módulos como serra. Preservar uma formação geológica grande conectada; tiles são controle de extração, não12mini-serras visíveis. A próxima prévia usa estados completos da mesma serra com retiradas locais e assimétricas. Isso não resolve automaticamente o controle por tile ou junções finais: não registrar esses estados whole-formation em rock1x1 nem repeti-los no mapa. Apoio próprio, topo baixando, faces irregulares e zero sem pedra continuam obrigatórios. Módulos anteriores preservados como reprovados para direção artística.

