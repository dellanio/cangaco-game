# Varredura de dados sem leitor (sessão autônoma, item 20)

Pedido: *"varredura de dados sem leitor, listando o custo de remover cada um."* **Nada foi
removido.** A lista é para o operador decidir.

## Método (registrado no BUILD_PLAN: custo se mede compilando)
1. **Busca de candidatas:** toda chave de `data/*.json`, fora o tema e os `_doc`, sem
   ocorrência em `src/` nem em `tools/`. Não contam como leitor o `loader.ts`, o
   `types.ts`, o `data-schema.js` e o `data-rules.js`, porque só copiam ou validam.
2. **Falso positivo descartado à mão:**
   - ids de mercadoria como chave (`tree_trunk`, `flour`...) e chaves lidas pelo valor
     (`virote`, `funda`), que são lidos de forma genérica;
   - campo que o loader **converte** com outro nome (`*_segundos_base` → `ticks*`).
     Segui o nome convertido, e o `ticksIntervalo` da regeneração é lido por
     desestruturação: está vivo.
3. **Custo:** cada caminho foi tirado do JSON de verdade. Rodei `tsc --noEmit` (os tipos
   vêm do JSON, `sim/data/raw.ts`) e `validate:data`, e restaurei o arquivo. Os testes
   que leem sem tipo foram achados por busca e estão marcados.

## Resultado

| Campo | O que é | Quem lê | Custo de remover (tsc / validate / testes) | Sugestão |
|---|---|---|---|---|
| `delivery.maxSerfsNoMarketplace` | **duplica** `economy.marketplace.maxSerfs` (10), que é o que a F35 lê | só o loader copia | 1 erro (loader) + 1 campo em `types.ts` / OK / nenhum | **remover** |
| `combat.ia.homensPorFileira` | pus na F28-IA (esta sessão); a formação sai de `tilesDoGrupo` e não lê isto | ninguém | 0 / OK / nenhum | **remover** (é meu) ou ligar à formação |
| `buildings.regraHP`, `buildings.regraMarteladas` | fórmula escrita em texto; o número vale por `hp` de cada prédio | ninguém | 0 / OK / nenhum | mover para `_doc` |
| `condition.regraCivil` | texto da regra das 2 comidas | o loader copia, ninguém usa | 1 (loader) / OK / nenhum | mover para `_doc` |
| `delivery.reserva` (`obrigatoria`, `naOrigem`, `noDestino`) | texto do contrato do JobBoard; o código implementa a reserva sem ler isto | o loader copia | 2 (loader, types) / OK / nenhum | mover para `_doc` |
| `economy.storehouse.bloqueioPorItem`, `economy.marketplace.taxaFixa` | booleanos descritivos; `taxaFixa` virou `taxa` na F35 | ninguém | 0 / OK / nenhum | remover `taxaFixa`; `bloqueioPorItem` espera o item do bloqueio |
| `terrain.pathfinding.cachePorParOrigemDestino` | descreve o cache do A* | ninguém | 0 / OK / nenhum | mover para `_doc` |
| `economy.bloqueioPadraoNoArmazem` | a lista do bloqueio do armazém (GDD), mecânica **não implementada** | o loader copia | 2 (loader, types) / OK / nenhum | manter (é da feature futura) |
| `combat.stormAttack` | investida, mecânica **não implementada** (correção do operador de 2026-09-28) | o loader copia | 2 (loader, types) / OK / nenhum | manter |
| `combat.formacao` (`colunasMin`, `colunasMax`) | fileiras do grupo, **não implementado** (a F26 marcha em bloco fixo) | o loader copia | 2 (loader, types) / OK / nenhum | manter |
| `units.*.tipos[].visao` | névoa; **a IA ignora a névoa por decisão** do operador, e não há névoa | ninguém | 0 / OK / nenhum | manter (é da névoa) |
| `units.civis.tipos[].vaiAoInn` | quem vai à Bodega; hoje todo civil vai (`drenaCondicao`) | ninguém | 0 / OK / nenhum | remover, ou ligar a `drenaCondicao` |
| `time.duracaoAlvoDePartida_min` (60) | meta de design | ninguém | 0 / OK / nenhum | mover para `_doc` |
| `condition.duracaoEfetiva_min_escala2` | conferência cruzada da fome | **só** `data-rules.js` (regra) | 0 / OK / nenhum | manter: a regra é o leitor |
| `delivery.alertaTarefaSemCandidato_segundos` | o alerta de tarefa sem candidato **não existe na UI**; os testes da F15b usam como teto de ócio | só testes (`F15b-entrega`, `F15b-aceite`) | 2 (loader) + 2 testes / OK / 2 testes quebram | manter (os testes dependem) |
| `production.proporcoesDeReferencia` | proporções do GDD §4.5 | só teste (`F19-cadeia-do-pao`, leitura sem tipo) | 0 no tsc / OK / **F19 quebra em execução** | manter |

## O que isto não cobre
- Chaves lidas por valor dinâmico (`dados.x[variavel]`) passam como vivas, desde que
  apareçam no texto. Uma chave cujo nome só existe no JSON e é lida por índice
  calculado seria falso positivo desta lista. **Hipótese não conferida:** não achei
  nenhum caso.
- As chaves de `theme-sertao.json` ficaram de fora. O tema é da tela e da arte, e tem
  leitores fora de `src/sim`.
