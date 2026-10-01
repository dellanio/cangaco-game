---
name: pianco-animation-planner
description: Planejar quadros e camadas de animação do Piancó, incluindo trabalho vivo, animais, efeitos e projéteis.
---

# Planejamento de animação

Não leia `brief-arte.md`, `GDD.md`, `docs/` ou skill arquivada. Carregue `../pianco-render-contract/SKILL.md` e `../pianco-sprite-tools/SKILL.md`; use uma especialidade visual quando houver produção. Planejamento não cria regra ou tempo de gameplay.

Entrada: id, categoria, estado/direção, base aprovada, camada, anchor, duração existente no dado, quadro, destino, orçamento e evento visual. Entregue tabela de poses, ordem, duração, loop/transição, linha dos pés, elemento funcional dominante e prévia nos zooms 0,5 / 1 / 2. Separe evento visual de evento de simulação. Projéteis (flecha, pedra de bodoque, tiro) e efeitos (poeira, fumaça, impacto, faísca) seguem a mesma base e luz; não mude colisão ou dano.

F-VIVO-0 define camadas e anchors de trabalho, pilha e animal. F-VIVO-a organiza pilhas de entrada/saída e quatro posições principais de Armazém, Bodega e obra, sem ocultar porta. F-VIVO-b planeja trabalho interno sincronizado ao ciclo, inclusive fumaça/luz quando cabível. F-VIVO-c planeja cinco posições do curral e três idades derivadas do progresso da receita. F-VIVO-d monta cena dos cinco casos no mesmo quadro e revê interferência entre camadas. Os cinco casos são `guarda`, `transforma`, `dentro`, `criacao` e `luz`.

Para prédio com receita, receba da `pianco-buildings` o plano de composição **antes** de criar quadros: região de atividade, `ancoras.trabalho.area`, pontos `ancoras.estoque.entrada/saida` por mercadoria, visibilidade do trabalhador escolhida e ordem de oclusão. Planeje estados distintos da **casa**: vazia, ociosa/sem insumo ou com saída cheia, trabalhando; fumaça, mastro e bandeira têm condições e camadas próprias quando aplicáveis. Não transforme os quadros nem o descanso medidos no KaM em duração do Piancó. O conteúdo visual da animação `haIdle` do KaM não foi confirmado: trabalhador na janela é uma escolha Piancó pendente, não um fato medido. Caso `guarda` ou atividade externa não recebe animação interna de trabalho por padrão; a casa ainda pode ter animação de ocioso.

Planeje estoque vazio e 1–5; o modo de render **atual** repete unidades, enquanto cinco sprites compostos por estágio são uma opção de arte que requer consumidor novo. A pilha de saída aparece enquanto aguarda coleta e diminui quando o estoque real diminui; não a pinte fixa no corpo do prédio. Teste as combinações simultâneas em 0,5 / 1 / 2 sobre os três terrenos. Se a escolha for mostrar trabalhador, preserve fundo → personagem → anteparo; produto repousa na superfície vazia e pode ter a base coberta pela borda frontal. Declare os quadros de fundo, ação, ocioso, anteparo e mercadoria sem embutir os estados dinâmicos no corpo.

`src/render/trabalho.ts` consome o laço genérico `ocioso` quando ocupante está dentro sem trabalhar; BUG-X esconde a unidade. `WorldScene.ts` desenha trabalho e pilha após o corpo. Pessoa visível na janela ou anteparo frontal requer decisão e integração próprias. `schoolhouse` anima enquanto treina; confira o consumidor. `barracks` e `storehouse` não animam trabalhador. Fumaça genérica só no trabalho; fogo por dano é laço genérico futuro. Contrato: `src/render/manifesto-camadas.ts` e `tests/F17f-manifesto.test.ts`.

Em curral, use primeiro anchors específicos do prédio; caso ausentes, hipótese de cinco x fracionários 0,164 / 0,332 / 0,500 / 0,668 / 0,836, y=0,25 na metade traseira. As idades 1/2/3 seguem o progresso, não sorteio por frame. Escolha um elemento grande reconhecível em 0,5; se sumir, simplifique pose e detalhe. Lote: um id e um estado, até quatro quadros novos antes de revisão sequencial. Para unidade, siga oito direções e contagens da `pianco-units`. Sem PNGs gerados/inspecionados, marque `planejado`, jamais `aprovado`.

## Luz e volume

Siga os quatro valores, deslocamento de matiz e luz fixa descritos em ../pianco-render-contract/SKILL.md. Transições suaves de luz e sombra são permitidas dentro de cada material; proíbem-se apenas gradiente de fundo, vinheta e brilho digital/plástico. Mantenha pelo menos três níveis legíveis no zoom 0,5 e sombra interna projetada quando houver elemento que a cause.

A luz de todos os quadros e efeitos segue a fonte única de cima, levemente do sul, sem componente leste-oeste. Pares oeste/leste de unidade podem ser espelhados com camadas e máscara alinhadas. Efeitos e objetos volumétricos precisam manter leitura na prévia com tint 0,8; terreno albedo não recebe sombra direcional pintada.
