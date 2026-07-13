#!/usr/bin/env node
import { buildProgram } from "./cli/program";

buildProgram().parseAsync(process.argv);
