# Plano — F28c, regeneração de HP (sessão autônoma, item 7)

Decisão do operador: *"1 HP a cada 10s. Implemente, e meça o efeito com o nosso HP
dobrado antes de fixar o número."*

**Pré-requisito que o item não dizia:** a `Unidade` não tem HP na sim. O `units.json` dá
`hp` ("golpes até morrer") só a militar e a mercenário, nunca a civil.

1. `state.ts`: `Unidade.hp?`, AUSENTE em civil e lido como cheio em militar sem o
   campo. Assim nenhuma fixture quebra e o save não muda de versão. Quem cria soldado
   (F25) põe o valor.
2. `sim/vida.ts`:
   - `hpMaximoDoTipo(tipo)` = `hp × combate.multiplicadorHP.valor`, ou `null` para
     civil;
   - `hpDaUnidade(u)` = `u.hp ?? máximo`.
3. Dado: `combat.json: regeneracao { hp: 1, intervalo_segundos_base: 10 }`, na escala
   `combate`, convertido uma vez no loader. O schema registra o caminho.
4. `systems/regeneracao.ts`: a cada `ticksIntervalo` do relógio global, toda unidade
   com HP abaixo do máximo e acima de zero ganha `hp`, sem passar do máximo. Vale
   inclusive em luta, e não olha a FSM.
5. `tick.ts`: roda depois dos comandos e antes do cerco.
6. Teste `tests/F28c-regeneracao.test.ts`:
   - o miliciano ferido volta ao cheio no tempo que o dado diz e nunca passa dele;
   - civil não muda;
   - regenera atacando;
   - mesma corrida, mesmo estado;
   - a **medida**: a tabela do tempo até encher, por tipo, nosso contra KaM, em
     `test-output/F28c.json`.

PARA REVISÃO: o relógio é o global (`tick % intervalo`). No KaM ele é o da unidade.
