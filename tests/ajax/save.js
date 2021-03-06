var originalAjax = BD.ajax;

QUnit.module('Ajax save', {
    setup: function() {
        App.Category = BD.Model.extend({
            name: BD.attr('string')
        });
        App.Post = BD.Model.extend({
            category: BD.belongsTo('App.Category'),
            title: BD.attr('string'),
            comments: BD.hasMany('App.Comment', 'post', {isEmbedded: true}),
            createdTime: BD.attr('date', {readonly: true})
        });
        App.Comment = BD.Model.extend({
            post: BD.belongsTo('App.Post', {isParent: true}),
            text: BD.attr('string')
        });
        BD.store.loadMany(App.Category, [
            {
                id: 301,
                name: 'Common stuff'
            },
            {
                id: 302,
                name: 'Uncommon stuff'
            }
        ]);
        BD.store.loadMany(App.Post, [
            {
                id: 101,
                categoryId: 301,
                title: 'This is a good day to live'
            }
        ]);
        BD.store.loadMany(App.Comment, [
            {
                id: 201,
                postId: 101,
                text: 'I agree!'
            },
            {
                id: 202,
                postId: 101,
                text: 'I disagree!'
            }
        ]);
    },
    teardown: function() {
        BD.store.reset();
        BD.ajax = originalAjax;
    }
});

test('Do not a allow a record to be created twice', function() {
    var post = App.Post.createRecord({
        title: 'a'
    });
    fakeAjax(200, {
        posts: [
            {
                _clientId: post.get('clientId'),
                id: 1,
                title: 'a'
            }
        ]
    });
    post.save();
    throws(function() {
        post.save();
    }, /You can't save a new record that's already being saved. That would create two different records on the server./);
});

test('POST ajax request always contains all non-undefined properties', function() {
    expect(3);
    var post = App.Post.createRecord({
        category: App.Category.find(301),
        title: 'New post in town'
    });
    BD.ajax = function(hash) {
        equal(hash.type, 'POST');
        equal(hash.url, '/posts');
        deepEqual(JSON.parse(hash.data), {
            post: {
                _clientId: post.clientId,
                categoryId: 301,
                title: 'New post in town'
            }
        });
    };
    post.save();
});

test('Test PUT ajax request options when attribute has changed', function() {
    expect(3);
    var post = App.Post.find(101);
    BD.ajax = function(hash) {
        equal(hash.type, 'PUT');
        equal(hash.url, '/posts/101');
        deepEqual(JSON.parse(hash.data), {
            post: {
                _clientId: post.clientId,
                id: 101,
                title: 'This is a good day to die'
            }
        });
    };
    post.set('title', 'This is a good day to die');
    post.save();
});

test('Test PUT ajax request options when belongsTo has changed', function() {
    expect(3);
    var post = App.Post.find(101);
    BD.ajax = function(hash) {
        equal(hash.type, 'PUT');
        equal(hash.url, '/posts/101');
        deepEqual(JSON.parse(hash.data), {
            post: {
                _clientId: post.clientId,
                id: 101,
                categoryId: 302
            }
        });
    };
    post.set('category', App.Category.find(302));
    post.save();
});

test('Test PUT ajax request options when belongsTo has changed to null', function() {
    expect(3);
    var post = App.Post.find(101);
    BD.ajax = function(hash) {
        equal(hash.type, 'PUT');
        equal(hash.url, '/posts/101');
        deepEqual(JSON.parse(hash.data), {
            post: {
                _clientId: post.clientId,
                id: 101,
                categoryId: null
            }
        });
    };
    post.set('category', null);
    post.save();
});

test('Test PUT', function() {
    var post = App.Post.find(101);
    var req = fakeAjax(200);
    post.set('title', 'This is a good day to die');
    equal(post.get('isDirty'), true);
    post.save();
    req.respond();
    equal(post.get('isDirty'), false);
    equal(post.get('title'), 'This is a good day to die');
});

test('Test save() with properties, normal attribute', function() {
    var post = App.Post.find(101);
    var req = fakeAjax(200);
    post.save({
        properties: {
            title: 'This is a good day to die'
        }
    });
    equal(post.get('isDirty'), false);
    equal(post.get('title'), 'This is a good day to live');
    post.save();
    req.respond();
    equal(post.get('isDirty'), false);
    equal(post.get('title'), 'This is a good day to die');
});

test('Test save() with properties, belongsTo', function() {
    var commonCategory = App.Category.find(301);
    var uncommonCategory = App.Category.find(302);
    var post = App.Post.find(101);
    var req = fakeAjax(200);
    post.save({
        properties: {
            category: uncommonCategory
        }
    });
    equal(post.get('isDirty'), false);
    equal(post.get('category'), commonCategory);
    post.save();
    req.respond();
    equal(post.get('isDirty'), false);
    equal(post.get('category'), uncommonCategory);
});

test('Test save() with properties, normal null attribute', function() {
    expect(1);
    var post = App.Post.find(101);
    BD.ajax = function(hash) {
        strictEqual(JSON.parse(hash.data).post.title, null);
    };
    post.save({
        properties: {
            title: null
        }
    });
});

test('Test save() with payloadData, simple property and object', function() {
    expect(3);
    var post = App.Post.find(101);
    BD.ajax = function(hash) {
        var data = JSON.parse(hash.data);
        strictEqual(data.post.title, 'Post title');
        strictEqual(data.randomProperty, 'Weee!');
        strictEqual(data.randomObject.foo, 'bar');
    };
    post.save({
        properties: {
            title: 'Post title'
        },
        payloadData: {
            randomProperty: 'Weee!',
            randomObject: {
                foo: 'bar'
            }
        }
    });
});

test('Test save() with properties, null belongsTo', function() {
    expect(1);
    var post = App.Post.find(101);
    BD.ajax = function(hash) {
        strictEqual(JSON.parse(hash.data).post.categoryId, null);
    };
    post.save({
        properties: {
            category: null
        }
    });
});

test('Test error validation', function() {
    var post = App.Post.find(101);
    var expectedValidationErrors = {};
    expectedValidationErrors[post.clientId] = {
        message: 'All of it is wrong.',
        attributes: {
            title: 'This is wrong.'
        }
    };
    var req = fakeAjax(422, {
        validationErrors: expectedValidationErrors
    });
    post.set('title', 'This is a good day to die'); //Set something so .save() actually commits the record
    post.save();
    req.respond();
    equal(post.get('error'), 'All of it is wrong.');
    equal(post.get('errors.title'), 'This is wrong.');
});

test('Event is triggered when record is validated', function() {
    expect(1);
    var post = App.Post.find(101);
    post.one('didValidate', function() {
        ok(true);
    });
    var expectedValidationErrors = {};
    expectedValidationErrors[post.clientId] = {
        attributes: {
            title: 'This is wrong.'
        }
    };
    var req = fakeAjax(422, {
        validationErrors: expectedValidationErrors
    });
    post.set('title', 'This is a good day to die'); //Set something so .save() actually commits the record
    post.save();
    req.respond();
});

test('Loading data into the store after a save should not update client changed values', function() {
    var post = App.Post.load({
        id: 1,
        title: 'none'
    });

    post.set('title', 'first');
    var req1 = fakeAjax(200, {
        posts: [
            {
                _clientId: post.get('clientId'),
                id: 1,
                title: 'first',
                createdTime: '2013-09-02'
            }
        ]
    });
    post.save();

    post.set('title', 'second');
    var req2 = fakeAjax(200, {
        posts: [
            {
                _clientId: post.get('clientId'),
                id: 1,
                title: 'second',
                createdTime: '2013-09-02'
            }
        ]
    });
    post.save();

    equal(post.get('createdTime'), null, 'Date should not be set yet');

    req1.respond();

    equal(post.get('createdTime').format('YYYY-MM-DD'), '2013-09-02', 'Date should have been loaded');
    equal(post.get('title'), 'second', 'Second value should be preserved after first have been saved');

    req2.respond();

    equal(post.get('title'), 'second', 'Second value should still be there');
});

test('Default attribute value should be saved', function() {
    App.Tree = BD.Model.extend({
        trunkColor: BD.attr('string', {defaultValue: 'brown'}),
        leafColor: BD.attr('string', {defaultValue: 'green'})
    });
    var tree = App.Tree.createRecord({
        leafColor: 'red'
    });
    BD.ajax = function(hash) {
        var data = JSON.parse(hash.data);
        strictEqual(data.tree.trunkColor, 'brown');
        strictEqual(data.tree.leafColor, 'red');
    };
    tree.save({
        properties: {
            category: null
        }
    });
});