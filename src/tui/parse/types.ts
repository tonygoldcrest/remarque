export type CellType = "context" | "add" | "del" | "empty";

export interface Cell {
  num: number | null;
  text: string;
  type: CellType;
}

export type Row = { kind: "hunk"; header: string } | { kind: "line"; left: Cell; right: Cell };
