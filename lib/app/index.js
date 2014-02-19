var express   = require('express')
  , logger    = require('winston')
  , config    = require('config')
  , handlers  = require(__dirname + '/handlers');

module.exports = {
  setup : function(app) {
    app.use(express.compress());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.query());
    app.use(express.cookieParser(config.app.cookie_secret));
    app.use(express.session());

    app.use(app.router);
    app.use('/', handlers);
      
    app.use(function catchAllErrorHandler(err, req, res, next){
      logger.error(err.stack);
      res.send(500);
    });
  }
};