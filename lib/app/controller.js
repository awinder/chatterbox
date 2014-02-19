var _ = require('lodash')
  , moment = require('moment')
  , couchbase = require('couchbase')
  , uuid = require('node-uuid');
  
module.exports = {
  index : function(req, res) {
    res.send({ 
      _links : [
        {
          href: "/comments",
          rel: "next"
        }      
      ]
    });
  },
  getCommentsList : function(req, res) {
    var db = new couchbase.Connection({bucket: "chatterbox"}, function(err) {
      if (err) throw err;
      
      db.view('comments_by_article', 'List Articles').query({group: true}, function(err, results) {
        if (err) throw err;
        
        var comments = {
          comments : []
        }
        
        results.forEach(function(val) {
          comments.comments.push({
            _href : '/comments/' + encodeURIComponent((val.key.substr(0,1) === '/') ? val.key.substr(1, val.key.length - 1) : val.key)
          });
        });
        
        res.send(comments);
      });      
    });
  },
  getCommentsForArticle : function(req, res) {
    var db = new couchbase.Connection({bucket: "chatterbox"}, function(err) {
      var articleId = req.params.commentKey
        , options = {
          startkey : ['/' + articleId],
          endkey : ['/' + articleId, 10],
          full_set: true
        };
                    
      db.view('comments_by_article', 'View Comments By Article').query(options, function(err, results) {
        var parents = {}
          , node
          , roots = [];
          
        for (var i = 0; i < results.length; i += 1) {
          node = results[i].value;
          node.children = [];
          parents[node['_id']] = i;
          
          if (node.parent !== '') {
            if (typeof results[parents[node.parent]] !== 'undefined') {
              results[parents[node.parent]].value.children.push(node);
            }            
          } else {
            roots.push(node);
          }
        }
        
        res.send(roots);
      });
    });
  },
  putCommentForArticle : function(req, res) {
    var record = req.body
      , errors = [];
    
    if (typeof record._id !== 'undefined') {
      delete record._id;
    }
    if (record.type !== 'comment') {
      errors.push('Document must have type `comment`');
    }
    if (record.hasOwnProperty('author') === false || record.author.hasOwnProperty('name') === false) {
      errors.push('Document must have an author property, which has a name property');
    }
    if (record.hasOwnProperty('title') === false || record.hasOwnProperty('content') === false) {
      errors.push('Document must have a title and content property');
    }
    if (record.hasOwnProperty('time') === false || typeof Data.parse(record.time) !== 'object') {
      record.time = new Date();
    }
    if (req.params.hasOwnProperty('commentKey') === false) {
      errors.push('Must specify comment url as a request parameter.');
    }
    
    record._id = uuid.v4();
    record.time = Date.parse(record.time);
    record.time = moment(record.time).format();
    record.post = '/' + req.params.commentKey;
    
    if (errors.length > 0) {
      res.send({
        errors: errors,
        response: false
      }, 500);
      return;
    }
    
    var db = new couchbase.Connection({bucket: "chatterbox"}, function(err) {
      if (record.hasOwnProperty('parent')) {
        db.get(record.parent, function(err, result) {
          if (err && err.code === 13) {
            res.send({
              errors: [
                {
                  message: "ERROR: Parent key did not exist"
                }
              ],
              response: false
            }, 500);
          } else {
            record.level = ++result.value.level;
            db.add(record._id, record, function(err, result) {
              if (typeof err === 'undefined') {
                res.send({
                  errors: [],
                  response: {
                    status: 'added',
                    record: record
                  }
                }, 200)
              } else {
                res.send({
                  errors: [
                    {
                      message: "Error creating comment."
                    }
                  ],
                  response: false
                })
              }
            })
          }
        });
      } else {
        record.parent = "";
        record.level = 0;
        
        db.add(record._id, record, function(err, result) {
          if (typeof err === 'undefined') {
            res.send({
              errors: [],
              response: {
                status: 'added',
                comment: record
              }
            }, 200)
          } else {
            res.send({
              errors: [
                {
                  message: "Error creating comment."
                }
              ],
              response: false
            })
          }
        });
      }
    });    
  }
};