# Proposta — releitura da interface (estrutura, não estilo)

Branch `estilo-ui`, 2026-09-25. Proposta para o operador escolher; **nada aqui
está implementado**. O mock estático está em `ui-releitura-rts.html` (abre no
Vite: `/docs/propostas/ui-releitura-rts.html`).

> **Decidido (operador, 2026-09-25): Layout 2, com os dois painéis retráteis.**
> A seção 8 é a decisão e o refinamento; as seções 1 a 7 são o estudo que a
> antecedeu e ficam como registro do que foi comparado.

## 0. O defeito e o que os RTS fazem com ele

O menu Construir de hoje é uma lista vertical de 28 prédios com texto, que rola.
Num RTS o jogo não para enquanto o jogador procura; rolar lista é tempo perdido
e, pior, é tempo perdido *toda vez*, porque a posição de cada item muda com a
altura da janela.

Como os três jogos citados resolvem:

| Jogo | Onde fica o "construir" | Como cabe | Painel de contexto |
|---|---|---|---|
| **Age of Empires II** | Rodapé, faixa de largura inteira. Esquerda: grade de comandos 5×3 (15 botões). Centro: seleção (retrato, HP, fila). Direita: minimapa | Duas páginas: prédios econômicos e militares. Cada ícone tem tecla fixa | Na mesma faixa, no centro; a fila de treino é uma linha de ícones |
| **Civilization VI** | Painel lateral da cidade, com abas Distritos / Prédios / Unidades / Maravilhas, e busca | Lista rolante **com abas**. Rolar é aceitável porque o jogo é por turnos e espera | Lateral, sobreposto ao mapa |
| **Knights and Merchants** | Coluna à direita com quatro abas (Build, Ratios, Stats, Menu). A aba Build é uma **grade de ícones 5 colunas × 6 linhas**, estrada/campo/vinha na primeira linha | Tudo visível, sem rolagem; bloqueado fica cinza. Passar o mouse mostra nome e custo *abaixo da grade*, não em tooltip sobre o mapa | **Substitui** o conteúdo da coluna quando se seleciona uma casa; as abas continuam em cima para voltar |

A lição que serve ao Piancó: **ícone em grade fixa, tudo visível, e a informação
textual num cartão fixo abaixo da grade** — o texto sai do botão e vai para um
lugar só. O Civ é o contraexemplo: lista rolante funciona lá porque o relógio
espera; aqui não espera. O GDD §7.1 já descreve a estrutura do K&M ("barra
lateral com abas Build, Distribuição, Estatísticas e Opções, e painel contextual
do item selecionado abaixo"); esta proposta é essa estrutura, decidida em pixel.

## 1. Grade de ícones: cabe sem rolar? Em quantas linhas?

**Cabe. 5 colunas × 6 linhas para os 28 prédios, mais 1 linha de ferramentas.**

Contas na coluna de hoje, que continua com 260 px (a F06 mede `canvas.right <=
painel.left`, e a coluna não muda de largura):

| Medida | Valor |
|---|---|
| Largura útil da coluna (260 − 2 × 12 de margem) | 236 px |
| Ícone | 40 × 40 px |
| Folga entre ícones | 9 px |
| Colunas (5 × 40 + 4 × 9 = 236) | **5** |
| Passo de linha (40 + 7) | 47 px |
| Linhas para 28 prédios (28 ÷ 5, arredondado para cima) | **6** |
| Linha de ferramentas: estrada, demolir estrada, campo (F18h) | +1 |

Seis colunas dariam ícone de 32 px, que é o tamanho do K&M em 1024 × 768 e
pequeno demais para o traço grosso da xilogravura ler. Cinco é o número.

**Ícone que não existe é placeholder, não bloqueio** (CLAUDE.md §9): enquanto a
arte não chega, o botão desenha a **miniatura do footprint** do prédio (N × M
quadradinhos, do `tamanho` que o seletor já devolve) dentro da moldura de tinta.
Isso distingue 4×4 (quartel) de 2×1 (garimpo) de relance e não digita nenhuma
letra em `.ts`. A arte final entra por `assets/sprites/<id>/icone.png` com
entrada `tipo: "icone"` no manifest, 40 × 40, em xilogravura — é o estilo que o
GDD §9.7 diz que as ferramentas de geração reproduzem bem.

## 2. Grupos por função, tirados da árvore

A árvore de `buildings.json` (GDD §5.3) tem cinco cadeias. Cada prédio cai em
exatamente uma:

| Grupo (id neutro) | Rótulo proposto no tema | Prédios (ordem = profundidade na árvore a partir do que já está de pé) | n |
|---|---|---|---|
| `vila` | A vila | schoolhouse · inn · storehouse (adicional) · marketplace | 4 |
| `materia` | Mato e pedra | quarry · woodcutters · sawmill · coal_mine · gold_mine · iron_mine | 6 |
| `comida` | De comer | farm · fishermans · wineyard · mill · swine_farm · bakery · butchers | 7 |
| `oficinas` | Oficinas | weapons_workshop · metallurgists · iron_smithy · tannery · weapon_smithy · armor_smithy · armory_workshop | 7 |
| `bando` | O bando | watchtower · barracks · stables · town_hall | 4 |

Total 28. Duas decisões que valem registrar:

- **Cocheira (`stables`) vai em `bando`, não em `comida`**: come milho, mas o
  cavalo só serve a Vaqueiro e Capitão. O jogador que procura cavalo está
  montando bando.
- **Fundição (`metallurgists`) vai em `oficinas`**: faz dinheiro, mas é
  oficina de minério, irmã da Forja. E `town_hall` (Mercenários) vai em
  `bando`, porque o que sai dele é soldado.

Dentro de cada grupo a ordem é a **profundidade na árvore**, calculada do dado
(`desbloqueadoPor` a partir de `economy.estadoInicial.predios`), nunca digitada.
Efeito: a fronteira do que está cinza desce pela grade conforme a partida
avança, como no K&M — o jogador aprende que "o que posso fazer agora está em
cima de cada faixa".

**Abas ou faixas?** Faixas (grupos como bandas de linhas dentro de uma grade
só), não abas. Com 5 colunas, os grupos ocupam 1 + 2 + 2 + 2 + 1 = **8 linhas**
com o nome do grupo gravado numa régua fina entre elas. Abas esconderiam 21 dos
28 ícones a cada momento e custariam um clique para trocar; o Age aceita isso
porque tem 15 células, nós temos 30. As faixas custam duas linhas a mais (8 em
vez de 6) e o orçamento da seção 3 mostra que cabem.

Onde mora o agrupamento: em **`data/menu-build.json`** (`grupos: [{ id,
predios: [...] }]`), lido por `ui/` direto como o tema é lido hoje. Não é regra
de jogo, então não entra em `sim/`; e `ui/` continua sem importar `sim/data`.
Uma regra nova em `tools/data-rules.js` reprova prédio fora de grupo, em dois
grupos, ou grupo com id sem rótulo em `theme-sertao.json > menuBuild.grupos`
(mesmo desenho do guarda da F22 para as causas de alerta).

## 3. Painel de contexto: lateral ou rodapé?

Três layouts avaliados. O canvas é a célula `(coluna 1, linha 2)` da grade CSS
da F06 e **nunca fica debaixo de painel** nos três; o que muda é quantas
células a grade tem.

### Layout 1 — "Prancha" (o do K&M). **Recomendado.**

```
┌────────────────────────────────────────────────────────────┬──────────────┐
│ DINHEIRO 20  TÁBUA 40  PEDRA 30  COMIDA 25  GENTE 6/0      │  [PAUSADO]   │  HUD 40px
│                       ┌ AVISOS ─┐┌──────────┐              │              │  (avisos viram carimbos aqui)
│                       │Sem quem…1││Sem estr…1│              │              │
├────────────────────────────────────────────────────────────┼──────────────┤
│                                                            │ CONSTRUIR │ PRÉDIO │  abas
│                                                            ├──────────────┤
│                                                            │ ═ ▬ ▦        │  ferramentas: estrada, demolir, campo
│                                                            │ ── A vila ── │
│                   canvas (1020 × 680)                      │ ▣ ▣ ▣ ▣      │
│                   sem nada por cima                        │ ── Mato e pedra ──
│                                                            │ ▣ ▣ ▣ ▣ ▣    │
│                                                            │ ▣            │
│                                                            │ ── De comer ──
│                                                            │ ▣ ▣ ▣ ▣ ▣    │
│                                                            │ ▣ ▣          │
│                                                            │ ── Oficinas ──
│                                                            │ ▣ ▣ ▣ ▣ ▣    │
│                                                            │ ▣ ▣          │
│                                                            │ ── O bando ──│
│                                                            │ ▣ ▣ ▣ ▣      │
│                                                            ├──────────────┤
│                                                            │ Bodega       │  cartão fixo: o que está
│                                                            │ Tábua 6·Pedra 5   sob o mouse ou ativo
│                                                            │ requer Armazém    (nome, custo, requer,
│                                                            │ Venda e mesa…│    descrição do tema)
└────────────────────────────────────────────────────────────┴──────────────┘
```

Ao clicar num prédio do mapa, a **coluna troca de página** para PRÉDIO (a aba
CONSTRUIR fica visível em cima; clicar nela, ou `Esc`, volta). A página PRÉDIO
é o painel da F16b inteiro, com a coluna toda (680 px a 720p) para ele — a fila
da escola e os 14 tipos de civil viram uma grade de ícones 5 × 3 abaixo dos 5
slots.

```
│ CONSTRUIR │ PRÉDIO ◀   │
├──────────────┤
│ Casa do Coronel   [PARADO] │
│ Firmeza        550/550 │
│ Entra  [Dinheiro 3]    │
│ Sai    —               │
│ ── Fila ──             │
│ ▣ Carregador  trein. 31% ×│
│ ▣ Carregador  na fila  × │
│ ▣ Carregador  na fila  × │
│ ░░░░░░░░░░░░░░░░░░░░░ │  vazio, hachurado
│ ░░░░░░░░░░░░░░░░░░░░░ │
│ ── Engajar ──          │
│ ▣ ▣ ▣ ▣ ▣              │  14 tipos, 5 × 3
│ ▣ ▣ ▣ ▣ ▣              │
│ ▣ ▣ ▣ ▣                │
│                        │
│ [Parar]     [Derrubar] │
```

**O que muda para o canvas: nada.** A grade continua `1fr 260px` × `40px 1fr`.
O que muda é que os dois painéis que hoje são **sobreposição na célula do
canvas** (`#painel-predio` no canto inferior esquerdo, `#alertas` no superior
direito) saem de lá: o contexto vai para a coluna e os avisos viram carimbos no
HUD. Isso apaga uma classe de defeito que a F13b já teve de contornar ("o tile
vazio não pode cair sob o painel: o clique não chegaria ao canvas") e libera o
canto do mapa para o minimapa quando ele vier (P2).

**Orçamento vertical a 1280 × 720** (coluna = 680 px, margens 12 + 12). Os
números são **medidos no mock** (`getBoundingClientRect` em escala 1, com a
fonte de display carregada), não estimados:

| Página CONSTRUIR | px |
|---|---|
| Abas | 35 |
| Linha de ferramentas | 40 |
| 8 linhas de ícones (40 px + 7 de folga entre linhas de um grupo) | 341 |
| 5 réguas de grupo × 16 | 80 |
| Cartão fixo (nome, custo e tamanho, 1 linha de descrição) | 97 |
| 12 folgas entre blocos × 4 | 48 |
| Margens | 24 |
| **Total** | **665 de 680** |

Cabe com 15 px de folga. A primeira versão do mock tinha folga de 6 px entre
blocos e estourava em 9 px: a margem é essa, apertada, e é por isso que a
pergunta 3 da seção 7 existe. A 1080p sobram 360 px (é onde entra o minimapa
acima das abas, como no K&M Remake). A página PRÉDIO da escola, medida no
mesmo mock, dá **571 px** com a fila cheia e os 14 tipos em grade — sobra.

Custo do layout: com um prédio selecionado, construir outro pede um clique na
aba (ou `Esc`). É o mesmo clique que o jogador do K&M dá há 25 anos e o mesmo
que o do Age dá para virar a página econômico/militar. Frequência baixa;
custo constante; sem rolagem.

### Layout 2 — "Balcão" (o do Age)

```
┌────────────────────────────────────────────────────────────┬──────────────┐
│ HUD                                                        │              │  40
├────────────────────────────────────────────────────────────┤ CONSTRUIR    │
│                                                            │ (grade 5×8,  │
│                   canvas (1020 × 548)                      │  sempre      │
│                                                            │  visível)    │
│                                                            │              │
├────────────────────────────────────────────────────────────┤              │
│ Casa do Coronel │ Firmeza 550/550 │ FILA ▣ ▣ ▣ ░ ░ │ ENGAJAR ▣▣▣▣▣▣▣ │ [Derrubar] │  rodapé 148
│ [PARADO]        │ Entra [Dinheiro 3] Sai — │             │         ▣▣▣▣▣▣▣ │            │
└────────────────────────────────────────────────────────────┴──────────────┘
```

A grade de construir fica sempre visível na coluna; o contexto vira faixa
horizontal de 148 px no rodapé, só na largura do canvas (a coluna desce até o
chão). O canvas perde 148 px de altura: a grade CSS ganha a terceira linha
(`40px 1fr 148px`) e o roteiro da F06 ganha a afirmação `canvas.bottom <=
rodape.top`. O Phaser mede o pai no boot e o rodapé tem altura fixa, então nada
muda no `render/`.

Prós: zero cliques entre inspecionar e construir; a fila da escola em linha,
como no Age. Contras: a faixa fica vazia sem seleção (o Age a enche com
minimapa e retrato — nós não temos nenhum dos dois ainda). A conta de área,
**corrigida pelo operador**: o rodapé tira 148 de 680 px, **21,8 % da altura**,
mas a coluna de 260 px do Layout 1 tira 20 % da largura, de forma permanente.
A diferença entre os dois não é *quanto* canvas sobra — é *quando* se perde:
o Layout 1 perde sempre; o Layout 2 perde só enquanto há algo selecionado, e
com a faixa encolhendo sem seleção (seção 8) não perde nada no resto do tempo.

### Layout 3 — "Coluna dividida"

Coluna à direita com **abas por grupo** em cima (5 abas, cada uma com no máximo
2 linhas de ícones = 128 px) e o painel de contexto embaixo, sempre. Nada muda
no canvas nem na grade CSS.

Prós: contexto e construir visíveis ao mesmo tempo, sem tocar no canvas.
Contras: só 7 dos 28 ícones à vista a cada momento; o jogador tem de saber em
que grupo o prédio está antes de achá-lo (a Cocheira é bando ou comida?); a
fronteira do desbloqueio some, porque está espalhada em cinco abas.

### Comparação

| | 1 Prancha | 2 Balcão | 3 Dividida |
|---|---|---|---|
| 28 ícones visíveis sem rolar | sim | sim | 7 por vez |
| Canvas | −20 % da largura, sempre | −21,8 % da altura, só com seleção (seção 8) | −20 % da largura, sempre |
| Grade CSS da F06 | igual | +1 linha, +1 afirmação | igual |
| Sobreposição no canvas | nenhuma | nenhuma | nenhuma |
| Cliques entre inspecionar e construir | 1 | 0 | 0 |
| Fila da escola | vertical, com folga | horizontal, apertada | vertical, sem folga a 720p |
| Grupos por função | faixas na grade | faixas na grade | abas |
| Minimapa (P2) | acima das abas a 1080p | no rodapé, como no Age | não cabe |
| GDD §7.1 | é ele | não | meio |

**Recomendação original: Layout 1**, pela estrutura do GDD, pelo original e
por não mexer na grade que a F06 mede. **Recusada pelo operador** (seção 8) por
duas razões que a proposta não tinha pesado: no Layout 1 selecionar um prédio
*tira a grade de construir da tela* — clicar na pedreira para ver o estoque e
perder o menu incomoda num RTS, e é por isso que o Age faz as duas coexistirem;
e o painel de contexto da Fase C é seleção **militar** (grupo, formação,
ordens, condição da tropa), que é faixa horizontal, não coluna de 260 px —
nascer no Layout 1 obrigaria a refazer quando o Quartel existir.

## 4. Avisos e HUD

Os avisos (F22) deixam de ser caixa sobre o mapa e viram **carimbos no HUD**,
entre os recursos e o PAUSADO: `[Sem quem trabalhe 1] [Sem estrada 1]`. Mesma
estrutura de DOM (`#alertas`, `.alerta[data-causa]`, `.rotulo`, `.contagem`),
outro lugar. Quando o "clique leva a câmera ao problema" (GDD §7.3) for
implementado, o carimbo já é o botão. A largura sobra: a 1280 px os recursos
ocupam ~520 px e o carimbo mais longo tem ~180.

## 5. O que fica como está (as quatro restrições)

- **Nenhuma string visível em `.ts`.** Rótulos dos grupos, das abas e do cartão
  vêm de `theme-sertao.json > menuBuild.grupos / abas`. O placeholder de ícone é
  desenho (footprint), não letra.
- **`ui/` não importa `sim/data`.** O agrupamento vem de `data/menu-build.json`,
  lido como o tema; custo, requisito e tamanho continuam vindo de
  `opcoesDoMenuBuild` (seletor puro).
- **Canvas nunca sob painel.** No Layout 1 é *mais* verdade do que hoje: as
  duas sobreposições saem.
- **Atributos que os roteiros afirmam** ficam nos mesmos nós: `data-predio`,
  `data-ferramenta`, `aria-pressed`, `aria-disabled` no botão-ícone;
  `data-predio-aberto`, `data-tipo`, `data-cancelar`, `data-treinar`,
  `data-demolir`, `data-pausar` na página PRÉDIO; `data-causa` nos avisos.
  **O que muda de estrutura e exige roteiro novo**: o texto "requer X" sai do
  botão e vai para o cartão fixo (`[data-planta]`), então a afirmação da F06
  sobre `textContent` do item passa a ler o cartão; e a F22 mede o retângulo
  dos avisos contra o do painel — os dois mudam de lugar e a medida vira "os
  avisos estão dentro do HUD".

## 6. Custo de implementação, se o Layout 1 for escolhido

Só `src/ui/`, `index.html`, `data/` e roteiros. Nada em `render/` nem `sim/`.

1. `data/menu-build.json` + regra em `tools/data-rules.js` + schema; chaves
   novas no tema. (`validate:data` verde.)
2. `menu-build.ts`: grade de ícones com faixas, placeholder de footprint,
   cartão fixo alimentado por hover/ativo. Mantém `ferramenta.alternar` e o
   `blur` do BUG-A.
3. `painel-predio.ts`: vira página da coluna; a trava de ponteiro do BUG-B
   continua (a página redesenha a 10 Hz como hoje).
4. Abas: um módulo pequeno `ui/abas.ts`, que só alterna `hidden` entre as
   duas páginas e recebe `selecao.aoMudar`.
5. `alertas.ts`: monta em `#hud`.
6. Roteiros F06, F13b, F16b, F22 ajustados nos pontos da seção 5; F-D1 não
   muda.

Três a quatro sessões. A xilogravura já feita (`estilo.css`) se aplica em
cima: moldura de tinta nos ícones, item ativo como bloco entintado com barra
de ocre (a medida da F06 continua), faixas como régua gravada, carimbos no HUD.

## 7. Perguntas em aberto (para o operador)

1. Minimapa é P2 no GDD §7.2. No Layout 1 ele cabe acima das abas a 1080p e
   não cabe a 720p. Vale reservar o lugar agora ou decidir quando chegar?
2. Tecla `B` (proposta no GDD §2.2) passa a ser "aba CONSTRUIR"? Hoje não
   existe; entraria no inventário `input/atalhos.ts`, que é `input/`, fora
   do escopo desta branch.
3. A resolução mínima suportada é 1280 × 720? O orçamento fecha com 15 px de
   folga nela; abaixo disso a grade precisaria de rolagem e voltaríamos ao
   defeito.

## 8. Decisão do operador (2026-09-25): Layout 2, retrátil

O operador aprovou o desenho geral — grade por grupo, ícone derivado do
footprint, avisos como carimbo no HUD — e escolheu o **Balcão** (Layout 2)
pelas duas razões registradas no fim da seção 3: a grade de construir e o
contexto **coexistem**, e o contexto militar da Fase C é faixa, não coluna.
Com uma exigência a mais: os dois painéis precisam **retrair e ficar
minimizados** — a coluna da direita vira uma linha fina na borda direita, e a
barra de baixo, ao retrair, fica encostada no **lado esquerdo** da tela. E
pediu que a barra de baixo sirva para "maiores detalhes de um edifício".

Duas condições dele antes de implementar, e como esta seção as resolve:

1. **O roteiro da F06 ganha `canvas.bottom <= rodape.top`**, ao lado de
   `canvas.right <= painel.left` que já existe (8.3).
2. **A faixa vazia não fica vazia**: sem seleção ela **encolhe** para a alça
   de 24 px (8.2). Resumo da vila e últimos avisos foram considerados e
   recusados aqui: resumo da vila é o HUD (que já mostra dinheiro, material,
   comida e gente), e avisos já são carimbos no HUD (seção 4) — repetir os
   dois numa faixa de 148 px seria pagar 21,8 % do mapa por informação que já
   está na tela. Encolher devolve o mapa e deixa a alça como lugar do que
   está na mão (pergunta 8.6.1).

### 8.1 Para que serve a barra de baixo

A barra de baixo **é** o painel de contexto do GDD §7.2 — o que hoje é o
`#painel-predio` sobreposto no canto do mapa (F16b). Ela mostra o que está
selecionado, e só isso. Com um prédio selecionado, é exatamente "maiores
detalhes de um edifício":

| Bloco | Conteúdo hoje (F16b, F13b, F17b) | Vem depois (GDD §2.3, §7.2) |
|---|---|---|
| Identidade | nome, carimbo `Parado` / `Em obra`, firmeza ou progresso | descrição do tema, ligar/desligar reparo |
| Gente | quem trabalha ou `Sem trabalhador` | *Dismiss* do civil |
| Estoque | gavetas Entra / Sai; medidor de material da obra | Armazém: 28 mercadorias com bloquear/liberar |
| Ações | Parar / Voltar ao trabalho, Derrubar | modo do Lenhador; quantas armas produzir |
| Fila | Casa do Coronel: 5 slots + 14 tipos | Quartel: tipo de soldado |
| Grupo militar | — | Halt / Split / Link / Formação / Feed / Storm (§2.4) |

A largura de 1020 px é o que torna isso possível: no painel de 248 px de hoje
tudo é empilhado; na barra os blocos ficam **lado a lado**, e o painel do
armazém com 28 mercadorias, que não caberia numa coluna, cabe numa faixa. É
essa a razão de o Age pôr o contexto no rodapé.

### 8.2 Os dois painéis e os quatro estados

```
Aberto + aberto (padrão)        Prancha fechada                 Balcão fechado                  Os dois fechados
┌────────────────┬────┐         ┌─────────────────────┬┐        ┌────────────────┬────┐         ┌─────────────────────┬┐
│ HUD            │    │         │ HUD                 ││        │ HUD            │    │         │ HUD                 ││
├────────────────┤ C  │         ├─────────────────────┤│        ├────────────────┤ C  │         ├─────────────────────┤│
│                │ O  │         │                     │C        │                │ O  │         │                     │C
│ canvas         │ N  │         │ canvas              │O        │ canvas         │ N  │         │ canvas              │O
│ 1020 × 548     │ S  │         │ 1262 × 548          │N        │ 1020 × 658     │ S  │         │ 1262 × 658          │N
│                │ T  │         │                     │S        │                │ T  │         │                     │S
├────────────────┤ R  │         ├─────────────────────┤T        │                │ R  │         │                     │T
│ balcão 148     │ .  │         │ balcão 148          │R        ├────────────────┤ .  │         ├─────────────────────┤R
│                │    │         │                     │.        │▲ Pedreira (24) │    │         │▲ Pedreira (24)      │.
└────────────────┴────┘         └─────────────────────┴┘        └────────────────┴────┘         └─────────────────────┴┘
```

- **Prancha** (coluna da direita, a grade de construir). Aberta: 260 px.
  Fechada: **22 px**, uma lombada de tinta na borda direita com o rótulo
  `Construir` (tema) escrito na vertical e a seta. Clicar na lombada abre;
  clicar na seta do cabeçalho fecha. Só o jogador abre e fecha — a prancha
  nunca se mexe sozinha, porque é onde a mão dele vai a cada poucos segundos.
- **Balcão** (barra de baixo, o contexto). Aberto: 148 px. Fechado: **24 px**,
  uma alça encostada à esquerda com o nome do que está selecionado e a seta
  `▲`. O balcão **abre sozinho ao selecionar** um prédio (selecionar é pedir
  detalhe) e **fecha sozinho quando não há seleção** (`Esc`, clique em tile
  vazio, prédio demolido): barra vazia é 148 px de mapa perdidos por nada.
  Fechado à mão com um prédio selecionado, ele guarda a seleção (o contorno no
  mapa fica) e a alça mostra o nome; selecionar outro prédio reabre.

O estado dos dois é **estado de interface**, como a ferramenta e a seleção:
vive em `ui/`, nunca em `GameState`, e a preferência da prancha (aberta ou
fechada) vai para `localStorage` como o lembrete da ajuda (F-D1) — é
preferência de quem joga nesta máquina, não de partida.

### 8.3 O que acontece com o canvas

Nada em `render/`. `src/render/game.ts:36` já configura
`Phaser.Scale.RESIZE` a 100 % do pai, então o canvas **acompanha a célula da
grade**: quando a coluna passa de 260 para 22 px ou a linha de baixo de 148
para 24 px, o mapa cresce e a câmera continua válida. A grade CSS passa a ter
três linhas e as duas medidas viram variáveis que mudam com um atributo no
`body`:

```
body                         { grid-template-columns: 1fr var(--largura-prancha);
                               grid-template-rows: var(--altura-hud) 1fr var(--altura-balcao); }
body[data-prancha="fechada"] { --largura-prancha: 22px; }
body[data-balcao="fechado"]  { --altura-balcao: 24px; }
#jogo     { grid-column: 1; grid-row: 2; }        /* canvas: SO a celula dele, como hoje */
#balcao   { grid-column: 1; grid-row: 3; }        /* nunca sobre o canvas */
#prancha  { grid-column: 2; grid-row: 2 / -1; }   /* desce ate o chao */
```

O canvas **nunca fica sob painel** em nenhum dos quatro estados: a lombada e a
alça são células da grade, não sobreposição. O roteiro da F06 ganha a
afirmação `canvas.bottom <= balcao.top` e passa a medir os quatro estados.

### 8.4 O que muda de estrutura e exige roteiro novo

- `#menu-build` → `#prancha`, com cabeçalho (título do tema + botão de
  fechar), grade de ícones em faixas (seção 2) e cartão fixo. Atributos
  `data-predio`, `data-ferramenta`, `aria-pressed`, `aria-disabled` ficam no
  botão-ícone; o texto `requer X` vai para o cartão `[data-planta]`, e a
  afirmação da F06 sobre `textContent` passa a ler o cartão.
- `#painel-predio` → `#balcao`, mesmo conteúdo em blocos horizontais, mais a
  alça `[data-alca]`. `data-predio-aberto`, `data-tipo`, `data-cancelar`,
  `data-treinar`, `data-demolir`, `data-pausar` ficam. A trava de ponteiro do
  BUG-B continua. A afirmação da F13b "o tile vazio não pode cair sob o painel"
  vira trivialmente verdadeira e fica.
- `#alertas` vai para o HUD como carimbos (seção 4); a F22 troca a medida
  "não cobre o painel" por "está dentro do HUD".
- Atributos novos, para os roteiros: `body[data-prancha]`,
  `body[data-balcao]`, `[data-alca]`, `[data-fechar]`.

### 8.5 Fatias de implementação (uma por sessão)

> **Estado (2026-09-25): as quatro fatias estão implementadas na branch
> `estilo-ui`**, um commit por fatia (`feat(ui): Layout 2, fatia N`). O que
> saiu diferente do plano, e por quê: a faixa tem **148 px**, não 132 (a fila
> de cinco vagas mais o título não cabia em 108 px de conteúdo), e a alça
> **24 px**; a lombada tem **22 px** (a 18 o título vertical não lia). O
> `#alertas` foi para dentro do `#hud` no `index.html` sem mudar
> `ui/alertas.ts`. **A lombada foi substituída** (operador, 2026-09-25: lia
> como "menu comprimido numa barra"): fechada, a prancha some inteira e o
> canvas vai até a borda; um **botão flutuante no canto superior direito da
> barra** a traz de volta, com animação de entrada. `tools/shot.js` ganhou `CANGACO_SHOT_PORTA` porque um
> Vite órfão de outra sessão ocupava a porta 5175 e o runner media o
> `index.html` do diretório vizinho. As perguntas de 8.6 seguem abertas.

1. **Grade e retração.** `index.html` e `estilo.css` com a grade de três
   linhas e os dois atributos; `ui/prancha.ts` e `ui/balcao.ts` só com abrir,
   fechar e a alça, e o conteúdo de hoje movido para dentro sem mudar. F06
   ganha as medidas dos quatro estados. É a fatia que prova que o canvas
   cresce e que nada fica por baixo.
2. **Grade de ícones.** `data/menu-build.json` com os grupos, regra em
   `validate:data`, rótulos no tema, `menu-build.ts` vira grade com faixas,
   placeholder de footprint e cartão fixo. F06 ajustada.
3. **Balcão horizontal.** `painel-predio.ts` em blocos lado a lado; fila da
   escola em linha; F13b e F16b ajustadas.
4. **Avisos no HUD.** `alertas.ts` monta em `#hud`; F22 ajustada.

Só `src/ui/`, `index.html`, `data/` e `tools/shots/`. Nada em `render/`,
`sim/` nem `input/`.

### 8.6 Perguntas em aberto

1. A prancha fechada some com o cartão fixo; o nome e o custo do prédio na
   mão passam a existir só na planta fantasma (F-TP já escreve a colheita sob o
   cursor). Basta, ou a alça do balcão mostra o que está na mão?
2. Tecla para abrir e fechar a prancha (`B`, proposta no GDD §2.2) entra no
   inventário `input/atalhos.ts`, que é `input/`. Fica para a fila, ou entra
   nesta branch com a nota de exceção?
