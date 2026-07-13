import { Command } from "commander";

import { SCHEMA_VERSION } from "../protocol";
import { readVersion } from "./helpers";
import { registerBatchVerbs } from "./commands/batch-verbs";
import { registerPanelCommands } from "./commands/panel";
import { registerReadVerbs } from "./commands/read-verbs";
import { registerSessionCommands, registerSessionsList } from "./commands/sessions";
import { registerSetupCommands } from "./commands/setup";
import { registerStateCommands } from "./commands/state";
import { registerDelete, registerThreadVerbs } from "./commands/thread-verbs";

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
