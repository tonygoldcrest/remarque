import { DisplayRow } from "../../model";

export type Cell = Extract<DisplayRow, { kind: "line" }>["left"];
