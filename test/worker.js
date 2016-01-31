"use strict";

var http = require("http");

var routes = {
  hello: function(req, res, ctx){
    res.end("Hello World!");
  },
  echo: function(req, res, ctx){
    req.pipe(res);
  },
  config: function(req, res, ctx){
    //console.log(ctx);
    var definition = ctx.worker.definition;
    res.end( JSON.stringify(definition, function(k, v){
      return ("worker" === k)? undefined : v;
    }, 2) );
  },
  "404": function(req, res, ctx){
    res.statusCode = 404;
    res.end('Not Found');
  }
}

function route (req) {
  var routePath = (req.url).replace(/^\/([\w]*).*?$/gi, "$1");
  //console.log("Url requested: ", req.url);
  //console.log("Route matched: ", routePath);

  return routes[routePath] || routes["404"];
};


module.exports = function worker( context ) {
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

    return route(req)(req, res, context);
  });
  server.listen(context.port);
}
