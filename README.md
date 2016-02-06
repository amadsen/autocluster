# Autocluster

Simplify the semantics for setting up a cluster of node processes

## Install

~~~bash
npm install autocluster
~~~

## Use

*Autocluster should only be used from a single module in a given process - if two modules running in the same process try to use autocluster it will throw an Error.*

Using Autocluster is fairly simple. Autocluster exports a function that you pass a cluster configuration to. Autocluster then builds a cluster matching that configuration. It looks something like this

~~~javascript
var autocluster = require("../index.js"),
    http = require("http");
    
autocluster({
      master: "./lib/master-module.js",
      workers: [{
          type: "worker",
          number: -1,
          fork: {},
          context: {
            port: 8080
          },
          run: "./lib/worker.js"
      }]
});
~~~

**Note**: Each process, master or worker, gets its own copy of the configuration so that workers can access functions defined in the module. _Changes to one process' configuration **are not** reflected in any of the other processes._ It is advised tha you make sure your configuration does not vary between proceeses.

## Cluster Configuration

An autocluster cluster configuration contains two top level keys

+ **master** - this should be function or a relative path to a module to be loaded in the context of the file in which the configuration is being passed to autocluster. If a function is provided or the module exports a function, cluster will call it, passing in one argument with two keys, **conf** containging the active configuration, and an **on** method that lets you register event listeners on the cluster's master process.
+ **workers** - This may be a string, a function, a number, an object, or an array. In each case it is converted to a list containing worker definition objects. 
	+ A string will be treated as a value for that worker definition's **run** key - that is, a path to a module - and loaded aproprately. Default values for all other keys will be used.
	+ A function will be treated as a value for that worker definition's **run** key. Default values for all other keys will be used.
	+ A number will be treated as the value for that worker definition's **number** key. Default values for all other keys will be used.

### Worker Definitions

A worker definition defines these keys

+ **type** - *String*, an arbitrary name describing the type of worker process. Default: `"worker"`.
+ **number** - *Integer*, Indicates the number of worker processes to generate. Positive numbers are an explicit count - exactly that many will be generated. Zero means use the cpu count. Negative values are subtracted from the number of cpus available and the resulting number of processes are generated. Default: `0`.
+ **fork** - *Object*, _env_ to send to [`cluster.fork()`](https://nodejs.org/api/cluster.html#cluster_cluster_fork_env) for this child. Default: `undefined`.
+ **context** - *Object*, worker-type specific configuration to pass to the worker process when it comes online. Default: `{}`.
+ **run** - *String* or *function*, the actual functionality of the worker. It may be a function or path to a module to be required. If it resolves to a function, the function will be called and passed the `context` defined for this worker type, with the worker available as `context.worker` and the worker definition as `context.worker.definition`. Default: `undefined`.

Keep in mind that your calling module will be run for each process. Further, a module required for a worker definition will be run by that worker process. Therefore it is not neccesary to export a function from a module to use it to set up a worker process. However, if such a module does export a function _it will be called_.