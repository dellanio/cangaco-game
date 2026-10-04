# Estilo escolhido — D (2026-09-30)

O operador escolheu o `storehouse front` da segunda geração D como referência visual canônica do Piancó. A unidade de referência é o `serf` D sem chapéu da segunda geração. Estas imagens são **âncoras de estilo**, ainda não sprites de produção registrados no manifesto. Foram geradas pela ferramenta nativa nesta etapa, sem usar imagens antigas do jogo ou de terceiros como referência.

| Referência | Arquivo aprovado | SHA-256 | Candidato de origem |
| --- | --- | --- | --- |
| Prédios | `storehouse-front-D.png` | `346CB7F6BC6FE9C280B013FDB3F987357C3DC1E31CCD9D002910291602D7AA0E` | `candidatos/D/storehouse/generation-02-raw.png` |
| Unidades | `serf-D.png` | `FEDFF0844E59D9DAF34463FE4C91D4B0F1A4BE2C8F40C05F94854BD413785F02` | `candidatos/D/serf/generation-02-raw.png` |

Para novas gerações, anexe a referência escolhida da categoria por `referenced_image_paths`. Para vegetação e recursos, use a referência ou combinação necessária para manter materiais, luz e pincelada coerentes. Não use `candidatos/_descartadas_contaminadas/` nem sprites antigos do jogo como referência.

## Projeção obrigatória dos prédios

Todos os prédios novos usam o mesmo top-down 3/4 **oblíquo**. `front` descreve o lado de entrada voltado ao sul no mapa, não uma fachada plana vista à altura dos olhos. O desenho deve mostrar o plano superior do telhado, a fachada sul e um plano lateral perceptível. O footprint continua ortogonal em tiles quadrados; não desenhe chão ou base em losango isométrico. Preserve direção fixa da câmera, escala, anchor e porta alinhada ao tile de entrada. A referência de leitura é a sensação de RTS clássico citada pelo operador; não copie arte, geometria ou composição específica de outro jogo.

## Situação da homologação

O operador aprovou **a direção visual** D. As cenas candidatas de `storehouse` passaram no validador em modo de ensaio, sem calibração cromática, e não foram registradas em `assets/manifest.json`. Falta calibrar limites cromáticos por região com piloto multivista e realizar revisão independente antes de homologar sprites de produção.
