# Catálogo visual dos 28 prédios

Ids, nomes e footprints vêm de `data/buildings.json` e `data/theme-sertao.json`. Parede/cobertura/objeto são **propostas de direção de arte** para o portão zero, sujeitas à inspeção no zooms 0,5 / 1 / 2; não representam assets aprovados.

## Famílias

- Parede: `P1` tábuas verticais escuras; `P2` taipa caiada branca; `P3` taipa caiada ocre; `P4` pedra bruta; `P5` troncos empilhados; `P6` adobe cru; `P7` tijolo cerâmico aparente. Alternativas se a função pedir: pau-a-pique com estrutura aparente ou pedra caiada.
- Cobertura: `C1` telha colonial terracota; `C2` telha colonial clara; `C3` telha colonial escura; `C4` sapê claro; `C5` palha marrom escura. São **cinco** famílias na lista fornecida.

| id | Nome | Tiles | Parede | Cobertura | Objeto funcional dominante |
| --- | --- | --- | --- | --- | --- |
| `storehouse` | Armazém | 3×3 | P1 | C3 | sacos e caixas empilhados |
| `schoolhouse` | Casa do Coronel | 3×3 | P2 | C1 | varanda de entrada e mesa de ordens |
| `inn` | Bodega | 4×3 | P3 | C1 | barril e balcão externo |
| `quarry` | Pedreira | 3×2 | P4 | C4 | bloco de corte e talha |
| `woodcutters` | Casa do Lenhador | 3×2 | P5 | C5 | tora e cepo de machado |
| `watchtower` | Torre de Pedra | 2×2 | P4 | C3 | plataforma de vigia e bandeira |
| `sawmill` | Serraria | 4×2 | P1 | C5 | serra grande e pilha de tábuas |
| `farm` | Roçado de Milho | 4×3 | P6 | C4 | fileiras de milho e paiol |
| `wineyard` | Canavial | 3×2 | P6 | C4 | colmos de cana e feixe cortado; sem parreira |
| `fishermans` | Casa do Pescador | 3×2 | P1 | C5 | rede de pesca e canoa |
| `gold_mine` | Garimpo | 2×1 | P4 | C5 | entrada da cava e bateia |
| `coal_mine` | Jazida de Carvão | 3×2 | P4 | C3 | pilha grande de carvão negro junto à boca; calha secundária |
| `iron_mine` | Mina de Ferro | 3×1 | P4 | C3 | pilha grande de minério ferruginoso junto à boca; guincho secundário |
| `weapons_workshop` | Casa de Armas de Madeira | 4×2 | P1 | C5 | cavalete de armas de madeira |
| `barracks` | Quartel do Bando | 4×4 | P4 | C3 | pátio de treino e bandeira |
| `marketplace` | Feira | 4×3 | P1 | C4 | bancas e toldo de feira |
| `mill` | Moinho | 3×3 | P7 | C1 | mó ou roda de moagem grande |
| `bakery` | Padaria | 3×3 | P2 | C1 | forno de barro e chaminé |
| `swine_farm` | Malhada | 4×3 | P6 | C5 | cercado e cocho de bode; sem porco |
| `stables` | Cocheira | 4×3 | P5 | C5 | amarra de cavalo e cocho |
| `butchers` | Casa de Carne | 3×3 | P3 | C1 | mesa de corte e carne de sol |
| `tannery` | Curtume | 3×2 | P6 | C4 | couro estendido em varais |
| `armory_workshop` | Casa do Gibão | 3×3 | P3 | C2 | gibão de couro pendurado |
| `metallurgists` | Fundição | 3×3 | P7 | C3 | forno alto e cadinho |
| `town_hall` | Mercenários | 4×3 | P4 | C2 | quadro de contratação e bandeira |
| `iron_smithy` | Forja | 4×2 | P7 | C3 | bigorna e brasa da forja |
| `weapon_smithy` | Ferraria | 4×2 | P7 | C3 | suporte de lâminas e bigorna |
| `armor_smithy` | Casa do Ferro | 4×3 | P7 | C2 | suporte de proteção de ferro e bigorna |

Para funções parecidas, o objeto funcional e a silhueta precisam diferir no primeiro olhar. Texto do nome fica na UI, nunca pintado no sprite. As facções compartilham a construção; apenas lenço/bandeira mudam de cor.
