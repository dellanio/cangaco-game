# Barra lateral única — medição e proposta (2026-09-26)

Pedido do operador (tarefa 3 da noite 12): medir e propor, **sem implementar**. Nada
em código mudou.

Tudo em **Verificado** foi medido com Playwright:
- sonda no scratchpad da sessão, fora do repositório, e apagada;
- Chromium com `?pausado`, nos viewports indicados, sobre a `main` em `f5fc2e9`.

O que não foi medido está marcado como **hipótese**.

## a) Quanto da tela é mapa hoje (Layout 2, F06 + balcão)

| Viewport | Estado | Canvas | % mapa |
|---|---|---|---|
| 1280×720 | nada escolhido (balcão na alça, 24 px) | 1020×656 | **72,6 %** |
| 1280×720 | prédio escolhido (balcão aberto, 148 px) | 1020×532 | **58,9 %** |
| 1280×720 | prancha fechada | 1280×656 | 91,1 % |
| 1920×1080 | nada escolhido | 1660×1016 | **81,3 %** |
| 1920×1080 | prédio escolhido | 1660×892 | **71,4 %** |
| 1920×1080 | prancha fechada | 1919×1016 | 94,0 % |

As faixas que comem o mapa:
- o HUD, 40 px no topo, na largura toda;
- a prancha, 260 px à direita, na altura abaixo do HUD;
- o balcão, 24 ou 148 px embaixo, na largura do canvas.

## b) O mesmo com uma barra única, nada em cima e nada embaixo

Com a barra na altura inteira, o canvas fica com (W − B) × H, e a parte de mapa é 1 − B/W.

| Viewport | B = 220 | B = 260 | B = 300 |
|---|---|---|---|
| 1280×720 | **82,8 %** | **79,7 %** | **76,6 %** |
| 1920×1080 | **88,5 %** | **86,5 %** | **84,4 %** |

- **Com prédio escolhido**, que é o pior caso de hoje, a 1280×720 e B = 260, o mapa vai de 58,9 % para 79,7 %: **+20,8 pontos**.
- **Com nada escolhido**, o ganho é de +7,1 pontos.
- A 1920×1080, os ganhos são de +15,1 e +5,2 pontos.
- A área do mapa **deixa de mudar com a seleção**. Hoje o canvas encolhe 124 px de altura quando o balcão abre.

## c) Largura mínima legível

### Grade de prédios (verificado)

- Hoje a grade tem 5 colunas de ícones de 40 px, com gap de 9 px: 236 px.
- Somando o padding de 10 + 10 e a borda de 3, a prancha precisa de **259 px**. Os 260 de hoje são exatamente o mínimo dela.
- Com a prancha a 240, o `scrollWidth` do menu fica em 246, maior que os 237 de largura útil: a grade já transborda.
- Mantendo o ícone de 40 px (retrato de 34), que é o piso de legibilidade que eu não reduziria:

| Colunas | Grade | Barra mínima | Linhas de ícone (33 ícones, 6 grupos + ferramentas) |
|---|---|---|---|
| 5 | 236 | 259 | 9, como hoje |
| 4 | 187 | **210** | 10 |
| 3 | 138 | 161 | 14 |

### Painel do prédio (verificado, blocos empilhados)

Hoje os blocos ficam lado a lado, e o `min-content` do painel da escola é 1037 px. Empilhados, vale o maior bloco:

| Peça | min-content |
|---|---|
| identidade, na escola | 158 (título "Casa do Coronel": 142) |
| identidade, no armazém | 125 |
| linha "Firmeza 550/550" | 109 |
| gavetas | 31 a 60 |
| ações (pausar/demolir) | 92 a 94 |

O painel empilhado cabe em **~160 px de conteúdo**, ou seja, uma barra de **≥ 185 px**.

### Fila da escola (verificado em parte)

- O bloco `escola` tem 709 px hoje: a fila e o `engajar` lado a lado.
- **Slot da fila**: `width: 232px` fixo no CSS (`estilo.css:438`). O motivo já encolhe com reticências.
  - **Hipótese, não medido**: sem o motivo, o slot cabe em ~180 px (nome em display 11 px + progresso + ×). A fila estava vazia na sonda, e o nome mais longo não foi medido dentro do slot.
- **Botões de tipo**: 14 botões, o mais largo com 126 px.
  - Hoje são 5 colunas `max-content`, 449 px.
  - Em 2 colunas, 256 px, o que pede uma barra ≥ 279.
  - Em 1 coluna, 126 px de largura e 14 linhas: ~308 px de altura (**hipótese**, a 22 px por linha).

**Resumo de (c):**
- **210 px** é o piso da grade (4 colunas);
- **~185** é o piso do painel;
- a fila precisa do slot abaixo de 232;
- os tipos em 2 colunas só cabem na barra de **300**.
- Na de 260, os tipos vão para 1 coluna.

## Proposta

Uma coluna à direita, na altura inteira. De cima para baixo:

1. **Logo com moldura**, ~48 px.
2. **Minimapa** quadrado na largura útil, com o retângulo da vista atual. O mapa é 128×128, e na barra de 260 isso dá ~1,85 px/tile.
3. **Os cinco recursos** em lista vertical, ícone e número (os SVG `hud-*` já existem), 5 × 24 = ~120 px.
4. **As abas do GDD §7.1**: Construir, Distribuição, Estatísticas e Opções, ~32 px.
5. **Corpo da aba Construir**: a grade por grupo, como hoje. O prédio bloqueado ganha **cadeado** sobre o retrato, no lugar do `grayscale` (`estilo.css:283`), e o "requer X" continua na dica.
6. **Painel do prédio escolhido** no rodapé da barra: os blocos de hoje, empilhados.
7. **Faixa da marca**: silhueta de cangaceiro a cavalo em xilogravura e o lema "TERRA FORTE, GENTE VALENTE", ~56 px.

Nada no topo e nada embaixo. **Recomendo B = 260**:
- a grade continua com 5 colunas, sem mudança;
- o painel empilhado cabe com folga;
- o mapa fica com 79,7 % / 86,5 %.

A de 220 ganha 3 pontos a mais, mas custa uma linha a mais de grade e aperta a fila. A de 300 só se justifica para os tipos em 2 colunas.

### O orçamento vertical não fecha a 720 (achado)

Barra de 260, alturas estimadas (**hipótese** de desenho, não medidas):

| Peça | px |
|---|---|
| logo | 48 |
| minimapa | 237 |
| recursos | 120 |
| abas | 32 |
| marca | 56 |
| **fixo** | **~493** |

- A 720 sobram **~227 px** para a grade e o painel juntos.
- A grade sozinha ocupa ~600 hoje (a prancha mede 680 de altura e não rola por pouco), e o painel da escola empilhado dá ~550.
- A 1080 sobram ~587, o que também não cabe os dois.

Saída que recomendo, e que é a do original (GDD §7.1: "painel contextual do item selecionado abaixo"):
- **O painel do prédio ocupa o corpo da aba quando há seleção**, e a grade volta quando ela some.
- O "rodapé" vira o lugar do painel **dentro** do corpo, não uma faixa própria sempre visível.
- Abaixo de ~900 px de altura:
  - o minimapa encolhe para 160;
  - a marca fica só com o lema, em ~24 px.

É decisão do operador.

## O que isto quebra

1. **A grade CSS da F06 / Layout 2** (`estilo.css:55-66`). Hoje o `body` tem 2 colunas × 3 linhas: HUD, canvas e balcão, mais a prancha. Passa a ter 1 linha × 2 colunas.
   - O **`#hud` some como faixa**, e tudo o que mora nele precisa de casa nova:
     - os recursos vão para a barra;
     - os alertas (`#alertas`, clicáveis pelo GDD §7.3), a dica "Aperte H", o aviso de tempo (F-D4), o carimbo PAUSADO e o botão Construir (`abrir-prancha`) ficam sem lugar.
     - **Proposta**: alertas e carimbo flutuando no canto do canvas, oposto à barra, sem faixa. A dica e a velocidade vão para a aba Opções.
   - A **prancha retrátil** (`data-prancha="fechada"`, que dá 91–94 % de mapa) precisa de decisão: a barra única recolhe ou não? Recomendo que recolha, ficando só a lombada.
2. **Os roteiros que medem a moldura.**
   - `tools/shots/F06.js:20-29` afirma o canvas abaixo do HUD **e** `canvas.right <= painel.left`.
     - A segunda continua válida contra a barra.
     - A primeira perde o objeto: não há HUD em cima.
   - **31 roteiros** usam `canvas.right` via `_canvas.js` como limite de "tile visível". Esses continuam de pé, e o canvas até cresce.
   - **11 roteiros** citam `#hud` e **10** citam `#menu-build`/`data-prancha`. Todos precisam ser revistos.
   - Os comentários de F13b, F16b, F17b, F17d e F22 ("o painel sobrepõe o canto do canvas") já estavam velhos desde o balcão.
   - A regra da §8 do CLAUDE.md lista `#hud` entre os painéis que exigem passo despausado. Ela passa a valer para a barra.
3. **O balcão** (Layout 2, `docs/propostas/ui-releitura-rts.md` §8, `src/ui/balcao.ts`, `data-balcao`, a alça): sai inteiro.
   - A regra "abre quando há algo escolhido" migra para o corpo da aba.
   - `F06.js` e `F16b.js` o exercitam.
   - É trabalho recente e aprovado, que esta proposta desfaz.
4. **Fullscreen.** O KaM roda em tela cheia, e nós rodamos numa aba.
   - A barra do navegador come altura: a 1920×1080 de monitor, o viewport útil fica em ~950–1000 (**hipótese**, varia por navegador). Isso agrava o orçamento vertical acima.
   - A Fullscreen API resolve, mas:
     - só entra por gesto do usuário (botão na aba Opções, ou F11);
     - **no fullscreen da API, `Esc` sai da tela cheia e a página não consegue impedir.** A exceção é a Keyboard Lock API, que só existe no Chromium.
   - Hoje `Esc` cancela a ferramenta e fecha o painel (`src/input/atalhos.ts`). No fullscreen, o primeiro `Esc` do jogador derruba a tela cheia. Precisa de decisão: outro atalho de cancelar (o botão direito, como no original), ou aceitar.
   - O Phaser em `Scale.RESIZE` já acompanha a troca de tamanho.
5. **O que a barra pede e ainda não existe.**
   - **Minimapa**: GDD §7.2, P2, não existe.
   - **Abas Distribuição e Estatísticas**: P2 e P1, não existem. Nasceriam vazias ou com "em breve".
   - **Cadeado no lugar do cinza**: o GDD §7.2 diz "bloqueados em cinza com 'requer X'" e precisa ser atualizado junto.
   - **Logo, moldura e silhueta do cangaceiro**: são arte, e pelo CLAUDE.md §9 arte entra por decisão humana. Até lá, placeholder com o `id` escrito.
   - **O lema**: vai para `data/theme-sertao.json`, nunca no `.ts`.
6. **§10 do CLAUDE.md**: a mudança é só de `src/ui/` + `index.html` + CSS + roteiros, sem `sim/`. O minimapa, se entrar, toca `src/render/`, e deve ser sub-item separado.

## Se o operador aprovar

Esta é uma sugestão de fila, que não foi escrita no `BUILD_PLAN.md`:
- **UI-barra-a**: a moldura, a coluna única, e o HUD e o balcão desmontados, com o conteúdo de hoje realocado e F06/F16b atualizados;
- **UI-barra-b**: abas e cadeado;
- **UI-barra-c**: minimapa (render);
- **UI-barra-d**: a arte da marca, por decisão humana;
- **UI-barra-e**: fullscreen e o atalho de cancelar.

## Referência do operador (2026-09-26, depois da proposta)

O operador mostrou a ideia da barra num mockup (`ui.jpg`, arquivo local dele, fora do repositório; não versionado por ser arte, §9). Medidas **estimadas a olho** sobre a imagem, não medidas em pixel:
- a imagem tem ~1672×941;
- a barra ocupa ~325 px, ou **~19 % da largura**.

O que o mockup **resolve** das perguntas acima:
- **Nada em cima nem embaixo**: confirmado.
- **Grade e painel juntos**, sem o painel substituir a grade. A grade mostra 4 grupos de 4 ícones (A Vila, Mato e Pedra, De Comer, Oficinas), e não os 33 ícones. Então ela rola, ou mostra só parte.
- **Grade em 4 colunas**, com ícones maiores que os 40 px de hoje.
- **Cadeado** no lugar do cinza.
- **Minimapa** com a vista marcada e uma **rosa dos ventos** ao lado, sem ocupar a largura toda.
- **Painel do prédio no rodapé**, compacto:
  - retrato, nome, Vida, Entra e Sai;
  - "ENGAJAR · CUSTA 1" com os tipos em **3 colunas**.
  - A fila de 5 slots (GDD §7.2, P0) não aparece.
- **Marca**: o cangaceiro montado e a placa "Terra Forte / Gente Valente" **transbordam a barra sobre o mapa**, no canto inferior esquerdo.
- **Logo**: "Piancó / Ferro e Mandacaru", com moldura de madeira e mandacaru.

O que **diverge** da proposta ou do GDD, e depende do operador:
1. **A barra fica à esquerda**, não à direita.
   - Nos roteiros, a asserção da F06 inverte: `canvas.left >= barra.right`.
   - `_canvas.js` mede o retângulo do canvas e não assume `left = 0` (não conferi linha a linha).
2. **Abas**: Construir, Unidades, Pesquisa, Diplomacia e Opções. O GDD §7.1 diz Construir, Distribuição, Estatísticas e Opções. Pesquisa e Diplomacia não têm mecânica no GDD. Isso é mudança de design (`IDEIAS.md`/GDD), não só de tela.
3. **Largura**: 19 % dá ~249 px a 1280 e ~373 px a 1920. Falta decidir se a largura é fixa em px ou proporcional à tela. Fixa em 373 a 1280, o mapa cairia para ~71 %.
4. **A fila da escola some** no desenho. Ela é P0 no GDD §7.2, e hoje o painel tem 5 slots. Falta decidir onde ela fica: aba, sobreposição ou rolagem.
5. **Engajar em 3 colunas**: o mockup mostra 9 dos 14 tipos, e o botão mais largo tem 126 px (medido na seção c). Três colunas de 126 pedem ~390 px, mais que a barra. O desenho usa botões de ~88 px, com fonte menor e rótulo curto.
6. **A marca sobre o mapa**: a transparência de clique na parte que transborda precisa ser decidida (`pointer-events: none`, ou o canto do mapa deixa de receber mouse). Isso contraria o comentário do Layout 2 ("o canvas não fica sob painel").
7. **Textos**: "Vida" em vez de "Firmeza", e o nome do lugar "Piancó / Ferro e Mandacaru". São do tema (`data/theme-sertao.json`), nunca do `.ts`.
