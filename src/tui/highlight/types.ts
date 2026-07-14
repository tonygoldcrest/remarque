export interface Token {
  text: string;
  color?: string;
}

export interface SideTokens {
  old: Token[][] | null;
  new: Token[][] | null;
}

export interface HastText {
  type: "text";
  value: string;
}

export interface HastElement {
  type: "element";
  properties?: { className?: string[] };
  children?: HastNode[];
}

export type HastNode = HastText | HastElement;
