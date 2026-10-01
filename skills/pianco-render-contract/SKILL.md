---
name: pianco-render-contract
description: Contrato técnico compartilhado para render, dimensões, pivôs, paleta, luz, zoom e integração dos sprites do Piancó.
---

# Contrato técnico de render

Carregue com o diretor e uma especialidade. Não leia `brief-arte.md`, `GDD.md`, `docs/` nem a skill antiga arquivada. Fatos de implementação vêm de `data/`, `assets/manifest.json` e `src/render/`; decisões visuais abaixo vêm do operador.

## Render conferido

Em `src/render/game.ts:48-51`, o jogo instancia `Phaser.Game` com `type: Phaser.AUTO` e `pixelArt: false`. `AUTO` escolhe WebGL quando disponível e pode usar Canvas como alternativa; portanto WebGL **não é garantido** por essa configuração. Não há declaração explícita de filtro linear nesse trecho; conferir o resultado em execução nos três zooms antes de homologar. O mundo usa grid ortogonal de 64×64 px e câmera top-down 3/4 fixa. `data/terrain.json` oferece zooms 0,5 / 0,75 / 1 / 1,5 / 2; todo portão visual usa **0,5, 1 e 2**.

Pés no centro inferior. Unidade usa `anchor: [0.5, 1]` e mesma linha de base em todos os frames. Objeto com pivô especial segue sua entrada no manifesto.

| Tipo | Derivado 1× | Master 2× |
| --- | ---: | ---: |
| Unidade comum | 64×96 | 128×192 |
| Unidade grande | 96×128 | 192×256 |
| Arvore adulta `tree`, porte grande em ensaio | 192x256 | 384x512 |

Tamanhos 1× são do manifesto; masters 2× são decisão do operador. Onde houver contorno, teste ~3–4 px no master para resultar em ~2 px no derivado; a variante B pode usar contorno seletivo, sempre mais escuro que o material, sem preto uniforme. Meça após redução e nos três zooms. Prédio tem envelope individual no manifesto.

Vegetacao: mandacaru ~110 px, facheiro ~96 px, xique-xique ~80 px, macambira e arbusto ~44 px sao hipoteses. A arvore grande `tree` foi ampliada linearmente em 2x pelo operador em 2026-10-01: quadro 192x256, master 384x512, pes no mesmo pivo. Outros estados dessa entrada mantem a silhueta anterior em quadro maior com margem transparente. Conferir mata com lenhador nos zooms 0,5 e 1 para avaliar copa, profundidade e unidades encobertas.

Para edificios, `front` nomeia entrada sul no grid; camera obliqua top-down 3/4 revela telhado, fachada e lateral. As referencias D de estilo vivem fora do repositorio, no caminho definido em `pianco-sprite-director`; elas usam luz antiga e servem somente para materiais, pincelada e volume. `assets/base/_estilo/` so recebe ancora visual apos nova escolha do operador.
Obliquidade já faz parte de `front`; ela não prova que exista uma variante `left_offset` ou `right_offset`. Essas etiquetas futuras descrevem orientação do volume/fachada e da porta perante a câmera fixa, nunca espelhamento ou deslocamento do PNG. Portas e camadas locais terão de continuar alinhadas ao tile de entrada quando o render consumir as variantes.
## Destino e consumo

`assets/manifest.json` define id, tipo, estados, tamanho, footprint, anchor, licença e origem. Caminhos em `estados` e `origem.base` são relativos a `assets/`. Masters ficam em `assets/base/`; derivados carregáveis, em `assets/sprites/`. `src/render/sprites-urls.ts` só inclui `assets/sprites/**/*.png`; `src/render/sprites.ts` associa URLs e manifesto. Confira entrada individual antes de salvar. Nunca registre com script que descarte estados ou anchors.

Para prédios, `tamanho` mede o canvas, não a silhueta pintada. O footprint continua sendo a área da simulação; `src/render/escala-predio.ts` aplica `regraDeLargura.k`, `regraDeAltura.k` e exceções individuais `larguraMaxPorLote`/`alturaMaxPorLargura` do manifesto. Antes de aprovar escala, meça o retângulo com alfa ≥128 do derivado, compare em cena com um prédio aprovado de igual footprint e confira a posição desse retângulo em relação ao `anchor` e à porta. Uma margem transparente grande pode deixar o prédio pequeno mesmo com canvas e footprint corretos.

Quando o prédio precisa de bandeira junto ao telhado, `ancoras.bandeira` no manifesto marca o ponto de contato do pé do mastro em frações do canvas do sprite. O render converte esse ponto pela escala e pelo `anchor` atuais; confira em captura a posição real sobre a cobertura. Não desenhe a bandeira de facção no PNG do prédio.

Produza só `front` dos prédios. `left_offset` e `right_offset` são variantes futuras sem consumidor identificado no render; quando implementadas, manterão footprint e anchor, e a porta ficará sobre o tile de entrada nas três vistas.

## Camadas dinâmicas de prédios: estado conferido no render

`src/render/manifesto.ts` aceita `ancoras.trabalho.area` como retângulo normalizado e `ancoras.estoque.entrada/saida` como pontos normalizados, na ordem das mercadorias da receita. `src/render/manifesto-camadas.ts` separa os casos `guarda`, `transforma`, `dentro`, `criacao` e `luz`. `src/render/pilhas.ts` mostra quantidade positiva até o teto visual de 5 por ponto; vazio não desenha pilha. O teto visual não é capacidade de estoque. `storehouse` mostra até quatro mercadorias mais abundantes.

`src/render/scenes/WorldScene.ts` monta corpo, trabalho e pilha nessa ordem. BUG-X oculta a unidade quando ela está dentro da casa. `src/render/trabalho.ts` consome um laço genérico `ocioso` de oito quadros enquanto a casa ocupada não trabalha e quadros de trabalho durante o ciclo. Pessoa visível em janela e anteparo frontal exigem decisão e integração próprias. A arte reserva aberturas e áreas dinâmicas desde o master, sem mercadoria permanente.
Em particular, um trabalhador atrás de um peitoril e uma mercadoria pousada numa mesa com borda dianteira exigem ordem local de profundidade ou máscara; a ordem atual `corpo → trabalho → pilha` não resolve ambos os recortes. O PNG canônico deve preservar a superfície vazia e o plano de camadas para integração futura. A padaria tem, conforme `data/production.json`, entrada `flour` e saída `loaves`; suas posições no desenho ainda não estão aprovadas.

O levantamento KaM é comparação, não contrato automático. No Piancó, `src/render/manifesto-camadas.ts` e `tests/F17f-manifesto.test.ts` definem pilha como um sprite `unidade` repetido até cinco, ocioso como um laço genérico, e fumaça genérica animada só no trabalho. A revelação de obra usa `madeira` + `completo` (`src/render/manifesto.ts`). Fogo por dano é laço genérico futuro. A escola deve animar enquanto treina, mas confirme o consumidor antes de declarar a arte integrada.

BUG-X usa o predicado de casa ocupada para ocultar a unidade no render e no acerto quando ela está dentro. Não desenhe outra pessoa na casa sem decisão do operador e plano de oclusão. O `storehouse` mostra pilhas embora o equivalente KaM medido não as mostre; `marketplace` não consta do `houses.dat` original.

## Cor, valores e luz

Paleta de referência conferida em `data/theme-sertao.json`: terra `#B5763A`, terra queimada `#8C4A25`, ocre `#C9974B`, telha `#B4562F`, cal `#EDE3D0`, algodão cru `#D9C9A8`, verde seco `#7C8B6A`, verde caatinga `#5E6B4F`, madeira `#5A3F2B`, couro `#8A5A32`, céu `#4E86A8`.

Prédios, unidades, vegetação e recursos com volume apresentam luz, meio-tom, sombra própria e oclusão nas frestas/cantos. Ao menos três níveis de valor devem permanecer distinguíveis a zoom 0,5, inclusive sob tint 0,8. Transições suaves entre luz e sombra dentro do material são permitidas. Proíbem-se gradiente de fundo, vinheta e brilho digital ou plástico. A sombra desloca levemente o matiz sem apenas escurecer o RGB. Tiles de terreno são albedo e seguem a regra separada abaixo.

Decisão do operador, registrada em cdcfec5: uma única luz do mundo para chão, prédio, unidade, vegetação e recurso, vindo de cima e levemente do sul (lado da câmera), sem componente leste-oeste. Planos voltados ao sul recebem mais luz; planos voltados ao norte recebem menos. A orientação do objeto muda quais planos recebem luz, mas uma unidade E e sua correspondente W podem ser espelhadas sem inverter uma iluminação lateral. Sombras internas projetadas são obrigatórias quando existirem: beiral na parede, aba do chapéu no rosto, braço/arma no corpo, telha em telha, copa no tronco, bloco em bloco na pedra. Sombra de contato curta na base, até ~4 px no derivado 1×. Use sombra separada se o render a consumir; não duplique sombra pintada e blob.

## Albedo, transformações e relevo

Tile base de terreno guarda somente cor e material. Não pinte luz direcional, sombra projetada, brilho ou escurecimento de encosta no albedo; apenas oclusão local em frestas e poros do próprio material é permitida. O mesmo tile deve continuar coerente após rotação de 90° e espelho. O render escolherá essas transformações por tile para quebrar a repetição; tiles conectáveis, como estradas e bordas, ainda precisam respeitar a orientação calculada pela vizinhança. A luz e sombra do relevo pertencem ao render.

Sprites com volume precisam manter leitura após multiplicação RGB por 0,8 (aproximadamente 20% menos luz) nas encostas sombreadas, sem mudar o alfa nem pintar a sombra do relevo no master. Para revisão, monte prévia normal e prévia escurecida sobre os terrenos reais em zoom 0,5 / 1 / 2. Confira silhueta, ao menos três valores distinguíveis em 0,5, função do objeto, máscara de facção e placas quando existirem. O render é o consumidor futuro desse tint; esta regra de arte não afirma que já esteja implementado.

Unidades têm oito direções lógicas. Com a luz sem eixo leste-oeste, W pode espelhar E, NW pode espelhar NE e SW pode espelhar SE. N e S permanecem canônicas. Espelhe também máscara, equipamento e camadas alinhadas; verifique que detalhes assimétricos não prejudiquem a identidade. As referências D aprovadas antes desta decisão servem para materiais e pincelada, não para herdar a antiga direção de luz. Candidatos anteriores não são automaticamente homologados sob o novo contrato.

## Facção e texto

Cores de facção: `#D64B3F` e `#3F72D6`. Unidades compartilham base e equipamento; uma máscara separada em cinza define **lenço grande + faixa na cintura ou chapéu**. No derivado 1×, alvo mínimo: 48 pixels com alfa ≥128 na máscara, dos quais pelo menos 24 no lenço e 16 no segundo elemento; ambos com largura de pelo menos 4 px, visíveis a zoom 0,5. A máscara tem o mesmo tamanho da base e não pinta fora do alfa dela. A comparação da máscara e do `militia` fica para o primeiro lote de unidades de produção. **Pendência de render:** consumir máscara de facção como segundo sprite com `setTint` no mesmo atlas. Não implementar nesta etapa.

Nenhum texto legível dentro do sprite, exceto as placas integradas à fachada de inn (Bodega), bakery (Padaria), butchers (Casa de Carne) e metallurgists (Fundição), aprovadas pelo operador. Confira esses nomes em data/theme-sertao.json antes de gerar. Demais nomes e preços são sobrepostos pelo jogo. Seleção e barra de vida pertencem ao render e precisam contrastar nos três terrenos.

## Aprovação

O validador técnico examina dimensões, pivô, pés, borda alfa, identidade cromática, direção vertical de luz, simetria leste–oeste e máscara. A folha de contato usa grama, areia e rocha reais a 0,5 / 1 / 2 e versão RGB×0,8. Antes de aprovar uma variante, limites cromáticos por região dependem de calibração pela folha nova aprovada. Um sprite de produção só fica aprovado com validador calibrado, revisão visual independente e aceite do operador.
