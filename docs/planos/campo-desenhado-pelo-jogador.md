# Campo desenhado pelo jogador — diagnóstico e plano

**Sessão de 2026-09-25. Nada foi implementado: o operador pediu o plano e a parada.**

---

## Parte 1 — Diagnóstico da fazenda que o operador construiu

### O que foi medido (sonda headless, apagada depois da medição)

Cenário: a fazenda do dado publicado, **no mapa de verdade** (`sertao-128`), posta na
aldeia, **ocupada** pelo roceiro e **ligada** ao armazém por estrada — a mesma fixture
`cenarioDeFazendaSemCampo` que o aceite da F18 já usa, que é exatamente a situação do
operador. 3000 ticks:

| Medida | Valor |
|---|---|
| Milho nas gavetas da fazenda | `{}` — **zero**, nem entrada nem saída |
| Alerta no estado | `[{ predio: f1, tipo: farm, causa: 'sem-campo' }]` |
| Linha de alcance do painel | `{ recurso: 'corn', tiles: 0, unidades: 0 }` |
| Ocupante | `roceiro` (farmer) — **não é falta de trabalhador** |

### Por quê: o mapa

`campoArado` no `sertao-128.json`: **130 tiles**, em **duas manchas** e só duas —
x 108..117 / y 22..30 e x 73..82 / y 58..66. O armazém da abertura está em (29,30).
Distância de Chebyshev da mancha mais próxima à vila: **42 tiles**.

Varrendo as 16 384 posições do mapa com o alcance real da receita
(`production.json: farm.colheita.alcance_tiles = 4`, medido do footprint):

- **748 posições** (4,6 % do mapa) têm ao menos um tile arável ao alcance;
- a mais próxima do armazém está a **37 tiles**.

Ou seja: **não existe lugar algum perto da vila onde a fazenda produza**. Não é sorte
ruim de posicionamento — é o mapa. Para o roçado funcionar, hoje, o jogador teria de
plantar a fazenda a 37+ tiles da vila, com estrada e armazém próprios lá — que é
literalmente o que a fixture `cenarioDeFazenda` faz (fazenda em 112,30 mais
`armazem-do-roçado` em 116,34).

### A tela mostra o motivo?

Sim, em dois lugares, e os dois com a frase certa:

- **alerta do HUD** (F22): causa `sem-campo` → `theme-sertao.json` →
  **"Sem terra de plantio ao alcance"**;
- **painel do prédio** (F-TA): a linha de alcance com zero tem frase própria →
  **"Roçado: nenhum ao alcance"**.

E a **planta fantasma** (F-TP) escreve a mesma frase **antes do clique**, enquanto o
prédio ainda é prévia.

### A consequência, então, não é "a tela não avisa" — é que não há o que fazer com o aviso

O jogo diz o motivo e não oferece ação nenhuma para resolvê-lo: não existe ferramenta de
campo, e terra arada não se cria. A única saída é mudar a fazenda 37 tiles de lugar. É a
diferença entre *informação* e *agência*, e é o que o operador sentiu jogando.

### Correção de uma premissa do pedido

O pedido diz "o campo é derivado da **posição da fazenda**, em anéis até 15 tiles".
O código não faz isso, e a diferença importa para o plano:

- o campo é derivado do **TERRENO do mapa** — `resources.json: corn.terreno =
  "campoArado"`, e o carregador varre as linhas do mapa
  (`loader.ts: derivarRecursosDoTerreno`);
- o **alcance** da fazenda é **4** tiles a partir do footprint, não 15
  (`production.json: farm.colheita.alcance_tiles`). O 15 existia em
  `terrain.json.campos.milho.tilesPorFarm`, **sem leitor nenhum**, e a própria F18 o
  removeu;
- **não existe "dono do tile"**. O que existe é reserva exclusiva e transitória, por
  tarefa de colheita/plantio (F-T2c, F-D3). Duas fazendas com alcances sobrepostos
  dividem os tiles pela reserva, não por posse.

---

## Parte 2 — O plano da ferramenta de campo

### O que a reversão derruba de fato

| Peça da F18 | O que acontece |
|---|---|
| Campo derivado do terreno (`corn.terreno`) | **Só isto cai** — e só na opção B abaixo |
| "Dono do tile" | Nada a derrubar: não existe |
| Predicado "sem tile arável alcançável" (`semTrabalhoAoAlcance` → alerta `sem-campo`) | **Sobrevive intacto.** Ele pergunta ao MAPA quais tiles existem ao alcance; quem pôs o tile lá — gerador ou jogador — ele não sabe nem precisa saber |
| Ciclo arar → semear → colher → pousio (regime `porAcao`, `reposicao`) | **Sobrevive intacto** |
| Roceiro que sai do prédio até o tile (F-T3) | **Sobrevive intacto** |

O desenho da F18 aguenta a reversão melhor do que parecia: o que muda é **de onde nasce
o tile arável**, e nada do que acontece com ele depois.

### Duas opções, com o número de cada uma

**Opção A — o jogador desenha, e as manchas do mapa continuam valendo.**
`corn.terreno` fica. As 130 manchas seguem plantáveis; o jogador ganha o poder de criar
tile arável onde quiser. Custo de quebra: **zero teste**.

**Opção B — só o jogador cria campo.** `corn.terreno` sai; as manchas viram terreno
mudo. Custo **medido** (removi a chave, rodei a suíte inteira, reverti):
**16 arquivos de teste, 33 testes** de 94/1345 — F18 (3 arquivos), F19, F19b, F-T1,
F-T3 (2 arquivos + sonda), F03, F06, F08, F09, F11a, F16a, F22. Boa parte é fixture que
planta fazenda dentro da mancha e passaria a ter de desenhar o campo antes.

**Recomendação: A.** A mancha do mapa deixa de ser a única terra do mundo e passa a ser o
que devia ter sido desde sempre — terra já arada, um começo de graça. E o custo da
reversão cai a zero. Se o operador quiser B por coerência de ficção ("terra arada é
sempre obra de alguém"), o preço é o lote acima, e ele é mecânico, não conceitual.

### 1. O molde é a estrada, e ele de fato já está inteiro

| Peça | Onde | O que o campo reusa |
|---|---|---|
| Arrasto tile a tile, preenchendo buracos | `input/arrasto.ts`, `input/colocar.ts` | igual, com modo novo |
| Modo de ferramenta (`'estrada'`, `'demolir-estrada'`) | `input/ferramenta.ts` | +2 modos |
| Botão no menu Construir, com o custo escrito | `ui/menu-build.ts: montarFerramenta` | +2 botões |
| Comando de arrasto único (`PlaceRoad { tiles }`) | `sim/commands.ts` | `PlaceField { cultura, tiles }` |
| Recusa por terreno/recurso antes de aceitar | `sim/estradas.ts: canPlaceRoad` | mesma forma, com "onde se pode arar" vindo do dado |
| **Tile planejado no estado** (`estradasPlanejadas`) | `sim/state.ts`, `sim/estradas.ts` | `camposPlanejados` |
| **Laborer que vai até o tile e assenta** | `sim/systems/estradas.ts` (124 linhas), tarefa no JobBoard, FSM do laborer | laborer que vai até o tile e **ara** |
| Camada de render do tile planejado | `render/estradas.ts` (194 linhas) | camada análoga |
| Tile pronto aparece sozinho | `render/mapa.ts` desenha `state.recursos` por tipo, com cor do tema | **nada a fazer**: o tile arado nasce como recurso e a camada já o pinta |

**Tamanho honesto:** um módulo novo em `sim/` no talhe de `sim/estradas.ts` (541 linhas,
das quais o campo não precisa da parte de rede/conectividade — na ordem de metade), ~124
linhas de sistema, +1 campo obrigatório em `GameState` (custo medido na F18g: **2 sites**
pelo compilador, mais o `VERSAO_DO_SAVE`), e do outro lado ~200 linhas de render, 2
botões e 2 modos de input.

**Isso cruza `sim/` e `render/`, e por isso deve virar DOIS itens**, não um com nota de
integração: **(a)** o tile de campo na sim — comando, tile planejado, tarefa, laborer
arando, teste headless; **(b)** as duas ferramentas no menu — render/ui/input, com
roteiro Playwright e o gesto despausado da §8. É a mesma fronteira que a F08 e a F18d-2
já usaram.

### 4. Custo em material: a cana **não** depende da F18g

A premissa do pedido é que "material que sai do armazém para um tile é a tarefa com
destino-tile da F18g". **Conferido no código: não é.** Existem hoje **dois** caminhos já
publicados para cobrar material por tile, e nenhum carrega nada até o tile:

1. **O da estrada.** 1 stone por tile (`terrain.json: estrada.custoStonePorTile`). A
   tarefa **reserva** a pedra na gaveta `saida` de um armazém e **debita** quando o
   laborer assenta o tile (`sim/estradas.ts:404-442`). O laborer não carrega pedra.
2. **O do plantio.** `resources.json: tipos.<t>.reposicao.custo` é cobrado da gaveta
   **`entrada` do próprio prédio** no tick em que o plantio começa
   (`systems/especialistas.ts: iniciarPlantio`, linhas 270-305) — quem enche essa gaveta
   é o serf, pela tarefa normal de destino-**prédio**, que já existe. Hoje o custo do
   milho é `{}`, e o caminho está exercitado com custo injetado em
   `tests/F18-rocado.test.ts`.

Então: **o canavial não espera a F18g**. O 1 timber por tile cabe em qualquer um dos
dois — no (1) se quem paga é o laborer que ara, no (2) se é o canavial que replanta. A
nota que a própria F18 deixou em `production.json: wineyard` já aponta para o (2):
*"quando o Wineyard existir, a videira nasce com `colheita` de uva e `reposicao.custo:
{ timber: 1 }`"*.

**Mas a cana espera outra coisa, e essa é real:** o **Canavial não existe como
consumidor**. `production.json: wineyard` hoje é `entra: {}` / `sai: { wine: 0.5 }`,
**sem `colheita`** — ele fabrica cachaça do nada, em qualquer lugar. Criar a ferramenta
"terra de cana" agora produziria tiles que ninguém colhe, que é o padrão que o projeto já
recusou antes (dado sem leitor, evento sem consumidor).

**Portanto sim: entra só o milho agora** — mas o motivo não é a F18g, é o Canavial. A
ferramenta de cana entra junto com o item que der `colheita` ao Wineyard, e aí ela é uma
entrada de dado e um botão, não um sistema novo.

### 5. Mesmo tile com tipo diferente, ou dois recursos?

**Dois recursos distintos, um por cultura** — e a estrutura já obriga isso:

- `state.recursos[chave] = { tipo, quantidade }`: **um tile, um recurso**. A regra está
  escrita e é verificada no carregamento (`loader.ts` reprova dois tipos no mesmo tile e
  dois tipos derivando do mesmo terreno);
- cada cultura tem rendimento, tempo de reposição e custo próprios —
  `rendimentoPorTile`, `reposicao.segundos_base`, `reposicao.custo` — e os três são **por
  tipo** em `resources.json`. Milho e cana com números diferentes dentro do mesmo tipo
  não têm onde morar;
- a receita aponta para **um** recurso: `colheita.recurso`. O Roçado colhe `corn`; o
  Canavial colheria o outro id;
- o render já pinta uma cor por tipo de recurso: as duas culturas se distinguem de graça.

Sobre o **id neutro** (CLAUDE.md §9: id da sim em inglês, nome do tema em português): a
cultura da bebida no dado neutro é a **uva** (`wineyard`, `wine`), e é o tema que chama o
prédio de **Canavial** e a bebida de **Cachaça**. O coerente é o recurso nascer `grapes`,
com o tema escrevendo "Cana": trocar o id neutro para `cane` obrigaria a trocar
`wineyard` e `wine` junto, e isso é decisão de tema, não de mecânica. Fica como pergunta
ao operador.

**O que muda em `resources.json` para o milho:** sai `terreno: "campoArado"` (na opção B)
ou fica (na A); e entra o dado de **onde se pode arar** — a lista de terrenos permitidos
—, que hoje não existe porque ninguém criava campo.

---

## O que este plano NÃO decide

- **A ordem da fila.** A F21b era o próximo item; se o campo desenhado passa à frente, é
  decisão do operador.
- **Opção A ou B** (as manchas do mapa continuam valendo, ou não).
- **Id neutro da cultura da cachaça** (`grapes` vs `cane`).
