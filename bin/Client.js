var io = require('socket.io-client');
var fs = require('fs');
var path = require('path');
var os = require("os");

function Client(port, connect) {
  this.socket = io('http://localhost:' + port);

  socket.on('connect', function() {
    console.log('connect');
  });

  socket.on('cmd', function(data) {
    console.log('cmd');
  });

  socket.on('disconnect', function() {
    console.log('disconnect');
  });

  socket.on('error', function(err) {
    console.error(err);
  });

  if (connect) {
    socket.emit('black-bird:connect');
  }

  this.openFile(".test");
}

Client.prototype.openFile = function(filePath) {
  var commandData = {
    token: path.resolve(filePath),
    displayName: path.basename(filePath),
    remoteAddress: os.hostname(),
    baseName: path.basename(filePath)
  };

  fs.readFile(filePath, 'utf8', function (err, data) {
    if (err) {
      return console.log(err);
    }

    this.socket.emit('black-bird:cmd',  {
      f: 'Open',
      arguments: commandData
    });
  });
}

module.exports = Client;
