export interface CaptureInput {
  content: string;
  blobSha: string;
  line: number;
  endLine: number;
  contextLines?: number;
}

export interface ResolveOptions {
  fuzzyThreshold?: number;
}

export interface ResolvedPosition {
  line: number;
  endLine: number;
}

export interface LineMatch {
  index: number;
  score: number;
  exact: boolean;
}
