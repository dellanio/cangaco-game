# Diário de balanceamento

Observações sobre ritmo, custo e dificuldade. **Não são bugs** e não entram em
`BUGS.md`.

**Por que separado:** balanceamento corrigido um de cada vez nunca converge —
você ajusta o milho, quebra o pão, ajusta o pão, quebra a fome. Acumule dez
observações, ajuste os dez números juntos, rode o cenário longo uma vez.

Fechado o ciclo, arquive o lote e esvazie a seção de abertas.

---

## Modelo

```markdown
- [data] o que senti jogando | número suspeito | arquivo
- [2026-10-03] pedra acaba antes do 3º prédio | quarry 1.8/min parece baixo | production.json
```

---

## Observações abertas

- [2026-09-20] o bônus efetivo da estrada é 1,4 e não 1,30: estrada 5 ticks/tile, grama 7 (6,5 arredonda para 7)
  | `custoDeMovimento.grama` 1.30 a `tickHz` 10 e escala de movimento 2.0, com um único `Math.round`
  | data/terrain.json, data/time.json (não é bug do loader: é a granularidade de 10 Hz)
  | **decidido pelo operador: fica** — corrigir exigiria mudar `tickHz`, que mexe em tudo, e o excesso favorece a
  estrada, que é a direção certa. Só reabrir se `tickHz` mudar por outro motivo.
- [2026-09-20] 4 serfs levam 5538 ticks (~9 min a 1x) para entregar os 100 materiais de 20 obras de uma vez
  | logística lenta se o jogador planta muitas obras juntas; layout sintético do teste de carga, não partida
  | data/units.json (velocidade a pé 1.0 tile/s) e o número de serfs treinados
- [2026-09-22] com várias obras plantadas e NENHUM material entregue ainda, os laborers acabam todos na ÚLTIMA obra
  plantada, depois de um tempo | sugere que largam a tarefa no meio e reclamam outra — `esperando_material` é o
  único estado que libera (`'pedido-da-unidade'`, que reabre), e sem material nenhuma obra é trabalhável
  | src/sim/systems/laborers.ts, data/construcao.json (`laborersMaximosPorObra`)
  | **verificar na F17**, com estradas e serfs entregando de verdade, ANTES de decidir qualquer regra de
  prioridade — pode desaparecer sozinho quando houver material. Observação do operador; não confirmada por
  execução minha.
- [2026-09-22] o veio da Quarry rende 200 pedras: ~33400 ticks, ~55 min de produção contínua na escala 2.0
  | `quarry.veio.rendimento` 200, número de PARTIDA aprovado pelo operador, nunca medido em partida
  | data/production.json
  | **calibrar na F15b**, junto com o resto do lote. A referência é o original: constroem-se várias pedreiras e
  elas se esgotam ao longo da partida — se uma só durar a partida inteira, o número está alto. Aprovado como
  ponto de partida, não como valor final.

---

## Ciclos fechados

_(nenhum ainda)_

---

## Oráculo de calibração

Antes de mexer em qualquer taxa, rode o cenário longo e confira contra as
proporções da seção 4.5 do GDD. Um cenário que as respeite **não pode**:

- acumular fila infinita em nenhum prédio
- deixar trabalhador ocioso por muito tempo
- ter `saida_cheia` persistente (isso é logística, não produção — a correção é
  mais serfs ou mais estrada, não mexer na taxa)
