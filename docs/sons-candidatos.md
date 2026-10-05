# Sons candidatos — para o operador aprovar

H-ARTE-SONS-CANDIDATOS (a lista de sons para o operador aprovar), Fase H. Decisão do operador
(2026-10-03): o som vem de banco livre com licença **CC0**, a sessão lista os candidatos com o link
e a licença, e **o operador aprova cada um**. Nada se baixa sem a coluna `aprovado` preenchida por
ele. Som que falta é silêncio.

**Como aprovar:** na coluna `aprovado`, escreva o número do candidato escolhido (`1`, `2` ou `3`),
ou `nenhum` para recusar todos os da linha (a sessão procura outros). Vazio quer dizer "ainda não
olhei", e o som continua em silêncio.

**A licença foi conferida na página de cada candidato em 2026-10-03** (Freesound: o selo "Creative
Commons 0" do próprio som, ligado a `creativecommons.org/publicdomain/zero/1.0/`; OpenGameArt: o
campo "License(s)" da página, só `CC0`). Candidato com licença dupla (ex.: `OGA-BY 3.0, CC0`) ficou
de fora. A duração é a da página; o que passa de alguns segundos vai precisar de recorte na
H-ARTE-SONS-APROVADOS (os sons aprovados entram no jogo), e o recorte é anotado no manifesto.

O `id` é o id neutro do som (o mesmo que o `data/som.json` usa); o "toca quando" é o evento da sim
(`state.events`) ou a situação da tela que o toca.

| id | toca quando | candidatos | aprovado |
|---|---|---|---|
| `blueprint-placed` | a planta é posicionada (input, sem evento; GDD §10 "som seco") | 1. [Knocking once on wood, single footstep — CuboRodante](https://freesound.org/people/CuboRodante/sounds/812363/) · CC0 · 1,1 s<br>2. [2x4.wav — This_Is_A_Hoax](https://freesound.org/people/This_Is_A_Hoax/sounds/354108/) · CC0 · 66,6 s (recorte) | 1 |
| `building-completed` | `building-completed` (a obra virou prédio) | 1. [Cow Bell.wav — dnewtonjr](https://freesound.org/people/dnewtonjr/sounds/189785/) · CC0 · 14,0 s (recorte; o chocalho do sertão)<br>2. [Ding Ding Small Bell — JohnsonBrandEditing](https://freesound.org/people/JohnsonBrandEditing/sounds/173932/) · CC0 · 14,2 s (recorte) | 1 |
| `goods-produced` | `goods-produced` (um ciclo de produção terminou) | 1. [JM_TOOLS_Hammer 01 - Nail in Wood - In a Room.wav — Julien_Matthey](https://freesound.org/people/Julien_Matthey/sounds/118341/) · CC0 · 25,6 s (recorte; a martelada do GDD §9.8)<br>2. [Axe chopping wood — xkeril](https://freesound.org/people/xkeril/sounds/753925/) · CC0 · 12,9 s (recorte; o machado do GDD §9.8) | 1 |
| `unit-trained` | `unit-trained` (a escola ou o quartel entregou uma unidade) | 1. [HEY VERY LOW 4.WAV — metrostock99](https://freesound.org/people/metrostock99/sounds/345083/) · CC0 · 0,6 s<br>2. [Voice_Man_hey_calling_far_away_shout.wav — ValentinPetiteau](https://freesound.org/people/ValentinPetiteau/sounds/557375/) · CC0 · 16,8 s (recorte) | 1 |
| `strike-hit` | `unit-struck` com `acertou: true` | 1. [Sword Hit — qubodup](https://freesound.org/people/qubodup/sounds/442769/) · CC0 · 0,8 s<br>2. [Single Sword Hit.wav — MTJohnson](https://freesound.org/people/MTJohnson/sounds/426322/) · CC0 · 0,8 s | 1 |
| `strike-miss` | `unit-struck` com `acertou: false` | 1. [Swinging staff whoosh (strong) 04.wav — Nightflame](https://freesound.org/people/Nightflame/sounds/422513/) · CC0 · 0,3 s<br>2. [Swing Woosh — Jofae](https://freesound.org/people/Jofae/sounds/389590/) · CC0 · 0,3 s | 1 |
| `unit-killed` | `unit-killed` (morte em luta) | 1. [Male Death Sound — Blankened](https://freesound.org/people/Blankened/sounds/554443/) · CC0 · 1,0 s<br>2. [Grunt1 - Death Pain.wav — tonsil5](https://freesound.org/people/tonsil5/sounds/416839/) · CC0 · 1,0 s | 1 |
| `shot-gun` | `projectile-fired` com `projetil: virote` (o bacamarte do Cabra de Fogo) | 1. [Musket Shot.wav — mlsulli](https://freesound.org/people/mlsulli/sounds/234869/) · CC0 · 2,4 s<br>2. [old musket bang.wav — bruno.auzet](https://freesound.org/people/bruno.auzet/sounds/538795/) · CC0 · 3,6 s | 1 |
| `shot-sling` | `projectile-fired` com `projetil: flecha` ou `funda` (o bodoque e a funda) | 1. [Slingshot 2.wav — olver](https://freesound.org/people/olver/sounds/513933/) · CC0 · 3,2 s (recorte)<br>2. [Slingshot sound — K27K_Mike](https://freesound.org/people/K27K_Mike/sounds/853649/) · CC0 · 2,5 s | 2 |
| `stone-thrown` | `stone-thrown` (a torre atirou uma pedra) | 1. [Stone on Stone Hit — xtra1](https://freesound.org/people/xtra1/sounds/858891/) · CC0 · 17,7 s (recorte)<br>2. [Stone - Throwing pebbles — Vrymaa](https://freesound.org/people/Vrymaa/sounds/734669/) · CC0 · 6,6 s (recorte) | 2 |
| `building-hit` | `building-attacked` (um golpe de tropa num prédio) | 1. [wood impact axe chop real int echo.flac — kyles](https://freesound.org/people/kyles/sounds/454381/) · CC0 · 12,6 s (recorte)<br>2. [Bangs, Knocks, Thuds and Hits — Alex_hears_things](https://freesound.org/people/Alex_hears_things/sounds/376667/) · CC0 · 49,2 s (recorte) | |
| `peace-ended` | `peace-ended` (acabou a paz) | 1. [Big Horn — Fenodyrie](https://freesound.org/people/Fenodyrie/sounds/835316/) · CC0 · 30,0 s (recorte; faz as vezes do berrante)<br>2. [TOLLING BELL — SamuelGremaud](https://freesound.org/people/SamuelGremaud/sounds/454855/) · CC0 · 55,0 s (recorte) | |
| `victory` | `match-ended` com `fim: vitoria` | 1. [Medieval: Victory Theme — RandomMind](https://opengameart.org/content/medieval-victory-theme) · CC0<br>2. [Win Jingle — Fupi](https://opengameart.org/content/win-jingle) · CC0 | https://freesound.org/people/chripei/sounds/165491/|
| `defeat` | `match-ended` com `fim: derrota` | 1. [horn_fail_wahwah_1.wav — TaranP](https://freesound.org/people/TaranP/sounds/362206/) · CC0 · 4,3 s<br>2. [Game Over! — zuvizu](https://opengameart.org/content/game-over-0) · CC0<br>3. [Game Over Sound(Old School) — den_yes](https://opengameart.org/content/game-over-soundold-school) · CC0 | 2 |
| `command-rejected` | `command-rejected` de comando do jogador (a planta vermelha, a ordem recusada) | 1. [Negative.wav — iwanPlays](https://freesound.org/people/iwanPlays/sounds/626085/) · CC0 · 0,5 s<br>2. [UIClick_clay plop various negative UI_Funky Audio_FASS.wav — Funky_Audio](https://freesound.org/people/Funky_Audio/sounds/702999/) · CC0 · 9,3 s (recorte) | 2 |
| `ambient-wind` | ambiente em laço, sempre em jogo (vento seco, GDD §9.8) | 1. [Wind in dry tall grass … Arivaca Road desert in Arizona — felix.blume](https://freesound.org/people/felix.blume/sounds/666175/) · CC0 · 301 s<br>2. [desert_wind.wav — DarkShroom](https://freesound.org/people/DarkShroom/sounds/645305/) · CC0 · 59,6 s<br>3. [wind light desert day steady eerie with crickets.flac — kyles](https://freesound.org/people/kyles/sounds/454361/) · CC0 · 118,8 s | 2 |
| `ambient-cicada` | ambiente em laço, sempre em jogo (cigarra, GDD §9.8) | 1. [Cicadas W breeze 2 — Colin.LeBlanc.Sound](https://freesound.org/people/Colin.LeBlanc.Sound/sounds/824925/) · CC0 · 16,0 s<br>2. [Cicadas — dethrok](https://freesound.org/people/dethrok/sounds/272169/) · CC0 · 45,8 s<br>3. [13-year cicadas in Tennessee — kenaroni](https://freesound.org/people/kenaroni/sounds/202679/) · CC0 · 35,3 s | 2 |
| `inn-bell` | a Bodega (`inn`) está na vista (sino da bodega, GDD §9.8) | 1. [Small Bell #2 — steffcaffrey](https://freesound.org/people/steffcaffrey/sounds/452379/) · CC0 · 1,9 s<br>2. [Small Bell — NachtmahrTV](https://freesound.org/people/NachtmahrTV/sounds/553214/) · CC0 · 5,8 s | https://freesound.org/people/TRP/sounds/574664/ |
| `music-peace` | música enquanto não há luta perto da vila do jogador | 1. [Medieval: Market Day — RandomMind](https://opengameart.org/content/medieval-market-day) · CC0 · tem versão em laço<br>2. [Medieval: Harvest Season — RandomMind](https://opengameart.org/content/medieval-harvest-season) · CC0<br>3. [Happy Accordion — TheSoundLibrary](https://freesound.org/people/TheSoundLibrary/sounds/813189/) · CC0 · 16,4 s (o fole, perto da sanfona) | https://freesound.org/people/Setuniman/sounds/146896/ |
| `music-combat` | música com luta perto da vila do jogador | 1. [Battle Theme A — cynicmusic](https://opengameart.org/content/battle-theme-a) · CC0<br>2. [Fast fight / battle music (looped) — XCVG](https://opengameart.org/content/fast-fight-battle-music-looped) · CC0 |1  | 
| `build-wood` | laborer `martelando` numa obra de prédio (pedido do operador, 2026-10-04: "batendo tábua") | 1. [Hammering_Wood.wav — CapsLok](https://freesound.org/people/CapsLok/sounds/204946/) · CC0 · 13,3 s (recorte; prego numa tábua)<br>2. [Hammer hitting nail.wav — LiezelDippenaar](https://freesound.org/people/LiezelDippenaar/sounds/707525/) · CC0 · 4,0 s (martelo, prego, tábua) | 1 |
| `build-road` | laborer `nivelando` ou `martelando` num tile de estrada (pedido do operador, 2026-10-04) | 1. [Shovel_dirt.wav — dr19](https://freesound.org/people/dr19/sounds/353907/) · CC0 · 9,1 s (pá na terra, batidas)<br>2. [Shovel in dirt — RavenWolfProds](https://freesound.org/people/RavenWolfProds/sounds/503672/) · CC0 · 10,8 s (pá entrando e saindo da terra) | 1 |
| `quarry-work` | o cabouqueiro trabalhando a pedra do lajedo (pedido do operador, 2026-10-04: "quebrando pedra, batendo em pedras") | 1. [Tiny Hammer on Stone.wav — Shamewap](https://freesound.org/people/meggiepie/sounds/389692/) · CC0 · 6,5 s (martelinho num bloco de pedra)<br>2. [Gathering Stone Resources.flac — qubodup](https://freesound.org/people/qubodup/sounds/184383/) · CC0 · 10,7 s (picareta em chão duro; o autor pede o link da página) |2|
| `road-placed` | o jogador pede um tile de rua (`PlaceRoad`; input, como a planta) (pedido do operador, 2026-10-04: "um som simples") | 1. [Bricks/Stones/Rocks/Gravel Falling — iwanPlays](https://freesound.org/people/iwanPlays/sounds/567249/) · CC0 · 4,2 s (recorte de um só impacto de cascalho)<br>2. [stone falls and breaks low pitch — SoundCollectah](https://freesound.org/people/SoundCollectah/sounds/109360/) · CC0 · 4,6 s (recorte do primeiro impacto)<br>3. [Normal click — Breviceps](https://freesound.org/people/Breviceps/sounds/448086/) · CC0 · 0,05 s (clique de interface, sem cara de pedra) | 2 |
| `troop-hungry` | `troop-hungry` (a tropa do jogador entra em alerta de fome, e o lembrete a cada 4 min; I-COMIDA-AVISO-DA-TROPA-COM-FOME, 2026-10-05) | 1. [war horn.wav — adharca](https://freesound.org/people/adharca/sounds/539956/) · CC0 · 4,4 s (a corneta do KaM: corte no fim com fade)<br>2. [Distant War Horn.wav — DeVern](https://freesound.org/people/DeVern/sounds/512490/) · CC0 · 19,3 s (recorte)<br>3. [The Deepest & Heaviest Grumbly Hunger Growls — bbonaparte1993](https://freesound.org/people/bbonaparte1993/sounds/455554/) · CC0 · 22,0 s (barriga roncando; recorte; 11 kHz) | |

**Os quatro últimos (2026-10-04)** entraram a pedido do operador, depois do merge da H, com a licença
conferida na página de cada um no mesmo dia. Ficou de fora, por não ser CC0: `Rock_Hammer_Chisel_01`
de dheming (Attribution 4.0), `Chisels` de iainmccurdy e `Wooden hammer hitting stone surface` de
alec_havinmaa (Attribution NonCommercial 4.0).

## O que ficou de fora, e por quê

- **Instrumentos do sertão (rabeca, zabumba, viola, pífano, GDD §9.8):** não achei música CC0 com
  eles. As músicas acima são de feira medieval e de batalha genérica; servem até haver uma
  gravação própria. Leitura conservadora: listar o que existe e deixar a escolha com o operador.
- **Berro de bode, carro de boi, relincho (GDD §9.8 e o tema):** não têm evento na sim nem situação
  na H. Ficam para quando um evento os pedir; "evento sem consumidor não nasce" vale para o som.
- **Martelada a cada incremento de HP (GDD §10):** a sim não emite evento por martelada. O
  `goods-produced` toca a martelada no fim do ciclo; a martelada da obra precisa de evento novo, o
  que é mudança de sim fora da H.
