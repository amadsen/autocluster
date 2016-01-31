"use strict";

var autocluster = require("../index.js"),
    http = require("http");
module.exports = startTestHttpServer;

function startTestHttpServer() {
  var statsWorkerQueue = [],
      statsWorker;
  function sendToAdmin () {
      var args = [].slice.call(arguments);
      statsWorkerQueue.push(args);

      if(statsWorker){
        setImmediate( function(){
          while(statsWorkerQueue.length > 0){
            statsWorker.send.apply(statsWorker, statsWorkerQueue.pop());
          }
        });
      }
  };

  autocluster({
      master: function (master){
        console.log("Setting up master process.");

        master.on('online', function (worker) {
          if((worker.definition || {}).type === "stats"){
            statsWorker = worker;
          }

          console.log("Worker process came online: ", worker);

          sendToAdmin({
            type: "worker-online",
            payload: {
              id: worker.id,
              definition: worker.definition
            }
          });
        });

        master.on('listening', function (worker, addressInfo) {
          console.log("Worker process listening: ", worker, addressInfo);
          sendToAdmin({
            type: "worker-listening",
            payload: {
              id: worker.id,
              definition: worker.definition
            }
          });
        });

        master.on('exit', function (worker) {
          console.log("Worker process exiting: ", worker);
          sendToAdmin({
            type: "worker-exit",
            payload: {
              id: worker.id,
              definition: worker.definition
            }
          });
        });
      },
      workers: [
        {
          type: "stats", // an arbitrary name describing the type of worker process
          number: 1,     // positive numbers are an explicit count, zero means use
                         // the number of cpus available, and negative
                         // numbers are relative to the number of cpus available
          fork: {        // env to send to cluster.fork() for this child
            silent: true
          },
          context: {      // worker-type specific config to pass to the worker
            port: 8081   //   process when it comes online.
          },
          // 'run' is the actual functionality of the worker. It may be a
          // function or path to a module that exports a function.
          // ****
          // Note: using a function may have surprising effects if you use
          // variables from the function's closure since the configuration is
          // actually prepared and passed in the each worker distinctly from
          // the master process so that functions can work at all. Each process
          // has it's own instance of the function (or module).
          run: function (context) {
            var stats = {
              count: {},
              list: []
            };

            context.worker.on("message", function(msg){
              console.log("Stats worker recieved ", msg);
              stats.count[msg.type] = (!stats.count[msg.type])? 1 : (stats.count[msg.type] + 1);
              stats.list.push(msg);
              console.log("Stats worker is ", context.worker.id);
              console.log("Stats worker has ", stats);
            });

            var server = http.createServer();
            server.on('request', function(req, res) {
              req.on('error', function(err) {
                console.error(err);
                res.statusCode = 400;
                res.end();
              });
              res.on('error', function(err) {
                console.error(err);
              });

              console.log("In request handler stats worker is ", context.worker.id);
              console.log("In request handler stats worker has ", stats);

              res.end(JSON.stringify(stats, null, 2));
            });
            server.listen(context.port);
          }
        },
        {
          type: "worker", // an arbitrary name describing the type of worker process
          number: -1,     // positive numbers are an explicit count, zero means use
                         // the number of cpus available, and negative
                         // numbers are relative to the number of cpus available
          fork: {},      // env to send to cluster.fork() for this child
          context: {      // worker-type specific config to pass to the worker
            port: 8080   //   process when it comes online.
          },
          // 'run' is the actual functionality of the worker. It may be a
          // function or path to a module that exports a function.
          run: "./worker.js"
        }
      ]
  });
};

//if(module === process.mainModule) {
  startTestHttpServer();
//}
