# BRIEF-ARTE: como produzir a arte do jogo

> Documento único para quem vai gerar e derivar a arte sem conhecer o projeto.
> Escrito em 2026-09-26, com o repositório em `4a1b65d`. O que está marcado
> **[testado]** foi executado nessa versão. O que está marcado **[lido]** foi tirado
> do código ou do dado, sem execução. Se o repositório andou, confira antes de confiar.
>
> O `CLAUDE.md` e o `AGENTS.md` continuam valendo inteiros. Este documento não
> revoga nenhuma regra deles. Ele reúne o que importa para a arte.

---

## 1. O que é o jogo

Um RTS de vila ambientado no sertão nordestino, que roda no browser. O jogador planta
prédios, estradas e roçados, e os habitantes trabalham sozinhos.
O mundo é um grid **ortogonal** de tiles de **64 px**, e a câmera é **top-down 3/4**,
fixa, sem rotação.
Existem dois registros de arte. No mundo, arte **pintada à mão**, com cor e volume. Na
interface, **xilogravura de cordel**: preto sobre papel, traço grosso (GDD §9.7).
Mecânica inspirada em *Knights and Merchants* (1998). **Nenhum asset desse jogo entra
aqui**, nem como referência de estilo.

---

### Portão zero — reconhecimento sem legenda

> **COBERTO O NOME, O JOGADOR SABE O QUE É.** Se uma pessoa que conhece as
> funções do jogo não identifica o prédio sem nome, tooltip ou clique, o sprite
> não passa, mesmo que projeção, escala e acabamento estejam corretos.

Esse portão vem antes dos demais. A captura de aceite deve mostrar o prédio no
mundo, no tamanho real, com o nome coberto. A avaliação usa três alavancas em
conjunto:

1. **Material da parede:** a vila não pode virar uma sequência de taipa branca.
2. **Material da cobertura:** telha colonial é uma opção, não o padrão universal.
3. **Objeto funcional dominante:** algo externo e legível conta o que acontece ali.

Quatro paredes por quatro coberturas produziriam somente 16 combinações para 28
prédios. Por isso a direção canônica usa sete famílias de parede e quatro de
cobertura, formando 28 pares exclusivos. Cor sozinha não conta como objeto
funcional; o objeto precisa ter silhueta ou volume reconhecível no sprite final.

### Matriz proposta de diferenciação dos 28 prédios

Esta tabela é decisão de design pendente de aprovação do operador. Ela orienta
modelagem futura; não autoriza redesenho em lote.

| Prédio (`id`) | Parede | Cobertura | Objeto funcional dominante |
|---|---|---|---|
| Armazém (`storehouse`) | tábuas verticais escuras | telha colonial terracota | plataforma de carga com grande talha sobre portas largas |
| Casa do Coronel (`schoolhouse`) | taipa caiada branca | telha colonial terracota | varanda de recrutamento com porta dupla e quadro de avisos |
| Bodega (`inn`) | taipa caiada ocre | sapê claro e desfiado | mesas e cadeiras externas, placa pendurada com bode e lousa de preços |
| Pedreira (`quarry`) | pedra bruta | zinco oxidado | guincho, rampa e piso de pedra |
| Casa do Lenhador (`woodcutters`) | troncos empilhados | palha marrom escura | cepo com machado e cavalete de toras; deve ler como cabana |
| Torre de Pedra (`watchtower`) | pedra bruta | telha colonial terracota | plataforma alta de tiro com seteiras e sino de alerta |
| Serraria (`sawmill`) | tábuas verticais escuras | zinco oxidado | lâmina de serra exposta e trilho de entrada da tora |
| Roçado de Milho (`farm`) | taipa caiada ocre | palha marrom escura | paiol ripado e espigas penduradas para secagem |
| Canavial (`wineyard`) | taipa caiada branca | sapê claro e desfiado | moenda de cana com rolos e bica para caldo |
| Casa do Pescador (`fishermans`) | taipa caiada ocre | zinco oxidado | trapiche curto, rede estendida e varal de peixe |
| Garimpo (`gold_mine`) | pedra bruta | palha marrom escura | calha de lavagem e bateia grande junto à entrada |
| Jazida de Carvão (`coal_mine`) | troncos empilhados | zinco oxidado | tremonha negra e vagonete carregado de carvão |
| Mina de Ferro (`iron_mine`) | pedra bruta | sapê claro e desfiado | trilho e caçamba com minério vermelho-escuro |
| Casa de Armas de Madeira (`weapons_workshop`) | troncos empilhados | telha colonial terracota | bancada externa com cabos, foices e bodoques |
| Quartel do Bando (`barracks`) | tábuas verticais escuras | sapê claro e desfiado | estandarte alto e cavalete de armas na entrada |
| Feira (`marketplace`) | taipa caiada branca | zinco oxidado | sequência de toldos, balança grande e bancadas vazias |
| Moinho (`mill`) | adobe cru | sapê claro e desfiado | roda motriz lateral, funil de milho e mó exposta |
| Padaria (`bakery`) | adobe cru | telha colonial terracota | forno abaulado externo, chaminé baixa e chapa de beiju |
| Malhada (`swine_farm`) | troncos empilhados | sapê claro e desfiado | curral frontal, cocho comprido e porteira para os bodes |
| Cocheira (`stables`) | taipa caiada ocre | telha colonial terracota | porteira larga, amarradouro e sela pendurada |
| Casa de Carne (`butchers`) | adobe cru | palha marrom escura | jirau de salga e ganchos sob um alpendre aberto |
| Curtume (`tannery`) | adobe cru | zinco oxidado | couros esticados em armações e tanques de curtimento |
| Casa do Gibão (`armory_workshop`) | tábuas verticais escuras | palha marrom escura | gibão em manequim e cavalete com chapéus de couro |
| Fundição (`metallurgists`) | tijolo cerâmico aparente | zinco oxidado | cadinho basculante, moldes de moeda e chaminé quente |
| Mercenários (`town_hall`) | taipa caiada branca | palha marrom escura | balcão de contratação, estandarte e painel de recompensas |
| Forja (`iron_smithy`) | tijolo cerâmico aparente | telha colonial terracota | fornalha aberta, chaminé alta e lingoteira |
| Ferraria (`weapon_smithy`) | tijolo cerâmico aparente | sapê claro e desfiado | bigorna e expositor de peixeiras, ferrões e canos |
| Casa do Ferro (`armor_smithy`) | tijolo cerâmico aparente | palha marrom escura | torso de prova com peitoral e placas metálicas penduradas |

**Auditoria de colisão.** Nenhum dos 28 prédios repete o mesmo par
parede+cobertura. Mesmo assim, o par não basta para aprovação: o objeto funcional
dominante precisa diferenciar prédios da mesma cadeia e continuar legível quando
o sprite é visto no jogo, não apenas no render grande.

---

## 2. A projeção

> **DECISÃO CANÔNICA — operador, 2026-09-27.** A referência de câmera do projeto é
> `assets/source/blender/reference_scene.blend`. Todos os 28 prédios partem dessa cena:
> não recrie nem ajuste a câmera, a luz ou a unidade por prédio.
>
> O grid é **ortogonal, quadrado, 64×64 px**. Na cena canônica, **1 unidade de mundo no
> Blender = 1 tile do jogo**. No teste 512×512, `ortho_scale = 8` produz exatamente
> 64 px por unidade no eixo horizontal. Isso fixa a proporção matemática entre
> footprints — por exemplo, 3×2 sempre é menor que 3×3 — sem ajuste manual.
>
> A câmera é **ortográfica**, com azimute lateral fixado em **10°** e elevação compensada
> para **59,5051°**. O operador escolheu 10° em 2026-09-27 após comparar a mesma casa em
> 0°, 10°, 20° e 30° sobre o grid real de 64×64 px: 10° foi o menor valor que revelou a
> cumeeira e distinguiu as duas águas sem a base deixar de ler como retângulo. No teste,
> a aresta de fundo ficou em 8,64°; 20° levou-a a 18° e começou a brigar com o grid.
> O cubo de
> validação mede 3×2×2 unidades; sua base aparece retangular, e o topo domina a fachada
> na proporção calibrada abaixo. Um segundo cubo 3×3×3 prova a escala proporcional sem ajuste
> manual. Losango reprova o portão e exige corrigir esta cena antes de criar qualquer
> prédio.
>
> **Vista canônica `frontal` (também chamada `foco central`).** Aprovada pelo
> operador em 2026-09-27: câmera em azimute **10°**, elevação **59,5051°** e
> `ortho_scale = 8`. Na Casa do Coronel, a compensação local de fachada `-10°`
> neutraliza o azimute lateral e produz a leitura frontal simétrica sem alterar
> a câmera de referência.
>
> **Calibração de elevação — imagens do KaM fornecidas pelo operador em 2026-09-27.**
> Medição feita em um corte vertical representativo da fachada principal, ignorando
> chaminé, bandeira e alpendre: na casa térrea de madeira, cumeeira→beiral = 240 px e
> beiral→chão = 162 px (`1,481`); na casa térrea de pedra, 257 px e 174 px (`1,477`).
> As razões diferem só `0,3%`; a média é `1,479`. Nos dois blocos de validação a
> profundidade é igual à altura, portanto a projeção ortográfica dá
> `topo/fachada = tan(elevação)`: `atan(1,479) = 55,94°`. Esse foi o ponto inicial em
> azimute 0°. Ao fixar o azimute em 10°, a elevação foi compensada para **59,5051°** para
> manter a razão projetada em `1,479`. Esse número
> transfere somente a proporção vertical observada; não copia o azimute isométrico nem
> as diagonais do chão do KaM. No painel Transform do Blender, essa elevação aparece
> aproximadamente como **`Rotation X = 30,4949°`**, o complemento `90° − 59,5051°`;
> não digitar `59,5051°` nesse campo, pois isso inverteria a calibração.
>
> **Portão de aparência da casa 3×2.** O render
> `tmp/blender/reference/reference_house_test.png`, feito sem mover ou reenquadrar a
> câmera, mede telhado = 109 px e parede = 74 px, razão `1,473` — diferença de cerca de
> `0,4%` para a média `1,479` das duas capturas do KaM. A cena salva deixa os cubos
> disponíveis no Outliner, mas o `F12` renderiza essa casa com duas águas, parede,
> porta e janela em volume e cor chapada.
>
> **Projeção confirmada no código do KaM — `reyandme/kam_remake`, `master`, commit
> `731a8a47a4a02fac3d20326fdfed0fba7d1f845b` (2026-09-25).** A leitura visual de que
> o KaM seria isométrico estava errada: os sprites são oblíquos, mas o mapa é
> ortogonal. Evidências verificadas no fonte:
>
> - `src/gui/KM_Viewport.pas:330-334`: `MapToScreen` calcula X somente a partir de
>   `aMapLoc.X` e Y somente de `aMapLoc.Y`, ambos multiplicados pelo mesmo
>   `ZoomedCellSizePX`; não existe mistura `(x-y)`/`(x+y)`.
> - `src/gui/KM_InterfaceGame.pas:671-676`: a conversão inversa calcula X e Y
>   separadamente; depois corrige apenas Y pela altura do terreno.
> - `src/common/KM_Defaults.pas:13-14`: `CELL_SIZE_PX = 40`; a célula é quadrada, e
>   `CELL_HEIGHT_DIV` controla somente o relevo pseudo-3D.
> - `src/render/KM_Render.pas:199-213`: o modo normal usa `glOrtho`.
> - `src/render/KM_RenderTerrain.pas:802-856`: a estrada é um overlay por tile,
>   escolhido por máscara dos quatro vizinhos cardinais e rotação.
> - `src/render/KM_RenderTerrain.pas:522-536`: cada tile usa os vértices quadrados
>   `(x-1,y-1)`, `(x-1,y)`, `(x,y)` e `(x,y-1)`, com eventual deslocamento vertical
>   pelo relevo — nunca um losango.
> - `src/render/KM_RenderPool.pas:760-792,1996-2020`: prédios usam X/Y e pivô sem
>   mistura de eixos; a ordenação por `Feet.Y` é painter's order para sprites altos,
>   não projeção isométrica.
>
> **Conclusão canônica:** o KaM é grid/câmera ortogonal 2D com tiles quadrados,
> relevo pseudo-3D e sprites pré-desenhados em perspectiva oblíqua. Logo, o grid
> quadrado e a base sem losango do Piancó estão alinhados ao código real do KaM.
> Os **56° não são “a câmera do KaM”**: são somente a calibração artística da cena
> Blender para reproduzir a razão telhado/parede medida nos sprites.
>
> A cena tem uma única luz no alto à esquerda. Seu vetor de sombra aponta para baixo à
> direita, mas **a sombra projetada no chão não entra no passe principal do sprite**:
> terreno e sombras pertencem a camadas separadas no jogo. O mundo usa intensidade
> neutra mínima `0,06` somente para a fachada não cair a preto; não há segunda luz
> direcional nem preenchimento capaz de apagar a modelagem da luz principal.
>
> A câmera não calibra o transbordamento: ela fixa somente projeção e a régua de
> `64 px = 1 tile`. O transbordamento pertence a cada prédio e é registrado pelo
> tamanho do PNG mais seu ponto de assentamento no manifesto.

**A regra.** A base do prédio é um **retângulo com arestas horizontais**, alinhado ao
grid quadrado. A câmera fica alta e à frente, olhando para baixo, e enxerga a fachada
da frente **e para dentro do telhado**. As linhas do chão correm na horizontal e na
vertical da imagem, nunca em diagonal.

**O que ela não é.**

- **Não é isométrica.** Isométrico põe o chão em losango de proporção 2:1. Losango não
  cabe num footprint quadrado com nenhum fator de escala.
- **Não é elevação frontal.** Fachada chapada, sem ver o telhado por cima, também
  está errada.

**O caso medido.** O armazém atual (`assets/base/storehouse/`) veio isométrico. Depois
de derivado, o prédio completo cobre só cerca de 39 % do quadrado de chão de 3×3 tiles
que ele ocupa, e o resto fica vazio. A medida está na nota do `assets/manifest.json`.
Esse defeito é o **BUG-H** no `BUGS.md`, com severidade `feio`. A correção é arte,
não código: refazer as duas imagens do armazém (seção 4). Em conversa antiga ele aparece como
"BUG-F", mas esse id é de outro bug, já corrigido. Use BUG-H.

**A referência de câmera aprovada** é somente
`assets/source/blender/reference_scene.blend`. A Casa do Lenhador permanece como arte
histórica do projeto, mas não calibra projeção, transbordamento ou escala.

---

## 3. A convenção de arquivo

### Tamanho e âncora

**Regra canônica de escala e transbordo (2026-09-27).** O footprint é regra da
simulação; o canvas é regra da arte. A base do prédio assenta no retângulo do lote,
mas telhado, beiral, varanda e escada podem passar livremente por cima, por baixo e
pelos lados. O que fixa o tamanho é a régua humana na escala `64 px = 1 tile`, nunca
encaixar o alfa num canvas `footprint × 64`.

- O derivador preserva a escala canônica e recorta o canvas comum dos estados sem
  redimensionar o conteúdo.
- `tamanho` é a dimensão real do PNG e pode exceder o footprint em qualquer eixo.
- `anchor` é o **ponto de assentamento dentro do PNG** que cai no centro da borda
  inferior do lote. `[0.5,1]` só vale quando nada passa abaixo nem desloca a base;
  com escada inferior, `anchor.y < 1`.
- O render escala pela régua (`footprint lógico × 64`), não por `tamanho[0]`; portanto
  aumentar o canvas não encolhe o prédio de volta ao lote.
- Terreno continua 64×64 e não usa esta regra. Vegetação, recursos e unidades seguem
  seus próprios tamanhos e âncoras do manifesto.

**Medição do KaM instalado.** `houses.rx` guarda tamanho e pivot por sprite, e
`KM_ResHouses.pas:260-261,400-401,510-511` guarda o `PlanYX` do footprint. Isso
confirma que não há fator global: o posicionamento é individual e assimétrico. No
lenhador 3×2, o bitmap completo é 124×91 px, pivot `(-62,-60)` e transborda cerca de
`0,55 tile` à esquerda; à direita termina `0,45 tile` antes da borda. No quartel
4×4, o bitmap é 232×191 px e excede a largura do lote em `1,80 tile` no total,
concentrado à esquerda pelo pivot `(-92,-155)`. A leitura visual anteriormente
registrada — `0,65 tile` acima no 3×2 e `0,9 tile` no 4×4 — mede o alfa visível contra
o lote na captura e continua útil como régua artística. Já o pacote não sustenta um
transbordo inferior comum: nesses dois exemplos o bitmap termina antes da borda sul.
Logo, transbordo para baixo é permitido quando a arquitetura pede (escada, rampa),
mas é dado por prédio, não percentual copiado do KaM.

**Compressão vertical medida no KaM instalado (2026-09-27).** A régua é
`altura total do bitmap / (SizeY do footprint × 40 px)`. O leitor foi conferido
contra o fonte `reyandme/kam_remake` no commit
`26b3c8619135978132be3c396459f453736f4f5f`: `KM_ResSpritesEdit.pas:651-685` lê de `houses.rx`
`Size`, `Pivot` e pixels; `KM_ResHouses.pas:23-43,193-199,902-920` liga o
`StonePic` e o `SizeX×SizeY` de cada registro de `houses.dat` ao tipo do prédio.
O índice `StonePic` do DAT é zero-based e corresponde ao slot `+1` do RX.

| Prédio KaM | Footprint | Bitmap | Altura / footprint Y |
|---|---:|---:|---:|
| butchers | 3×3 | 148×108 | 0,9000 |
| armorsmithy | 4×3 | 154×123 | 1,0250 |
| farm | 4×3 | 175×124 | 1,0333 |
| metallurgists | 3×3 | 145×127 | 1,0583 |
| armoryworkshop | 3×3 | 147×129 | 1,0750 |
| bakery | 3×3 | 140×131 | 1,0917 |
| stables | 4×3 | 186×135 | 1,1250 |
| storehouse | 3×3 | 144×136 | 1,1333 |
| quarry | 3×2 | 148×91 | 1,1375 |
| woodcutters | 3×2 | 124×91 | 1,1375 |
| swinefarm | 4×3 | 187×139 | 1,1583 |
| schoolhouse | 3×3 | 171×142 | 1,1833 |
| inn | 4×3 | 171×143 | 1,1917 |
| barracks | 4×4 | 232×191 | 1,1938 |
| coalmine | 3×2 | 157×97 | 1,2125 |
| weaponsworkshop | 4×2 | 161×98 | 1,2250 |
| sawmill | 4×2 | 156×101 | 1,2625 |
| ironsmithy | 4×2 | 146×103 | 1,2875 |
| vineyard | 3×2 | 163×103 | 1,2875 |
| weaponsmithy | 4×2 | 150×107 | 1,3375 |
| tannery | 3×2 | 143×109 | 1,3625 |
| mill | 3×2 | 111×113 | 1,4125 |
| watchtower | 2×2 | 109×139 | 1,7375 |
| ironmine | 3×1 | 111×92 | 2,3000 |
| goldmine | 2×1 | 97×92 | 2,3000 |

Nos 22 prédios econômicos comuns, excluídas as silhuetas funcionais da torre e
das duas minas, a faixa é `0,9000–1,4125` e a mediana é `1,1708`. Os dois casos
diretamente comparáveis ao Piancó são mais estreitos: storehouse `1,1333` e
schoolhouse `1,1833`. Portanto **transbordar continua permitido, mas não é uma
meta**. Para prédio comum, o primeiro portão é altura total próxima de `1,17 ×`
a altura do footprint, com faixa ordinária até `1,20 ×`; passar disso exige um
objeto funcional que justifique a silhueta, como torre, moinho ou boca de mina.
Em footprint 3×3 do Piancó, isso dá referência de `225 px` e teto ordinário de
`230 px`, antes de exceção documentada.

Essa compressão é de **modelagem caricatural**, não de câmera: manter a câmera
canônica e achatar telhado, escada, fundação e, quando necessário, o eixo Z do
volume. A relação interna telhado/parede `1,479` continua válida apenas para a
tipologia térrea de duas águas na qual foi medida. Ela pode ser preservada
enquanto o envelope total diminui, porque escada, embasamento, beiral e alturas
arquitetônicas são variáveis diferentes; não é regra universal para sobrado nem
telhado de quatro águas.

**Prova visual da compressão — Storehouse e Pedreira (2026-09-27).** O Storehouse
3×3 passou de `214×328` (`1,708 ×` a altura do footprint) para `214×254`
(`1,323 ×`), com compressão vertical `0,68`, telhado raso e acesso curto. O
primeiro teste em `1,208 ×` foi rejeitado na captura do jogo: fazia o sobrado ler
como térreo e ficar pequeno diante da Casa do Coronel. Logo, sobrado comprime
cobertura e acesso, mas preserva a leitura dos pavimentos; `1,20 ×` é portão de
prédio térreo comum, não teto universal. A
Pedreira 3×2 passou de `192×165` (`1,289 ×`) para `192×151` (`1,180 ×`), com
compressão vertical `0,76`. A câmera e o footprint não mudaram. Nos dois casos,
`madeira` e `completo` agora vêm do mesmo modelo, câmera, recorte e ponto de
assentamento; a obra troca fechamento e acabamento por armação, sem inventar
outra arquitetura. Renders e comparações intermediárias ficam exclusivamente
em `tmp/blender/`; somente `.blend` canônico e derivados aprovados entram em
`assets/`.
> **A RÉGUA É O HOMEM — regra do operador, 2026-09-27.** A escala entre objetos se
> mede em **alturas de homem (H)**, e não em tiles. H é a altura visível do Carregador
> (serf), hoje **73 px** no sprite derivado. **Toda arte nova declara a sua altura em H
> antes de ser gerada**, no pedido e na entrada do manifesto. Pedido sem altura em H
> não se gera. A tabela-alvo do operador, ainda **proposta e não aplicada**, é esta:
>
> | classe | altura-alvo | em px (H = 73) |
> |---|---|---|
> | casa térrea | ~2,5 H | ~182 |
> | sobrado | ~3,5 H | ~255 |
> | mandacaru | ~2,2 H | ~161 |
> | árvore adulta | ~3,0 H | ~219 |
> | arbusto | ~0,6 H | ~44 |
>
> O desvio de cada asset atual está medido no item F-ESC do `BUILD_PLAN.md`: a árvore
> está a −65 % e a macambira a +46 %. A altura do prédio **também** tem teto pela
> largura desenhada (F-ESC, k = 1,0, decidido e não implementado). O sobrado a 3,5 H
> esbarra nesse teto, e o conflito está anotado lá, esperando decisão. Até a F-ESC
> entrar, o item "A altura é livre" abaixo vale para o derivado **existente**, não
> para arte nova.

> **MEDIDO NO KAM — referência, 2026-09-27.** Fonte: o cabeçalho dos sprites
> (`houses.rx`, `units.rx`, `trees.rx`) e o `unit.dat`/`mapelem.dat` da instalação do
> operador, lidos por `tools/kam-medir.js`. O lote vem do `PlanYX` do kam_remake. Nenhum
> pixel foi lido e nada do KaM está no repositório: só estes números.
>
> - **Régua:** no KaM o tile tem 40 px e o serf tem **37–41 px**, andando para o sul.
>   **Um tile vale uma altura de homem.** Aqui, H = 73 px num tile de 64: o homem é
>   1,14 tile, 14 % maior em relação ao chão que no KaM.
> - **Prédio pronto, por tamanho de lote** (em px do KaM; "H" = px ÷ 40):
>
> | lote | n | altura | altura em H | altura ÷ largura | largura ÷ lote | passa acima do lote |
> |---|---|---|---|---|---|---|
> | 3×2 | 8 | 91–113 (med 100) | **2,5 H** | 0,62–1,02 (0,72) | 0,93–1,36 (**1,15**) | 14–45 px (med 26 = **0,65 tile**) |
> | 4×2 | 4 | 98–107 (102) | 2,55 H | 0,61–0,71 (0,68) | 0,91–1,01 (0,96) | 20–30 (26) |
> | 3×3 | 6 | 108–142 (130) | 3,25 H | 0,73–0,94 (0,88) | 1,17–1,43 (1,22) | −9–27 (17) |
> | 4×3 | 6 | 123–149 (137) | **3,4 H** | 0,71–0,84 (0,76) | 0,96–1,19 (1,13) | −1–26 (19,5) |
> | 4×4 | 1 (quartel) | 191 | 4,8 H | 0,82 | 1,45 | 35 (0,9 tile) |
> | 2×2 | 1 (torre) | 139 | 3,5 H | **1,27** | 1,36 | 72 (1,8 tile) |
>
> - **Âncora:** a base do sprite encosta na borda de baixo do lote, de 13 px acima a 4
>   px abaixo (mediana 3 px acima). Na horizontal, a borda esquerda fica perto da
>   borda esquerda do lote (de −18 a +13 px), e o excesso de largura cai **à direita**
>   (mediana de 14 a 24 px). **Hipótese:** o excesso à direita é a sombra, que o KaM
>   desenha dentro do sprite. Não foi confirmado, porque confirmar exigiria ler pixel.
>   A regra `anchor [0.5, 1]` desta seção fica a ~0,1 tile do KaM.
> - **Árvore adulta** (13 espécies): 87–130 px, mediana 106 = **2,65 H** (faixa
>   2,2–3,25 H).
> - **O que isto confirma da tabela-alvo:**
>   - casa térrea 2,5 H = o 3×2 do KaM, **exato**;
>   - sobrado 3,5 H ≈ o 4×3 do KaM (3,4 H);
>   - árvore 3,0 H: dentro da faixa, acima da mediana;
>   - k = 1,0: nenhum prédio do KaM passa de 1,02, **salvo a torre** (1,27). É a
>     exceção que o operador já decidiu declarar no dado.
> - **Decisão do operador (2026-09-27): fator de largura 1,0, com exceções.** Não 1,15.
>   O 1,15 do KaM (lote 3×2; 1,17 na mediana geral) provavelmente inclui a sombra, que
>   o KaM desenha dentro do sprite e nós não. Sem a sombra, o 1,02 medido confirma o
>   limite. A exceção se declara no dado, prédio a prédio, como a torre.
> - **Decisão do operador (2026-09-27): a tradução é pelo HOMEM, não pelo lote.** A
>   casa térrea fica com **182 px** (2,5 H), e não 159 px (0,83 × 192). O porquê: *o
>   jogador julga o prédio contra as pessoas que andam ao lado, não contra um tile que
>   ele não enxerga.*
>   - **Consequência, esperada e não defeito:** aqui o tile vale 0,88 H, e no KaM 1,0 H.
>     Com a mesma altura em H, os nossos prédios transbordam mais do lote do que os
>     de lá.

- **A largura manda.** A largura do sprite derivado é `footprint[0] × 64` px. Um prédio
  de 3 tiles de largura tem 192 px. Um de 4 tem 256 px.
- **A altura é livre.** Ela é o que a arte der, na mesma escala. Não estique para
  quadrado.
- **Âncora na borda inferior, no centro:** `anchor [0.5, 1]`. A borda de baixo do PNG
  encosta na borda de baixo do footprint.
- **Fundo transparente.** Nada de chão no sprite (seção 5).

### F-ESC — revogada como limite de canvas

A regra antiga `altura ≈ 1,0 × largura` e a exceção `1,40` da Casa do Coronel
misturavam estatura arquitetônica com tamanho de arquivo; ficam revogadas. A conta
humana `3,5 / 2,5 = 1,40` continua descrevendo a altura relativa do sobrado, mas não
define canvas nem teto. Para a Casa do Coronel, a cena canônica usa escala uniforme
`0,90` em torno do piso e produz `214×291 px` a 64 px/tile. Seu assentamento é
`[0.5,0.843]`: a base cai no lote 3×3 e a escada
transborda abaixo dele. Os estados `madeira` e `completo` usam exatamente o mesmo
recorte. A compensação local de fachada é `-10°`: ela neutraliza o azimute da câmera
para esta fachada ler de frente, sem alterar a câmera canônica dos 28 prédios.

### Pipeline híbrido — Blender → pintura → derivação

O Blender é a fonte de verdade de geometria. A pintura nunca corrige volume: recebe
um volume já aprovado e só resolve superfície.

**1. Blender — base estrutural.** Cada prédio nasce de
`assets/source/blender/reference_scene.blend`, mantendo câmera ortográfica, escala,
luz e unidade. O passe principal é RGBA transparente, sem terreno nem sombra lançada
fora do prédio. Além do render de derivação a 64 px/tile, produza uma base de pintura
com pelo menos o dobro da resolução linear; a Casa do Coronel usa
`schoolhouse_paint_base_1024.png`, 128 px por tile. Essa sobra dá pixels para telha,
taipa, contorno e desgaste antes da redução final.

- Sombra de contato no chão, quando necessária, sai em passe separado e nunca é
  incorporada ao sprite principal. A sombra sob beiral e alpendre pertence ao prédio e
  fica no passe principal.
- `Z/depth` e normal de câmera são passes auxiliares úteis para máscara, conferência de
  planos e futuras ferramentas que aceitem condicionamento; não substituem o RGBA e
  não são obrigatórios para a primeira repintura.
- Salve a cena, o RGBA grande e o render cru derivado. Isso permite repetir a pintura
  sem recalibrar câmera ou modelar de novo.

**2. Pintura — edição restrita.** A ferramenta preferida é o `imagegen` nativo em
modo de edição com duas entradas: render Blender como **alvo de edição** e um asset
canônico do Piancó como **referência somente de estilo**. Para a Casa do Coronel, a
referência é `assets/base/woodcutters/casa_lenhador_03_completo.png`.

A liberdade é **baixa**: pode acrescentar contorno marrom-escuro, desenho de telha,
textura de taipa e cal, veio de madeira, variação cromática, poeira e sujeira do sertão
e sombra sob o beiral. Não pode alterar silhueta, câmera, azimute, proporção, posição de
telhado, portas, janelas, postes, varanda, escada ou ponto de assentamento. O prompt
repete essas invariantes. Mesmo assim, gerador de imagem não é transformação
determinística: se redesenhar arquitetura ou mover alfa, a saída é reprovada, não
"corrigida" mudando escala.

Portão antes de promover: sobreponha o alfa pintado ao render Blender e compare
silhueta, largura, altura e assentamento; depois veja lado a lado com um prédio
canônico sobre terreno real. A geração original fica em `assets/base/<id>/`; candidata
reprovada ou ainda não aprovada não entra no manifesto.

**3. Derivação.** Recorte todos os estados pela mesma caixa, preserve a régua de
64 px/tile e o ponto de assentamento calculado pelo Blender, e reduza a pintura grande
uma única vez com filtro de alta qualidade. O derivador não encaixa no footprint, não
recalcula proporção e não recentraliza cada estado separadamente. Só depois do portão
visual o PNG pintado substitui o cru em `assets/sprites/<id>/` e o manifesto registra
dimensão, `anchor`, base e origem.

**Prova da Casa do Coronel, 2026-09-27.** A primeira candidata está em
`assets/base/schoolhouse/schoolhouse_painted_candidate.png`; a derivação de teste fica
em `tmp/blender/schoolhouse/`; e a comparação com
o lenhador em `screenshots/CORONEL-paint-test-side-by-side.png`. Aprovada pelo operador
como candidata a testar na tela, ela passou a alimentar o estado `completo`; o portão
final continua sendo a captura no jogo ao lado do lenhador e das unidades.

**Revisão premium e de escala, 2026-09-27.** O modelo foi reduzido uniformemente a
`90%`, sem alterar a câmera ortográfica, o azimute `10°` nem as proporções internas.
Isso reduz o transbordo do telhado e da escada, mantendo o sobrado maior que uma casa
térrea. A base de pintura aprovada é
`assets/base/schoolhouse/schoolhouse_painted_premium_v2.png`, repintada com materiais
mais realistas e leitura próxima de um render 3D; o derivado consumido pelo jogo mede
`214×291 px`.

### Onde fica cada arquivo

| O quê | Pasta | Entra no jogo? |
|---|---|---|
| Base, a imagem grande que a ferramenta gerou | `assets/base/<id>/` | Não. É registro de geração. |
| Derivado, o sprite que o jogo carrega | `assets/sprites/<id>/` | Sim. |
| Índice de tudo | `assets/manifest.json` | Sim. |

`<id>` é o **id neutro em inglês** do `data/buildings.json` (`storehouse`, `quarry`,
`woodcutters`), nunca o nome do tema.

### Nomes

- **Base:** `assets/base/<id>/<id>_<n>_<estagio>.png`, com 1536 px de largura
  (`docs/spec-arte-predios.md`) **[lido]**. As duas bases existentes não seguem essa
  convenção: usam o nome em português (`armazem_03_completo.png`,
  `casa_lenhador_03_completo.png`). Arte nova segue a convenção.
- **Derivado:** `assets/sprites/<id>/<id>_<estagio>.png`, com a chave da seção 4
  (`madeira` ou `completo`) **[lido do manifest]**.
- **Ícone do menu:** `assets/sprites/<id>/icone.png`, 72×72.

### O comando que funciona

Não existe script `npm` para arte. Os derivadores rodam direto com `node`, à mão, e a
saída é commitada.

```bash
node tools/derivar-sprites.js     # base -> sprite do prédio
node tools/derivar-icones.js      # base -> ícone 72x72 do menu
```

**[testado]** `node tools/derivar-sprites.js` na `main` regrava os três PNG do armazém
**byte a byte iguais** aos commitados (`git status` limpo depois) e imprime o tamanho
para o manifest, 192×135.
**[lido]** `derivar-icones.js` não foi executado nesta verificação.

**O derivador não é genérico.** Três limitações, todas lidas no arquivo:

1. **A lista de alvos é escrita à mão.** A constante `ALVOS` no topo de
   `tools/derivar-sprites.js` só tem os três arquivos do armazém. Para um prédio novo,
   é preciso acrescentar um par `{ base, saida }` por imagem (duas por prédio).
2. **A largura é fixa em 192 px** (`LARGURA_ALVO = 192`). Serve só para prédio de
   3 tiles de largura. Prédios de 2 ou 4 tiles exigem que a largura venha de
   `footprint[0] × 64`. Isso é mudança de ferramenta e precisa de plano.
3. **Um recorte só para todos os alvos.** Ele junta as bounding boxes de todos os
   `ALVOS` e recorta um retângulo comum. Com dois prédios na lista, o recorte de um
   contamina o outro. Rode um prédio de cada vez, ou torne o recorte por prédio.

Ele usa o Chromium do Playwright, que já vem instalado com o projeto.

### A entrada no manifest

Todo sprite precisa de uma entrada em `assets/manifest.json`, dentro de `assets`.
**[testado]** Esta entrada, com os PNG derivados, fez a casa do lenhador aparecer
desenhada na tela:

```json
{
  "id": "woodcutters",
  "tipo": "predio",
  "footprint": [3, 2],
  "tamanho": [192, 179],
  "anchor": [0.5, 1],
  "estados": {
    "estrutura": "sprites/woodcutters/woodcutters_estrutura.png",
    "completo": "sprites/woodcutters/woodcutters_completo.png"
  },
  "licenca": "arte propria do projeto, fornecida pelo operador em <data>",
  "origem": {
    "base": "base/woodcutters/casa_lenhador_03_completo.png",
    "semente": null,
    "nota": "como foi derivado, e o id ou a semente da ferramenta, se houver"
  }
}
```

Regras que o teste `tests/F17f-manifesto.test.ts` confere **[lido]**:

- `anchor` é `[0.5, 1]`.
- O arquivo de cada estado existe e tem exatamente o `tamanho` declarado.
- `tamanho[0]` é igual a `footprint[0] × 64`.
- `footprint` é igual ao do `data/buildings.json`.

`footprint` é `[largura, profundidade]` em tiles. `estados` pode ter só uma das duas
imagens. A que falta vira retângulo placeholder na tela.

### Arte nova não reprova teste nenhum

Desde 2026-09-26 o `tests/F17f-manifesto.test.ts` não fixa quem tem arte. A lista vem
do manifesto, e as regras do resolvedor são provadas com um manifesto escrito no
próprio teste (`docs/planos/F17f-lista-derivada.md`).

**[testado] O teste de fumaça.** A partir da `main` em `828a3d4`, num worktree limpo:

1. o armazém trocado por seis estágios com nomes novos
   (`storehouse_<estagio>.png`), e os três sprites antigos apagados;
2. depois disso, a pedreira com seis estágios e a casa do lenhador com dois,
   acrescentadas.

Nos dois passos, `npm run verify` terminou com código 0: 103 arquivos e 1434 testes
verdes. Os PNG da medida eram imagens vazias com a dimensão certa, porque o teste só
lê o cabeçalho. **Não há parada por arte nova.** Se um teste reprovar ao entrar arte,
é um defeito de verdade no manifest ou nos arquivos, e a mensagem diz qual.

A única regra que sobra sobre nomes de estado: toda chave de `estados` tem de ser um
nome que o render desenha. Hoje são os seis estágios antigos; com a F17g passam a ser
`madeira` e `completo` (seção 4). Chave com outro nome reprova, porque nunca
apareceria na tela. O teste de fumaça acima é de antes da decisão das duas imagens.

---

## 4. A obra: duas imagens reveladas

> **Decisão do operador, 2026-09-26: a obra deixa de ter seis estágios.** Cada prédio
> tem **duas imagens**: a **madeira** e a de **pedra**, que é o prédio pronto. As duas
> se **revelam conforme o `hp` sobe**, como no original (kam_remake, medido em
> `BUILD_PLAN.md`, F-VIVO). O motivo é triplo:
> - custa menos: são 2 imagens por prédio, 56 no total, contra 168;
> - a casa sobe a cada martelada, e não em cinco saltos;
> - o registro entre estágios, que a casa do lenhador errou (o 01 noutro canvas), deixa
>   de ter cinco transições para acertar e passa a ter **um par**.
>
> **Não derive mais `marcacao`, `fundacao`, `paredes` nem `cobertura`.** O `estrutura`
> que já existe **vira a `madeira`**: é a mesma coisa, a armação em pé.
>
> O código ainda desenha os seis até o item **F17g** do `BUILD_PLAN.md` entrar. Até lá,
> o `madeira` não aparece na tela. Entregue as duas imagens assim mesmo: o manifesto
> passa a aceitá-las na F17g.

| Chave no manifest | O que a imagem mostra | Quando aparece |
|---|---|---|
| `madeira` | A **armação inteira de madeira** em pé, sobre o alicerce: esteios, vigas, caibros do telhado, sem parede nem telha. | É revelada de baixo para cima enquanto a tábua é pregada. |
| `completo` | O **prédio pronto**: paredes, telhado, porta. | É revelada de baixo para cima **por cima da madeira** enquanto a pedra é assentada. No fim cobre a madeira inteira. |

**A conta da revelação** (render, pura; a entrada é o `hp` da obra e o custo do prédio):
- A obra tem `hpTotal`, e a fase da madeira é a parte da tábua: `hpMadeira = hpTotal ×
  tábua / (tábua + pedra)`. Nos 28 prédios, isso dá 50 de hp por material entregue.
- `hp ≤ hpMadeira`: a madeira aparece até a fração `hp / hpMadeira`, e o prédio pronto
  não aparece.
- `hp > hpMadeira`: a madeira aparece inteira, e o prédio pronto aparece até a fração
  `(hp − hpMadeira) / (hpTotal − hpMadeira)`.
- Com `hp` igual a 0, nada aparece. Quem mostra a obra antes da primeira martelada é o
  canteiro sendo aplainado (F17d) e a pilha do material entregue (F-VIVO-a).

**O que isso pede da arte:**
- **Mesmo canvas, mesma posição.** As duas bases de um prédio têm o mesmo tamanho de
  canvas e o prédio no mesmo lugar dentro dele. O derivador recorta as duas pela união
  das bounding boxes. Um par desalinhado aparece como uma madeira que "sai" pela
  lateral do prédio pronto.
- **Medição que justifica uma guarda automática (2026-09-26).** O par da Pedreira que
  estava no repositório tinha o centro do conteúdo deslocado em aproximadamente **28 px**
  entre `madeira` e `completo`, embora os dois arquivos tivessem o mesmo canvas. Quando
  a F17g entrar, o teste do manifesto deve conferir tanto o tamanho igual do par quanto
  o centro do conteúdo; canvas igual sozinho não prova registro.
- **O prédio pronto cobre a madeira.** Toda a silhueta da `madeira` fica dentro da
  silhueta do `completo`. Esteio que passa da parede continua visível com a casa pronta.
- **A base de baixo é a do chão.** A revelação é um recorte horizontal que sobe da
  borda inferior do sprite. Não há máscara no alfa: a ordem de revelação é a altura, e
  a arte não precisa de nada além das duas imagens.

**Os rótulos da tela.** O painel e o medidor da obra continuam dizendo em que pé ela
está. Os rótulos por estágio de `data/theme-sertao.json` são reescritos pela F17g,
não pela arte.

- **O sprite do prédio é estático.** Nenhum trabalhador, animal, fumaça ou mercadoria
  dentro dele. O prédio **tem** animação e estoque visível (decisão do operador,
  2026-09-26), mas os dois são **camadas à parte**, desenhadas pelo render por cima do
  `completo`, nas áreas que o prédio reserva vazias. As camadas, as áreas e os arquivos
  estão na seção 4a.
- O GDD §9.6 fala em três estágios, e o código ainda usa seis. Os dois ficam
  desatualizados quando a F17g entrar.

---

## 4a. O prédio vivo: trabalho, estoque e animais

Decisão do operador, 2026-09-26. Todo prédio produtor mostra **o próprio estoque** e
**a própria animação de trabalho**, como no KaM. Cada prédio tem a **sua** animação: o
serrador serrando não é o padeiro amassando. O comportamento vem do kam_remake
(código aberto, `KM_Units_WorkPlan.pas`, `KM_RenderPool.pas`), usado como referência de
**comportamento**. Nenhum sprite de lá entra aqui (CLAUDE.md §9).

**Nada disto aparece na tela ainda.** O render das camadas são os sub-itens F-VIVO-a a
F-VIVO-d do `BUILD_PLAN.md`. Mas o manifesto **já aceita** os três tipos novos e o campo
`ancoras` (F-VIVO-0, 2026-09-26) **[testado]**: as entradas podem ir para o
`assets/manifest.json` assim que a arte existir. O `tests/F17f-manifesto.test.ts`
confere cada uma pelas regras desta seção, e as regras moram em
`src/render/manifesto-camadas.ts`. Rode `npm run verify` depois de acrescentar: a
mensagem de erro diz o id, o campo e o que o dado pede.

- **Arte em parte vale, por laço inteiro.** Um prédio do caso 3 pode entrar só com
  `laco1_1` … `laco1_8`; o `laco2` fica placeholder. Laço pela metade (`meio_1` …
  `meio_6` de 8) é recusado.
- **Prédio do caso 1 não tem entrada `trabalho`**: o teste recusa. A fumaça dele é a
  genérica, pelo ponto `trabalho.fumaca`.

### Os cinco casos

Todo prédio com receita em `data/production.json` cai em exatamente um caso.

| Caso | Prédios | O que o trabalhador faz | Animação dentro |
|---|---|---|---|
| 1. Sai, volta e só guarda | Roçado (`farm`), Casa do Lenhador (`woodcutters`), Casa do Pescador (`fishermans`) | colhe no campo e deposita | **nenhuma** |
| 2. Sai, volta e transforma | Pedreira (`quarry`), Canavial (`wineyard`) | colhe no campo e trabalha dentro | 3 laços: `inicio`, `meio`, `fim` |

O Canavial é **engenho de cana**: o trabalhador sai para cortar cana no campo e, dentro,
mói e destila. O laço mostra moenda, tacho ou alambique, e a saída são barris ou
garrafas de cachaça. Nada de uva, parreira ou lagar de vinho, embora o id seja
`wineyard` e a mercadoria `wine`.
| 3. Nunca sai | Serraria, Moinho, Padaria, Casa de Carne, Curtume, Fundição, Forja, Casa de Armas de Madeira, Casa do Gibão, Ferraria, Casa do Ferro | espera o insumo dentro | 2 laços: `laco1`, `laco2` |
| 4. Nunca sai, sem trabalhador | Garimpo, Jazida de Carvão, Mina de Ferro | trabalha dentro da montanha | 1 laço de luz: `luz` |
| 5. Criação | Malhada (`swine_farm`), Cocheira (`stables`) | alimenta os animais | 2 laços de alimentar + animais crescendo |

- **Caso 1 não tem animação dentro** (decisão do operador, confirmado no kam_remake: o
  plano do roceiro, do lenhador e do pescador não tem nenhuma sub-ação no prédio). A
  vida dele está no trabalhador no campo e na pilha que cresce.
- **O Canavial e as minas** já estão nos casos da tabela (correção de simulação F-CANA,
  2026-09-26). O Canavial sai para cortar cana no partido que o jogador arou. O mineiro
  colhe de dentro da mina, sem andar até o veio.
- **Prédios sem receita** (armazém, bodega, Casa do Coronel, quartel, feira,
  mercenários, torre) não têm animação de trabalho. O armazém e a bodega mostram
  estoque.

### Os quadros

- **8 quadros por laço.** Nunca menos de 6: com 2 ou 3 quadros, o boneco treme.
- **4 quadros para luz** (caso 4).
- **Animação longa é o mesmo laço repetido, não mais quadros.** No KaM, a pedreira
  repete o laço do meio 9 vezes, a serraria 25, o moinho 47. Quem decide quantas
  repetições é o render, pela duração do ciclo no dado. A arte só entrega o laço.
- **Os dois laços do caso 3 são gestos diferentes do mesmo ofício**, não o mesmo gesto
  em outro ângulo: o padeiro amassa e depois mexe no forno; o ferreiro martela e depois
  mergulha a peça. Um laço só, repetido o ciclo inteiro, parece máquina.
- **O primeiro e o último quadro de cada laço se encaixam**: o laço volta ao começo sem
  pulo.

### A regra do zoom

A 0,75 o prédio tem cerca de 144 px e um boneco de 16 px vira mancha. Por isso:

> **Todo laço tem um elemento grande ou uma mudança de luz.** Grande é cerca de ¼ da
> área de trabalho: a vela do moinho, a tora na serra, o forno que acende, o fole, a
> fumaça, o animal. O gesto da mão (amassar, curtir, martelar peça pequena) é **bônus**
> para zoom 1 ou mais, nunca a única coisa que muda.

Hipótese até medir numa captura a 0,75: sobrevivem luz, fumaça, vela, serra com tora
grande, animal que quase dobra de tamanho entre as idades, e pilha de ~12 px.

### As três âncoras

O prédio declara, na própria entrada do manifest, **onde** cada camada aparece. As
coordenadas são **frações do sprite `completo`**, de 0 a 1, com a origem no canto
superior esquerdo: `[0.5, 0.8]` é o meio da largura, a 80 % da altura. Fração, e não
pixel, porque a largura do prédio ainda vai mudar com o fator da seção 3.

```json
"ancoras": {
  "trabalho": { "area": [0.30, 0.45, 0.60, 0.75], "fumaca": [0.72, 0.10] },
  "estoque":  { "entrada": [[0.15, 0.90]], "saida": [[0.80, 0.92]] },
  "curral":   [[0.20, 0.70], [0.35, 0.75], [0.50, 0.72], [0.65, 0.76], [0.80, 0.70]],
  "obra":     { "timber": [0.10, 0.95], "stone": [0.25, 0.95] }
}
```

Todo bloco é opcional: prédio sem `ancoras` usa âncoras padrão derivadas do footprint
(ver o `BUILD_PLAN.md`, F-VIVO). Um bloco declarado, porém, tem de estar completo.

- **`trabalho.area`** é `[x0, y0, x1, y1]`: o retângulo da porta, janela, alpendre ou
  forno onde o quadro de trabalho é desenhado. O quadro tem exatamente o tamanho dessa
  área. **`trabalho.fumaca`** é o ponto da chaminé ou da boca da mina. Caso 1 declara só
  `fumaca`.
- **`estoque.entrada` e `estoque.saida`** são **pontos**, um por mercadoria que a
  gaveta pode guardar, na ordem de `data/production.json` (`entra` e `sai`). A Casa do
  Gibão tem 2 de entrada e 2 de saída; a Malhada, 1 e 2; a Pedreira, 0 e 1. A pilha
  daquela mercadoria cresce a partir do ponto.
- **`curral`** são **5 pontos**, só na Malhada e na Cocheira: onde fica cada animal.
- **As três áreas não se sobrepõem.** A pilha não cobre a porta, e o animal não pisa
  na bancada. É isso que deixa a ordem de desenho trivial.
- **A bodega** declara 4 pontos de entrada, um por comida (`loaves`, `sausages`,
  `wine`, `fish`), e nada de saída.
- **`obra`** é um ponto por material do custo do prédio (`timber`, `stone`; só os que
  o prédio pede): onde fica a pilha do material entregue e ainda não pregado. É o
  `BuildSupply` do kam_remake. O ponto é do sprite `completo`, como os outros, e a pilha
  usa a arte `pilha` da mercadoria, sem arte nova.
- **O armazém** declara **4 pontos em `estoque.entrada`**, e nada de saída (decisão do
  operador, 2026-09-26; a gaveta escolhida é decisão da F-VIVO-0). Eles mostram as **quatro mercadorias mais abundantes**, por quantidade,
  com desempate pela ordem de `economia.mercadorias`. O resto não aparece no mapa: a
  lista completa está no painel do prédio. O mapa é para ver de relance, não para
  inventariar.

### Os três tipos novos de asset

Os três seguem os oito campos da seção 3 e a mesma pasta `assets/sprites/<id>/`.

**`trabalho`** — os quadros de trabalho de UM prédio.

- `id`: o id do prédio (`sawmill`). A fumaça, que é genérica, tem `id` `fumaca`.
- `estados`: um arquivo por quadro, chave `<laco>_<n>`, de 1 a 8 (1 a 4 na luz):
  `inicio_1` … `fim_8` no caso 2; `laco1_1` … `laco2_8` nos casos 3 e 5; `luz_1` …
  `luz_4` no caso 4; `fumaca_1` … `fumaca_8` na fumaça.
- Arquivo: `sprites/<id>/<id>_<laco>_<n>.png`.
- `tamanho`: o da área `trabalho.area` do prédio, no sprite derivado. Todos os quadros
  do mesmo prédio têm o mesmo tamanho.
- Fundo transparente. O quadro mostra o trabalhador e o que ele mexe, nunca a parede.

**`pilha`** — UMA unidade de uma mercadoria.

- `id`: a mercadoria neutra de `data/economy.json` (`stone`, `loaves`). O id é neutro,
  o desenho é do tema: **`wine` é cachaça**, em barril pequeno ou garrafa, nunca vinho
  nem taça.
- `estados`: um só, `unidade`. Arquivo `sprites/<id>/<id>_unidade.png`.
- **Uma unidade, não uma pilha.** O render empilha de 1 a 5 a partir do ponto de
  estoque: três embaixo, duas em cima. A imagem precisa **empilhar bem**: vista no
  mesmo ângulo do prédio, base plana, âncora no pé (`[0.5, 1]`).
- Tamanho: cerca de ¼ de tile de largura (16 px no zoom 1). Legível a ~12 px.
- **Estoque é por unidade, não por faixa** (decisão do operador, 2026-09-26): o teto da
  gaveta é 5, e 5 unidades desenhadas dizem o número exato. O armazém, que não tem teto,
  desenha no máximo 5 por mercadoria.

**`animal`** — um animal da criação, nas três idades.

- `id`: a mercadoria que ele vira: `pigs` (Malhada) e `horses` (Cocheira).
- `estados`: `idade1_1` … `idade1_4`, `idade2_…`, `idade3_…`: 3 idades × 4 quadros de
  um laço parado (respirar, mexer a cabeça, comer).
- Arquivo: `sprites/<id>/<id>_<idade>_<n>.png`. Âncora no pé.
- **O adulto (idade 3) tem quase o dobro do filhote (idade 1)**: é a diferença que se
  vê de longe. O adulto ocupa cerca de 0,6 tile de largura.
- O mesmo desenho serve às 5 posições do curral. A idade de cada posição vem do
  progresso do ciclo, pelo render; a simulação não tem idade de animal.

**`cultura`** — a planta de UM tile de roça, por estado (**proposta**, item `F-CAMPO`
do `BUILD_PLAN.md`, 2026-09-26; entra quando o operador aprovar o item).

- `id`: o recurso neutro: `corn` (milho) e `grapes`. **`grapes` é cana-de-açúcar**, em
  touceira alta de colmo e folha comprida, nunca parreira, vinhedo ou cacho.
- `estados`: `semeado`, `crescendo_1`, `crescendo_2`, `maduro`. Arquivo
  `sprites/<id>/<id>_<estado>.png`.
- **Uma imagem por estado, desenhada pelo render sobre o tile**, com a mesma disciplina
  da `pilha`: o chão continua do mapa e a planta vem por cima. **Terra não tem sprite**:
  é o chão `campoArado`, que o mapa já desenha.
- Quem escolhe o quadro é o render, pela fração do tempo de crescer, como a idade do
  animal. A simulação sabe só quando o tile foi semeado.
- Tamanho: 1 tile (64 px no zoom 1), âncora no pé (`[0.5, 1]`). O `maduro` pode passar da
  borda de cima do tile, e o `semeado` não passa da metade de baixo.
- **O maduro tem de se ler de longe**: é o estado que diz ao jogador "tem o que colher".
  Milho com espiga e palha amarelando; cana alta e verde-escura.

**`arvore`** — a árvore de UM tile de mata, por estado. É **proposta**, do item `F-REPL`
do `BUILD_PLAN.md` (2026-09-27), e entra quando o operador aprovar o item.

- `id`: o recurso neutro, `tree`.
- `estados`: `muda`, `crescendo_1`, `crescendo_2`, `adulta` e `toco`.
  - `adulta` e `toco` são os dois estados que a tabela "Terreno e vegetação" já pede ("com
    madeira e cortada").
  - O replantio acrescenta os **três** de crescimento. São três porque o KaM tem três
    idades antes da adulta (BALANCE_LOG, "REFERÊNCIA KaM — o replantio").
  - Arquivo: `sprites/tree/tree_<estado>.png`.
- Mesma disciplina da `cultura`:
  - uma imagem por estado, desenhada pelo render sobre o chão do mapa;
  - o render escolhe o quadro pela fração do tempo de crescer;
  - a simulação sabe só quando o tile foi plantado.
- Tamanho: âncora no pé (`[0.5, 1]`), como a adulta.
  - A `muda` cabe na metade de baixo do tile.
  - A `crescendo_2` já passa da borda de cima.
  - A adulta fica na altura que a F-ESC medir.
- **A muda tem de se ler como obstáculo.** Na simulação, a árvore bloqueia o passo desde
  o plantio, e o jogador precisa ver por que a unidade contorna um tile com planta
  pequena.
- **O toco não pode parecer muda.** O toco é o tile que o lenhador vai replantar; a muda
  é a que já cresce.

### A conta

| Parte | Imagens |
|---|---|
| Obra dos 28 prédios: `madeira` + `completo` (seção 6) | 56 |
| `pilha`: 28 mercadorias × 1 unidade | 28 |
| Caso 2: 2 prédios × 3 laços × 8 | 48 |
| Caso 3: 11 prédios × 2 laços × 8 | 176 |
| Caso 4: 3 minas × 1 luz × 4 | 12 |
| Caso 5, alimentar: 2 prédios × 2 laços × 8 | 32 |
| Caso 5, `animal`: 2 bichos × 3 idades × 4 | 24 |
| Fumaça genérica: 1 laço × 8 | 8 |
| **Total** | **384** |
| `cultura` (proposta F-CAMPO): 2 culturas × 4 estados | +8 |
| `arvore` (proposta F-REPL): 3 estados de crescimento; `adulta` e `toco` já estão em "Terreno e vegetação" | +3 |

A animação sozinha soma 300 (48 + 176 + 12 + 32 + 24 + 8). O operador escolheu esse
nível, e não o mínimo de um laço por prédio, porque um laço só parece repetitivo e
redesenhar custa mais que desenhar certo.

**Pilha das armas (F24a, 2026-09-26).** Até a F24a, a Casa de Armas de Madeira, a
Ferraria e a Casa do Ferro produziam `arma_madeira`, `arma_ferro` e `armadura_ferro`,
que não eram mercadorias, e a saída delas não tinha pilha. Hoje saem as armas de
verdade — `hand_axe`/`lance`/`longbow`, `sword`/`pike`/`crossbow` e
`iron_armor`/`iron_shield`, uma por ciclo, pela cota do prédio — e a saída das três
tem pilha, com a cor do tema.

---

## 5. O que nunca entra no sprite

O sprite do prédio tem **só o prédio**. Fora dele:

- chão, terreno, grama, terra batida sob o prédio;
- pedra solta, lajedo, rocha;
- vegetação: cacto, árvore, mato, folhas;
- recurso natural: tora, pedra bruta, água, cardume, milho em pé.

**O porquê.** O terreno e os recursos são desenhados pelo jogo, tile a tile, a partir
do estado da simulação. Recurso acaba. Uma pedreira com pedra pintada no sprite parece
ter pedra para sempre, inclusive depois de o lajedo secar e o jogo parar de extrair.
O jogador passa a ver uma coisa e o jogo a fazer outra. Pelo mesmo motivo, a casa do
lenhador não tem mata em volta: a mata acaba.

**Mercadoria também fica fora** (decisão do operador, 2026-09-26). O estoque do prédio
aparece na tela, mas quem desenha é o render, unidade por unidade, a partir do estoque
de verdade (seção 4a). Uma pilha pintada no sprite mente do mesmo jeito que a pedra
pintada: o prédio parece abarrotado com a gaveta vazia. Isso **revoga** a "pilha de
lenha cortada" que esta seção permitia antes: na casa do lenhador, as toras são estoque.

**Os trabalhadores e os animais também ficam fora.** Eles são camadas da seção 4a.

**O que o sprite precisa ter no lugar deles: áreas vazias.** Uma bancada, um pátio, um
tablado ou um trecho de chão de terra batida **dentro do contorno do prédio**, sem nada
em cima, onde a pilha vai aparecer. Uma porta, janela, alpendre ou forno aberto onde o
trabalho aparece. Na Malhada e na Cocheira, um curral cercado e vazio. Um prédio
desenhado sem essas áreas tem de ser refeito quando a camada chegar. É a única parte
desta decisão que fica cara depois.

**Pode entrar**, porque é parte do prédio e não muda com o jogo: a cerca de vara do
próprio prédio, uma ferramenta encostada, o varal, a bancada **vazia**, o cocho **vazio**.
Na dúvida, pergunte: "isso some quando o recurso acaba, ou quando a gaveta esvazia?".
Se some, fica de fora.

O molde de prompt da spec já traz isso: `No raw, uncut rock`, e o prompt negativo com
mata e folhas (`docs/spec-arte-predios.md`, `docs/arte-prompt-higgsfield.md`).

---

## 6. A lista do que falta

Tudo abaixo foi tirado do dado (`data/*.json`) nesta data **[lido]**.

### Prédios (28)

Estado de hoje: só o armazém tem sprite, e errado (isométrico). A casa do lenhador tem
base aprovada e ícone, mas **não tem sprite de jogo** em `assets/sprites/woodcutters/`.

| id | Nome no jogo | Footprint | Largura do sprite |
|---|---|---|---|
| storehouse | Armazém | 3×3 | 192 |
| schoolhouse | Casa do Coronel | 3×3 | 192 |
| inn | Bodega | 4×3 | 256 |
| quarry | Pedreira | 3×2 | 192 |
| woodcutters | Casa do Lenhador | 3×2 | 192 |
| watchtower | Torre de Pedra | 2×2 | 128 |
| sawmill | Serraria | 4×2 | 256 |
| farm | Roçado de Milho | 4×3 | 256 |
| wineyard | Canavial | 3×2 | 192 |
| fishermans | Casa do Pescador | 3×2 | 192 |
| gold_mine | Garimpo | 2×1 | 128 |
| coal_mine | Jazida de Carvão | 3×2 | 192 |
| iron_mine | Mina de Ferro | 3×1 | 192 |
| weapons_workshop | Casa de Armas de Madeira | 4×2 | 256 |
| barracks | Quartel do Bando | 4×4 | 256 |
| marketplace | Feira | 4×3 | 256 |
| mill | Moinho | 3×3 | 192 |
| bakery | Padaria | 3×3 | 192 |
| swine_farm | Malhada | 4×3 | 256 |
| stables | Cocheira | 4×3 | 256 |
| butchers | Casa de Carne | 3×3 | 192 |
| tannery | Curtume | 3×2 | 192 |
| armory_workshop | Casa do Gibão | 3×3 | 192 |
| metallurgists | Fundição | 3×3 | 192 |
| town_hall | Mercenários | 4×3 | 256 |
| iron_smithy | Forja | 4×2 | 256 |
| weapon_smithy | Ferraria | 4×2 | 256 |
| armor_smithy | Casa do Ferro | 4×3 | 256 |

São duas imagens por prédio, `madeira` e `completo` (seção 4): 56 imagens no total. As duas facções usam **os mesmos
prédios**. Só a cor do lenço e da bandeira muda: vermelho `#D64B3F` e azul `#3F72D6`.

### Unidades (28)

Hoje **nenhuma** unidade tem sprite. O jogo desenha um quadrado de 32 px com o nome em
cima. **Desde 2026-09-26 (F-SPR) o caminho de código existe**, sem arte nenhuma: uma
entrada `tipo: "unidade"` no manifesto, **um arquivo por direção**, com estado
`"<pose>:<direcao>"` (`parado:n`, `parado:l`, `parado:s`...). Direções: `n ne l se s so
o no`. O oeste sem arquivo é o leste espelhado. Sem arquivo, o quadrado continua. O
contrato inteiro, com terreno, recurso e vegetação, está no item F-SPR do
`BUILD_PLAN.md`.

**Regras do GDD §9.5:**

- Civil usa **chapéu de palha**. Militar usa **chapéu de couro de aba virada**. A
  silhueta do chapéu é o que distingue um do outro a 32 px.
- Os civis são **um corpo só com uma ferramenta diferente na mão**. Desenhe o corpo uma
  vez e troque a camada do item.
- Com espelho horizontal, 4 direções custam 3 desenhos (norte, leste, sul) e 8 direções
  custam 5 (norte, nordeste, leste, sudeste, sul). O lado oeste é o espelho.

**Civis: 4 direções** (`data/units.json`, `direcoesDeSprite: 4`)

| id | Nome no jogo | Item na mão |
|---|---|---|
| serf | Carregador | cesto ou saco nas costas |
| laborer | Obreiro | marreta de madeira |
| stonemason | Cabra da Pedreira | ponteiro e marreta |
| woodcutter | Lenhador | machado |
| carpenter | Carpina | serrote |
| farmer | Roceiro | enxada |
| baker | Forneiro | pá de forno |
| animal_breeder | Criador | cambito |
| butcher | Carneador | faca de ponta |
| fisherman | Pescador | tarrafa |
| miner | Mineiro | picareta e candeeiro |
| metallurgist | Fundidor | tenaz |
| blacksmith | Ferreiro | martelo de forja |
| recruit | Aprendiz | mãos vazias, chapéu de couro novo |

**Militares: 8 direções** (`direcoesDeSprite: 8`)

| id | Nome no jogo | Arma | Montado |
|---|---|---|---|
| militia | Cabra | facão | não |
| axe_fighter | Cabra de Gibão | facão | não |
| sword_fighter | Valente | peixeira longa | não |
| bowman | Bodoqueiro | bodoque | não |
| crossbowman | Cabra de Fogo | bacamarte | não |
| lance_carrier | Aguilhadeiro | aguilhada de vaqueiro | não |
| pikeman | Ferrão | ferrão comprido | não |
| scout | Vaqueiro | facão | sim |
| knight | Capitão do Bando | peixeira e cano de fogo | sim |

**Mercenários (5):** rebel Retirante, rogue Emboscador, vagabond Andarilho (montado),
barbarian Bruto do Mato, warrior Jagunço. **Fora de qualquer leva por enquanto**
(decisão do operador, 2026-09-26). O dado não declara o número de direções deles, o
tema não descreve a arma, e eles ainda não existem no jogo, porque a Fase C, a
militar, não começou. O operador decide quando o Quartel existir. A lacuna está
registrada como nota no item F25 do `BUILD_PLAN.md`. **Não gere mercenário.**

### Terrenos (6)

Hoje cada terreno é uma cor lisa, sem textura e sem transição. O item da fila que
cuida disso é o **F-TR** no `BUILD_PLAN.md`: textura por tipo, tile de transição,
árvore com silhueta.

| id | Hoje | Andável |
|---|---|---|
| grama | `#5E6B4F` | sim |
| campoArado | `#6B4A2E` | sim |
| areia | `#C9974B` | sim |
| agua | `#3C6E8F` | não |
| rocha | `#8A8175` | não |
| montanha | `#5C544B` | não |

A estrada não é terreno. Ela é desenhada por cima na cor `terra` `#B5763A`. O trecho
planejado e ainda não construído é terra translúcida com contorno `terraQueimada`
`#8C4A25`.

### Recursos (8)

Hoje cada recurso é um marcador colorido sobre o tile. O tile que esgotou vira um
marcador escuro (`#2A2622`).

| id | O que é | Hoje | Acaba? |
|---|---|---|---|
| rock | lajedo, pedra da pedreira | `#D8D2C4` | sim |
| tree | árvore, madeira do lenhador | `#3E5D34` | sim, por corte |
| fish | cardume | `#7FB8C9` | sim |
| corn | milho do roçado | `#C9A227` | sim, por colheita |
| grapes | **cana-de-açúcar** do Canavial (ver abaixo) | ainda não existe no dado | sim, por colheita |
| coal | carvão | `#3B3A38` | sim |
| iron_ore | minério de ferro | `#A0603C` | sim |
| gold_ore | ouro | `#E8C25A` | sim |

**`grapes` é CANA, não uva** (operador, 2026-09-26). O id é herdado do KaM; o jogo é
sertão. Na tela o jogador vê Cana, Canavial e Cachaça (`data/theme-sertao.json`). Quem
ler `grapes` no dado desenha **touceiras altas de colmo, folha comprida**: nunca
parreira, videira ou cacho de uva. O tile é plantado pelo jogador, como o milho: nasce
do arado, não do mapa. O recurso entra no dado com a correção do Canavial (seção 4a).

Cada recurso precisa de um desenho **com** recurso e um **esgotado**. O lajedo
esgotado e o roçado em pousio hoje desenham o mesmo marcador; a nota do F-TR pede que
se separem.

### Vegetação e objetos (tema)

- **Vegetação:** mandacaru, xique-xique, juazeiro, umbuzeiro, facheiro, macambira.
- **Objetos:** cerca de vara, pilha de lenha, cacimba, carro de boi, jumento, varal de
  carne de sol.

Nenhum deles tem lugar no código hoje. São lista de desejo do tema.

---

## 7. A paleta e a luz

**Paleta** (`data/theme-sertao.json`, bloco `paleta`) **[lido]**:

| Nome | Hex | Uso |
|---|---|---|
| terra | `#B5763A` | chão batido, estrada |
| terraQueimada | `#8C4A25` | sombra da terra, contorno de estrada |
| ocre | `#C9974B` | areia, parede de taipa |
| telha | `#B4562F` | telha colonial |
| cal | `#EDE3D0` | reboco caiado |
| algodaoCru | `#D9C9A8` | tecido, roupa de civil |
| verdeSeco | `#7C8B6A` | vegetação seca |
| verdeCaatinga | `#5E6B4F` | caatinga, grama |
| madeira | `#5A3F2B` | esteio, porta, cerca |
| couro | `#8A5A32` | chapéu e gibão |
| ceu | `#4E86A8` | céu, só em interface |

**A luz não está no tema.** Ela está no GDD §9.4 e no molde de prompt da spec
**[lido]**:

- a luz vem **de cima e da esquerda**;
- a sombra cai **para baixo e para a direita**;
- é luz de sol forte, sem neblina, com cor quente e nada saturado;
- o contorno é **escuro e sutil**, nem preto puro, nem ausente;
- **escala:** a altura de um civil é mais ou menos a altura de uma porta.

**Arquitetura:** taipa de mão com estrutura de madeira aparente, reboco caiado, telha
colonial, porta e janela em cor forte.

O molde de prompt completo (estilo, paleta, luz, fundo e negativas) está em
`docs/spec-arte-predios.md`. Use-o sem mudar a câmera, que é a parte que já deu errado
uma vez.

---

## 8. Como ver no jogo

Sequência **[testada]** em 2026-09-26, num worktree descartável, com a casa do lenhador:

1. Ponha as bases em `assets/base/woodcutters/`, todas no mesmo canvas.
2. Em `tools/derivar-sprites.js`, troque a constante `ALVOS` pelos pares do prédio:
   ```js
   { base: 'base/woodcutters/casa_lenhador_02_estrutura.png', saida: 'sprites/woodcutters/woodcutters_estrutura.png' },
   { base: 'base/woodcutters/casa_lenhador_03_completo.png',  saida: 'sprites/woodcutters/woodcutters_completo.png' },
   ```
3. Rode o derivador. Ele imprime o tamanho que vai para o manifest:
   ```bash
   node tools/derivar-sprites.js
   ```
   Saída testada: 192×179.
4. Acrescente a entrada em `assets/manifest.json` (modelo na seção 3).
5. Rode a verificação:
   ```bash
   npm run verify
   ```
   Resultado testado: verde, com código 0 (o teste de fumaça da seção 3).
6. Tire o screenshot do cenário de abertura, que planta armazém, casa do lenhador,
   pedreira, escola e estrada:
   ```bash
   npm run shot -- F17
   ```
   Resultado testado: `OK. 6 captura(s)`. O arquivo `screenshots/F17-5-final.png`
   mostrou a casa do lenhador desenhada com o sprite novo, pintada, de telha
   terracota e com pilha de lenha. O armazém continuou isométrico. A Casa do Coronel
   apareceu como retângulo marrom placeholder. Os carregadores apareceram como
   quadrados com o rótulo "Carregador".

Para ver à mão, `npm run dev` sobe o jogo em `http://localhost:5173` **[lido, não
testado nesta verificação]**.

**Cuidados:**

- Os roteiros de screenshot usam a porta fixa 5175. Rode **um de cada vez**, nunca em
  paralelo.
- O passo 2 é edição de ferramenta. Faça-o só se o plano da tarefa mandar.
- **Só prédio aparece hoje.** O manifest aceita só `tipo: "predio"`
  (`src/render/manifesto.ts`). Unidade, terreno e recurso não têm código que carregue
  sprite: pôr um PNG deles em `assets/sprites/` não muda nada na tela. Fazer isso
  aparecer é trabalho de `src/render/`, com item próprio no `BUILD_PLAN.md`.
- Um PNG em `assets/sprites/` que não está no manifest não é carregado. Um estado do
  manifest cujo arquivo falta vira retângulo placeholder. Nada disso quebra o jogo.

---

## 9. O alvo da primeira leva

A primeira leva é o que aparece nos primeiros minutos de toda partida.

### Terreno e vegetação

| Peça | Formato | Observação |
|---|---|---|
| grama, campoArado, areia, agua, rocha, montanha | tile 64×64, repetível | uma textura por tipo |
| transições | tile 64×64 | pelo menos grama com areia e grama com água |
| árvore (`tree`) com madeira e cortada | um sprite por estado | a árvore é mais alta que o tile, com âncora no pé |
| lajedo (`rock`) com pedra e esgotado | tile 64×64 | o esgotado tem de ser distinto do roçado em pousio |
| vegetação decorativa | um sprite por espécie | mandacaru e xique-xique primeiro |

Nada disso aparece na tela até a feature F-TR ser implementada no render.

### Três prédios

Os três são os que a abertura planta primeiro e os que o roteiro F17 mostra.

| id | Nome | Footprint | Sprite | Estado de hoje |
|---|---|---|---|---|
| storehouse | Armazém | 3×3 | 192 px de largura | isométrico, BUG-H: refazer `madeira` e `completo` |
| woodcutters | Casa do Lenhador | 3×2 | 192 px de largura | base aprovada para estrutura (vira `madeira`) e completo: pronto, falta só conferir o registro do par |
| quarry | Pedreira | 3×2 | 192 px de largura | nada: `madeira` e `completo` novos, **sem pedra desenhada** |

Os três precisam das áreas vazias da seção 4a desde o primeiro desenho: o armazém, o
pátio do estoque; a casa do lenhador, o ponto de saída das toras e a chaminé; a
pedreira, a área de trabalho (caso 2) e o ponto de saída dos blocos. A base aprovada da
casa do lenhador tem lenha empilhada? Se tiver, ela é estoque pintado (seção 5) e sai
no refazer.

### Duas unidades

| id | Nome | Direções | Desenhos com espelho | Item |
|---|---|---|---|---|
| serf | Carregador | 4 | 3 (norte, leste, sul) | cesto ou saco nas costas |
| laborer | Obreiro | 4 | 3 (norte, leste, sul) | marreta de madeira |

**Tamanho na tela hoje** **[lido em `src/render/grid.ts`]**. A unidade ocupa meio tile,
32×32 px no zoom 1. O zoom vai de 0,5 a 2, então ela aparece entre 16 e 64 px. O
chapéu precisa ser legível a 32 px. Duas unidades no mesmo tile são deslocadas até
16 px uma da outra (`deslocamentoDaUnidade`), então o sprite tem âncora no pé.

**Marcador de carga.** Hoje o nome da mercadoria aparece em texto acima do carregador
(`fsmData.carga`). O tema tem 31 entradas de mercadoria. Proposta, **ainda não decidida**:

- um desenho do carregador **vazio** e um **carregado**, com o cesto cheio;
- um ícone pequeno da mercadoria por cima, como camada separada, em vez de um
  carregador por mercadoria.

O obreiro não carrega mercadoria. Ele espera o material no canteiro. O desenho dele em
repouso e batendo a marreta basta.

---

## Não mexa

- **`src/sim/`.** Sessão de arte é `assets/`, `tools/` e, com plano, `src/render/`.
- **`test-results.json`.** Quem marca feature como pronta é o operador.
- **`.claude/` e `AGENTS.md`.**
- **Os testes**, em geral. Arte nova não precisa de mudança em teste nenhum (seção 3).

**Uma unidade parada dentro de um prédio** na tela era o **BUG-G**, corrigido em
2026-09-26 (`e64d456`). Se voltar a acontecer, é defeito da simulação, não de sprite nem
de profundidade de desenho: registre com `/bug`.

**Dívida de tela que a simulação já tem e a tela ainda não mostra.** Cada item precisa
de item próprio no `BUILD_PLAN.md` antes de código:

- a pedra parada no canteiro da estrada, esperando o obreiro, candidata a um sprite
  pequeno de monte de pedra;
- o carregador levando pedra até um tile de estrada, e não até uma porta;
- o obreiro esperando material no tile;
- o pescador na margem, a um tile da água.
### Schoolhouse compacta — cobertura e acesso (2026-09-27)

A `schoolhouse` confirma a regra de caricatura de RTS: **não comprimir o
sobrado inteiro**. Os dois pavimentos permanecem legíveis; a compressão ocorre
no telhado de quatro águas e no acesso. A cobertura **não é escalada nem
achatada**: remove-se uma faixa interna de cada água e reúnem-se as bordas,
preservando tamanho das telhas, inclinação visual, cumeeira, diagonais e
beiral. A escada passa a ser um acesso curto,
recolhido ao piso do alpendre, sem ocupar visualmente o tile da rua.

O envelope final é `214x240 px` para footprint `3x3` (`192x192 px`). O ponto de
assentamento é `[0.5, 0.875]`; ele ancora o piso do alpendre, enquanto o acesso
compacto pode aparecer abaixo sem deslocar a base do prédio. `madeira` e
`completo` usam o mesmo modelo, câmera e envelope Blender. A pintura só troca
superfície — telha, taipa, madeira, pedra, contorno e desgaste — e não pode
reabrir o telhado nem alongar a escada.
