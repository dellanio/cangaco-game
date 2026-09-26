# Plano — F-SPR: carregamento de sprite de terreno, recurso, vegetação e unidade

> Ordem do operador, leva noturna de 2026-09-26, item 5. Sem arte nenhuma: só o
> carregamento, com fallback para o placeholder de hoje quando não houver PNG. Render
> puro: nada em `src/sim/`, nada em `data/`. `assets/` e `tools/derivar-sprites.js`
> ficam intocados, porque são do Codex na `derivacao-sprites`. O `assets/manifest.json`
> não muda nesta feature: não há arte para declarar, e o que muda é o TIPO que o lê.

## As restrições que o operador deixou

- A entrada de prédio continua válida como está: mesmos campos e mesma chave de textura
  (`predio:<id>:<estagio>`).
- Nenhuma largura é calculada como `footprint × 64`. O tamanho desenhado vem do manifesto
  (`tamanho`) ou do dado (`tilePx`). O fator de transbordo entra pelo arquivo, sem tocar
  neste código.
- O teste prova os dois lados, como a F17f: tem arte, resolve; não tem, cai no placeholder.

## As decisões (minhas, marcadas para o operador revisar)

**(a) Terreno e recurso são textura de tile.** `render/mapa.ts` continua dando o código por
tile, e a cena continua pintando a camada por índice. O que muda é só a **tira** que vira
tileset. Hoje ela é um `Graphics` com uma cor por código. Passa a ser uma `CanvasTexture`
em que cada código recebe a textura do manifesto, redimensionada para `tilePx × tilePx`,
ou a cor ou o marcador de hoje quando não há PNG. Índice do tile, código, `putTileAt` e as
contagens do roteiro não mudam. Transição entre terrenos continua sendo a F-TR.

**(b) Vegetação é sprite, não textura.** Uma árvore é mais alta que o tile, e textura de
tile não transborda. A unidade que passa atrás dela precisa ficar atrás, o que pede depth
por `y`, e camada de tile não tem isso. Quem é vegetação é o **manifesto** que diz: a
entrada `tipo: "vegetacao"` com o id do recurso (`tree`). Não há lista no código. Com
sprite carregado, a célula da tira fica vazia para esse código, e a cena põe uma imagem
por tile presente, ancorada pelo `anchor` do manifesto, no tamanho do arquivo. O
esgotado continua sendo o marcador único da camada de tile.

**(c) Unidade usa um arquivo por direção, não folha de sprite.**
- A chave de `estados` é `"<pose>:<direcao>"`, com as direções
  `n, ne, l, se, s, so, o, no`. Hoje o render só pede a pose `parado`; animação é outra
  feature, que acrescenta poses sem mudar a forma.
- **O oeste é espelho** (brief §6): falta `o`, usa `l` com `flipX`. Vale o mesmo para
  `no`←`ne` e `so`←`se`. Com isso, 4 direções custam 3 arquivos e 8 custam 5. Uma entrada
  que declara `o` explicitamente não é espelhada.
- O número de direções vem de `data/units.json` (`direcoesDeSprite`), que hoje não tem
  leitor. Civis têm 4, militares 8, e os mercenários não declaram nada: sem direção, sem
  sprite, fica o placeholder, como o operador decidiu.
- Com 4 direções, a diagonal cai na horizontal.
- Por que não folha: a folha precisa de campos novos no manifesto (tamanho do quadro e
  ordem das direções), e a ordem errada troca a direção em silêncio. O arquivo por direção
  cabe nos oito campos da §9 como estão, a dimensão de cada arquivo se confere pelo
  cabeçalho, como a F17f já faz, e refazer uma direção toca um arquivo só. Empacotar
  num atlas depois é passo de build e não muda o contrato.

## Execução

1. `src/render/manifesto.ts`, que continua sem import nenhum:
   - tipos novos, com a união;
   - `assetDoPredio` estreitado;
   - `chaveDeTextura(tipo, id, estado)`, de modo que `chaveDaTextura` dê a mesma chave de antes;
   - os resolvedores puros de camada, vegetação e unidade;
   - `direcaoDoPasso`.
2. `src/render/direcoes-de-sprite.ts`: lê `direcoesDeSprite` de `data/units.json`.
3. `src/render/sprites.ts`: `texturasParaCarregar` recebe o manifesto e as URLs por
   parâmetro, com o padrão de hoje, e enfileira todo tipo.
4. Cena:
   - a tira de terreno e a de recurso por `CanvasTexture`;
   - sprite de vegetação;
   - sprite de unidade, com a direção guardada em memória de render;
   - `window.__cangaco` publica o que resolveu arte, para o roteiro afirmar o lado do placeholder.
5. `tests/F-SPR-carregamento.test.ts`: os dois lados, com manifesto sintético. A F17f
   passa a aplicar as regras de prédio só a entradas `predio`, sem afrouxar nada.
6. `tools/shots/F-SPR.js`: sem arte, todo tipo cai no placeholder e as contagens são as
   de antes. Mais a não-regressão de F-T1, F-T2a, F10 e F17.
7. Criar o item no BUILD_PLAN, com o contrato que a F-TR e a arte de unidade herdam; verify;
   commit.
