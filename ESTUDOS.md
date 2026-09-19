Prompts, na ordem

1. O game loop e o tick

Sou engenheiro de software experiente, mas nunca fiz jogo. Explique game
loop e tick rate para quem sabe programar mas não conhece o vocabulário
de games. Cubra: por que jogos separam "atualizar o mundo" de "desenhar
na tela"; o que é passo de tempo fixo e por que é preferível a passo
variável; o que é interpolação entre ticks; e o que dá errado quando a
lógica usa delta time variável. Use o artigo "Fix Your Timestep" do Glenn
Fiedler como referência. Exemplos em TypeScript.

2. Determinismo e RNG semeado

Explique determinismo em simulação de jogos. O que significa uma
simulação determinística, por que ela é desejável, e quais são as fontes
comuns de não-determinismo. Explique gerador pseudoaleatório semeado:
como funciona, o que é a semente, por que Math.random() não serve, e como
implementar um mulberry32 em TypeScript de forma pura (sem estado interno
mutável). Explique também por que ordem de iteração e ponto flutuante
podem quebrar determinismo. Público: engenheiro de software sem
experiência em games.

3. Arquitetura de simulação

Explique como separar a simulação de um jogo da sua renderização.
Cubra: por que a lógica não deve viver dentro da engine gráfica; o que é
uma função step(estado, comandos) -> novo estado; padrão de comandos em
vez de chamadas diretas; por que o estado deve ser serializável; e como
isso permite testar o jogo sem abrir a tela. Compare com arquiteturas
que você conhece de backend, como event sourcing e reducers do Redux.
Público: engenheiro backend experiente.

4. Unidades autônomas

Explique máquinas de estado finito aplicadas a NPCs em jogos de
estratégia. Cubra: estados típicos de uma unidade trabalhadora; por que
FSM antes de árvore de comportamento; e o problema de alocação de tarefas
quando várias unidades competem pelo mesmo recurso — por que é preciso
reservar recurso na origem e vaga no destino, e o que acontece sem isso.
Exemplos em TypeScript, estado serializável, sem async.

5. Grid, coordenadas e pathfinding

Explique a matemática de um jogo top-down em grid ortogonal: conversão
entre coordenada de tela e coordenada de grid, ordenação por profundidade
para desenhar na ordem certa, e ancoragem de sprites de prédios que
ocupam vários tiles. Depois explique A* em grid: heurística, custo de
terreno, e como custo diferente por tipo de terreno faz unidades
preferirem estrada sem regra especial.

6. Balanceamento

Explique balanceamento de economia em jogos de estratégia com cadeias
de produção. Como se define taxa de produção; por que proporções entre
prédios importam mais que valores absolutos; como detectar gargalo; e
como testar balanceamento de forma sistemática em vez de por intuição.

Um conselho sobre o ritmo: faça o 1 e o 2 antes de aprovar o plano da F02 que está rodando. São os dois que cobrem exatamente o que você acabou de decidir sem entender. Uma hora de leitura e você passa a revisar o plano por conta própria, em vez de me perguntar.

Os outros quatro podem acompanhar as features: o 3 agora, o 4 antes da F09, o 5 antes da F04, o 6 antes da F15.