var commander = require('commander');
var os = require('os');
var fs = require('fs');
var yaml = require("js-yaml");
var path = require("path");

var settings, options, files;

function loadDiskConfig() {
  var homePath = process.env[(os.platform() == "win32" ? "USERPROFILE" : "HOME")];

  var file = path.join(homePath, ".black-birdrc");

  var rcFile;
  if (fs.existsSync(file)) {
    rcFile = file;
  }

  if (rcFile) {
    try {
      var params = yaml.safeLoad(fs.readFileSync(rcFile, "utf8"));
      options.host = params.host || options.host,
      options.port = params.port || options.port

    } catch(ex) {
      console.error(ex);
    }
  }
}

function loadSettings() {
  options = {
    host: "localhost",
    port: 52690,
    wait: false,
    force: false,
    verbose: false,
    lines: [],
    names: [],
    types: [],
  };

  loadDiskConfig();

  options.host = process.env.BLACK_BIRD_HOST || options.host;
  options.port = process.env.BLACK_BIRD_PORT || options.port;
}

loadSettings();

commander
  .version(require("../package.json").version)
  .usage("[options] <file ...>")
  .option("-h, --host <str>", "Connect to host. Use 'auto' to detect the host from SSH. Defaults to '" + options.host + "'.")
  .option("-p, --port <num>", "Port number to use for connection. Defaults to " + options.port + ".", parseInt)
  .option("-w, --wait", "Wait for file to be closed by editor.")
  // .option("-l, --line <num>", "Place caret on line <num> after loading file.", parseInt)
  // .option("-n, --name <str>", "The display name shown in editor.")
  // .option("-t, --type <str>", "Treat file as having type <str>.")
  .option("-f, --force", "Open even if the file is not writable.")
  .option("-v, --verbose", "Verbose logging messages.")
  .option('-c, --connect', 'Connect to remote server to list files and watch for changes');

commander.parse(process.argv)

options.host = commander.host || options.host;
options.port = commander.port || options.port;
options.wait = commander.wait || options.wait;
// options.lines.push commander.line || options.line;
// options.names.push commander.name || options.name;
// options.types.push commander.type || options.type;
options.force = commander.force || options.force;
options.verbose = commander.verbose || options.verbose;

if (options.host == "auto") {
  options.host = (process.env.SSH_CONNECTION ? process.env.SSH_CONNECTION.split(" ")[0] : "localhost");
}

function fatalError(msg) {
  console.error(msg);
  process.exit(1)
}

function fileIsWritable(file) {
  try {
    var fd = fs.openSync(file, "a");
    fs.closeSync(fd);
    return true;

  } catch(ex) {
    return false;
  }
}

files = commander.args;

if (files.length == 0 && !process.stdin.isTTY) {
  files.push('-');
}

files.forEach(function(file, index, list) {
  if (fs.existsSync(file)) {
    var stat = fs.statSync(file);
    if (stat.isDirectory()) {
      fatalErr(file + " is a directory. aborting...");
    }
    if (!fileIsWritable(file)) {
      if (options.force) {
        console.error("file " + file + " is not writable.  Opening anyway.");

      } else {
        fatalErr("file " + file + " is not writable.  Use -f/--force to open anyway")
      }
    }
  }
});

settings = {
  options: options,
  files: files,
  fileIsWritable: fileIsWritable
};

module.exports = settings;
