#!/usr/bin/env node

'use strict';

const Command = require('..');

const entry = async function() {
  await new Command().run(process.cwd(), process.argv.slice(2));
};
entry();
