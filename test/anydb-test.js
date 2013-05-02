var sqlite3 = require('sqlite3').verbose();
var chai = require('chai');
var Backbone = require('backbone');
var WebSQLStore = require('../backbone-websql.js')
var db = new sqlite3.Database(':memory:');
//var db = openDatabase('bb-websql-tests', '', 'Backbone Websql Tests', 1024*1024);

var assert = chai.assert;

var ThingModel = Backbone.Model.extend({
  'store': new WebSQLStore(db, 'things', null, function() {
    runTest();
  }, function(err) { throw err; })
});
var ThingCollection = Backbone.Collection.extend({
  'model': ThingModel,
  'store': ThingModel.prototype.store
});

function runTest() {
  var model = new ThingModel();
  assert(!model.id);
  model.set({'name': 'some name'})

  model.save(null, cb(function(err) {
    if (err) throw err;//return done('saving failed');
    assert(model.id);
    
    var loadModel = new ThingModel({'id': model.id});
    loadModel.fetch(cb(function(err) {
      if (err) throw err;//return done('loading failed');
      assert.deepEqual(loadModel.toJSON(), model.toJSON());
      //done();
    }));
  }));
}

db.run('CREATE TABLE IF NOT EXISTS `testing` (`id` primary key, `value`)', function(err) {
  if (err) throw err;
  db.run("INSERT INTO testing (id, value) VALUES ('test', 'test1')", function(err) {
    if (err) throw err;
    db.run("INSERT INTO testing (id, value) VALUES ('test', 'test2')", function(err, results) {
      if (err) throw err;
      db.all("SELECT * FROM testing", function(err, results) {
        if (err) throw err;
        console.log(JSON.stringify(results));
        db.close();
      });
    });
  });
});

function cb(options, callback) {
  if (typeof options == 'function') {
    callback = options;
    options = {};
  }
  if (!options) options = {};
  options.success = function() {
    callback.apply(null, [null].concat(arguments));
  };
  options.error = function(model, err) {
    callback.apply(null, [err || true].concat(arguments));
  };
  return options;
}