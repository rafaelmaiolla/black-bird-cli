var io = require('socket.io-client');
var fs = require('fs');
var path = require('path');
var os = require('os');
var recursive = require('recursive-readdir');
var watch = require('watch');
var minimatch = require("minimatch");
var svn = require('svn-interface');
var md5 = require('md5');

function Client(port, fileList) {
  this.port = port;
  this.fileList = fileList;
  console.log('[black-bird-cli]', 'Client port=' + this.port);

  console.log('[black-bird-cli]', 'Connecting...');

  this.socket = io('http://localhost:' + this.port);
  this.handleSocketEvents();
}

Client.prototype.handleSocketEvents = function() {
  this.socket.on('connect', function() {
    console.log('[black-bird-cli]', 'Connected');

    this.socket.emit('black-bird:connect', os.hostname());

    if (this.fileList.length) {
      this.openFileList(this.fileList);
    }
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

Client.prototype.commandClose = function(filePath) {
  console.log('[black-bird-cli]', 'Command Close', filePath);

  this.sendCommand('ConfirmClose', [filePath]);
};

Client.prototype.commandSave = function(filePath, fileContent) {
  console.log('[black-bird-cli]', 'Command Save', filePath);

  if (filePath != '-') {
    var writeStream = fs.createWriteStream(filePath);
    console.log('[black-bird-cli]', 'Saving file', path.basename(filePath));

    writeStream.end(fileContent, "utf8", function() {
      console.log('[black-bird-cli]', 'File saved', path.basename(filePath));
      this.sendCommand('ConfirmSave', [filePath]);
    }.bind(this));

  } else {
    this.sendCommand('SaveRejected', [filePath]);
  }
};

Client.prototype.commandList = function(filePath, ignoredNames) {
  console.log('[black-bird-cli]', 'Command List', filePath, ignoredNames);

  this.createMonitor(filePath, ignoredNames);

  recursive(filePath, ignoredNames, function (err, fileList) {
    console.log('[black-bird-cli]', 'File list', fileList);
    this.sendCommand('List', [filePath, fileList]);
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

      this.sendCommand('Diff', [filePath, data]);
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

Client.prototype.openFile = function(filePath, reopen) {
  console.log('[black-bird-cli]', 'Open file', filePath);

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
      this.sendCommand('Open', [filePath, data]);
    }.bind(this));

  } else if (fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf8', function(err, data) {
      if (err) {
        return console.error('[black-bird-cli]', err);
      }

      console.log('[black-bird-cli]', 'Sending file');
      this.sendCommand('Open', [filePath, data]);

    }.bind(this));

  } else {
    this.sendCommand('Open', [filePath, ""]);
  }
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

Client.prototype.createMonitor = function(filePath, ignoredNames) {
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

  watch.createMonitor(filePath, options, function (monitor) {
    console.log('[black-bird-cli]', '[monitor]', 'Monitor created');
    this.monitor = monitor;

    monitor.on("created", function (f, stat) {
      console.log('[black-bird-cli]', '[monitor]', 'File created', f);
      this.sendCommand('Created', [f.toString()]);
    }.bind(this));

    monitor.on("changed", function (f, curr, prev) {
      console.log('[black-bird-cli]', '[monitor]', 'File changed', f);
      fs.readFile(f, function(err, buf) {
        this.sendCommand('Changed', [f.toString(), md5(buf)]);
      }.bind(this));
    }.bind(this));

    monitor.on("removed", function (f, stat) {
      console.log('[black-bird-cli]', '[monitor]', 'File removed', f);
      this.sendCommand('Removed', [f.toString()]);
    }.bind(this));

  }.bind(this));
};

module.exports = Client;
