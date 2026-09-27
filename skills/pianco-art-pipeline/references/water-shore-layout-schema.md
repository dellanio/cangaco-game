# Layout de margens d'água

O `process-water-shores.mjs` deriva 16 PNGs transparentes, um para cada máscara
cardinal N/L/S/O. O bit `1` é norte, `2` leste, `4` sul e `8` oeste. A margem
fica dentro do tile de água; o miolo continua vindo das variantes de água.

```json
{
  "source": "assets/base/terrain-atlas/terrain-atlas-source.png",
  "sourceCrop": [6, 368, 350, 350],
  "outputDir": "assets/sprites/terrain/water-shore",
  "preview": "screenshots/water-shore-preview.png",
  "previewBackground": "assets/sprites/terrain/agua.png",
  "size": 64,
  "shoreWidth": 11,
  "feather": 3
}
```

`source` fornece o material da margem e `sourceCrop` limita a região amostrada.
`shoreWidth` controla quanto a praia avança sobre a água; `feather` controla a
transição irregular do alfa. Sempre abra o preview 4×4 e depois o lago real.
