var io = require('socket.io-client');
var fs = require('fs');
var path = require('path');
var os = require('os');
var recursive = require('recursive-readdir');

function Client(port, connect) {
  console.log('[black-bird-cli]', 'Connecting...');

  this.socket = io('http://localhost:' + port);

  this.socket.on('connect', function() {
    console.log('[black-bird-cli]', 'Connected');

    this.socket.emit('black-bird:connect');
  }.bind(this));

  this.socket.on('black-bird:cmd', function(data) {
    console.log('[black-bird-cli]', 'black-bird:cmd', data);
    if (this['command' + data.cmd]) {
      this['command' + data.cmd].apply(this, data.arguments);

    } else {
      console.error('[black-bird-cli]', 'Command not supported', data.cmd);
    }
  }.bind(this));

  this.socket.on('disconnect', function() {
    console.log('[black-bird-cli]', 'Disconnected');
  }.bind(this));

  this.socket.on('error', function(err) {
    console.error('[black-bird-cli]', err);
  }.bind(this));
}

Client.prototype.sendCommand = function(command, commandArguments) {
  console.log('[black-bird-cli]', 'Sending command', command, commandArguments);

  this.socket.emit('black-bird:cmd',  {
    cmd: command,
    arguments: commandArguments
  });
};

Client.prototype.commandSave = function(options, fileContent) {
  console.log('[black-bird-cli]', 'Command Save', options);

  var writeStream = fs.createWriteStream(options.file);
  console.log('[black-bird-cli]', 'Saving file', options.basename);

  writeStream.end(fileContent, "utf8", function() {
    console.log('[black-bird-cli]', 'File saved', options.basename);
    this.sendCommand('ConfirmSave', [options]);
  }.bind(this));
};

Client.prototype.commandList = function(path, ignoredNames) {
  console.log('[black-bird-cli]', 'Command List', path, ignoredNames);

  recursive(path, ignoredNames, function (err, files) {
    console.log('[black-bird-cli]', 'Files', files);
    // Files is an array of filename
    this.sendCommand('List', [files]);
  }.bind(this));
};

Client.prototype.commandOpen = function(filePath) {
  console.log('[black-bird-cli]', 'Command Open', filePath);

  this.openFile(filePath);
};

Client.prototype.openFile = function(filePath) {
  console.log('[black-bird-cli]', 'Open file', filePath);

  var commandData = {
    file: path.resolve(filePath),
    hostname: os.hostname(),
    basename: path.basename(filePath)
  };

  console.log('[black-bird-cli]', 'commandData', commandData);

  console.log('[black-bird-cli]', 'Read file');

  fs.readFile(filePath, 'utf8', function(err, data) {
    if (err) {
      return console.error('[black-bird-cli]', err);
    }

    console.log('[black-bird-cli]', 'Sending file');
    this.sendCommand('Open', [commandData, data]);

  }.bind(this));
};

module.exports = Client;
