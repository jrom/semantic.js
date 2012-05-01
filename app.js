
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , mongo = require('mongodb')
  , Server = mongo.Server
  , Db = mongo.Db;

var app = express()
  , server = new Server('localhost', 27017, {auto_reconnect: true})
  , db = new Db('semantic', server);

db.open(function (err, db) {
  console.log('connected to mongoDB');
});

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express['static'](__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

app.configure('development', function () {
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

http.createServer(app).listen(3000);

console.log("Express server listening on port 3000");
