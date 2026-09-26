PIANCÓ: FASE DE ANIMAÇÃO E VIDA DO MUNDO

PAPEL

Você será responsável por projetar e implementar a camada de animação
do jogo Piancó: Ferro e Mandacaru.

Não trate esta tarefa apenas como criação de sprites animados.

O objetivo é transformar o cenário atualmente predominantemente estático
em um mundo visualmente vivo, coerente com um RTS ambientado no sertão
nordestino, sem destruir performance, direção artística ou arquitetura
da simulação.

Você deve agir simultaneamente como:

- Technical Art Director
- 2D Animation Engineer
- Gameplay Rendering Engineer
- Tools Engineer
- Performance Engineer

O resultado final deve ser integrado ao jogo, reproduzível e documentado.

==================================================
0. LEITURA OBRIGATÓRIA
==================================================

Antes de modificar qualquer arquivo:

1. Leia AGENTS.md inteiro.
2. Leia CLAUDE.md, se existir.
3. Leia docs/BRIEF-ARTE.md inteiro.
4. Leia o GDD relevante.
5. Leia BUILD_PLAN.md.
6. Leia BUGS.md.
7. Inspecione package.json.
8. Inspecione assets/manifest.json.
9. Inspecione data/units.json.
10. Inspecione data/buildings.json.
11. Inspecione data/theme-sertao.json.
12. Inspecione src/render/ inteiro.
13. Descubra qual biblioteca ou tecnologia faz o rendering.
14. Descubra como sprites, profundidade, câmera e zoom funcionam.
15. Descubra como a simulação comunica estados ao renderer.

O BRIEF-ARTE.md continua sendo fonte de verdade para:

- projeção;
- câmera;
- escala;
- paleta;
- iluminação;
- arquitetura;
- footprints;
- anchors;
- identidade visual.

Não altere essas decisões durante a fase de animação.

Se houver contradição real entre documentação e código, registre e reporte.

==================================================
1. BASELINE
==================================================

Antes de qualquer mudança:

- registre git status;
- registre git log --oneline -1;
- execute a suíte de verificação existente;
- capture screenshots do estado atual;
- registre performance aproximada do cenário de teste existente.

Não tente otimizar ainda.

Precisamos de baseline antes de introduzir animação.

==================================================
2. TOOLCHAIN DE ANIMAÇÃO
==================================================

Verifique se existe uma instalação funcional e legítima do Aseprite 1.3+.

Não baixe executáveis não oficiais ou builds de origem duvidosa.

Se Aseprite não estiver instalado, PARE apenas a etapa que depende dele
e reporte exatamente o que falta.

Verifique:

- Python 3.10+
- uv
- Aseprite
- Codex MCP

Instale o MCP de Aseprite prioritário:

https://github.com/MalloyTheDev/aseprite-mcp

Clone o MCP FORA do repositório Piancó.

Sugestão:

D:\tools\codex-mcp\aseprite-mcp

Depois:

uv sync

Configure ASEPRITE_PATH para a instalação real encontrada.

Configure:

ASEPRITE_MCP_WORKSPACE=<PIANCO>\assets

Não exponha o disco inteiro ao MCP.

Registre o servidor no Codex usando o mecanismo MCP suportado pela
instalação atual do Codex.

Prefira codex mcp add quando disponível.

Alternativamente use ~/.codex/config.toml.

Valide com:

codex mcp list

Depois use o health_check do MCP e faça um round-trip real:

- criar .aseprite de teste;
- adicionar frame;
- renderizar preview;
- exportar PNG;
- apagar somente os artefatos temporários criados para esse teste.

Não prossiga se o MCP não estiver funcional.

Documente em:

docs/ANIMATION-TOOLCHAIN.md

Inclua:

- versão Aseprite;
- caminho executável;
- repositório MCP;
- commit do MCP;
- versão Python;
- versão uv;
- configuração utilizada.

==================================================
3. NÃO INSTALE OUTRO ENGINE SEM NECESSIDADE
==================================================

Não adicione Phaser, Pixi, Three, Spine, DragonBones ou outro motor de
animação por conveniência.

Primeiro descubra o renderer existente.

Utilize os mecanismos atuais sempre que forem adequados.

Somente proponha nova dependência quando demonstrar que a infraestrutura
existente não consegue entregar o requisito de forma razoável.

Não instale Spine.

Não instale TexturePacker.

Aseprite já será responsável inicialmente pela produção e exportação
de sprite sheets.

==================================================
4. CRIE docs/BRIEF-ANIMACAO.md
==================================================

Antes de implementar animações, escreva um documento de arquitetura e
direção de movimento.

Ele deve definir pelo menos:

- categorias de animação;
- frame animation;
- transform animation;
- sway animation;
- particles;
- shader/procedural animation, se suportado pelo renderer;
- FPS de cada categoria;
- loop;
- pivôs;
- anchors;
- direções;
- espelhamento;
- vento global;
- randomização;
- culling;
- pooling;
- LOD;
- triggers da simulação;
- formato dos sprite sheets;
- formato dos metadados;
- nomenclatura;
- estrutura de diretórios;
- critérios visuais;
- critérios de performance.

Mostre o plano antes de executar mudanças arquiteturais grandes.

==================================================
5. PRINCÍPIO CENTRAL
==================================================

Não transforme todo movimento em frame animation.

Escolha a técnica mais barata que preserve qualidade.

FRAME ANIMATION:

- unidades;
- animais;
- trabalho;
- ataques;
- fogo pequeno;
- elementos que realmente mudam de desenho.

PROCEDURAL / SWAY:

- árvores;
- arbustos;
- milho;
- vegetação;
- pequenos elementos flexíveis.

PARTICLES:

- fumaça;
- poeira;
- palha seca;
- folhas;
- lascas;
- fagulhas;
- cinzas;
- pequenos detritos.

TRANSFORMS:

- rodas;
- polias;
- mecanismos;
- objetos rotativos.

SHADER, somente se o renderer oferecer uma solução adequada:

- ondas;
- refração;
- calor;
- vento;
- deformações sutis.

==================================================
6. WIND CONTROLLER
==================================================

Projete um WindController global.

O vento não pode ser implementado independentemente em árvore, fumaça
e bandeira.

O WindController deve fornecer algo equivalente a:

direction
strength
gust
time

Efeitos consumidores:

- copa das árvores;
- vegetação;
- bandeiras;
- fumaça;
- poeira;
- palha seca;
- água, quando apropriado.

Cada objeto deve possuir phaseOffset aleatório.

Evite qualquer movimento sincronizado artificial.

As rajadas devem atravessar o mundo de maneira coerente.

==================================================
7. PROVA DE CONCEITO OBRIGATÓRIA
==================================================

Antes de escalar a solução implemente apenas cinco casos:

A. Uma árvore com movimento de vento.

B. Água animada.

C. Fumaça saindo da chaminé de uma padaria ativa.

D. Uma bandeira de facção balançando.

E. Um carregador com walk cycle.

Esses cinco casos validam:

- procedural animation;
- frame animation;
- particles;
- integração com simulação;
- Aseprite MCP;
- pipeline de export;
- performance.

Somente depois disso escale.

==================================================
8. ÁRVORES E VEGETAÇÃO
==================================================

Evite gerar oito PNGs completos para cada árvore.

Quando visualmente possível, derive:

tree
  trunk
  canopy

Mantenha a base estável.

A copa recebe movimento discreto.

Árvores diferentes precisam de:

- phaseOffset diferente;
- pequena variação de velocidade;
- pequena variação de amplitude.

Juazeiro e umbuzeiro podem reagir ao vento.

Mandacaru e xique-xique devem ter movimento muito menor.

Não faça cactos balançarem como árvores.

O objetivo não é mostrar a animação.

O objetivo é impedir que o cenário pareça morto.

==================================================
9. ÁGUA
==================================================

Crie inicialmente de 4 a 8 frames-base no Aseprite.

Evite movimento rápido.

Tiles adjacentes não devem obrigatoriamente usar a mesma fase.

Investigue:

- ondulação;
- brilho sutil;
- pequenas ondas;
- círculos ocasionais causados por peixe;
- perturbação perto do pescador.

Evite aparência cartunesca ou água piscando.

==================================================
10. PARTÍCULAS AMBIENTAIS
==================================================

Implemente um particle system reutilizável ou utilize o sistema nativo
existente do renderer.

Ele deve suportar pooling.

Primeiros efeitos:

smoke
dust
straw
leaf
wood_chip
stone_dust
spark
ember

Evite objetos sendo criados e destruídos continuamente causando pressão
no garbage collector.

==================================================
11. POEIRA, PALHA E SERTÃO
==================================================

Crie eventos ambientais ocasionais.

Elementos possíveis:

- palha seca;
- folhas;
- pequenos galhos;
- poeira;
- fragmentos de capim.

Não use grandes tumbleweeds como linguagem visual predominante.

A ambientação é sertão nordestino, não western norte-americano.

Considere pequenos redemoinhos de poeira ocasionais.

Não exagere na frequência.

Eventos raros geram mais impacto do que efeitos constantes.

==================================================
12. FUMAÇA
==================================================

Fumaça deve ser efeito runtime.

Não pinte fumaça permanentemente no sprite do prédio.

Em prédios produtivos:

idle:
sem fumaça ou fumaça mínima.

producing:
emissão ativa.

WindController influencia direção.

Exemplos:

- padaria;
- forja;
- fundição;
- fogueira.

A fumaça deve:

nascer pequena;
subir;
expandir;
ser deslocada pelo vento;
reduzir opacidade;
desaparecer.

==================================================
13. BANDEIRAS DE FACÇÃO
==================================================

Não gere versões completas do prédio por facção.

Utilize uma bandeira separada.

Cores existentes do projeto:

vermelho #D64B3F
azul #3F72D6

Crie uma animação base.

Prefira tint/mask ou variante derivada programaticamente.

Sem Spine, tente primeiro loop de aproximadamente 6 a 8 frames no
Aseprite ou transformação procedural simples.

A base junto ao mastro se move pouco.

A extremidade livre possui maior amplitude.

O WindController controla intensidade e velocidade.

==================================================
14. UNIDADES
==================================================

Use o Aseprite MCP intensamente aqui.

Os civis compartilham corpo.

Crie um master:

civil_base.aseprite

Estrutura sugerida:

body
head
hat
arm
tool
load
shadow

Não gere corpo totalmente independente para cada profissão se a arte
permitir reutilização.

Animações iniciais:

idle
walk
work
carry

Direções civis:

north
east
south

west = mirror(east)

Respeite as regras de direção existentes no BRIEF-ARTE.md e
data/units.json.

A silhueta deve continuar legível no tamanho real mostrado pelo jogo.

O chapéu continua sendo elemento-chave da leitura visual.

Utilize ferramentas diferentes como layers/attachments quando possível.

Exemplos:

serf:
basket/load

laborer:
hammer

woodcutter:
axe

farmer:
hoe

carpenter:
saw

==================================================
15. ANIMAÇÕES DE TRABALHO
==================================================

Conecte efeitos à simulação real.

Exemplos:

WOODCUTTER

axe impact
→ wood_chip particle

QUARRY

hammer impact
→ stone_dust particle

BLACKSMITH

hammer impact
→ spark particles

BAKERY

production active
→ chimney smoke

FISHERMAN

cast
→ water ripple

ROAD CONSTRUCTION

hammering
→ dust/stone particles

Não mantenha efeitos de produção ativos quando ninguém estiver trabalhando.

==================================================
16. VIDA AMBIENTAL
==================================================

Após a POC e somente se o custo for baixo, considere:

- carcará ou asa-branca cruzando o cenário ocasionalmente;
- roupa em varal reagindo ao vento;
- jumento mexendo cabeça ou cauda;
- carro de boi levantando poeira;
- fogueira;
- brasas;
- milho ondulando;
- ondulações de peixe;
- portas abrindo quando unidades entram;
- pequenas folhas caindo;
- calor tremulando próximo de forno ou forja;
- sombras ambientais muito discretas.

Não introduza todos automaticamente.

Priorize custo/benefício visual.

==================================================
17. PERFORMANCE
==================================================

Isto é um RTS.

Nunca assuma que uma técnica é barata porque funciona com dez objetos.

Crie benchmark.

Meça antes e depois.

Implemente:

- offscreen culling;
- pooling;
- shared textures;
- shared animation definitions;
- random phase;
- LOD;
- reduced update rate quando possível.

Sugestões iniciais:

units:
8 a 12 fps

flags:
8 a 12 fps

water:
6 a 8 fps

fire:
8 a 12 fps

offscreen visual animations:
nenhum update desnecessário

Não trate esses números como dogma.

Meça o renderer real.

==================================================
18. ARQUIVOS
==================================================

Avalie esta estrutura, adaptando apenas se houver razão arquitetural:

assets/
  animation-source/
    units/
    environment/
    effects/

  animations/
    units/
    environment/
    effects/

Crie fontes editáveis .aseprite.

Nunca mantenha somente o PNG exportado quando houver um master animado.

Crie um mecanismo determinístico de export.

O objetivo deve ser algo equivalente a:

source .aseprite
    ↓
Aseprite CLI
    ↓
spritesheet PNG
metadata JSON
preview GIF
    ↓
runtime

==================================================
19. MANIFEST
==================================================

Não force imediatamente animação para dentro do assets/manifest.json
existente.

Primeiro investigue seu contrato atual.

Se ele estiver excessivamente ligado a prédios estáticos, prefira
inicialmente:

assets/animation-manifest.json

Exemplo conceitual:

{
  "id": "serf",
  "kind": "frames",
  "sheet": "...",
  "metadata": "...",
  "anchor": [0.5, 1]
}

E:

{
  "id": "bakery_smoke",
  "kind": "particle",
  "trigger": "production.active"
}

O schema final deve ser decidido com base no código existente.

==================================================
20. ASEPRITE MCP WORKFLOW
==================================================

Para cada asset animado:

1. Importar ou abrir a referência.
2. Criar master .aseprite.
3. Criar layers.
4. Criar frames.
5. Criar animation tags.
6. Ajustar frame duration.
7. Renderizar preview.
8. Inspecionar visualmente.
9. Corrigir.
10. Renderizar novamente.
11. Exportar GIF para QA.
12. Exportar spritesheet.
13. Exportar metadata.
14. Integrar no jogo.
15. Capturar screenshot ou vídeo de execução.

Nunca declare uma animação pronta apenas porque o arquivo foi exportado.

Ela precisa funcionar dentro do jogo.

==================================================
21. TILED
==================================================

Não introduza Tiled nesta primeira etapa se ainda não houver necessidade
de mapa.

Quando o runtime ambiental estiver estável, poderá ser criada uma fase
separada de integração com:

https://github.com/rpgjs/tiled-ai

O futuro objetivo será permitir que o mapa defina:

- regiões de vento;
- emissores ambientais;
- pontos de pássaros;
- poeira;
- objetos animados;
- zonas de água;
- triggers;
- efeitos locais.

Tiled define onde as coisas estão.

O runtime define como elas se comportam.

==================================================
22. QUALIDADE VISUAL
==================================================

O jogo não deve parecer:

- GIFs independentes colados na tela;
- árvores sincronizadas;
- água piscando;
- fumaça repetitiva;
- partículas excessivas;
- parque temático;
- western norte-americano;
- pixel art genérico;
- cenário medieval europeu.

O movimento precisa preservar a direção artística do BRIEF-ARTE.md.

O princípio visual é:

"o jogador percebe que o mundo está vivo sem conseguir apontar uma única
animação exagerada."

==================================================
23. DEFINIÇÃO DE PRONTO DA POC
==================================================

A POC só termina quando:

- árvore reage ao vento;
- água possui movimento;
- padaria produz fumaça somente quando apropriado;
- bandeira reage ao vento e representa a facção;
- carregador possui walk cycle;
- Aseprite MCP está integrado;
- export é reproduzível;
- assets fonte .aseprite existem;
- sprite sheets são gerados;
- jogo carrega os outputs;
- testes existentes continuam verdes;
- não há regressão de gameplay;
- performance foi medida;
- screenshots ou vídeo comprovam o resultado.

Ao terminar apresente:

1. arquitetura final;
2. ferramentas instaladas;
3. MCP configurado;
4. arquivos criados;
5. alterações de código;
6. custos de performance;
7. animações funcionando;
8. problemas encontrados;
9. próximos passos recomendados.

Não marque itens futuros como concluídos.