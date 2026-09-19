---
description: Delega uma tarefa mecânica ao Codex CLI para economizar crédito
---

Delegue a tarefa abaixo ao Codex, executando `codex exec "<tarefa>"` via Bash.

## Antes de delegar, confira a tabela de roteamento

**Pode ir para o Codex** (mecânico, já especificado):
- `src/render/` e `src/ui/`
- scripts de build, validação de dados, pipeline de assets
- testes escritos a partir de um critério de aceite que já existe
- refatoração mecânica, boilerplate, conversão de formato

**NUNCA vai para o Codex** (exige julgamento sobre invariante):
- qualquer coisa em `src/sim/` — tick, FSM, JobBoard, reservas
- tudo que toca determinismo ou escala de tempo
- decisões de arquitetura ou mudanças no `CLAUDE.md`
- o avaliador e as rubricas

Se a tarefa cair na segunda lista, **recuse a delegação**, explique em uma
linha e faça você mesmo.

## Como delegar

1. Escreva um enunciado autocontido: o Codex não vê esta conversa. Inclua o
   caminho dos arquivos, o critério de aceite do `BUILD_PLAN.md` e as regras
   do `CLAUDE.md` que se aplicam.
2. Rode `codex exec` com esse enunciado.
3. **Revise o diff você mesmo.** O resultado do Codex é um rascunho, não uma
   entrega: confira as invariantes antes de aceitar.
4. Rode `npm run verify`.

Tarefa: $ARGUMENTS
