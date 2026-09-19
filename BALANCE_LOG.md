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

_(nenhuma ainda)_

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
