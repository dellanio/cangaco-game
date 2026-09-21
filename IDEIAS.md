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
- Estrada diagonal, fidelidade ao original — exige interpolação diagonal no arrasto, render
  inclinado e isConnected com 8 vizinhos sem cortar quina. (O GDD §5.4 traz "estradas diagonais
  funcionam se nada bloquear a passagem" **[fonte]**; a Fase A fica em 4 direções por decisão do
  operador. Ao adotar: o A\* por estrada da F10 só liga o que `isConnected` liga, e o teste de
  equivalência em `tests/F10-astar.test.ts` prende os dois — mudar um exige mudar o outro.)
