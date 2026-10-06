/**
 * I-TELA-TRILHA-SONORA — a playlist da trilha sonora (pedido do operador, 2026-10-06): a regra pura do
 * player, e o fundo sonoro com o tocador falso (tocar, terminar, passar, pausar, o combate por cima).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { criarFundoSonoro, passarFaixa, proximaFaixa, TRILHA_INICIAL } from '../src/render/fundo-sonoro';
import type { DadosDoFundo, TocadorDeFaixa, TocadorDeLaco } from '../src/render/fundo-sonoro';
import { createInitialState } from '../src/sim/state';
import { validarSom } from '../tools/data-rules.js';
import { EVENTOS_DA_SIM } from '../src/render/eventos-da-sim';

const som = JSON.parse(readFileSync('data/som.json', 'utf8')) as DadosDoFundo & Record<string, unknown>;
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Record<string, unknown>;

describe('I-TELA-TRILHA-SONORA', () => {
  it('(1, 5) a regra pura: comeca na primeira, a proxima de i e i+1, da ultima volta a primeira; passar mantem a pausa', () => {
    expect(TRILHA_INICIAL).toEqual({ indice: 0, pausada: false });
    expect([0, 1, 2].map((i) => proximaFaixa(i, 3))).toEqual([1, 2, 0]);
    expect(proximaFaixa(0, 1)).toBe(0);
    expect(passarFaixa({ indice: 1, pausada: true }, 2)).toEqual({ indice: 0, pausada: true });
    expect(passarFaixa({ indice: 0, pausada: false }, 2)).toEqual({ indice: 1, pausada: false });
  });

  it('a playlist do dado: as tres faixas do operador, na ordem, no canal musica', () => {
    expect(som.musica.playlist).toEqual(['music-pianco-01', 'music-pianco-02', 'music-pianco-03']);
  });

  function montar() {
    const log: string[] = [];
    let fim: (id: string) => void = () => undefined;
    const trilha: TocadorDeFaixa = {
      tocar: (id, v) => { log.push(`tocar ${id} ${v.toFixed(2)}`); },
      parar: (id) => { log.push(`parar ${id}`); },
      reiniciar: (id) => { log.push(`reiniciar ${id}`); },
      quandoTerminar: (fn) => { fim = fn; },
    };
    const lacos: TocadorDeLaco = { tocar: (id) => { log.push(`laco ${id}`); }, parar: (id) => { log.push(`parar-laco ${id}`); } };
    const dados: DadosDoFundo = { ...som, musica: { ...som.musica, transicaoSegundos: 1 } } as DadosDoFundo;
    const disponiveis = new Set(['music-pianco-01', 'music-pianco-02', 'music-pianco-03', 'music-combat']);
    const fundo = criarFundoSonoro({ dados, disponiveis, tocador: lacos, volume: () => 1, pedir: () => undefined, tickMs: 100, tocadorDaTrilha: trilha });
    const estado = createInitialState(1);
    let ms = 0;
    const quadro = (passo = 2000) => { ms += passo; fundo.quadro(ms, estado, null); };
    const trilhaDoLog = () => log.filter((l) => !l.startsWith('laco') && !l.startsWith('parar-laco'));
    return { fundo, quadro, log, trilhaDoLog, terminar: (id: string) => fim(id) };
  }

  it('(2) na paz toca a faixa da vez; o fim dela passa para a seguinte, e da ultima volta a primeira', () => {
    const { fundo, quadro, trilhaDoLog, terminar } = montar();
    quadro(0);
    quadro();
    expect(trilhaDoLog().at(-1)).toBe('tocar music-pianco-01 1.00');
    terminar('music-pianco-01');
    quadro();
    expect(trilhaDoLog()).toContain('reiniciar music-pianco-01');
    expect(trilhaDoLog().at(-1)).toBe('tocar music-pianco-02 1.00');
    expect(fundo.contadores().trilha).toEqual({ indice: 1, pausada: false, faixa: 'music-pianco-02' });
    terminar('music-pianco-02');
    quadro();
    expect(trilhaDoLog().at(-1)).toBe('tocar music-pianco-03 1.00');
    terminar('music-pianco-03');
    quadro();
    expect(trilhaDoLog().at(-1)).toBe('tocar music-pianco-01 1.00');
    // o fim de uma faixa que nao e a da vez nao mexe
    terminar('music-pianco-02');
    expect(fundo.contadores().trilha?.faixa).toBe('music-pianco-01');
  });

  it('(6) pausar para a faixa (guardando o ponto), continuar retoma a mesma, passar reinicia a atual e toca a seguinte', () => {
    const { fundo, quadro, trilhaDoLog } = montar();
    quadro(0);
    quadro();
    fundo.alternarPausaDaTrilha();
    quadro();
    expect(trilhaDoLog().at(-1)).toBe('parar music-pianco-01');
    quadro();
    expect(trilhaDoLog().at(-1)).toBe('parar music-pianco-01'); // pausada, nada toca
    // passar com a trilha pausada troca a faixa e continua pausada
    fundo.passarFaixa();
    quadro();
    expect(fundo.contadores().trilha).toEqual({ indice: 1, pausada: true, faixa: 'music-pianco-02' });
    expect(trilhaDoLog().some((l) => l.startsWith('tocar music-pianco-02'))).toBe(false);
    fundo.alternarPausaDaTrilha();
    quadro();
    expect(trilhaDoLog().at(-1)).toBe('tocar music-pianco-02 1.00');
    fundo.passarFaixa();
    quadro();
    expect(trilhaDoLog().slice(-2)).toEqual(['reiniciar music-pianco-02', 'tocar music-pianco-03 1.00']);
  });

  it('(3) o validador recusa a playlist vazia, a faixa fora da trilha do manifesto e a entrada sem origem', () => {
    const rodar = (s: unknown, m: unknown = manifesto): string[] => { const erros: string[] = []; validarSom(s, erros, { eventosDaSim: EVENTOS_DA_SIM, manifesto: m }); return erros; };
    expect(rodar(som)).toEqual([]);
    expect(rodar({ ...som, musica: { ...som.musica, playlist: [] } })).toContain('interface/som: musica.playlist precisa ser uma lista nao vazia de faixas');
    expect(rodar({ ...som, musica: { ...som.musica, playlist: ['music-pianco-01', 'music-combat'] } }))
      .toContain("interface/som: musica.playlist: a faixa 'music-combat' nao esta na secao trilha do manifesto");
    const trilha = (manifesto as { trilha: Record<string, Record<string, unknown>> }).trilha;
    const semOrigem = { ...manifesto, trilha: { ...trilha, 'music-pianco-01': { ...trilha['music-pianco-01'], origem: '' } } };
    expect(rodar(som, semOrigem)).toContain("interface/som: manifesto, faixa 'music-pianco-01': falta origem");
  });
});
