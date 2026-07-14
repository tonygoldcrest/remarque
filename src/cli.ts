#!/usr/bin/env node
import { buildProgram } from "./cli/program.js";

buildProgram().parseAsync(process.argv);
