# AGENTS.md

As regras deste projeto estão em CLAUDE.md. Leia-o inteiro antes de
qualquer ação; ele vale para você.

Diferenças porque você não é o Claude Code:

- CLAUDE.md fala de hooks, subagentes, /bug e /codex. Nada disso existe
  para você. Ignore essas partes.
- NUNCA escreva em test-results.json. O portão de verificação que o
  protege só funciona no Claude Code. Rode `npm run verify`, mostre a
  saída, e pare — quem marca a feature é o operador.
- Não mexa em .claude/ nem em AGENTS.md.
- Execute o plano em docs/planos/ indicado pelo operador, task por task,
  com um commit por task. Não faça push.
- Se aparecer uma situação que o plano não cobre, PARE e reporte. Não
  improvise solução.
- Se um teste, o lint ou o typecheck reprovar, a correção nunca é desativar,
  ignorar, excluir ou afrouxar a verificação. Corrija o código ou pare e
  reporte.
- Ao terminar, rode npm run verify e mostre a saída. Quem marca
  test-results.json é o operador.