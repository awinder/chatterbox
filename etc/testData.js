var couchbase = require('couchbase')
  , emitter = require('events').EventEmitter
  , util = require('util')
  , uuid = require('node-uuid')
  , charlatan = require('charlatan')
  , moment = require('moment')
  , _ = require('lodash');

var randomDate = function (start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

randomDate(new Date(2012, 0, 1), new Date())
  
var config = {
  host : [ "127.0.0.1:8091" ],
  bucket: 'chatterbox',
  "operationTimeout" : 20000, 
  "connectionTimeout" : 20000 
};

var db = new couchbase.Connection(config, function(err) {
  if (err) throw err;

  var generator = new DataGenerator()
    , rounds = 6
    , round = 0
    , posts = [];
    
  for (var i = 1; i <= 365; i++) {
    var date = new Date(2013, 0, i);
    posts.push('/blog/' + moment(date).format('YYYY-MM-DD') + '/' + charlatan.Lorem.words().join('-'));
  }
  
  console.log('Generating Mock Comments for the following URIs:');
  posts.forEach(function(post) {
    console.log('\t' + post);
  });
  console.log('-----------------------------------')

  var sent = 0;
      
  generator.on('generated', function(recordIDs) {
    sent += _.size(recordIDs);
    console.log('Generated ' + sent + ' records.');
    
    round++;
    if (round < rounds) {
      generator.setConfig({ 
        records : 1000 * posts.length,
        parents : recordIDs,
        level   : round,
        posts   : posts
      });
      generator.generateRecords();
    } else {
      console.log("Generated " + sent + " total records.");
      process.exit();
    }
    
    delete recordIDs;
  });
  
  generator.setConfig({ records : 100, posts: posts });
  generator.generateRecords();
});

var DataGenerator = function() {
  this.numRecords = 0;
  this.level = 0;
  this.parents = [];
  this.posts = [];
  this.configured = false;
};

util.inherits(DataGenerator, emitter);

DataGenerator.prototype.setConfig = function(conf) {
  if ('records' in conf === false || 'posts' in conf === false) {
    throw "Must specify a number of records to generate";
  }
  
  this.removeAllListeners('batchDone');
  this.posts = conf.posts;
  this.numRecords = conf.records || 0;
  this.level = conf.level || 0;
  this.parents = conf.parents || [];
  this.configured = true;
};

DataGenerator.prototype.generateRecords = function() {
  if (this.configured === false) {
    throw "Must configure your test run before calling into generateRecords";
  }
      
  var self = this
    , docs = []
    , i = 0;
      
  var ids = {}
    , start = 0
    , end = 100;
    
  this.on('batchDone', function(batchIds) {
    if (i % 1000 === 0) {
      console.log((self.numRecords - end) + " left in batch");
    }
    
    start += 100;
    end += 100;
    _.merge(ids, batchIds);
        
    if (i >= this.numRecords) {
      this.emit('generated', ids);
    } else {
      docs = [];
      i += 100;
      
      for (var j = 0; j < 100; j++) {
        docs.push(this.getFakeRecord());
      }
      
      this.setRecords(docs);
    }
  });
  
  for (i; i < 100; i++) {
    docs.push(this.getFakeRecord());
  }
  this.setRecords(docs);
};

DataGenerator.prototype.getFakeRecord = function() {
  var post, parent;
  
  if (_.size(this.parents) === 0) {
    post = this.posts[Math.floor(Math.random()*this.posts.length)];
    parent = '';
  } else {
    post = Object.keys(this.parents)[Math.floor(Math.random() * Object.keys(this.parents).length)]
    parent = this.parents[post][Math.floor(Math.random() * this.parents[post].length)];
  }
    
  var doc = {
    _id  : uuid.v4(),
    type : 'comment',
    post    : post,
    author  : {
      name  : charlatan.Name.name(),
      _link : 'http://' + charlatan.Internet.domainName()
    },
    title   : charlatan.Lorem.sentence(),
    content : charlatan.Lorem.paragraphs(4),
    time    : randomDate(new Date(2012, 0, 1), new Date()).toISOString(),
    parent  : parent,
    level   : this.level
  };
  
  return doc;
};

DataGenerator.prototype.setRecords = function(docs) {
  var self = this
    , sent = 0
    , records = {}
    , numToSend = _.size(docs);

  docs.forEach(function(doc) {
    if (records.hasOwnProperty(doc.post) === false) {
      records[doc.post] = [];
    }
    records[doc.post].push(doc._id);
    
    db.set(doc._id, doc, function(err) {
      sent++; 
      if (sent >= numToSend) {
        self.emit('batchDone', records);
      }
    });
  });
}