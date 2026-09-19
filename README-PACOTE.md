# Onde vai cada arquivo

```
raiz do repo/
├── CLAUDE.md                  regras do projeto (o agente lê em toda sessão)
├── BUILD_PLAN.md              backlog e critérios de aceite
├── BUGS.md                    só bugs abertos
├── BALANCE_LOG.md             observações de balanceamento
├── IDEIAS.md                  congelado até a Fase A fechar
├── test-results.json          o rastreador: tudo em false
├── PROGRESS.md                (criar vazio; o agente mantém)
├── docs/GDD.md
├── data/*.json                10 arquivos de configuração
├── agents/evaluator.md
├── scripts/verify.sh
└── .claude/
    ├── settings.json          registro dos hooks
    ├── hooks/                 4 scripts
    └── commands/              /codex e /bug
```

No `package.json`: `"verify": "bash scripts/verify.sh"`.

## Primeira sessão

```bash
chmod +x .claude/hooks/*.sh scripts/verify.sh
touch PROGRESS.md
git init && git add -A && git commit -m "chore: spec, dados e harness"
```

Depois, no Claude Code: `Leia CLAUDE.md e BUILD_PLAN.md. Implemente F01.`

## Teste os controles antes de confiar neles

- `touch AGENT_STOP` no meio de uma sessão: o agente tem que parar na hora.
- Peça para marcar uma feature como `true` sem rodar `npm run verify`: o hook
  tem que bloquear. **Se não bloquear, o resto do harness não vale nada.**
- Escreva algo em `STEER.md`: o agente lê na mensagem seguinte e o arquivo some.
