#! /usr/bin/env node

var chalk = require('chalk');
var program = require('commander');

var Client = require('./Client');

var error = chalk.red;
var success = chalk.green;
var warning = chalk.yellow;
var info = chalk.blue;

program
  .version('0.0.1')
  .option('-c, --connect', 'Connect to remote server')
  .option('-p, --port', 'Port number')
  .parse(process.argv);

program.parse(process.argv);

function execute() {
  console.log('[black-bird-cli]', 'Execute');
  var client = new Client(52690, true);
}

execute();
