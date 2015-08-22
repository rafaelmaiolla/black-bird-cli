var settings = require('./settings');
var Client = require('./Client');

var client = new Client(settings.options.port, settings.files);
