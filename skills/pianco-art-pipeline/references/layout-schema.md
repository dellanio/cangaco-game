# Layout de derivação

O arquivo JSON entregue a `process-sheet.mjs` usa caminhos relativos ao diretório de trabalho:

```json
{
  "source": "assets/base/folha/folha.png",
  "cells": [
    {
      "id": "tree",
      "crop": [0, 0, 384, 512],
      "output": "assets/sprites/vegetation/tree.png",
      "size": [96, 128],
      "contentSize": [88, 120],
      "bottomPadding": 4,
      "fit": "contain"
    }
  ]
}
```

`crop` é `[x, y, largura, altura]`. `fit` aceita `stretch` ou `contain`; `contain` preserva proporção e completa com transparência. `contentSize` é opcional e reduz o conteúdo antes de completar até `size`. `bottomPadding` reserva uma margem transparente inferior em pixels; use em sprites ancorados pelo pé para que o alfa não toque a borda do canvas.
