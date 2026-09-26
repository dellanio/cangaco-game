# Mapa de construções e profissões

> **Documento gerado.** Não edite à mão: rode `npm run docs:mapa`.
> Fonte: `data/buildings.json`, `data/production.json`, `data/units.json` e
> `data/theme-sertao.json`. Estrutura e número saem do dado; nome sai do tema.

**28 prédios, 14 profissões civis** — 12 ocupam prédio,
2 não ocupam nenhum (Carregador e Obreiro).

---

## 1. Árvore de desbloqueio

Cada prédio libera os filhos quando fica pronto (`desbloqueadoPor`).

```
Armazém  (storehouse)
├─ Casa do Coronel  (schoolhouse)
│  ├─ Pedreira  (quarry)
│  │  └─ Torre de Pedra  (watchtower)
│  └─ Casa do Lenhador  (woodcutters)
│     └─ Serraria  (sawmill)
│        ├─ Roçado de Milho  (farm)
│        │  ├─ Moinho  (mill)
│        │  │  └─ Padaria  (bakery)
│        │  ├─ Malhada  (swine_farm)
│        │  │  ├─ Casa de Carne  (butchers)
│        │  │  └─ Curtume  (tannery)
│        │  │     └─ Casa do Gibão  (armory_workshop)
│        │  └─ Cocheira  (stables)
│        ├─ Canavial  (wineyard)
│        ├─ Casa do Pescador  (fishermans)
│        ├─ Garimpo  (gold_mine)
│        │  └─ Fundição  (metallurgists)
│        │     └─ Mercenários  (town_hall)
│        ├─ Jazida de Carvão  (coal_mine)
│        ├─ Mina de Ferro  (iron_mine)
│        │  └─ Forja  (iron_smithy)
│        │     ├─ Ferraria  (weapon_smithy)
│        │     └─ Casa do Ferro  (armor_smithy)
│        ├─ Casa de Armas de Madeira  (weapons_workshop)
│        ├─ Quartel do Bando  (barracks)
│        └─ Feira  (marketplace)
└─ Bodega  (inn)
```

**Arestas de volta** — dependências que o desenho acima não mostra, porque
apontam para quem já apareceu:

- **Armazém** (`storehouse`) requer **Serraria** — o primeiro
  nasce pronto no cenário; um segundo precisa do pai.

---

## 2. Os prédios

Tábua e Pedra são o custo de construção. Entra/Sai em **unidades por minuto**
na escala 1.0 (`production.json`), antes do multiplicador de tempo.

| Prédio | id | Tam | Tábua | Pedra | HP | Requer | Trabalhador | Entra | Sai |
|---|---|---|---|---|---|---|---|---|---|
| Armazém | `storehouse` | 3x3 | 6 | 5 | 550 | Serraria | — | — | — |
| Casa do Coronel | `schoolhouse` | 3x3 | 6 | 5 | 550 | Armazém | — | — | — |
| Bodega | `inn` | 4x3 | 6 | 5 | 550 | Armazém | — | — | — |
| Pedreira | `quarry` | 3x2 | 3 | 2 | 250 | Casa do Coronel | Cabra da Pedreira | — | Pedra 1.8 |
| Casa do Lenhador | `woodcutters` | 3x2 | 3 | 2 | 250 | Casa do Coronel | Lenhador | — | Tora 0.55 |
| Torre de Pedra | `watchtower` | 2x2 | 3 | 2 | 250 | Pedreira | Aprendiz | — | — |
| Serraria | `sawmill` | 4x2 | 4 | 3 | 350 | Casa do Lenhador | Carpina | Tora 1.1 | Tábua 2.2 |
| Roçado de Milho | `farm` | 4x3 | 4 | 3 | 350 | Serraria | Roceiro | — | Milho 3 |
| Canavial | `wineyard` | 3x2 | 4 | 3 | 350 | Serraria | Roceiro | — | Cachaça 0.5 |
| Casa do Pescador | `fishermans` | 3x2 | 4 | 3 | 350 | Serraria | Pescador | — | Peixe 1 |
| Garimpo | `gold_mine` | 2x1 | 3 | 2 | 250 | Serraria | Mineiro | — | Ouro bruto 1 |
| Jazida de Carvão | `coal_mine` | 3x2 | 3 | 2 | 250 | Serraria | Mineiro | — | Carvão 1.2 |
| Mina de Ferro | `iron_mine` | 3x1 | 3 | 2 | 250 | Serraria | Mineiro | — | Minério 1 |
| Casa de Armas de Madeira | `weapons_workshop` | 4x2 | 4 | 3 | 350 | Serraria | Carpina | Tábua 1.6 | Facão 0.8, Aguilhada 0.8, Bodoque 0.8 |
| Quartel do Bando | `barracks` | 4x4 | 6 | 6 | 600 | Serraria | — | — | — |
| Feira | `marketplace` | 4x3 | 6 | 5 | 550 | Serraria | — | — | — |
| Moinho | `mill` | 3x3 | 4 | 3 | 350 | Roçado de Milho | Forneiro | Milho 1.22 | Fubá 1.22 |
| Padaria | `bakery` | 3x3 | 4 | 3 | 350 | Moinho | Forneiro | Fubá 1.22 | Cuscuz 2.44 |
| Malhada | `swine_farm` | 4x3 | 4 | 3 | 350 | Roçado de Milho | Criador | Milho 2 | Bode 0.5, Couro cru 0.5 |
| Cocheira | `stables` | 4x3 | 6 | 5 | 550 | Roçado de Milho | Criador | Milho 2 | Cavalo 0.5 |
| Casa de Carne | `butchers` | 3x3 | 4 | 3 | 350 | Malhada | Carneador | Bode 1.5 | Carne de sol 4.5 |
| Curtume | `tannery` | 3x2 | 4 | 3 | 350 | Malhada | Carneador | Couro cru 0.5 | Couro 1 |
| Casa do Gibão | `armory_workshop` | 3x3 | 4 | 3 | 350 | Curtume | Carpina | Couro 1, Tábua 1 | Gibão de couro 1, Chapéu de aba 1 |
| Fundição | `metallurgists` | 3x3 | 4 | 3 | 350 | Garimpo | Fundidor | Ouro bruto 0.5, Carvão 0.5 | Dinheiro 1 |
| Mercenários | `town_hall` | 4x3 | 6 | 5 | 550 | Fundição | — | — | — |
| Forja | `iron_smithy` | 4x2 | 4 | 3 | 350 | Mina de Ferro | Fundidor | Minério 1, Carvão 1 | Ferro 1 |
| Ferraria | `weapon_smithy` | 4x2 | 4 | 3 | 350 | Forja | Ferreiro | Ferro 0.8, Carvão 0.8 | Peixeira 0.8, Ferrão 0.8, Bacamarte 0.8 |
| Casa do Ferro | `armor_smithy` | 4x3 | 4 | 3 | 350 | Forja | Ferreiro | Ferro 0.8, Carvão 0.8 | Gibão reforçado 0.8, Peitoral de couro cru 0.8 |

---

## 3. As profissões, e quem sai do prédio

Quem **colhe** sai para o mapa; quem **transforma** fica dentro, porque o
insumo chega pelo carregador.

> A coluna "Onde trabalha" é **decisão de arquitetura**, não campo de dado:
> vem de `docs/planos/recursos-naturais-proposta.md` (operador, 2026-09-24) e
> está declarada em `tools/gerar-mapa-construcoes.js`. Nenhum dos recursos
> naturais existe no mapa hoje.

| Profissão | id | Prédios | Onde trabalha | Recurso natural |
|---|---|---|---|---|
| Cabra da Pedreira | `stonemason` | Pedreira | **FORA** do predio | rocha no mapa |
| Lenhador | `woodcutter` | Casa do Lenhador | **FORA** do predio | arvore no mapa |
| Carpina | `carpenter` | Serraria, Casa de Armas de Madeira, Casa do Gibão | dentro | — |
| Roceiro | `farmer` | Roçado de Milho, Canavial | **FORA** do predio | campo arado (milho, cana) |
| Forneiro | `baker` | Moinho, Padaria | dentro | — |
| Criador | `animal_breeder` | Malhada, Cocheira | dentro | — |
| Carneador | `butcher` | Casa de Carne, Curtume | dentro | — |
| Pescador | `fisherman` | Casa do Pescador | **FORA** do predio | agua |
| Mineiro | `miner` | Garimpo, Jazida de Carvão, Mina de Ferro | **FORA** do predio | veio na serra |
| Fundidor | `metallurgist` | Fundição, Forja | dentro | — |
| Ferreiro | `blacksmith` | Ferraria, Casa do Ferro | dentro | — |
| Aprendiz | `recruit` | Torre de Pedra | dentro | — |

Fora da tabela, porque não ocupam prédio:

| Profissão | id |
|---|---|
| Carregador | `serf` |
| Obreiro | `laborer` |

---

## 4. Cadeias de produção

Da extração ao bem que ninguém mais consome. Derivadas do grafo `entra`/`sai`
de `production.json`.

- Pedreira → **Pedra**
- Casa do Lenhador → Tora → Serraria → Tábua → Casa do Gibão → **Gibão de couro + Chapéu de aba**
- Casa do Lenhador → Tora → Serraria → Tábua → Casa de Armas de Madeira → **Facão + Aguilhada + Bodoque**
- Roçado de Milho → Milho → Moinho → Fubá → Padaria → **Cuscuz**
- Roçado de Milho → Milho → Malhada → Bode → Casa de Carne → **Carne de sol**
- Roçado de Milho → Milho → Malhada → Couro cru → Curtume → Couro → Casa do Gibão → **Gibão de couro + Chapéu de aba**
- Roçado de Milho → Milho → Cocheira → **Cavalo**
- Canavial → **Cachaça**
- Casa do Pescador → **Peixe**
- Garimpo → Ouro bruto → Fundição → **Dinheiro**
- Jazida de Carvão → Carvão → Fundição → **Dinheiro**
- Jazida de Carvão → Carvão → Forja → Ferro → Ferraria → **Peixeira + Ferrão + Bacamarte**
- Jazida de Carvão → Carvão → Forja → Ferro → Casa do Ferro → **Gibão reforçado + Peitoral de couro cru**
- Jazida de Carvão → Carvão → Ferraria → **Peixeira + Ferrão + Bacamarte**
- Jazida de Carvão → Carvão → Casa do Ferro → **Gibão reforçado + Peitoral de couro cru**
- Mina de Ferro → Minério → Forja → Ferro → Ferraria → **Peixeira + Ferrão + Bacamarte**
- Mina de Ferro → Minério → Forja → Ferro → Casa do Ferro → **Gibão reforçado + Peitoral de couro cru**
