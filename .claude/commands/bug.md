---
description: Registra um bug relatado pelo operador, sem corrigir
---

Registre um bug. **Não corrija nada nesta invocação.**

1. Leia `BUGS.md` e `BUILD_PLAN.md`.
2. Identifique a feature afetada a partir da descrição. Se não estiver claro,
   escreva `feature: ?` — não pergunte e não force um palpite.
3. Classifique a severidade:
   - `trava` — o jogo para, congela ou corrompe estado
   - `errado` — funciona mas viola uma regra escrita no GDD ou no BUILD_PLAN
   - `feio` — visual ou ergonomia
4. Acrescente a entrada em `BUGS.md` no formato padrão, com o próximo número
   livre. Bugs `feio` vão na seção `## Polimento`, no fim do arquivo.
5. Se a severidade for `trava` ou `errado`, vire a chave da feature para
   `false` em `test-results.json`.
6. Confirme em uma linha: número do bug, feature e severidade. Nada mais.

Relato: $ARGUMENTS
