# Milho crescendo — geração e revisão

Autor: pipeline nativo imagegen/OpenAI, dirigido pelo projeto Piancó. Licença: arte própria do projeto. Uma geração por estágio; limite contratado de duas por estágio.

Referência canônica preservada: assets/base/resources/corn-D-master-2x.png. O original maduro contém chão; por isso não foi enviado como entrada. A referência de pincelada limpa foi assets/base/bakery/madeira-original-20261012.png, um prédio aprovado, conforme escolha do operador. Nenhuma referência do KaM de 1998 ou dos antigos _estilo foi usada.

## Verde

Geração exec-0e3ea8d5-98ad-4aca-8900-426c9ca62b47. Entrada: padaria, somente estilo.

Prompt de produção: conjunto compacto de cinco plantas imaturas de milho verde para o RTS Piancó. Folhas lanceoladas alongadas e arqueadas, hastes curtas, sem espigas amarelas nem pendões. Câmera ortogonal superior 3/4, cinco plantas escalonadas e pé central inferior. Arte pintada fosca, verdes empoeirados #7C8B6A/#5E6B4F; três níveis de valor legíveis na redução. Luz única superior ligeiramente sul/câmera, sem componente leste/oeste, oclusão nas junções de folhas. Transparência real com margem; sem prédio, objeto, solo quadrado, cenário ou texto. Sem brilho plástico, vinheta, gradiente de fundo ou contorno preto uniforme.

## Muda

Geração exec-71dc8a0f-1456-40f2-a9cc-241df9e07610. Entrada: verde-original.png deste lote.

Prompt de produção: mesmas cinco posições, câmera, paleta e pincelada, agora mudas novas de milho com duas ou três folhas curtas estreitas, sem espigas/pendões/chão. Não apenas encolher as plantas adultas: desenhar a anatomia jovem. Conjunto menor/mais baixo, pé central inferior, fundo transparente. Mesma luz superior ligeiramente sul, sombras frias atrás e realces quentes em faces voltadas à câmera, sem viés lateral. Valores legíveis em 64x64 e acabamento fosco.

## Semeado

Geração exec-db9d7561-2462-4b18-80cc-dc0536972021. Entrada: muda-original.png deste lote.

Prompt de produção: remover plantas e folhas; cinco covas pequenas rasas de semeadura com grãos ocre parcialmente cobertos por migalhas de terra, isoladas entre si, sem plano de chão contínuo. Grupo largo/baixo e escalonado, marca frontal central inferior. Transparência real entre marcas e ao redor, sem brotos, raiz, prédio, campo, texto ou solo quadrado. Pincelada fosca tátil, terra #8C4A25 e ocre #C9974B, oclusão da cova e realces quentes nos grãos. Luz superior ligeiramente sul, nenhuma luz lateral ou sombra longa.

## Derivação e revisão

Crop da caixa alfa>=128 com margem de quatro pixels da origem; escala premultiplicada, canvas final 64x64/master128x128 e RGB bleed. Originais permanecem intactos; não há pintura por script. Pé alfa>0 alinhado à linha63 do maduro; alturas opacas10/23/34. Hashes de originais/masters/derivados em derivacao.json.

Validador original: success=true, errors=[], mode=trial. Trial não é calibração cromática homologada.

Revisão independente revisao_milho: aprovada tecnicamente após abrir derivados, masters e pranchas0.5/1/2, três solos, normal/tint0.8. Progressão legível, cinco plantas com folhas coerentes e sem espigas juvenis, luz superior sem viés lateral dominante, sem halos ou retângulo de fundo. Semeado discreto em0.5; verde mais desaturado que madura, ainda da mesma cultura. Homologação do operador pendente.
