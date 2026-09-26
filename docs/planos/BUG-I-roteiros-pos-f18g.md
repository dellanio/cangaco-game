# Plano — BUG-I: os quatro roteiros quebrados pela F18g

> Pedido do operador em 2026-09-26: corrigir a asserção sem mudar o que ela prova. Se
> alguma afirmar a REGRA em vez do número, registrar e dizer no relatório.

## A causa de cada um (medida com cópias `zz-diag-*` do roteiro, porta 5177)

| Roteiro | O que falha | Causa medida | Afirma regra ou número? |
|---|---|---|---|
| F10 | "no fim a rua deveria estar toda de pe, veio 0 e 11" | o laço do passo 5 sai quando o HUD chega ao valor final; antes da F18g a pedra só saía no assentamento, então "HUD final" implicava "rua de pé". Desde a F18g a pedra sai na COLETA: o HUD bate com os 11 tiles ainda no canteiro | **regra**, implícita: o comentário diz "é o assentamento que debita" |
| F13b | "com a rua puxada o motivo deveria virar a-caminho, veio []" | a escola se liga com 5 de 8 tiles de pé (tick 87; os 3 restantes ficam fora do trecho entre as portas). `a-caminho` vai do 87 ao ~115, e `erguerRua` só volta com o canteiro vazio: a checagem chega depois do treino ter começado | nenhum dos dois: o momento da checagem |
| F16b | "em 300 ticks a rua deveria estar toda de pe, veio 10 e 2" | os 2 últimos tiles esperam do tick 128 ao 353 enquanto a pedreira sobe; obra completa no 353, ocupada no 378. O 300 foi medido antes da F18g (completa 220, ocupada 241) | **número** (prazo medido) |
| F18d-2 | "a pedra deveria ter caido so pelos 1 tiles assentados, veio 26" | afirma literalmente a regra que a F18g trocou | **regra**, explícita |

## Correção

- **F10:** a rua de pé entra na condição de saída do laço do passo 5; as asserções
  depois dele ficam idênticas. Comentários que dizem "o assentamento debita" passam a
  dizer "a coleta debita".
- **F13b:** o painel da escola abre ANTES de a rua subir, e o roteiro avança de 1 em 1
  tick até o motivo virar `a-caminho`, afirmando em todo tick que ele é só `sem-estrada`
  ou `a-caminho`. Depois vem o passo 9 como está, e só então `erguerRua` confere a rua
  inteira de pé. Prova a mesma sequência `sem-estrada` → `a-caminho` → `treinando`, sem
  depender de em que bloco o último tile cai.
- **F16b:** o prazo é remedido (sonda: ocupada no 378, granularidade de 25) e recebe a
  mesma folga proporcional de antes (241 → 300, ~25 %): 480. Nada mais muda.
- **F18d-2:** a conta do meio passa à regra da F18g — a pedra que saiu do armazém é a
  de pé, mais a parada no canteiro, mais a que está na mão de serf (neste cenário só a
  rua gasta pedra). Para isso o render publica `pedraNoCanteiroNoEstado` em
  `window.__cangaco` (soma de `state.pedraNoCanteiro`), no mesmo molde de
  `camposProntosNoEstado`. E uma asserção nova afirma a regra nova: no quadro do meio a
  pedra já caiu MAIS do que o assentado. O passo 1 (comando não gasta) e o passo 3 (a
  pedra caiu uma vez, pelo traçado inteiro) ficam.

## Verificação

Os quatro com `CANGACO_SHOT_PORTA=5177` (a 5175 é do Codex), código 0; `npm run verify`.
Cópias `zz-diag-*` apagadas antes do commit.
