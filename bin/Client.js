var io = require('socket.io-client');
var fs = require('fs');
var path = require('path');
var os = require('os');
var recursive = require('recursive-readdir');
var watch = require('watch');
var minimatch = require("minimatch");
var svn = require('svn-interface');

function Client(port, files) {
  console.log('[black-bird-cli]', 'Client port=' + port);

  console.log('[black-bird-cli]', 'Connecting...');

  this.socket = io('http://localhost:' + port);

  this.monitoredFiles = {};

  this.socket.on('connect', function() {
    console.log('[black-bird-cli]', 'Connected');

    this.socket.emit('black-bird:connect');

    this.openFileList(files);
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

Client.prototype.commandList = function(remotePath, ignoredNames) {
  console.log('[black-bird-cli]', 'Command List', remotePath, ignoredNames);

  this.createMonitor(remotePath, ignoredNames);

  recursive(remotePath, ignoredNames, function (err, files) {
    console.log('[black-bird-cli]', 'Files', files);
    // Files is an array of filename
    this.sendCommand('List', [files, remotePath]);
  }.bind(this));
};

Client.prototype.commandOpen = function(filePath) {
  console.log('[black-bird-cli]', 'Command Open', filePath);

  this.openFile(filePath);
};

Client.prototype.commandDiff = function(filePath, repositoryType) {
  console.log('[black-bird-cli]', 'Command Diff', filePath, repositoryType);

  if (repositoryType == 'svn') {
    svn.diff(filePath, {}, function(err, data) {
      if (err) {
        console.error('[black-bird-cli]', 'Failed to diff path');
      }

      this.sendCommand('Diff', [data]);
    });
  }
};

Client.prototype.commandReject = function() {
  console.log('[black-bird-cli]', 'Command Reject');

  console.error('[black-bird-cli]', 'Failed to connect', 'Connection rejected');

  process.exit(1);
};

Client.prototype.openFileList = function(fileList) {
  console.log('[black-bird-cli]', 'Open file list', fileList);

  fileList.forEach(function(file, index, list) {
    this.openFile(file);
  }.bind(this));
};

Client.prototype.openFile = function(filePath) {
  console.log('[black-bird-cli]', 'Open file', filePath);

  var options = {
    hostname: os.hostname()
  };

  if (filePath == '-') {
    options.file = '-';
    options.basename = 'untitled (stdin)';

  } else {
    options.file = path.resolve(filePath);
    options.basename = path.basename(filePath);
  }

  console.log('[black-bird-cli]', 'options', options);

  console.log('[black-bird-cli]', 'Read file');

  if (filePath == '-') {
    var data = "";

    process.stdin.on("data", function(_data) {
      console.log("process.stdin", _data)
      data += _data;
    }.bind(this));

    process.stdin.on("error", function(err) {
      console.log('[black-bird-cli]', 'Failed to read from stdin');
    }.bind(this));

    process.stdin.on("end", function(err) {
      this.sendCommand('Open', [options, data]);
    }.bind(this));

  } else if (fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf8', function(err, data) {
      if (err) {
        return console.error('[black-bird-cli]', err);
      }

      this.monitoredFiles[filePath] = options;

      console.log('[black-bird-cli]', 'Sending file');
      this.sendCommand('Open', [options, data]);

    }.bind(this));

  } else {
    this.sendCommand('Open', [options, ""]);
  }
};

Client.prototype.fileChanged = function(fileName) {
  var options = this.monitoredFiles[fileName];

  console.log('[black-bird-cli]', 'File changed', options);
  this.sendCommand('Changed', [options]);
};

Client.prototype.filterMonitorFiles = function(ignoredNames) {
  var ignoreOpts = {matchBase: true};

  return function(file, stats) {
    console.log(file);
    for (var i = 0; i < ignoredNames.length; i++) {
      if (minimatch(file.toString(), ignoredNames[i], ignoreOpts)) {
        console.log("match");
        return false;
      }
    }
    return true;
  }
};

Client.prototype.createMonitor = function(remotePath, ignoredNames) {
  console.log('[black-bird-cli]', 'Create monitor');

  var options = {
    filter: this.filterMonitorFiles(ignoredNames),
    ignoreDotFiles: true,
    ignoreUnreadableDir: true,
    ignoreNotPermitted: true
  };

  if (this.monitor) {
    this.monitor.stop();
  }

  watch.createMonitor(remotePath, options, function (monitor) {
    console.log('[black-bird-cli]', '[monitor]', 'Monitor created');
    this.monitor = monitor;

    monitor.on("created", function (f, stat) {
      console.log('[black-bird-cli]', '[monitor]', 'File created', f);
      this.sendCommand('Created', [f.toString()]);
    }.bind(this));

    monitor.on("changed", function (f, curr, prev) {
      console.log('[black-bird-cli]', '[monitor]', 'File changed', f);
      if (this.monitoredFiles[f.toString()]) {
        this.fileChanged(f.toString());
      }
    }.bind(this));

    monitor.on("removed", function (f, stat) {
      console.log('[black-bird-cli]', '[monitor]', 'File removed', f);
      this.sendCommand('Removed', [f.toString()]);
    }.bind(this));

  }.bind(this));
};

module.exports = Client;
