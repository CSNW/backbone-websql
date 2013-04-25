(function(Backbone, _) {
var assert = chai.assert;

var ThingModel = Backbone.Model.extend({
  'urlRoot': '/things'
});
var ThingCollection = Backbone.Collection.extend({
  'url': '/things',
  'model': ThingModel
});

var User = Backbone.Model.extend({'urlRoot': '/users'});
var UserCollection = Backbone.Collection.extend({
  'url': '/users',
  'model': User
});

describe('Backbone.WebSQL', function() {

  before(function(done) {
    var db = openDatabase('bb-websql-tests', '', 'Backbone Websql Tests', 1024*1024);
    var routes = {
      '/things': 'things',
      '/users': {'table': 'users', 'cols': ['fname', 'lname']}
    };
    Backbone.WebSQL(db, routes, done);
  });

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

    it('should filter by a custom column', function(done) {
      var model = new User({'fname': 'Fred', 'lname': 'Flintstone'});
      model.save(null, cb(function(err) {
        if (err) return done('User.save() failed: ' + err);
        var opts = {'filters': {'fname': 'Fred'}};
        var coll1 = new UserCollection();
        coll1.fetch(cb(opts, function(err) {
          if (err) return done(err);
          assert.equal(coll1.length, 1);
          
          opts.filters.fname = 'Wilma';
          var coll2 = new UserCollection();
          coll2.fetch(cb(opts, function(err) {
            if (err) return done(err);
            assert.equal(coll2.length, 0);
            done();
          }));
        }));
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

})(Backbone, _);