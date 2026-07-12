declare module "lowlight" {
  interface HighlightResult {
    relevance: number;
    language: string;
    value: unknown[];
  }
  export function highlight(language: string, value: string, options?: unknown): HighlightResult;
  export function highlightAuto(value: string, options?: unknown): HighlightResult;
  export function registerLanguage(name: string, syntax: unknown): void;
}
