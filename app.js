var express = require('express')
  , moment = require('moment')
  , routes = require('./routes')
  , everyauth = require('everyauth')
  , mongo = require('mongodb')
  , Server = mongo.Server
  , Db = mongo.Db;

var app = express.createServer()
  , server = new Server('localhost', 27017, {auto_reconnect: true})
  , db = new Db('semantic', server);

var Item = require('./models/item.js')(db)
  , User = require('./models/user.js')(db);

db.open(function (err, db) {
  console.log('connected to mongoDB');
});

function findOrCreateUser(provider) {
  return function (session, token, secret, provider_user) {
    var promise = this.Promise();
    db.collection('users', function (err, collection) {
      collection.findOne({provider: provider, provider_id: provider_user.id}, function (err, user) {
        if (user) {
          user.id = user._id;
          promise.fulfill(user);
        }
        else {
          collection.insert({ provider: provider, provider_id: provider_user.id, provider_raw: provider_user }, function (err, user) {
            user = user[0]; // insert returns array of one element
            user.id = user._id;
            promise.fulfill(user);
          });
        }
      });
    });
    return promise;
  };
}

everyauth.everymodule.findUserById(function (_id, callback) {
  db.collection('users', function (err, collection) {
    collection.findOne({_id: mongo.ObjectID(_id)}, function (err, user) {
      callback(err, user);
    });
  });
});

everyauth
  .twitter
  .consumerKey(process.env.TWITTER_KEY)
  .consumerSecret(process.env.TWITTER_SECRET)
  .findOrCreateUser(findOrCreateUser('twitter'))
  .redirectPath('/');

app.configure(function () {
  app.use(express.cookieParser(process.env.COOKIE_SECRET || 'sekret'));
  app.use(express.session({ secret: (process.env.SESSION_SECRET || 'sekret')}));
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express['static'](__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(everyauth.middleware());
  app.use(app.router);
});

app.configure('development', function () {
  everyauth.debug = true;
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.helpers({
  moment: moment
});

everyauth.helpExpress(app);

function index(req, res, db, resource) {
  var type;
  if (resource === 'podcast') {
    type = 'episode';
  }
  else if (resource) { // links, posts
    type = resource.slice(0, -1);
  }

  db.collection('items', function (err, collection) {
    var options = {};
    if (type) {
      options.type = type;
    }
    collection.find(options).limit(20).sort({created_at: -1}).toArray(function (err, results) {
      res.render('index', {title: 'Hello', items: results });
    });
  });
}

function show(req, res, db, permalink, next) {
  db.collection('items', function (err, collection) {
    var options = { permalink: permalink};
    collection.findOne(options, function (err, item) {
      if (item) {
        res.render('show', {title: 'Some item', item: item });
      }
      else {
        next();
      }
    });
  });
}

app.get('/', function (req, res) {
  index(req, res, db);
});

app.get(/^\/(podcast|posts|links)$/, function (req, res) {
  index(req, res, db, req.params[0]);
});

app.get('/admin', function (req, res) {
  db.collection('items', function (err, collection) {
    collection.find().sort({created_at: -1}).toArray(function (err, results) {
      res.render('admin/index', { items: results });
    });
  });
});

app.get('/admin/new', function (req, res) {
  res.render('admin/new');
});

app.post('/admin/new', function (req, res) {
  db.collection('items', function (err, collection) {
    collection.insert(req.body, function (err, results) {
      res.redirect('/admin');
    });
  });
});

app.get('/admin/edit/:id', function (req, res) {
  var _id = mongo.ObjectID(req.params.id);
  db.collection('items', function (err, collection) {
    collection.findOne({_id: _id}, function (err, item) {
      if (item) {
        res.render('admin/edit', { item: item });
      }
      else {
        res.redirect('/admin');
      }
    });
  });
});

app.post('/admin/update/:id', function (req, res) {
  var _id = mongo.ObjectID(req.params.id);
  db.collection('items', function (err, collection) {
    console.log('TODO!');
    res.redirect('/admin');
  });
});

app.post('/admin/destroy/:id', function (req, res) {
  var _id = mongo.ObjectID(req.params.id);
  db.collection('items', function (err, collection) {
    collection.remove({_id: _id}, function (err, results) {
      res.redirect('/admin');
    });
  });
});

app.get('/:permalink', function (req, res, next) {
  show(req, res, db, req.params.permalink, next);
});

app.listen(3000);

console.log("Express server listening on port 3000");
