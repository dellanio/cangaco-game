# C-COMBATE-01b — storm attack (sim)

Fila do operador, item 1. O critério do BUILD_PLAN: "Comando `StormAttack { unidades }`. Só a
`stormAttack.apenas` carrega, em linha reta para a frente, a `multiplicadorVelocidade`, por
uma distância sorteada no RNG do estado entre `distancia_tiles.min` e `.max`, incontrolável
até acabar."

Só `src/sim/` e `data/`: a §10 não se aplica. A tela (o botão Storm) é a C-COMBATE-01c.

## O desenho

1. **O comando** `StormAttack { unidades }` vai em `commands.ts`.
   - É recusado INTEIRO (`command-rejected`, com `MotivoDeRecusaDeCarga`) nos mesmos casos
     da marcha: `sem-unidades`, `unidade-inexistente`, `unidade-nao-militar` e
     `lados-diferentes`.
   - Tem um motivo próprio, `sem-infantaria-corpo-a-corpo`: nenhuma unidade da lista pode
     carregar.
   - Quem não pode carregar (atirador, montado) ou já está em carga fica como está. Os
     outros carregam.
2. **Quem carrega** é `carregaNaInvestida(tipo)`, que lê `stormAttack.apenas`.
   `infantariaCorpoACorpo` é o militar que não atira (`aDistancia`) e não é `montado`.
   `tools/data-rules.js` só aceita esse valor.
3. **A direção** é a do primeiro da lista, o líder: é a frente da formação, e todos
   carregam para ela (PARA REVISÃO: no KaM a direção é a do grupo). A distância, em
   tiles, é sorteada por unidade, na ordem da lista, com `nextInt(state.rng, min, max + 1)`.
4. **A FSM `em_carga`** fica em `systems/carga.ts`, no sistema que roda depois da marcha e
   antes da luta. `fsmData` guarda `caminho` e `progresso` (o passo em curso),
   `cargaRestante` e `cargaDirecao`. No centro do tile:
   - com o restante em 0, a carga acaba e a unidade fica ociosa, virada para a frente;
   - se o tile à frente não é `passoAndavel` ou tem militar, a carga acaba também. Parada
     e encostada num inimigo, a luta da C6 a pega como a qualquer ocioso;
   - senão, `caminho` vira `[à frente]` e o passo começa.
5. **O passo** custa `max(1, round(custoDoPasso / multiplicadorVelocidade))`, em
   `custoDoPassoDaUnidade`.
   - `posicaoDaUnidade` usa a mesma função, para o desenho interpolar na velocidade certa.
   - É um multiplicador sobre um inteiro de ticks já convertido, aplicado com a mesma
     conta nos dois lados. PARA REVISÃO: não é conversão de escala de tempo.
6. **A luta.** Em carga, o corpo a corpo encostado num inimigo, no centro do tile, passa a
   lutar, como a marcha da C6 (no KaM, a carga para no inimigo). A carga não volta depois.
7. **Incontrolável.** Com `stormAttack.incontrolavel`, `MoveUnits`, `AttackUnit` e
   `AttackBuilding` pulam quem está `em_carga`. Os outros da lista cumprem a ordem.
8. **A paz** recusa `StormAttack` com `em-paz`. O `BLOCKED_BY_PEACETIME` do KaM tem storm.
   PARA REVISÃO: o operador liberou a marcha em paz, mas storm é ordem de ataque.
9. **A colisão:** `em_carga` fica `fora`, em `POSICAO_DO_ESTADO`.

## Aceite

`tests/C-COMBATE-01b-storm.test.ts`, na escaramuça, com a paz tirada do estado:
1. A tropa carrega em linha reta na direção do líder. Cada homem anda entre `min` e `max`
   tiles, todos na mesma linha, e para ocioso.
2. O passo da carga é mais curto que o da marcha no mesmo terreno, pela razão do dado:
   N ticks por tile contra M, com M/N ≈ `multiplicadorVelocidade`.
3. Durante a carga, `MoveUnits` não muda quem está em carga.
4. O atirador na lista não carrega. Uma lista só de atiradores é recusada com
   `sem-infantaria-corpo-a-corpo`.
5. Encostado num inimigo, o homem em carga passa a lutar.
6. Em paz, a ordem é recusada com `em-paz`.
7. O sorteio vem do RNG do estado: duas corridas dão o mesmo estado, e o `rng` avança.

Não-regressão:
- `npm run verify`;
- os roteiros C-TELA-03, C-IA-03c e F26b, conferindo o código de saída.

**Herda para a C-COMBATE-01c:**
- `StormAttack` entra em `ORDENS_MILITARES` (`ui/aviso-de-ordem.ts`), para o aviso da paz;
- o motivo `sem-infantaria-corpo-a-corpo` precisa de texto no tema.
