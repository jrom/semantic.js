var express = require('express')
  , routes = require('./routes')
  , everyauth = require('everyauth')
  , mongo = require('mongodb')
  , Server = mongo.Server
  , Db = mongo.Db;

var app = express.createServer()
  , server = new Server('localhost', 27017, {auto_reconnect: true})
  , db = new Db('semantic', server);

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
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express['static'](__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.cookieParser(process.env.COOKIE_SECRET || 'sekret'));
  app.use(express.session({ secret: process.env.SESSION_SECRET || 'sekret'}));
  app.use(everyauth.middleware());
});

app.configure('development', function () {
  everyauth.debug = true;
  app.use(express.errorHandler());
});

function index(req, res, db, type) {
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

app.get('/', function (req, res) {
  index(req, res, db);
});

app.get(/^\/(episodes|posts|links)/, function (req, res) {
  index(req, res, db, req.params[0].slice(0, -1));
});

app.listen(3000);

console.log("Express server listening on port 3000");
