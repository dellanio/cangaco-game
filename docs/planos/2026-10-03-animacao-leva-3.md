# Animação — Leva 3: generalização do consumidor de unidades

Pedido do operador em 2026-10-03: planejar a Leva 3. Este documento especifica a
pipeline. Execução autorizada pelo operador em 2026-10-03, após definir morte,
esqueleto e desaparecimento; não inclui produzir arte final. As tarefas
mantêm os ids D-TELA-05b, D-TELA-05c e D-TELA-05d do plano de origem.

## Resultado do bloco

O mesmo consumidor de atlas do serf resolve direção militar, estados de ação e
carregamento tardio de unidades, com provas em partida e atlas de depuração.
Arte estática e placeholders continuam funcionando. Nenhuma regra, número,
evento ou formato de save da simulação muda.

**Limite de pronto:** infraestrutura de animação generalizada e verificada. Não
significa que as 28 unidades ganharam arte animada. A morte mantém apenas um
resíduo visual: morte, esqueleto e desaparecimento, sem unidade lógica.

## Base conferida e reconciliação

Leitura da main em `a40e34c`, sem executar testes de gameplay nesta inspeção:

- A Leva 2 foi aprovada: `PROGRESS.md:17714-17725`. Valem andar com 8 quadros,
  virada de 45° a cada 0,7 tick e atlas de depuração versionado. Sua aprovação do
  espelho é do serf; não substitui a inspeção de arma e escudo de um militar.
- Civis, militares e mercenários já têm 8 direções no render:
  `src/render/direcoes-de-sprite.ts`. D-TELA-05a (8 direções) e D-TELA-05e
  (mercenários em 8 direções) não são tarefas a repetir.
- `src/render/animacao-de-unidade.ts` já tem quadro por distância, quadro pelo
  tempo de jogo e resolução de atlas com espelho. `src/render/unidades.ts:380`
  escolhe somente `andar` ou `parado`, e a direção ainda sai do deslocamento.
- `src/sim/combate.ts:13-17` confirma 0=norte, sentido horário, ausente=sul.
  O plano antigo tratava essa conversão como hipótese; agora ela está conferida.
- `src/render/scenes/WorldScene.ts:333-340` carrega o atlas isolado do serf de
  depuração. `src/render/sprites.ts:34` enfileira somente `estados` PNG; não há
  carregamento genérico de atlas reais. Essa ponte entra na D-TELA-05b antes da
  otimização da D-TELA-05d.
- O gerador `tools/gerar-sprites-depuracao.js` só produz o serf. São necessárias
  fixtures militares e de trabalho, sem geração de arte do jogo.
- A morte já remove a unidade: `src/sim/systems/combate.ts:162-166`,
  `src/sim/systems/fome.ts:100-137` e `src/sim/systems/projeteis.ts:37-49`.
  O render destrói o desenho ausente em `src/render/unidades.ts:336-344`.
  Portanto, “manter o corpo até a sim remover” não permite exibir seis quadros.
- `src/render/game.ts:66` substitui o estado da ponte. Ler somente o último
  `events` de um quadro perde eventos dos ticks intermediários quando o laço
  avança vários ticks. Esse caso precisa de prova na morte, se autorizada.
- Os estados de trabalho externo existem em `src/sim/systems/especialistas.ts`
  (`colhendo`, `semeando`) e `src/sim/systems/laborers.ts` (`nivelando`,
  `martelando`). A visibilidade vigente é `src/render/visibilidade.ts`.

O plano de 2026-09-30 continua como origem e referência técnica, mas suas notas de
Levas 1/2 abertas, walk 12 e mercenários sem direção estão desatualizadas. Para
esta leva valem a reconciliação acima e os aceites abaixo.

## Fronteira e decisões herdadas

- Escopo de código: `src/render/`, entrada de depuração em `src/inicio.ts`,
  ferramentas de fixtures, testes e roteiros. Emenda de 2026-10-03, após o operador mandar prosseguir: `src/main.ts` pode apenas sinalizar ao render load bem-sucedido e nova escaramuça, usando os callbacks existentes. `data/animacao-unidade.json` é
  interface; alterações exigem schema e casos que reprovam no funil real.
- Não escrever em `src/sim/`, `src/sessao.ts`, `src/laco.ts`, dados da sim,
  `assets/manifest.json`, `assets/base/` ou `assets/sprites/`. Sem dependência nova.
- Atlas final terá um item de arte separado. Neste bloco só se geram formas de
  depuração em `assets/depuracao/`, pelo script; nenhuma imagegen é necessária.
- `parado` usa tempo de jogo; `andar` usa distância desenhada; pausa congela os
  quadros; salto maior que `saltoMaximoTiles` não soma passada. Virada mantém o
  contrato aprovado da Leva 2. Não usar relógio de parede para animação.
- Atlas vence poses estáticas quando o quadro existe. Sem estado/quadro/arquivo,
  resolver pose parada disponível e depois placeholder, sem erro de console.
- Unidade dentro de prédio ou comendo continua invisível. Animação não dá ordem,
  não dispara golpe, não debita insumo e não retarda morte lógica.
- Não entram máscara de facção, montados em 16 direções, carga no braço,
  geração das 28 unidades nem aprovação de espelho de arte final.

## Ordem e portões

| Ordem | Tarefa | Dependência e saída |
|---|---|---|
| 0 | Commit dos aceites desta leva | Só documentação, antes de qualquer código |
| 1 | D-ARTE-DEPURACAO-LEVA-TRES — fixtures de militar e trabalhador | Atlas versionados e validados; serf anterior preservado |
| 2 | D-TELA-05b — direção militar e piloto | Fixtures; consumidor e carga de atlas funcionando |
| P | Revisão do espelho do militar | Operador vê as direções; reprovação impede generalizar o espelho militar |
| M | Morte visual definida em 2026-10-03 | Morte → esqueleto → desaparecimento; apenas render |
| 3 | D-TELA-05c — atacar, trabalhar e morrer | 05b e portões P/M; aceite da morte confirmado antes do código |
| 4 | D-TELA-05d — carregar tipos presentes e carga tardia | 05b; pode avançar com 05c bloqueada, conforme sessões longas do CLAUDE.md |
| 5 | Fechamento e avaliação | Operador declara o bloco fechado; morte pendente impede declarar a leva inteira pronta |

O id novo da tarefa 1 foi procurado com `git grep` na main e não existia. Os três
ids antigos são preservados. Um commit de implementação por tarefa; nenhum push.

## Tarefa 1 — D-ARTE-DEPURACAO-LEVA-TRES (fixtures de animação)

**Escopo:** estender o gerador com `militia`, `woodcutter` e `laborer`. Manter a
chamada existente e os bytes dos arquivos do serf. Ampliar o manifesto isolado
de depuração; não modificar o manifesto do jogo.

**Aceite:**

1. Cinco direções canônicas `n/ne/l/se/s`, origem 64×96 e anchor [0.5,1]. Cada
   quadro identifica estado, direção e índice, com pé constante e trim exercitado.
2. Militia: parado 4, andar 8, atacar 6, morrer 6. Woodcutter e laborer: parado 4,
   andar 8, trabalhar 6, morrer 6. Andar usa `tilesPorCiclo: 2`; os demais usam
   `fps: 10`; morrer sem laço. Esses valores são fixtures, não exigências da arte final.
3. O militar tem arma de um lado e escudo do outro, distinguíveis por geometria;
   trabalhar tem ferramenta legível. O espelho troca esses lados de forma visível.
4. Duas gerações em diretórios temporários dão os mesmos hashes. Serf preservado
   byte a byte. Todos os frames prometidos passam `violacoesDoAtlas`; ausente,
   contagem desigual e sourceSize errado continuam reprovando.
5. Teste `tests/D-ARTE-DEPURACAO-LEVA-TRES.test.ts`; hashes e contagens em
   `test-output/D-ARTE-DEPURACAO-LEVA-TRES.json`. Sem arte de terceiros.

## Tarefa 2 — D-TELA-05b (direção militar e piloto)

**Passos:** extrair resolução pura de direção; generalizar registro de depuração
para vários atlas e vitrine por tipo; carregar atlas por chave compartilhada e
URL resolvida; ligar militia ao consumidor existente. Nesta tarefa não filtrar
tipos presentes: isso é a D-TELA-05d.

**Aceite:**

1. Tabela de 0..7 resolve `n/ne/l/se/s/so/o/no`. Militar ou mercenário usa a
   direção da sim, inclusive parado após formação; ausente resolve sul. Civil usa
   vetor do passo e última direção. Não se aceita converter um inteiro inválido
   silenciosamente; caso encontrado em partida interrompe e reporta.
2. Preservar virada aprovada durante marcha; mudança explícita de direção militar
   pode iniciar virada mesmo sem deslocamento. A resolução termina na direção
   lógica, sem mudar formação ou combate. Ataque será sincronizado na tarefa 3.
3. Mesclar depuração e manifesto real por id, sem esconder as outras entradas.
   `?depuracao` preserva o piloto serf; depuração por tipo e `?vitrine=militia`
   carregam somente fixtures solicitadas. Jogo normal não importa o módulo de
   fixtures nem busca PNGs de depuração.
4. Carregar atlas JSON e PNG somente quando ambos forem resolvidos. Usar a chave
   de `chaveDoAtlas`; poses PNG continuam aceitas. Atlas ausente não causa 404.
   Não editar assets reais para demonstrar essa ponte: usar dados sintéticos.
5. Na vitrine, oito direções resolvem todos os frames de militia, com oeste
   espelhado e pé relativo y=0. Um quadro oeste explicitamente desenhado vence o
   espelho no teste puro. Capturas da vitrine mostram arma e escudo em leste/oeste.
6. Em partida, ordem real de formação/marcha muda o olhar, parada mantém direção
   final, passada avança por distância e pausa congela. Um passo despausado.
7. Testes `tests/D-TELA-05b.test.ts` e roteiro `tools/shots/D-TELA-05b.js` publicam
   direção lógica/visível, frame, espelho, pé e bytes de texturas. Capturas abertas
   e evidência `test-output/D-TELA-05b.json`. Operador avalia portão P antes de 05c.

## Tarefa 3 — D-TELA-05c (estados de ação)

**Situação:** execução autorizada em 2026-10-03; morte definida abaixo. O portão
P continua sendo a inspeção do piloto militar, antes da generalização.

**Ataque e trabalho — aceite proposto:**

1. Resolver estado por função pura a partir de movimento, FSM e visibilidade:
   militar `lutando/atirando/atacando` resolve atacar; civil externo `colhendo`,
   `semeando`, laborer `nivelando/martelando` resolve trabalhar; movimento resolve
   andar; demais resolvem parado. Invisibilidade vence todos. Serf e recruta não
   recebem trabalhar; unidade escondida não reaparece por ter atlas.
2. Cadência, acerto e produção continuam exclusivamente na sim. Ataque usa a
   direção lógica do alvo, sem suavização que faça o golpe mirar outro octante;
   direção do trabalho sai do tile da tarefa quando disponível, e senão mantém a
   última direção. Não inventar alvo para quem trabalha no próprio tile.
3. Quadros de ação usam tempo desde a entrada no estado, começando em 0; sair e
   reentrar reinicia, mudar somente direção não reinicia. O estado `andar` mantém
   passada por distância. Não sincronizar dano ao frame de impacto nesta leva.
4. Não reutilizar frame animado anterior se o novo estado não existir no atlas.
   Fallback mantém unidade legível. FPS/quadros/laço vêm do manifesto.
5. Tabela cobre todas as FSMs acima, transições e ausência de animação. Partida
   prova militia atacando, woodcutter colhendo e laborer trabalhando; hit points,
   colheita e construção continuam ocorrendo pelo `step`, sem mock da regra.
6. Testes `tests/D-TELA-05c.test.ts`, roteiro `tools/shots/D-TELA-05c.js`, ponte
   com estado/quadro/início de ação; passo despausado e capturas abertas. Sim com
   mesma semente/comandos termina byte a byte igual, com depuração ligada ou não.

### Portão M — morte, esqueleto e desaparecimento (definido em 2026-10-03)

O contrato antigo “corpo até a sim remover” é incompatível com a remoção no tick
da morte. O operador trouxe a referência do esqueleto desaparecendo e mandou
gerar o planejamento e executar. Esta emenda substitui a escolha pendente.
No clone KaM `731a8a4`, `src/units/tasks/KM_UnitTaskDie.pas:85-86` executa `uaDie`
por toda sua sequência, e `:105` fecha a unidade depois. Aqui a morte lógica
continua imediata; só o render mantém a apresentação. Não se copia arte do KaM.

- **Aceite:** resíduo temporário exclusivamente no render, com sequência visual
  morte → esqueleto → desaparecimento. A fixture de seis quadros usa dois de
  queda, dois de esqueleto e dois de dissipação; arte final pode definir outra
  contagem/fps pelo manifesto. Unidade lógica continua removida imediatamente.
  O plano de implementação deve:
  - consumir `unit-killed` e `unit-starved` uma vez por tick recebido na ponte,
    capturando posição/tipo/direção do estado anterior antes de substituí-lo;
  - não inferir morte só de id ausente: carregar outra partida não é morte;
  - preservar eventos de vários ticks entre quadros e morte de unidade que nunca
    esteve visível; sem desenhar corpo na porta de trabalhador escondido;
  - manter corpos em coleção separada, fora de seleção, acerto, minimapa,
    população, fome e save; último quadro sem laço, removido ao completar o ciclo;
  - relógio de jogo, pausa congelada; fim de partida congela a imagem, como C9,
    sem relógio especial para completar morte depois da vitória;
  - limpar memória no load/nova partida inclusive mesmo tick e ids iguais; não
    modificar Sessao nem Laco para isso. Se a identidade da troca não puder ser
    distinguida pela ponte/integração existente, parar e reportar;
  - provar morte por luta, projétil e fome; múltiplos ticks sem render; evento
    duplicado não duplica corpo; ausência de atlas cai na remoção atual; pausa,
    fim, load e liberação de objetos. Sem crescer a memória após corpos expirarem.
- A forma da fixture é geometria própria de depuração; esqueleto e dissipação
  devem ser distinguíveis na vitrine e na sequência da partida.

## Tarefa 4 — D-TELA-05d (carga inicial e tardia)

**Passos:** planner puro de carga por tipos do estado; coordenador da fila Phaser
com carregado/em curso/falhou; notificação de textura pronta invalida resolução
do desenho; reset de memória visual por partida. A otimização é de requisições e
texturas, não de quantidade de arquivos emitidos pelo bundler.

**Aceite:**

1. Preload carrega sprites/atlas de unidade dos tipos presentes nos dois lados,
   inclusive invisíveis. Não antecipar todos os tipos possíveis de treino.
   Recursos, terreno, prédios, pilhas e ícones mantêm a carga existente.
2. Tipo novo treinado/contratado no meio da partida enfileira uma carga por chave,
   mesmo com várias unidades do tipo e loader ocupado. Durante a carga aparece
   pose já carregada ou placeholder; ao concluir, aparece arte sem reiniciar cena.
3. Invalidação por conclusão de carga funciona pausado no mesmo tick e câmera:
   a chave atual de animação (tick/alfa/vista) sozinha não cobre esse caso.
4. Tipo conhecido mas sem arquivos resolvidos não faz requisição inválida.
   Falha de rede não cria tentativa por quadro nem impede desenhar a partida;
   registrar erro na ponte e seguir fallback. Teste de falha usa loader falso;
   roteiro normal continua exigindo zero erro de console.
5. Load e nova escaramuça reavaliam tipos; resposta assíncrona da partida anterior
   não recria unidade removida. Texturas já carregadas podem ser reaproveitadas;
   não remover textura que sustenta unidade ou corpo vigente. Unload/LRU não entra.
6. Teste puro usa manifesto com atlas e poses estáticas. Roteiro cria por treino
   ou contratação um tipo ausente da abertura, confere placeholder transitório,
   requisição única e textura pronta. Sem inserir arte de depuração no manifesto real.
7. `tests/D-TELA-05d.test.ts`, `tools/shots/D-TELA-05d.js` e
   `test-output/D-TELA-05d.json`: fila por tipo/chave, contagem de requisições e
   bytes RGBA8 antes/depois. Medir delta pelo PNG carregado; não afirmar memória
   real de GPU, tempo de rede ou cadência de rAF como teste de desempenho.

## Verificação, commits e fechamento

Por tarefa, conferir `AGENT_STOP`, `STEER.md`, bugs e árvore antes de começar.
Aceite em commit de documentação anterior ao código. Não tocar arquivo alheio
não commitado na main; trabalhar isolado se necessário. Sem execução paralela
de testes; usar sempre os wrappers da trava.

1. Rodar teste específico pela trava:
   `node tools/trava-de-testes.js npx vitest run tests/<tarefa>.test.ts`.
2. Rodar os leitores diretamente quando fixtures/dados mudarem: D-ARTE-02,
   D-TELA-04b/04d/04e, F-SPR-carregamento e F17f-manifesto. Não depender somente
   de `vitest related` para um teste que lê JSON pelo filesystem.
3. `npm run verify:rapido` verde antes do commit. Roteiro da tarefa e capturas
   abertas; logs/números nos destinos acima. Documentar hipótese separada de fato.
4. Não-regressão pelo código de saída: D-TELA-04b/c/d/e (piloto serf), F-SPR,
   D-TELA-03 (carga), C-TELA-03 (seleção), C-COMBATE-01c (controles de formação), F-T3
   (trabalho externo), F23b (load). Confirmar nomes no disco antes da corrida;
   se roteiro exigir save ausente, gerar pelo teste dono do save.
5. Registro em PROGRESS e commit `feat(<id>): ...`, um por tarefa. Diff desde
   a base deve ser vazio em sim, dados da sim e assets reais. Não escrever em
   `test-results.json`, `.claude/` ou AGENTS.md; nenhum push.
6. No fechamento declarado pelo operador: `npm run verify`, `npm run shot:todos`,
   commits finais de documentação, árvore limpa; **por último** `npm run test:longo`
   sozinho na máquina, seguido de `npm run selo:longo` antes da avaliação.
   Commit posterior invalida o selo e exige nova corrida. Operador marca features.

Aceite não atendido, conflito de escopo ou necessidade de mudar sim: parar a
tarefa, registrar o impedimento e seguir só para tarefa independente já coberta
pelo plano. Não afrouxar teste, schema ou lint para prosseguir.
