# Etapa 0 — escolha do estilo em duas fases

> Etapa concluída em 2026-09-30. O operador escolheu a variante D, especificamente `candidatos/D/storehouse/generation-02-raw.png` e o `serf` D sem chapéu. Este roteiro documenta o ensaio e não deve ser reexecutado em sessões futuras. Referências aprovadas: `assets/base/_estilo/STYLE.md`.
## Regra de contexto

Nunca exiba, incorpore nem anexe imagem no chat. Salve cada PNG em disco e informe somente o caminho absoluto para abertura no Windows Explorer. Para inspeção do agente, abra **uma** folha de contato reduzida de cada vez, com lado maior ≤1024 px; nunca abra masters 2× nem múltiplas imagens na mesma etapa. Dimensões, alfa, contorno e validador são medidos por script sem abrir imagem.

Os sprites atuais do jogo servem **somente** para medir tamanho, anchor e linha do pé. **Não** passe qualquer imagem atual em `referenced_image_paths`. Os sete candidatos produzidos antes desta revisão usaram essas referências e ficam excluídos da etapa 0 revisada.

## Fase 1: serf A/B/C

Gere o `serf` sem imagem de referência do jogo, uma vez por variante; uma única correção adicional por sujeito e variante é permitida. Escolha o mesmo sujeito, proporção, pose frontal sul e luz do mundo em todas:

- **A:** xilogravura marcada, sulcos e hachuras visíveis, contorno forte, degraus de valor e hachura na sombra.
- **B:** volume pintado com transições internas suaves, pouca hachura, contorno seletivo mais escuro que o material.
- **C:** volume pintado suave, hachura apenas nas oclusões.

Derive master 128×192 e sprite 64×96 com pés no centro inferior. Monte **A/B/C lado a lado**, sobre texturas reais de grama, areia e rocha, em folhas separadas para zoom 0,5 / 1 / 2. Reduza as folhas de inspeção para lado maior ≤1024 px. Salve e informe caminhos; **pare para o operador escolher quais variantes continuam**. Não gere prédio antes dessa escolha.

## Fase 2: storehouse somente nas variantes escolhidas

Para cada variante escolhida, gere `storehouse` em `front`, passando **somente o serf gerado daquela variante** em `referenced_image_paths` como âncora de estilo. O sprite atual do prédio não entra como referência. Use tamanho e anchor medidos no manifesto; porta sul sobre o tile de entrada. Monte cena com o `serf` ao lado da porta do armazém para conferir escala, em três terrenos reais e zooms 0,5 / 1 / 2. Salve, informe caminhos e pare para escolha final do estilo.

## Orçamento e relato

No máximo **2 gerações por sujeito por variante**: tentativa inicial + uma correção. Teto global **12 gerações** (3 variantes × 2 sujeitos × 2); uma tentativa falha consome orçamento. Falhou ou atingiu limite, pare e reporte. Não substitua arte por desenho programático; scripts apenas recortam, reduzem, montam comparação e medem.

Relate por variante, em texto e caminhos: se hachuras viram ruído/moiré no zoom 0,5; se contorno sobrevive 2×→1×; se o volume recebe a luz então usada no ensaio histórico (substituída pela regra atual de luz de cima, levemente do sul, sem eixo leste-oeste) e sombra da aba do chapéu, e, na fase 2, se o beiral projeta sombra na parede; resultado do validador em `mode: "trial"`, **sem calibração cromática ou aprovação automática**. Nenhuma candidata entra em `assets/base/_estilo/` antes da escolha do operador. Só depois registre SHA-256 e calibre o validador. `tree`, `rock`, `militia`, facção e vegetação ficam para pilotos de produção posteriores.
