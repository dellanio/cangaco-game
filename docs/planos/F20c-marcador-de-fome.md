# F20c — Marcador de fome no mundo (render)

Item da fila: `BUILD_PLAN.md` → **F20c — Marcador de fome no mundo (render)**.
Aceite escrito, copiado sem mexer:

> Unidade acima do limiar **não** tem marcador; mesma unidade abaixo dele tem; e
> **screenshot** — é mudança de tela (§8). O roteiro roda pelo menos um passo
> despausado se tocar em `#hud` ou `#alertas`.

Camada: **só `src/render/`** (mais o tema, que é dado de tela, e o roteiro em
`tools/shots/`). A exceção da §10 escrita no item da F20 **não é usada**: nenhum
arquivo de `src/sim/` muda nesta feature.

## Fatos conferidos antes de escrever código (2026-09-25)

| Fato | Onde | Consequência |
|---|---|---|
| `emAlertaDeFome(unidade)` existe e o comentário já diz "é o leitor da F20c" | `src/sim/condicao.ts:125` | o predicado **não se recalcula** no render: reexporta-se |
| `fracaoDeCondicao(unidade)` é derivada, nunca guardada | `src/sim/condicao.ts:106` | é o número que a ponte publica para o roteiro afirmar |
| `limiares` cru (`alertaVisual: 0.35`) e `ticksNoLimiar` (4200) convivem em `GameData` | `src/sim/data/loader.ts:465-472` | o roteiro compara fração com a fração do dado; o teste prova que as duas contas coincidem |
| `unidades.ts` promete no cabeçalho não importar `sim/data`, e o guarda é textual por arquivo | `tests/F04-grid-ortogonal.test.ts:145-154` | importar `../sim/condicao` é legítimo (mesmo precedente de `../sim/selectors`) |
| `alertas.causas` do tema é guardado por igualdade com `CAUSAS_DE_ALERTA` | `tests/F22-alertas.test.ts:211` | o rótulo do marcador **não pode** entrar ali: `fome` não é causa de alerta hoje |
| A ponte publica `unidadesRenderizadas` e `avancar(n)` | `src/render/debug.ts:127,198` | campo novo em `UnidadeRenderizada` chega ao roteiro de graça |
| A vila de abertura **não tem Bodega** | `data/economy.json` (`estadoInicial.predios`) | todo civil drena de 12 000 até morrer; cruzar 4 200 é só avançar ticks |

## Decisões

- **D1 — o render não tem limiar.** `src/render/marcador-de-fome.ts` **reexporta**
  `emAlertaDeFome` como `temMarcadorDeFome`. Reexportação e não cópia: o teste
  afirma `temMarcadorDeFome === emAlertaDeFome` (identidade de função), então não
  existe segunda fonte de verdade para o 0,35 nem risco de uma das duas mudar só.
- **D2 — o marcador é de falha de abastecimento, não de "vai comer".** No dado,
  `alertaVisual` (0,35) está **abaixo** de `civilVaiComer` (0,50): quem acende o
  marcador já passou pelo limiar de ir comer e continua caindo. O teste afirma a
  ordem (⊂ de `precisaComer`) e que existe faixa com fome e **sem** marcador —
  se um dia o dado invertesse os dois números, isso reprova.
- **D3 — o rótulo vai em `marcadores` no tema, seção nova.** Não cabe em
  `alertas.causas` (guarda da F22 exige igualdade com `CAUSAS_DE_ALERTA`, e a
  causa `fome` não existe em `sim/`). Texto do jogador no tema, como manda a §9.
- **D4 — a causa `fome` no HUD fica FORA desta feature.** A Nota da F22 diz que
  "quem fizer F20 acrescenta causa em `CAUSAS_DE_ALERTA`, derivação em `temCausa`
  e o rótulo no tema" — isso é `src/sim/` + `src/ui/`, duas camadas que o item da
  F20c exclui por escrito ("Só `src/render/`"). Fica registrado no `PROGRESS.md`
  e como Nota no item, para o operador decidir posição na fila. Não improviso
  exceção da §10 que ninguém escreveu antes do código.
- **D5 — o marcador fica ACIMA do marcador de carga.** Um serf com fome
  carregando pão tem os dois; empilhar no mesmo y esconderia a carga, que é
  informação da F10. Alturas ficam nomeadas no módulo novo, e o teste afirma a
  ordem entre elas.

## Tarefas

1. `data/theme-sertao.json`: seção `marcadores`, com `fome.rotulo` e a cor vinda
   da paleta (`telha`, o vermelho de barro que já existe).
2. `src/render/marcador-de-fome.ts`: a reexportação de D1 e as duas alturas de D5.
3. `tests/F20c-marcador-de-fome.test.ts`: identidade da função, varredura de
   `condicao` de cheia a 0 (⊂ de `precisaComer`, faixa não vazia, equivalência
   exata entre a conta em tick e a conta em fração que o roteiro usa), ordem das
   alturas, e `test-output/F20c.json`.
4. `src/render/unidades.ts`: desenha o marcador e publica
   `marcadorDeFome` + `fracaoDeCondicao` em `UnidadeRenderizada`.
5. `tools/shots/F20c.js`: três fases — cheia (sem marcador), com fome e ainda sem
   marcador (D2), abaixo do limiar (com marcador) — mais um passo **despausado**
   provando que o marcador sobrevive ao redesenho do laço, e as capturas.
6. `npm run shot -- F20c`, `npm run verify`, `PROGRESS.md`, `test-results.json`,
   commit.

## Evidência

- `test-output/F20c.json` (teste headless) e `test-output/F20c-shot.json` (roteiro).
- `screenshots/F20c-*.png` — a mesma vila antes e depois do limiar.
