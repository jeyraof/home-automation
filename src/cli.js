#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { registerUstockCommand } from './commands/ustock.js';

const program = new Command();

program
  .name('automation')
  .description('Local automation command collection')
  .version('0.1.0');

registerUstockCommand(program);

await program.parseAsync(process.argv);

