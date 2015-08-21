#!/usr/bin/env node

var chalk = require('chalk');

var settings = require('./settings');
var Client = require('./Client');

var error = chalk.red;
var success = chalk.green;
var warning = chalk.yellow;
var info = chalk.blue;

var client = new Client(settings.options.port, settings.files);
