import { DisplayRow } from "../../model/index.js";

export type Cell = Extract<DisplayRow, { kind: "line" }>["left"];
