import { Command } from "commander";

import { SCHEMA_VERSION } from "../protocol.js";
import { readVersion } from "./helpers.js";
import { registerBatchVerbs } from "./commands/batch-verbs.js";
import { registerPanelCommands } from "./commands/panel.js";
import { registerReadVerbs } from "./commands/read-verbs.js";
import { registerSessionCommands, registerSessionsList } from "./commands/sessions.js";
import { registerSetupCommands } from "./commands/setup.js";
import { registerStateCommands } from "./commands/state.js";
import { registerDelete, registerThreadVerbs } from "./commands/thread-verbs.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("remarque")
    .description("Agent- and front-end-agnostic code-review engine")
    .enablePositionalOptions()
    .version(`${readVersion()} (schema ${SCHEMA_VERSION})`, "-V, --version");

  registerThreadVerbs(program, "human");
  registerBatchVerbs(program, "human");
  registerReadVerbs(program);

  const agent = program
    .command("agent")
    .description("agent-facing verbs (author defaults to agent)");

  registerThreadVerbs(agent, "agent");
  registerBatchVerbs(agent, "agent");
  registerReadVerbs(agent);

  registerSetupCommands(program);
  registerSessionCommands(program);
  registerPanelCommands(program);
  registerSessionsList(program);
  registerDelete(program);
  registerStateCommands(program);

  return program;
}
