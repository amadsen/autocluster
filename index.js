"use strict";

/*
This module is a facade layer that we use to do an evil trick and get our calling
module. See http://stackoverflow.com/questions/13651945/what-is-the-use-of-module-parent-in-node-js-how-can-i-refer-to-the-requireing.
*/
var crash = require("./lib/crash.js"),
    autocluster = require("./lib/autocluster.js")

module.exports = autocluster( function(id){
  return module.parent.require(id);
});

// This is the evil trick - we delete ourselves from the module cache, which
// would be a performance hit (pulling the module off of the file system and
// reparsing and executing the javascript.) On the other hand, if you are using
// autocluster from more than one module, that in and of it's self is going to
// cause problems. Therefore, we deliberately throw an error if we detect it
// happening.
delete require.cache[__filename];
crash(module.parent.filename);
