---
name: pianco-sprite-tools
description: Ferramentas técnicas para derivar, registrar, validar e montar contatos de sprites do Piancó; não define estilo.
---

# Ferramentas de sprites

Para novas candidatas e ensaios de imagem, passe aos scripts caminhos sob `D:\projetos-pessoal\cangaco-arte-candidatos\<variante>\<id>\`. Nao grave folhas de contato, relatorios ou PNGs candidatos dentro do repositorio. Os scripts antigos preservados em `archive/skills/` sao historicos e nao devem ser carregados como contrato.

Leia `../pianco-render-contract/SKILL.md` para dimensões, pivôs, caminhos e portões. A direção artística fica na especialidade visual escolhida. Não use `brief-arte.md`, `GDD.md`, `docs/` nem o arquivo legado arquivado como fonte de regras.

## Scripts

- `scripts/process-sheet.mjs <layout.json>`: recorta e deriva uma folha; requer ffmpeg. Formato em [layout-schema.md](references/layout-schema.md).
- `scripts/register-layout.mjs <predio|unidade|recurso> <layout...>`: registra no manifesto. Recusa substituir entradas que perderiam estados ou anchor especial; nesses casos registre manualmente preservando os campos e confira o diff. O modo de unidade ainda segue o layout legado e não registra os oito rumos e todos os estados do contrato novo: para produção nova de unidade, monte a entrada manualmente até haver suporte específico. Não registre saída sem origem e licença.
- `scripts/process-terrain-edges.mjs`, `process-water-shores.mjs`, `process-rock-autotile.mjs`, `process-road-tiles.mjs` e `process-ink-icons.mjs`: derivação técnica por layout. Nenhum script cria arte original.
- `scripts/validate-sprites.mjs <spec.json> <diretorio-saida>`: verifica dimensões, master, pivô, linha dos pés, jitter, borda alfa, deriva cromática por região, máscara de time e completude dos estados. Para um lote de unidade, use `scope: "batch"` e `state`; exige todos os quadros das oito direções daquele estado. Sem `scope`, exige o conjunto completo da unidade. Gera `report.json` e contatos sobre grama, areia e rocha reais nos zooms 0,5 / 1 / 2. A calibração precisa apontar a folha de estilo aprovada por caminho e SHA-256.

O teste dirigido é `node --test --test-isolation=none skills/pianco-sprite-tools/tests/validate-sprites.test.mjs`. Ele cria PNGs válidos e inválidos em diretório temporário. Resultado automático não substitui revisão visual por outro agente nem aceite do operador. Antes da folha de estilo aprovada, limites cromáticos são apenas ensaios técnicos.

Na etapa 0 histórica, `mode: trial` permite ensaio sem aprovação. O validador aceita cinco direções canônicas com oeste derivável por espelho e testa luz vertical e simetria dos pares leste-oeste quando explícitos. A calibração cromática por região depende da nova folha aprovada; teste visualmente RGB×0,8 antes de homologar.
