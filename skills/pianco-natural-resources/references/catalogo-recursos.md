# Terrenos e fontes existentes

Inventário conferido em `data/theme-sertao.json` e `data/resources.json`. As cores e nomes são dados existentes; sugestões de forma são direção visual, não assets aprovados.

## Seis terrenos

| Id | Cor base | Leitura visual sugerida |
| --- | --- | --- |
| `grama` | `#5E6B4F` | cobertura rala da caatinga |
| `campoArado` | `#6B4A2E` | sulcos de roçado paralelos |
| `areia` | `#C9974B` | grão e pequenas ondulações |
| `agua` | `#3C6E8F` | lâmina com linhas curtas de corrente |
| `rocha` | `#8A8175` | laje e fendas angulares |
| `montanha` | `#5C544B` | maciço com estratos expostos |

## Oito fontes exploráveis

| Id neutro | Leitura regional | Mercadoria relacionada, quando aplicável |
| --- | --- | --- |
| `rock` | pedra aflorada | `stone` = Pedra |
| `tree` | árvore cortável | `tree_trunk` = Tora; `timber` = Tábua |
| `fish` | cardume/água de pesca | `fish` = Peixe |
| `corn` | milho em roçado | `corn` = Milho; `flour` = Fubá; `loaves` = Cuscuz |
| `grapes` | **cana-de-açúcar**, sem videira | `grapes` = Cana; `wine` = Cachaça |
| `coal` | veio escuro de carvão | `coal` = Carvão |
| `iron_ore` | minério de ferro | `iron_ore` = Minério; `iron` = Ferro |
| `gold_ore` | veio de ouro | `gold_ore` = Ouro bruto; `gold` = Dinheiro |

Mantenha a distinção entre fonte no mapa, item carregado e mercadoria processada. O nome regional aparece na UI; não escreva palavras dentro do sprite.
