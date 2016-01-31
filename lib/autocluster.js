"use strict";

var os = require('os'),
    cluster = require("cluster");

// keep track of workers configuraton as an object mapping type to config
var conf,
    workerTypeMap;
module.exports = function autoclusterForRequire(requireInCallerContext){
  return function autocluster ( configureCluster ) {
    // Note: Each process, master or worker, gets its own copy of the
    // configuration so that workers can access functions defined in the module.
    conf = ('function' === typeof configureCluster)? configureCluster() : configureCluster;
    workerTypeMap = normalizeWorkerTypes(conf);

    if (cluster.isMaster) {
      console.log("Configuration: ", conf);
      console.log("Worker Type Map: ", workerTypeMap);

      return startMaster();
    } else {
      return setupWorker();
    }
  };

  /* Functions run inside the worker processes */
  function setupWorker () {
    // We must be IN a child process, so we're already clustering

    var messageHandlers = {
      "init-worker": function initWorkMsgHandler(msg) {
        // figure out which type of worker we are supposed to be by
        // listening for the 'init-worker' message from the master process
        return initWorker( msg.definition );
      }
    }

    // listen for messages from the master process
    process.on('message', function(msg, handle) {
      msg = msg || {};

      var handler = messageHandlers[ msg.type ];
      if ("function" === typeof handler) {
        return handler(msg, handle);
      }
    });
  }

  function initWorker (workerTypeDefinition) {
    var ctx = workerTypeDefinition.context || {},
    // Note: Since we cannot pass functions across the process boundry
    // we pass the original configuration (as instantiated by the calling module
    // in each process) to both the master process and all workers. Users should
    // make sure their function runs consistently given these conditions.
        run = workerTypeMap[ workerTypeDefinition.type ].run;

    ctx.worker = Object.create(cluster.worker);
    ctx.worker.definition = workerTypeDefinition;
    if( "string" === typeof run ) {
      // deliberately blow up here if someone passed a bad config
      run = requireInCallerContext(run);
    }

    if( "function" === typeof run ) {
      run( ctx );
    }
  }

  /* Functions run in the master process */
  function startMaster() {
    // master process

    // facade / helper function for listening to cluster events
    function on( event, listener ){
      cluster.on(event, function(worker){
        var args = [].slice.call(arguments, 1);
        if (worker.id && idToTypeMap[worker.id]) {
          // augment the normal worker object with the worker's
          // Worker Type Definition
          worker = Object.create(worker);
          worker.definition = workerTypeMap[ idToTypeMap[worker.id] ];
        }
        args.unshift(worker);
        listener.apply(this, args);
      });
    }

    // function for forking workers while tracking which type a given
    // worker id should be.
    function forkWorkerForTypeDefinition (workerTypeDefinition) {
      console.log("Forking worker:\n", workerTypeDefinition);

      var worker = cluster.fork( workerTypeDefinition.fork );
      idToTypeMap[ worker.id ] = workerTypeDefinition.type;
    }

    // track CPUs
    var numCPUs = os.cpus().length;

    // keep track of workers configuraton as an object mapping type to config
    var idToTypeMap = {},
        master = conf.master;

    if ('string' === typeof master) {
      // deliberately blow up here if someone passed a bad config
      master = requireInCallerContext(master);
    }

    if('function' === typeof master){
      // run the master function, providing the config and a proxy to the
      // Cluster event emitters
      master({
        config: conf,
        on: on
      });
    }

    // when child processes die, restart them - we should only try
    // to kill the service via the master process
    on('exit', function (worker) {
      if (worker.suicide !== true) {
        forkWorkerForTypeDefinition( worker.definition );
      }
    });

    // Whenever a worker comes online, figure out what type of worker it is
    // supposed to be and send it the right config.
    on('online', function (worker) {
      worker.send({
        type: "init-worker",
        definition: worker.definition
      });
    });

    Object.keys(workerTypeMap).forEach( function spawnWorkersForType (type) {
      var workerTypeDefinition = workerTypeMap[ type ],
          numWorkers = numCPUs,
          requested = workerTypeDefinition.number || 0;

      console.log("Preparing to fork workers for definition: ", workerTypeDefinition);

      if(requested <= 0){
        // adding the zero or negative value subtracts it from the number of
        // available CPU cores previously recorded.
        numWorkers += requested;

        // minimum of 1
        numWorkers = (numWorkers > 1)? numWorkers : 1;
      } else if(requested > 0){
        numWorkers = requested;
      }

      console.log("Forking ", numWorkers, " of type ", type);

      // Create the specified number of workers
      for (var i = 0; i < numWorkers; i += 1) {
        forkWorkerForTypeDefinition( workerTypeDefinition );
      }
    });

  }


  function normalizeWorkerTypes (conf) {

    function toTypeMap (workerTypeList) {
      return workerTypeList.reduce( function (types, worker){
        worker.type = worker.type || "worker";
        types[worker.type] = worker;
        return types;
      },{});
    }

    var converters = {
      function: function (workers) {
        return [{ server: workers }];
      },
      string: function (workers) {
        return [{ server: workers }];
      },
      object: function (workers) {
        if ( Array.isArray(workers) ){
          return workers;
        }

        if(!workers){
          return [];
        }

        return [workers];
      },
      number: function (workers) {
        return [{ number: workers }];
      },
      undefined: function (workers) {
        return [];
      }
    }

    // if conf.workers is not yet an array, convert it
    var convert = converters[ typeof conf.workers ] || converters.undefined;
    conf.workers = convert(conf.workers);

    // further, if any elements within conf.workers are something other than
    // an object, we'd best convert them too.
    conf.workers = conf.workers.reduce( function (list, workerTypeDefinition) {
      var convert = converters[ typeof workerTypeDefinition ] || converters.undefined,
          result = convert(workerTypeDefinition);

      if(result){
        list = list.concat(result);
      }

      return list;
    }, []);

    return toTypeMap(conf.workers);
  }

}
