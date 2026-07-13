export interface RunOptions {
  cwd: string;
  stdin?: Buffer | string;
}

export interface LenientResult {
  stdout: string;
  code: number | null;
}

export interface RepoInfo {
  root: string;
  branch: string;
  hasHead: boolean;
}

export interface StagingStatus {
  staged: string[];
  unstaged: string[];
}
