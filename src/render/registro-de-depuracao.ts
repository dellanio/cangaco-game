import type { Manifesto } from './manifesto';

interface DepuracaoRegistrada {
  readonly manifesto: Manifesto;
  readonly atlas: { readonly chave: string; readonly url: string; readonly dados: object };
}
let registro: DepuracaoRegistrada | null = null;
/** A entrada da página registra o módulo dinâmico antes de iniciar o Phaser. */
export function registrarDepuracao(dados: DepuracaoRegistrada): void { registro = dados; }
export function depuracaoRegistrada(): DepuracaoRegistrada | null { return registro; }
