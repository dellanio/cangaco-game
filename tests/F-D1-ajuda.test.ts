// F-D1 — a tela de ajuda. O que se prova aqui NAO e a tela (nao ha DOM no
// ambiente `node` do vitest): e a corrente que faz a tela nao poder mentir.
//
//   inventario -> comportamento : apertar cada tecla declarada FAZ alguma coisa
//   inventario -> tema          : todo id tem rotulo, e todo rotulo tem id
//
// O terceiro elo — a tela lista o inventario — e do roteiro
// (`npm run shot -- F-D1`), porque so la existe DOM. Ele sozinho seria circular;
// quem prova honestidade e o primeiro elo daqui.
import { describe, expect, it } from 'vitest';
import { ATALHOS, GESTOS, casa, atalhoDeId } from '../src/input/atalhos';
import { ligarTeclado, type AjudaParaTeclado } from '../src/input/teclado';
import { ligarTeclasDoTempo, type ControleDoTempo } from '../src/input/teclas-do-tempo';
import { ligarNavegacao } from '../src/input/navegacao';
import { gameData } from '../src/sim/data';
import { criarFerramenta } from '../src/input/ferramenta';
import { criarSelecao } from '../src/input/selecao';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const tema = temaSertao.ajuda;

function apertar(alvo: EventTarget, key: string, extra: Record<string, boolean> = {}): boolean {
  const evento = Object.assign(new Event('keydown', { cancelable: true }), { key, ...extra });
  alvo.dispatchEvent(evento);
  return evento.defaultPrevented;
}

/** Liga os DOIS ouvintes no mesmo alvo, como o `main.ts` faz, e devolve um
 *  registro do que cada um fez. E preciso ser os dois: o inventario e unico e
 *  atravessa os dois modulos. */
function bancada(): { alvo: EventTarget; feitos: string[]; observar(): void } {
  const feitos: string[] = [];
  const alvo = new EventTarget();

  const ferramenta = criarFerramenta();
  ferramenta.aoMudar((predio, modo) => feitos.push(`ferramenta:${modo}:${predio ?? '-'}`));
  const selecao = criarSelecao();
  const ajuda: AjudaParaTeclado = {
    fechar: () => false,
    alternar: () => feitos.push('ajuda:alternar'),
  };
  const controle: ControleDoTempo = {
    alternarPausa: () => feitos.push('tempo:pausa'),
    acelerar: () => feitos.push('tempo:acelerar'),
    desacelerar: () => feitos.push('tempo:desacelerar'),
  };

  ligarTeclado(ferramenta, alvo, selecao, ajuda);
  ligarTeclasDoTempo(controle, alvo);
  // F-D2: o terceiro ouvinte. A navegacao nao tem callback — ela guarda estado
  // e e PERGUNTADA pelo quadro da cena. Entao a bancada pergunta tambem, e e
  // `observar()` que traduz o estado dela para a mesma lista dos outros dois.
  const nav = ligarNavegacao(alvo, gameData.terreno.camera);
  // Ferramenta na mao: sem isto o `Esc` nao teria o que cancelar e nao emitiria
  // mudanca nenhuma — o atalho pareceria morto por falta de estado, nao por
  // falta de codigo.
  ferramenta.selecionar('quarry');
  feitos.length = 0;
  return {
    alvo,
    feitos,
    observar() {
      const { x, y } = nav.direcao;
      if (x !== 0 || y !== 0) feitos.push('camera:mover');
      if (nav.espacoApertado) feitos.push('camera:arrastar');
    },
  };
}

describe('F-D1 — o inventario nao declara tecla que nao existe', () => {
  it.each(ATALHOS.map((a) => [a.id, a] as const))(
    'o atalho %s faz alguma coisa quando apertado',
    (_id, atalho) => {
      for (const tecla of atalho.teclas) {
        const { alvo, feitos, observar } = bancada();
        apertar(alvo, tecla);
        observar();
        expect(feitos, `a tecla "${tecla}" do atalho "${atalho.id}" nao fez nada`).not.toEqual([]);
      }
    },
  );

  it('cada atalho faz a COISA DELE, e nao a de outro', () => {
    const esperado: Record<string, string> = {
      ajuda: 'ajuda:alternar',
      cancelar: 'ferramenta:nenhum:-',
      estrada: 'ferramenta:estrada:-',
      pausa: 'tempo:pausa',
      acelerar: 'tempo:acelerar',
      desacelerar: 'tempo:desacelerar',
      'camera-mover': 'camera:mover',
      'camera-arrastar': 'camera:arrastar',
    };
    // A ida: o mapa acima cobre o inventario inteiro. Se alguem acrescentar um
    // atalho e esquecer desta tabela, e aqui que aparece.
    expect(Object.keys(esperado).sort()).toEqual(ATALHOS.map((a) => a.id).sort());
    for (const atalho of ATALHOS) {
      const { alvo, feitos, observar } = bancada();
      apertar(alvo, atalho.teclas[0] as string);
      observar();
      expect(feitos, `atalho "${atalho.id}"`).toEqual([esperado[atalho.id]]);
    }
  });

  it('nenhum atalho dispara com Ctrl, Meta ou Alt: essas teclas sao do navegador', () => {
    for (const atalho of ATALHOS) {
      for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
        const { alvo, feitos, observar } = bancada();
        apertar(alvo, atalho.teclas[0] as string, { [mod]: true });
        observar();
        expect(feitos, `atalho "${atalho.id}" com ${mod}`).toEqual([]);
      }
    }
  });

  it('o inventario NAO declara as teclas que o GDD §2.2 promete e o codigo nao tem', () => {
    // B, F, Delete, 1..9, Ctrl+1..9 e Espaco estao na tabela do GDD e nao
    // existem. Listar tecla que nao existe e trocar jogador perdido por jogador
    // enganado (BUILD_PLAN, F-D1). Este teste e o que impede alguem de
    // "completar" a tela copiando o GDD.
    // O `Espaco` SAIU desta lista na F-D2, e nao por conveniencia: ele passou a
    // existir de verdade, como arrasto de camera. O que o GDD §2.2 prometia
    // ("pular para o ultimo alerta") continua nao existindo, e continua sem
    // tecla — a tabela do GDD foi corrigida na mesma feature, para nao voltar a
    // ser fonte de tecla imaginaria.
    const prometidas = ['b', 'f', 'Delete', '1', '9'];
    const declaradas = new Set(ATALHOS.flatMap((a) => a.teclas.map((t) => t.toLowerCase())));
    for (const t of prometidas) {
      expect(declaradas.has(t.toLowerCase()), `"${t}" nao esta implementada`).toBe(false);
    }
    // E a outra ponta: apertar uma delas nao faz nada mesmo.
    for (const t of prometidas) {
      const { alvo, feitos, observar } = bancada();
      apertar(alvo, t);
      observar();
      expect(feitos, `a tecla "${t}" fez alguma coisa: o inventario esta desatualizado`).toEqual([]);
    }
  });
});

describe('F-D1 — a precedencia do Esc e o F1', () => {
  it('com a ajuda ABERTA, o Esc fecha a ajuda e a ferramenta continua na mao', () => {
    const alvo = new EventTarget();
    const ferramenta = criarFerramenta();
    let aberta = true;
    ligarTeclado(ferramenta, alvo, criarSelecao(), {
      fechar: () => {
        if (!aberta) return false;
        aberta = false;
        return true;
      },
      alternar: () => { aberta = !aberta; },
    });
    ferramenta.selecionar('quarry');

    apertar(alvo, 'Escape');
    expect(aberta).toBe(false);
    expect(ferramenta.predioAtivo, 'o Esc que fecha a ajuda nao pode largar a planta').toBe('quarry');

    // Fechada, o mesmo Esc volta a ser o da F06/F13b.
    apertar(alvo, 'Escape');
    expect(ferramenta.predioAtivo).toBeNull();
  });

  it('o F1 chama preventDefault, senao abre a ajuda do navegador por cima do jogo', () => {
    const alvo = new EventTarget();
    ligarTeclado(criarFerramenta(), alvo, criarSelecao(), { fechar: () => false, alternar: () => {} });
    expect(apertar(alvo, 'F1')).toBe(true);
  });

  it('sem ajuda passada, o teclado se comporta como antes da F-D1', () => {
    const alvo = new EventTarget();
    const ferramenta = criarFerramenta();
    ligarTeclado(ferramenta, alvo);
    ferramenta.selecionar('quarry');
    apertar(alvo, 'Escape');
    expect(ferramenta.predioAtivo).toBeNull();
  });
});

describe('F-D1 — o tema cobre o inventario, na ida e na volta', () => {
  const ids = [...ATALHOS.map((a) => a.id), ...GESTOS.map((g) => g.id)];

  it('todo id tem rotulo, e todo rotulo tem id', () => {
    expect(Object.keys(tema.rotulos).sort()).toEqual([...ids].sort());
  });

  it('todo gesto tem o texto do gesto, e nenhum gesto sobra', () => {
    expect(Object.keys(tema.gestos).sort()).toEqual(GESTOS.map((g) => g.id).sort());
  });

  it('todo grupo usado tem nome no tema', () => {
    const grupos = new Set([...ATALHOS.map((a) => a.grupo), ...GESTOS.map((g) => g.grupo)]);
    expect(Object.keys(tema.grupos).sort()).toEqual([...grupos].sort());
  });

  it('nenhum rotulo e id neutro disfarcado de texto', () => {
    for (const [id, rotulo] of Object.entries(tema.rotulos)) {
      expect(rotulo, `o rotulo de "${id}" e o proprio id`).not.toBe(id);
      expect(rotulo.length, `o rotulo de "${id}" e curto demais para dizer o que a tecla faz`)
        .toBeGreaterThan(id.length);
    }
  });
});

describe('F-D1 — casa()', () => {
  it('compara sem caixa: R e r sao a mesma tecla', () => {
    const estrada = atalhoDeId('estrada');
    expect(estrada).toBeDefined();
    expect(casa(estrada as never, { key: 'R' })).toBe(true);
    expect(casa(estrada as never, { key: 'r' })).toBe(true);
  });

  it('evento sem key nao casa com nada', () => {
    for (const atalho of ATALHOS) expect(casa(atalho, {})).toBe(false);
  });
});

gravarEvidencia('F-D1-ajuda', {
  atalhos: ATALHOS.map((a) => ({ id: a.id, grupo: a.grupo, teclas: a.teclas })),
  gestos: GESTOS.map((g) => ({ id: g.id, grupo: g.grupo })),
  rotulosDoTema: Object.keys(tema.rotulos).length,
});
