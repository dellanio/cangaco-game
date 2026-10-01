export interface SeloDaSuiteLonga {
  readonly commit: string; readonly verde: boolean; readonly arvoreLimpa: boolean; readonly sozinha: boolean | null;
}
export function problemasDoSelo(selo: Partial<SeloDaSuiteLonga> | null, head: string, arvoreSujaAgora: boolean): string[];
