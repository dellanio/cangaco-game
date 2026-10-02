---
name: pianco-sprite-director
description: Dirigir lotes de sprites do Piancó, escolher uma especialidade, exigir validação técnica e revisão independente.
---

# Diretor de sprites

## Entrega para a main e armazenamento de candidatas
Esta branch `noru-novos-sprites` nunca e mesclada diretamente na `main`. Para cada entrega, crie uma branch nova a partir da `main` atual e use `git restore --source` somente para os caminhos aprovados pelo operador. Confira o diff contra a `main` antes de pedir aprovacao para integracao; nao leve o controle de trabalho nem candidatos nessa entrega.

Novas candidatas, prompts de geracao, folhas de contato e testes de imagem ficam em `D:\projetos-pessoal\cangaco-game-candidatos\arte\`, fora do repositorio, com o esquema `<variante>/<id>/`. Salve cada PNG imediatamente nesse caminho, registre caminho absoluto, prompt, referencias, hash, resultado e proximo passo em `SKILL_BUILDER_PROGRESS.md`, e versione o controle ao fim de cada geracao. Nao use `git add -f` em candidatas novas. As imagens de `candidatos/` e `screenshots/` ja versionadas nesta branch permanecem no disco e no historico, mas saem do indice; nao as adicione novamente nem as transfira para a branch de entrega. No repositorio de entrega entram somente skills e sprites de predio aprovados na prova em tela, com derivado, manifesto e master correspondente.

Não leia, pesquise nem herde regras de `brief-arte.md`, `GDD.md`, `docs/` ou `pianco-art-pipeline` arquivada. Fontes técnicas permitidas: `data/`, `assets/manifest.json`, `src/render/`. Carregue sempre `../pianco-render-contract/SKILL.md` e, quando precisar de processamento, `../pianco-sprite-tools/SKILL.md`. Carregue **uma** especialidade por lote.

## Retomada obrigatória

No inicio de cada sessao na branch `noru-novos-sprites`, leia `SKILL_BUILDER_PROGRESS.md` e confira o registro externo. Na `main` ou em uma branch de entrega sem esse controle, nao gere arte: volte a branch de trabalho e consulte o controle antes de continuar. Nunca use `candidatos/_descartadas_contaminadas/` como referencia, comparacao ou base. Depois de cada geracao, salve o PNG em `D:\projetos-pessoal\cangaco-game-candidatos\arte\<variante>\<id>\`, registre prompt, referencias, hash, validacao, status, orcamento e proximo passo no controle e versione somente o controle antes de outra geracao. Relate apenas texto e caminhos; nunca anexe imagens ao chat.
## Estilo escolhido após a etapa 0

O operador escolheu D em 2026-09-30. Referencias historicas de estilo D ficam em `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\storehouse\generation-02-raw.png` (SHA-256 346CB7F6BC6FE9C280B013FDB3F987357C3DC1E31CCD9D002910291602D7AA0E) e `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\serf\generation-02-raw.png` (SHA-256 FEDFF0844E59D9DAF34463FE4C91D4B0F1A4BE2C8F40C05F94854BD413785F02). Use-as somente para materiais, pincelada e volume, nunca para luz antiga. Se nao estiverem disponiveis, pare a geracao e informe a dependencia. `front` e camera obliqua top-down 3/4 com entrada sul.
## Etapa 0 e decisão de produção

A [etapa 0 revisada](references/etapa-zero.md) é histórica. O orçamento e os prompts estão em `SKILL_BUILDER_PROGRESS.md`; não reinicie A/B/C/D. Calibre o validador por região com a nova folha aprovada. Não incorpore ou anexe imagens no chat.

## Decisão de relevo e luz

A luz única vem de cima, levemente do sul e sem eixo leste-oeste. Candidatas D antigas servem apenas como estilo. Oeste pode ser espelho do leste; terreno é albedo girável e espelhável. Exija prévia normal e RGB×0,8 nos três zooms. O validador mede luz vertical e simetria leste-oeste, mas calibração cromática ainda depende da nova folha.

## Roteamento

| Pedido | Especialidade |
| --- | --- |
| Prédio, obra, dano, destruição | `pianco-buildings` |
| Civil, militar, mercenário, animal, corpo caído | `pianco-units` |
| Árvore, cacto, arbusto, toco e decalque estático de caatinga | `pianco-vegetation` |
| Terreno, depósito, minério, mercadoria | `pianco-natural-resources` |
| Quadros e estados, projéteis, poeira, fumaça, impacto, faísca | `pianco-animation-planner` |

Receba id neutro, função, footprint, estado, direção/vista, base canônica, referência aprovada, dimensão, anchor, destino exato no manifesto, licença/origem, orçamento de chamadas e aceite. Consulte a entrada real e o loader antes de salvar; `assets/base/` guarda master e `assets/sprites/` guarda derivados consumidos. Não insira texto legível no PNG, exceto as placas aprovadas para inn, bakery, butchers e metallurgists, conforme pianco-buildings e os nomes de data/theme-sertao.json. `grapes` é cana, `wine` é cachaça; os nomes regionais restantes são texto da UI.

Lote pequeno: um id, uma categoria e um estado; para unidade, oito direções lógicas com oeste espelhável. Planeje orçamento explícito por unidade e pare ao atingir o limite ou falhar. Use geração nativa para raster; scripts apenas derivam, registram e validam. Nenhum asset fica aprovado sem validador **e** revisão de agente diferente do gerador. O operador homologa a folha e pilotos. Não altere gameplay para acomodar arte. Não rode `npm run verify` até o operador homologar um prédio ou unidade e pedir a verificação.

Antes de gerar qualquer prédio, use `pianco-buildings` para planejar atividade, ocioso, fumaça, estoque, camadas e anchors. Confira `src/render/manifesto-camadas.ts` e `tests/F17f-manifesto.test.ts`: ocupante dentro invisível; ocioso de um laço genérico; pilha com sprite `unidade`; fumaça genérica só no trabalho; obra `madeira` + `completo`. Fogo por dano é laço genérico futuro. Escola anima durante treinamento, sujeito a conferir consumidor. Não desenhe pessoa na janela nem pilha composta sem decisão e suporte de render. Registre qualquer estado não integrado.

## Luz e volume

Siga os quatro valores, deslocamento de matiz e luz fixa descritos em ../pianco-render-contract/SKILL.md. Transições suaves de luz e sombra são permitidas dentro de cada material; proíbem-se apenas gradiente de fundo, vinheta e brilho digital/plástico. Mantenha pelo menos três níveis legíveis no zoom 0,5 e sombra interna projetada quando houver elemento que a cause.

## Referências limpas na geração
Nunca envie como entrada de geração uma folha de comparação ou contato que incorpore terrenos, unidades ou outros sprites atuais do jogo. Eles são permitidos somente na montagem de escala/contraste. Referência artística deve conter apenas a candidata gerada autorizada, sem terreno atual ao fundo. Confira a composição da imagem antes da chamada; saída contaminada deve ser preservada e registrada como proibida para referência, comparação ou base em toda sessão.

