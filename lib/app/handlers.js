var express = require('express')
  , app = express();
  
var exports = module.exports = app;
exports.callbacks = require(__dirname + '/controller');

app.get('/', exports.callbacks.index);
app.get('/comments', exports.callbacks.getCommentsList);
app.get('/comments/:commentKey', exports.callbacks.getCommentsForArticle);
app.post('/comments/:commentKey', exports.callbacks.putCommentForArticle);