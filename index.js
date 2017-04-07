var monitor = require('chokidar');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var color = require('cli-color');
var fs = require('fs');
var util = require('util');
var commander = require('commander');
var os = require('os');
var path = require('path');
var sleep = require('thread-sleep');
var psTree = require('ps-tree');

var pwd = process.env.PWD;
var config = {
  // pid: os.tmpDir() + '/gharry.pid',
  pid: '',
  pwd: pwd,
  script: 'js',
  execute: 'index.js',
  ignored: '',
  watch: '.',
  safe: true,
};
// process.stdout.write(color.erase.screen);
// process.stdout.write(color.reset);
var watch = function () {
  monitor.watch(config.watch, { ignored: config.ignore })
    .on('change', function (path) {
      console.log(color.cyan('path changed:' + path));
      startUp(path);
    })
    .on('ready', function () {
      startUp();
    })
    .on('unlink', function (path) {
      console.log(color.cyan('path unlink:' + path));
      startUp(path);
    })
    .on('error', function (err) {
      console.log(err);
      stop();
    });
};

var startUp = function (file = '') {
  console.log(color.bgCyan('gharry start up process'));
  var pid = config.pid;
  if (pid) {
    if (!config.safe) {
      // cmd = util.format("ps -C %s | grep -v PID | awk '{print $1}' | xargs kill -15", pid);
      psTree(pid, function (err, kids) {
        var ppid = [pid];
        kids.map(function (p) {
          if (ppid.indexOf(p.PID) === -1) ppid.push(p.PID);
          if(ppid.indexOf(p.PPID) === -1) ppid.push(p.PPID);
        });
        console.log(ppid);
        var kill = spawn('kill', ['-15'].concat(ppid));
        kill.stdout.on('data', function (data) {
          console.log(data.toString);
        });
        kill.stderr.on('data', (data) => {
          console.log(`kill stderr: ${data}`);
        });

        kill.on('close', function (code) {
          if (code !== 0) {
            console.log(`kill process exited with code ${code}`);
          } else {
            run();
          }
        });
        kill.on('error', function (err) {
          console.log('Failed to start child process.', err.message);
        });
      });
    } else {
      if (file === config.execute) {
        process.kill(pid, 'SIGTERM'); // 重启主进程
      } else {
        process.kill(pid, 'SIGUSR1');
        process.kill(pid, 'SIGUSR2');
      }
    }
  } else {
    run();
  }
};

var stop = function () {

};

var run = () => {
  sleep(config.delay || 2000);
  var server = spawn.apply(null, [config.script, [config.execute], { cwd: config.pwd }]);
  console.log(color.green('listen process pid: ', server.pid));
  config.pid = server.pid;
  // var fd = fs.openSync(config.pid, 'w+');
  // fs.writeSync(fd, server.pid);
  // fs.close(fd);
  server.stdout.on('data', function (data) {
    console.log(color.xterm(4)(data.toString()));
  });

  // 捕获标准错误输出并将其打印到控制台
  server.stderr.on('data', function (data) {
    console.log(color.red.bgBlackBright(data.toString()));
  });
  server.on('error', function (err) {
    console.log(err.message);
    // if(err.message === 'spawn js ENOENT') return;
    console.log(color.red('error on process:', err.code), err.message);
    console.log(color.red('stack:', err.stack));
    console.log(color.yellow('wait for change....'))
  });

  server.on('exit', function (code, signal) {
    console.log(color.yellow('process state change, waiting for file changing ...'));
  });
};

commander.version('0.1.2')
// .option('-h, --help', '--help show menus')
  .option('-c, --config <file>', 'use config file');

commander.on('--help', function () {
  console.log(color.green('   --config, use config file'));
});
commander.parse(process.argv);
if (commander.config) {
  var conf = fs.readFileSync(pwd + '/' + commander.config);
  conf = JSON.parse(conf);
  config = Object.assign(config, conf);
}
watch();


