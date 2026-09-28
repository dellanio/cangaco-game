# Plano — C10: a exceção de largura por prédio no dado (fila do operador, item 10)

Decisão do operador: *"a exceção de largura vira dado, como a de altura."* Hoje só a altura
tem regra (F-ESC: `regraDeAltura.k` no manifesto, exceção em `alturaMaxPorLargura`). A
largura desenhada não tem teto, e nada acusa quando passa do lote.

## Medido (só o manifesto, nenhuma imagem aberta)
Largura do arquivo ÷ largura do lote (`footprint[0] × tile_px`, tile de 64): só dois prédios
passam de 1,0.
- `storehouse` (armazém): 214 ÷ 192 = 1,1146.
- `schoolhouse` (Casa do Coronel): 214 ÷ 192 = 1,1146.

## A regra (simétrica à da altura)
- **Manifesto:** `regraDeLargura.k = 1,0` e exceção por prédio em `larguraMaxPorLote`.
- **Render (`escala-predio.ts`):** a escala do sprite passa a ser o mínimo de três
  valores: pela largura do lote (a de hoje), pela altura (F-ESC) e pelo teto de largura
  (`larguraMaxPorLote` ou k).
- **Verificação:** `violacoesDaLargura` acusa `largo-sem-excecao` (passa de k sem exceção) e
  `excecao-morta` (declara exceção e cabe em k). O teste reprova nas duas.
- **Os dois de hoje ganham exceção de 1,12**, o transbordo que já têm arredondado para
  cima. A tela não muda. A decisão de encolher (tirar a exceção) é do operador (PARA
  REVISÃO).
- **Roteiro F-ESC:** passa a afirmar também `largura desenhada ≤ teto × lote`.

## Aceite
- (a) O manifesto real não tem violação de largura nem de altura.
- (b) Sintético: o prédio largo sem exceção acusa `largo-sem-excecao`; a exceção que cabe em
  k acusa `excecao-morta`.
- (c) `escalaDoSprite` encolhe o sprite largo demais para exatamente `k × lote` de largura,
  sem deformar. O armazém e a escola continuam na escala de antes.
- (d) Tela: o `npm run shot -- F-ESC` afirma a largura de cada prédio contra o teto.
