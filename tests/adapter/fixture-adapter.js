var User, adapter, oldAdapter;

module('BD.FixtureAdapter', {

    setup: function() {
        BD.FixtureRequest.reopen({ DELAY: 0 });
        oldAdapter = BD.store.get('adapter');
        adapter = BD.FixtureAdapter.create();
        BD.store.set('adapter', adapter);
        App.Category = BD.Model.extend({
            name: BD.attr('string'),
            luckyNumber: BD.attr('number'),
            posts: BD.hasMany('App.Post', 'category'),
            isPublic: BD.attr('boolean', {readonly: true})
        });
        App.Category.registerSortMacro('macroTest', ['name'], function(a, b) {
            //Sort by char length of name
            return a.get('name').length - b.get('name').length;
        });
        App.Post = BD.Model.extend({
            category: BD.belongsTo('App.Category'),
            title: BD.attr('string'),
            comments: BD.hasMany('App.Comment', 'post', {isEmbedded: true})
        });
        App.Comment = BD.Model.extend({
            post: BD.belongsTo('App.Post', {isParent: true}),
            message: BD.attr('string')
        });
        adapter.setFixtures(App.Category, [
            {
                id: 1,
                name: 'Billy',
                luckyNumber: 77
            },
            {
                id: 2,
                name: 'Noah',
                luckyNumber: 2
            }
        ]);
    },

    teardown: function() {
        BD.store.set('adapter', oldAdapter);
        BD.store.reset();
        App.Category = null;
    }

});

test('`load` persists the data in the fixtures', function() {
    adapter.setFixtures(App.Category, []);
    App.Category.load({
        id: 3,
        name: 'Sebastian',
        isPublic: true
    });
    var fixtures = adapter.fixturesForType(App.Category);
    equal(fixtures.length, 1);
    equal(fixtures[0].id, 3);
    equal(fixtures[0].name, 'Sebastian');
    equal(fixtures[0].isPublic, true);
});

asyncTest('`deleteRecords` deletes multiple records', function() {
    var records = [App.Category.find(1), App.Category.find(2)];
    var success = function(payload) {
        equal(adapter.fixturesForType(App.Category).length, 0)
        start();
    };
    adapter.deleteRecords(BD.store, App.Category, records, success, $.noop);
});

asyncTest('`adapter.deleteRecord` deletes the record', function() {
    var category = App.Category.find(1);
    var success = function(payload) {
        var fixtures = adapter.fixturesForType(App.Category);
        equal(fixtures.length, 1)
        equal(fixtures[0].id, 2);
        start();
    };
    adapter.deleteRecord(BD.store, category, 1, success, $.noop);
});

asyncTest('`record.deleteRecord` deletes the record', function() {
    var category = App.Category.find(1);
    category.deleteRecord()
        .success(function() {
            var fixtures = adapter.fixturesForType(App.Category);
            equal(fixtures.length, 1);
            equal(fixtures[0].id, 2);
            start();
        });
});

asyncTest('when parent record is saved, deleted embedded records should be unloaded', function() {
    var post = App.Post.load({
        id: 'postx1'
    });
    var comment = App.Comment.load({
        id: 'commentx1',
        postId: 'postx1'
    });
    comment.deleteRecord()
        .success(function() {
            equal(adapter.fixturesForType(App.Comment).length, 1, 'comment should not have been deleted yet');
            post.save({
                embed: ['comments']
            })
                .success(function() {
                    equal(adapter.fixturesForType(App.Comment).length, 0, 'comment should be deleted now');
                    start();
                });
        });
});

asyncTest('when parent record is deleted, embedded records should be unloaded', function() {
    var post = App.Post.load({
        id: 'postx1'
    });
    var comment = App.Comment.load({
        id: 'commentx1',
        postId: 'postx1'
    });
    post.get('comments'); //Trigger load of hasMany relationship
    post.deleteRecord()
        .success(function() {
            equal(adapter.fixturesForType(App.Post).length, 0, 'comment should be deleted now');
            equal(adapter.fixturesForType(App.Comment).length, 0, 'comment should be deleted now');
            start();
        });
});

asyncTest('`findOne` should return the found model', function() {
    var category = App.Category.createRecord();
    var success = function(payload) {
        notStrictEqual(payload.category, adapter.fixturesForType(App.Category)[0], 'data should be a copy');
        equal(payload.category.name, 'Billy');
        start();
    };
    adapter.findOne(BD.store, App.Category, category, 1, {}, success, $.noop);
});

asyncTest('`findOne` should call error if the model is not found in fixtures', function() {
    var category = App.Category.createRecord();
    var success = function() {
        throw new Error('Should not be called.');
    };
    var error = function(payload, statusCode) {
        equal(statusCode, 404);
        start();
    };
    adapter.findOne(BD.store, App.Category, category, 999, {}, success, error);
});

asyncTest('`saveRecord` adds one item when fixtures are empty and finds first available id', function() {
    adapter.setFixtures(App.Category, [
        {
            id: 'category1',
            name: 'Billy',
            luckyNumber: 77
        },
        {
            id: 'category2',
            name: 'Noah',
            luckyNumber: 2
        }
    ]);
    var success = function(payload) {
        var fixtures = adapter.fixturesForType(App.Category);
        equal(fixtures.length, 3);
        equal(fixtures[2].id, 'category3');
        equal(fixtures[2].name, 'Adam');
        equal(fixtures[2].isPublic, true);
        start();
    };
    var error = function() {};
    var record = App.Category.createRecord({
        name: 'Adam',
        isPublic: true
    });
    var data = {};
    data[BD.store._rootForType(record.constructor)] = record.serialize();
    adapter.saveRecord(BD.store, record, data, {}, success, error);
});

asyncTest('`saveRecord` adds one item when already fixtures exist', function() {
    expect(1);
    var success = function(payload) {
        equal(adapter.fixturesForType(App.Category).length, 3);
        start();
    };
    var error = function() {};
    var record = App.Category.createRecord({ name: 'Adam' });
    var data = {};
    data[BD.store._rootForType(record.constructor)] = record.serialize();
    adapter.saveRecord(BD.store, record, data, {}, success, error);
});

asyncTest('`saveRecord` calls `success` with a payload', function() {
  expect(1);
  var error = function() {};
  var success = function(payload) {
      // Make sure we get called
      ok(true);
      start();
  };
  var record = App.Category.find(1);
  var data = {};
  data[BD.store._rootForType(record.constructor)] = record.serialize();
  adapter.saveRecord(BD.store, record, data, {}, success, error);
});

asyncTest('Calling `save` on a record with embedded records should persist them all in fixtures', function() {
    adapter.setFixtures(App.Category, []);
    var category = App.Category.createRecord({
        name: 'Crazy'
    });
    var post1 = App.Post.createRecord({
        category: category,
        title: 'This is crazy'
    });
    var post2 = App.Post.createRecord({
        category: category,
        title: 'This is also crazy'
    });
    category.save({
        embed: ['posts']
    })
        .success(function() {
            equal(adapter.fixturesForType(App.Category).length, 1, 'Category was persisted');
            equal(adapter.fixturesForType(App.Post).length, 2, 'Posts were persisted');
            equal(category.get('id'), 'category1');
            equal(post1.get('id'), 'post1');
            equal(post2.get('id'), 'post2');
            strictEqual(post1.get('category'), category);
            strictEqual(post2.get('category'), category);
            equal(category.get('name'), 'Crazy');
            equal(post1.get('title'), 'This is crazy');
            equal(post2.get('title'), 'This is also crazy');
            start();
        });
});

asyncTest('Creating a record with a null belongsTo should set the fixture property to null too', function() {
    adapter.setFixtures(App.Post, []);
    var post = App.Post.createRecord({
        category: null
    });
    post.save()
        .success(function() {
            var fixtures = adapter.fixturesForType(App.Post);
            equal(fixtures.length, 1, 'Post was persisted');
            strictEqual(fixtures[0].categoryId, null);
            start();
        });
});

asyncTest('Properties in save() options should be persisted in fixtures for new records', function() {
    adapter.setFixtures(App.Category, []);
    var post = App.Category.createRecord({
        name: 'Arnold'
    });
    post.save({
        properties: {
            name: 'John'
        }
    })
        .success(function() {
            var fixtures = adapter.fixturesForType(App.Category);
            strictEqual(fixtures[0].name, 'John');
            strictEqual(post.get('name'), 'John');
            start();
        });
});

asyncTest('`findByQuery` calls success with a filtered payload and ignores pageSize and offset', function() {
    var success = function(payload) {
        equal(payload.categories.length, 1);
        notStrictEqual(payload.categories[0], adapter.fixturesForType(App.Category)[1], 'data should be a copy');
        equal(payload.categories[0].id, 2);
        equal(payload.categories[0].name, 'Noah');
        start();
    };
    var query = {
        name: 'Noah',
        pageSize: 100,
        offset: 100,
        include: 'category.thing'
    };
    adapter.findByQuery(BD.store, App.Category, query, success, $.noop, $.noop);
});

asyncTest('`findByQuery` respects sortProperty', function() {
    var success = function(payload) {
        equal(payload.categories.length, 2);
        equal(payload.categories[0].name, 'Billy');
        equal(payload.categories[1].name, 'Noah');
        start();
    };
    var query = {
        sortProperty: 'name'
    };
    adapter.findByQuery(BD.store, App.Category, query, success, $.noop, $.noop);
});

asyncTest('`findByQuery` respects sortProperty and sortDirection', function() {
    var success = function(payload) {
        equal(payload.categories.length, 2);
        equal(payload.categories[0].name, 'Noah');
        equal(payload.categories[1].name, 'Billy');
        start();
    };
    var query = {
        sortProperty: 'name',
        sortDirection: 'DESC'
    };
    adapter.findByQuery(BD.store, App.Category, query, success, $.noop, $.noop);
});

asyncTest('`findByQuery` sortProperty on numbers', function() {
    adapter.findByQuery(BD.store, App.Category, {sortProperty: 'luckyNumber'}, function(payload) {
        equal(payload.categories.length, 2);
        equal(payload.categories[0].luckyNumber, 2);
        equal(payload.categories[1].luckyNumber, 77);
        start();
    }, $.noop, $.noop);
});

asyncTest('`findByQuery` sortProperty on numbers DESC', function() {
    adapter.findByQuery(BD.store, App.Category, {sortProperty: 'luckyNumber', sortDirection: 'DESC'}, function(payload) {
        equal(payload.categories.length, 2);
        equal(payload.categories[0].luckyNumber, 77);
        equal(payload.categories[1].luckyNumber, 2);
        start();
    }, $.noop, $.noop);
});

asyncTest('`findByQuery` sort using sort macro ASC', function() {
    adapter.findByQuery(BD.store, App.Category, {sortProperty: 'macroTest'}, function(payload) {
        equal(payload.categories.length, 2);
        equal(payload.categories[0].name, 'Noah');
        equal(payload.categories[1].name, 'Billy');
        start();
    }, $.noop, $.noop);
});

asyncTest('`findByQuery` sort using sort macro DESC', function() {
    adapter.findByQuery(BD.store, App.Category, {sortProperty: 'macroTest', sortDirection: 'DESC'}, function(payload) {
        equal(payload.categories.length, 2);
        equal(payload.categories[0].name, 'Billy');
        equal(payload.categories[1].name, 'Noah');
        start();
    }, $.noop, $.noop);
});

asyncTest('`commitTransactionBulk` adds items not saved in the fixtures', function() {
    expect(1);
    var error = function() {};
    var data = { categories: [{name: 'Tesla'}, {name: 'Edison'}] };
    var success = function(payload) {
        equal(adapter.fixturesForType(App.Category).length, 4);
        start();
    };
    adapter.commitTransactionBulk(BD.store, App.Category, 'categories',
                                  data, success, error);
});

asyncTest('`commitTransactionBulk` updates items saved in the fixtures', function() {
    expect(2);
    var data = { categories: [{ id: 1, name: 'New Billy' }] };
    var success = function(payload) {
        var fixtures = adapter.fixturesForType(App.Category);
        equal(fixtures.length, 2);
        equal(fixtures[0].name, 'New Billy');
        start();
    };
    adapter.commitTransactionBulk(BD.store, App.Category, 'categories',
                                  data, success, $.noop);
});

asyncTest('`commitTransactionBulk` calls success with a payload', function() {
    expect(1);
    var success = function(payload) {
        ok(payload.hasOwnProperty('meta'));
        start();
    };
    var data = { categories: [] };
    adapter.commitTransactionBulk(BD.store, App.Category, 'categories',
                                  data, success, $.noop, $.noop);
});
