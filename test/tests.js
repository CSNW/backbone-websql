(function(root) {

var _ = root._ || require('underscore');
var Backbone = root.Backbone || require('backbone');
var WebSQLStore = Backbone.WebSQLStore || require('../backbone-websql.js')
var async = root.async || require('async');
var chai = root.chai || require('chai');
var assert = chai.assert;

var db;
if (root.openDatabase) {
  var db = openDatabase('bb-websql-tests', '', 'Backbone Websql Tests', 1024*1024);
}
else {
  var sqlite3 = require('sqlite3').verbose();
  var db = new sqlite3.Database(':memory:');
}

var ThingModel, ThingCollection;

describe('Backbone.WebSQL', function() {

  before(function(done) {
    ThingModel = Backbone.Model.extend({
      'store': new WebSQLStore(db, 'things', function() { done(); }, function(err) { done(err); })
    });
    ThingCollection = Backbone.Collection.extend({
      'model': ThingModel,
      'store': ThingModel.prototype.store
    });
  })

  afterEach(teardown);

  it('should save/load by id', function(done) {
    var model = new ThingModel();
    assert(!model.id);
    model.set({'name': 'some name'})

    model.save(null, cb(function(err) {
      if (err) return done('saving failed');
      assert(model.id);
      
      var loadModel = new ThingModel({'id': model.id});
      loadModel.fetch(cb(function(err) {
        if (err) return done('loading failed');
        assert.deepEqual(loadModel.toJSON(), model.toJSON());
        done();
      }));
    }));
  });

  it('should not save apiid ', function(done) {
    var model = new ThingModel({'name': 'some thing'});
    model.set({'apiid': Date.now()});

    model.save(null, cb(function(err) {
      if (err) return done(err);
      assert(model.id);
      
      var model2 = new ThingModel({'id': model.id});
      model2.fetch(cb(function(err) {
        if (err) return done('model2.fetch() failed');
        assert.equal(model2.get('name'), model.get('name'));
        assert(!model2.get('apiid'), 'should not save apiid');
        done();
      }));
    }));
  });

  describe('Collection.fetch()', function() {
    it('should populate the collection', function(done) {
      var coll = new ThingCollection();
      var model = new ThingModel({name: 'some thing'});
      
      model.save(null, cb(function(err) {
        if (err) return done('model.save() failed');

        coll.fetch(cb(function(err) {
          if (err) return done('coll.fetch() failed');
          assert.equal(coll.length, 1);
          done();
        }));
      }));
    });

    it('should work, even if Model.fetch() is called immediately after it', function(done) {
      var coll = new ThingCollection();
      var model = new ThingModel({name: 'some thing'});
      
      model.save(null, cb(function(err) {
        if (err) return done('model.save() failed');

        var model2 = new ThingModel({'id': model.id});
        async.parallel([
          function(callback) { coll.fetch(cb(callback)); },
          function(callback) { model2.fetch(cb(callback)); }
        ], function(err) {
          if (err) return done('fetch() failed');
          assert.equal(coll.length, 1);
          assert.equal(model2.get('name'), 'some thing');
          done();
        });
      }));
    });
  });

  describe('Model.fetch()', function() {
    it('should update a single model', function(done) {
      var model = new ThingModel({name: 'some thing'});
      model.save(null, cb(function(err) {
        if (err) return done('model.save() failed');

        var model2 = new ThingModel({id: model.id});
        model2.fetch(cb(function(err) {
          if (err) return done('model2.fetch() failed');

          assert.equal(model2.get('name'), 'some thing');
          done();
        }));
      }));
    });
  });
});

function teardown(done) {
  var coll = new ThingCollection();
  coll.fetch(cb(function(err) {
    if (err) return done('teardown fetch failed');
    var models = _.clone(coll.models);
    async.forEach(models, destroy, function(err) {
      if (err) return done('model.destroy() failed');
      done();
    });

    function destroy(model, callback) {
      model.destroy(cb(callback));
    }
  }));
}

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

})(this);