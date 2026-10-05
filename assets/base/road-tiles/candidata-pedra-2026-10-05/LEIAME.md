# Candidata de calçamento — I-ARTE-PEDRA-DA-RUA

**Candidata completa, não integrada e não homologada.** No sandbox do Codex o pipeline
falhou ao iniciar o Chromium (`spawn EPERM`); a sessão Claude rodou o mesmo script fora do
sandbox em 2026-10-05 e ele gerou as 17 imagens 64x64, a folha `ruas-contato.png` e o
`conferencia.json` (fonte periódica: sim). Na folha: reta, curva, T e cruzamento emendam;
há costura visível em algumas junções (o recorte por máscara usa offsets diferentes), e a
diagonal sai em contas soltas, como a ponte de hoje. Decisão do operador.

## Reprodução

Na raiz do repositório:

```powershell
node skills/pianco-sprite-tools/scripts/generate-road-stone-candidate.mjs
```

Semente fixa: **20261005**, declarada no script. Material original procedural,
sem download, referências de jogo ou geração por relógio. Fonte RGBA de 128×128:
pedras Voronoi periódicas em areia/cinza quente, juntas de terra e poros locais.
Não há luz direcional, sombra projetada, vinheta ou brilho no albedo. A luz do mundo
fica a cargo do render: de cima, levemente do sul, sem componente leste-oeste.

O script copia o layout vigente, mantendo tamanho 64 e roadWidth 34, e redireciona
fonte, sprites e preview exclusivamente para esta pasta. Depois executa o pipeline
vigente sem modificá-lo. Em ambiente que permita Chromium, também monta seis painéis
sobre a grama real: horizontal, vertical, curva, T, cruzamento e diagonal (esquerda
para direita, primeira linha e depois segunda). As máscaras são calculadas pelos
vizinhos N=1, L=2, S=4, O=8; pontes diagonais são centradas nos cantos compartilhados.

## Conferência realizada e pendente

- Fonte e repetição 3×3 gravadas. A distância dos centros usa um domínio periódico
  de 128 pixels; grão e poros usam coordenadas no mesmo domínio, inclusive nos cantos.
- PNGs decodificados: fonte 128×128 e repetição 384×384. A repetição 3×3 foi aberta:
  não foi observada linha de costura nas junções, mas o padrão repetido é perceptível.
  Aprovação visual continua pendente do operador.
- As **17 imagens 64×64 não foram conferidas**, pois o pipeline falhou antes de
  produzi-las. O script contém conferência de dimensões após a derivação.
- A conferência de periodicidade e o relatório `conferencia.json` previstos no
  script só são executados após a derivação; não foram concluídos nesta sessão.
- O pipeline usa recortes e offsets diferentes por máscara. Uma fonte periódica
  não garante continuidade das pedras entre derivados. Essa limitação precisa
  ser avaliada na montagem de ruas; o pipeline não foi alterado.

Nada foi registrado no manifesto ou em assets/sprites. Sem commit.
