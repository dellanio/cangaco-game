# Ideias congeladas

Tudo que não está no `BUILD_PLAN.md` mora aqui até a **Fase A fechar**.

Isto não é uma lista de espera educada, é um mecanismo de defesa. O que mata
projeto solo de jogo não é dificuldade técnica: é perder o fôlego antes da
primeira partida jogável, geralmente porque uma ideia boa entrou no meio do
caminho. Ideia boa é justamente a mais perigosa.

**Regra:** nada sai deste arquivo antes de `F17-aceite-fase-a` estar em `true`.

---

## Congeladas

- Elevação de terreno (existe no original; a regra de altura está na seção 9 do GDD)
- Multiplayer
- Geração procedural de mapa
- Campanha com missões encadeadas
- Editor de mapas
- 8 direções para civis (hoje são 4; ver guia de estilo)
- Sistema de reputação entre os dois bandos
- Terreno de mapa variado (água/lago, rocha, veio na montanha) — falta uma
  feature de terreno antes da F11: quem produz o mapa, o formato do dado, o
  render e o motivo `'terreno'` de `canPlace`. Dependem dela o Fisherman's
  (lago), as minas (veio) e a estrada (solo transponível). O formato do dado deve
  nascer junto de quem o produz, não antes. Decisão de fila é do operador.
