var express = require('express')
  , winston = require('winston')
  , config  = require('config')
  , app     = express();
  
require(__dirname + '/lib/app').setup(app);
app.listen(config.app.port);

winston.info('App now running on port ' + config.app.port);