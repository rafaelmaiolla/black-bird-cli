var io = require('socket.io-client');
var fs = require('fs');
var path = require('path');
var os = require('os');
var recursive = require('recursive-readdir');
var watch = require('watch');

function Client(port, connect) {
  console.log('[black-bird-cli]', 'Connecting...');

  this.socket = io('http://localhost:' + port);

  this.monitoredFiles = {};

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

Client.prototype.commandClose = function(options) {
  console.log('[black-bird-cli]', 'Command Close', options);

  delete this.monitoredFiles[options.file];

  this.sendCommand('ConfirmClose', [options]);
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

  this.createMonitor(path);

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

  var options = {
    file: path.resolve(filePath),
    hostname: os.hostname(),
    basename: path.basename(filePath)
  };

  console.log('[black-bird-cli]', 'options', options);

  console.log('[black-bird-cli]', 'Read file');

  fs.readFile(filePath, 'utf8', function(err, data) {
    if (err) {
      return console.error('[black-bird-cli]', err);
    }

    this.monitoredFiles[filePath] = options;

    console.log('[black-bird-cli]', 'Sending file');
    this.sendCommand('Open', [options, data]);

  }.bind(this));
};

Client.prototype.fileChanged = function(fileName) {
  var options = this.monitoredFiles[fileName];

  console.log('[black-bird-cli]', 'File changed', options);
  this.sendCommand('Changed', [options]);
};

Client.prototype.createMonitor = function(path) {
  console.log('[black-bird-cli]', 'Create monitor');

  watch.createMonitor(path, function (monitor) {
    console.log('[black-bird-cli]', '[monitor]', 'Monitor created');
    this.monitor = monitor;

    monitor.on("created", function (f, stat) {
      console.log('[black-bird-cli]', '[monitor]', 'File created', f);
      // Handle new files
    }.bind(this));

    monitor.on("changed", function (f, curr, prev) {
      console.log('[black-bird-cli]', '[monitor]', 'File changed', f);
      if (this.monitoredFiles[f.toString()]) {
        this.fileChanged(f.toString());
      }
    }.bind(this));

    monitor.on("removed", function (f, stat) {
      console.log('[black-bird-cli]', '[monitor]', 'File removed', f);
      // Handle removed files
    }.bind(this));

  }.bind(this));
};

module.exports = Client;
