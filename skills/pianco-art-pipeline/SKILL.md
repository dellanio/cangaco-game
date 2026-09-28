---
name: pianco-art-pipeline
description: Cria, deriva, integra e valida sprites, tiles, vegetação, recursos, prédios e peças de UI do jogo Piancó. Use sempre que uma tarefa adicionar ou alterar arte raster do projeto; não use para regras de simulação.
---

# Piancó Art Pipeline

Produza arte que pareça pertencer ao mesmo jogo, não apenas imagens bonitas isoladas.

## Antes de gerar

1. Leia `CLAUDE.md`, `docs/GDD.md` §9, `assets/manifest.json` e [references/art-contract.md](references/art-contract.md).
2. Identifique o id neutro, o uso no render, o footprint e a dimensão derivada.
3. Para prompts novos ou correções de uma folha, leia [references/prompt-recipes.md](references/prompt-recipes.md).
4. Use `imagegen` com referências canônicas do próprio projeto. Screenshots e mockups servem para composição; nunca viram o asset final.

## Contrato de saída

- Guarde a geração original em `assets/base/<id>/`.
- Guarde somente derivados consumidos em `assets/sprites/<id>/`.
- Registre cada derivado em `assets/manifest.json` com dimensão real, licença e base.
- Terreno é quadrado ortogonal 64×64; nunca losango ou cenário isométrico.
- Sprites de pé têm fundo transparente, pé no centro inferior, luz superior esquerda e sombra inferior direita.
- UI usa PNG para madeira, pergaminho, rebites e ornamentos. CSS limita-se a layout, recorte, estados e acessibilidade.
- Texto visível em HTML vem de `data/theme-sertao.json`. Texto incorporado em imagem só entra quando a peça aprovada exige lettering fixo.

## Derivação

Prefira folhas com células regulares. Crie um JSON de layout e rode:

```text
node skills/pianco-art-pipeline/scripts/process-sheet.mjs <layout.json>
```

O script recorta, redimensiona, cria diretórios e reprova dimensão divergente. O formato do layout está em [references/layout-schema.md](references/layout-schema.md).

Para ícones em xilogravura sobre papel, remova o fundo do papel e derive PNGs
transparentes com o processador de tinta:

```text
node skills/pianco-art-pipeline/scripts/process-ink-icons.mjs <layout.json>
```

O layout aceita `source`, `output`, `size`, `padding`, `threshold`, `softness`
e `ink`; use `mode: "rgba"` apenas para redimensionar uma fonte que já possui
transparência, como uma logomarca pronta.

Para estradas ortogonais, derive as 16 conexoes cardinais e a ponte diagonal a
partir de uma unica textura canonica:

```text
node skills/pianco-art-pipeline/scripts/process-road-tiles.mjs <layout.json>
```

O processador cria PNGs transparentes, preserva largura nas bordas dos tiles e
gera uma contact sheet sobre o terreno real para o portao visual.

Para margens d'agua ortogonais, derive as 16 mascaras cardinais de praia sobre
o miolo de agua existente:

```text
node skills/pianco-art-pipeline/scripts/process-water-shores.mjs <layout.json>
```

O formato esta em
[references/water-shore-layout-schema.md](references/water-shore-layout-schema.md).

Para outras transicoes ortogonais de terreno, derive 16 sobreposicoes
transparentes da textura que invade o tile-base:

```text
node skills/pianco-art-pipeline/scripts/process-terrain-edges.mjs <layout.json>
```

Para o lajedo, derive o estado de fallback e as 16 mascaras de conexao a partir
do afloramento canonico. O recorte seguro remove ornamentos isolados antes de
variar escala e deslocamento para dentro do aglomerado:

```text
node skills/pianco-art-pipeline/scripts/process-rock-autotile.mjs <layout.json>
```

Depois de derivar, registre o lote de forma idempotente:

```text
node skills/pianco-art-pipeline/scripts/register-layout.mjs predio <layout...>
node skills/pianco-art-pipeline/scripts/register-layout.mjs unidade <layout...>
node skills/pianco-art-pipeline/scripts/register-layout.mjs recurso <layout...>
```

O registrador cruza ids com `data/buildings.json` ou `data/units.json`, lê a dimensão do PNG e substitui somente a entrada de mesmo tipo e id.

## Portões

1. Abra a folha derivada ou contact sheet; alfa e dimensão não provam qualidade visual.
2. Para terreno, monte pelo menos uma matriz 3×3 e rejeite costura, vinheta, foco ou repetição gritante.
3. Para sprite, confira silhueta, pé, escala e halo sobre um tile real.
4. Rode `npm run verify` antes de cada commit e os roteiros `npm run shot` que mostram a arte.
5. Commit pequeno por categoria: pipeline, terreno/recursos, UI, prédios ou unidades.

Nunca altere `src/sim/` para acomodar arte. Se o asset não puder ser integrado sem mudar regra, mantenha o fallback e registre a lacuna.
