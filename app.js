var express = require('express')
  , moment = require('moment')
  , markdown = require('github-flavored-markdown')
  , routes = require('./routes')
  , everyauth = require('everyauth')
  , mongo = require('mongodb')
  , mongoStore = require('connect-mongodb')
  , Server = mongo.Server
  , Db = mongo.Db;

var db_options = {};

if (process.env.MONGOHQ_URL) {
  var db_uri_split = process.env.MONGOHQ_URL.match(/^mongodb:\/\/(.*):(.*)@(.*):(.*)\/(.*)$/);
  db_options.user = db_uri_split[1];
  db_options.password = db_uri_split[2];
  db_options.host = db_uri_split[3];
  db_options.port = +db_uri_split[4];
  db_options.database = db_uri_split[5];
} else {
  db_options.host = 'localhost';
  db_options.port = 27017;
  db_options.database = 'semantic';
}

var app = express.createServer()
  , server = new Server(db_options.host, db_options.port, {auto_reconnect: true})
  , db = new Db(db_options.database, server);

var Item = require('./models/item.js')(db)
  , User = require('./models/user.js')(db);

db.open(function (err, db) {
  db.authenticate(db_options.user, db_options.password, function (err) {
    if (err && db_options.user) {
      console.log('error authenticating');
    } else {
      console.log('connected to mongoDB');
    }
  });
});

function authorize(req, res, next) {
  if (req.user && req.user.admin) {
    next();
  }
  else {
    res.redirect('/');
  }
}

function findOrCreateUser(provider) {
  return function (session, token, secret, provider_user) {
    var promise = this.Promise()
      , parsed_user;
    User.findOne({provider: provider, provider_id: provider_user.id}, function (err, user) {
      if (user) {
        user.id = user._id;
        promise.fulfill(user);
      }
      else {
        parsed_user = User.from_provider(provider, provider_user.id, provider_user);
        User.insert(parsed_user, function (err, user) {
          user = user[0]; // insert returns array of one element
          user.id = user._id;
          promise.fulfill(user);
        });
      }
    });
    return promise;
  };
}

everyauth.everymodule.findUserById(function (_id, callback) {
  User.findOne({_id: mongo.ObjectID(_id)}, function (err, user) {
    callback(err, user);
  });
});

everyauth
  .twitter
  .consumerKey(process.env.TWITTER_KEY)
  .consumerSecret(process.env.TWITTER_SECRET)
  .findOrCreateUser(findOrCreateUser('twitter'))
  .redirectPath('/auth/callback');

app.configure(function () {
  app.use(express.cookieParser(process.env.COOKIE_SECRET || 'sekret'));
  app.use(express.session({
    store: new mongoStore({db: db})
  , secret: (process.env.SESSION_SECRET || 'sekret')
  }));
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(everyauth.middleware());
  app.use(app.router);
  app.use(express['static'](__dirname + '/public'));
});

app.configure('development', function () {
  everyauth.debug = true;
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.helpers({
  moment: moment
, markdown: markdown
});

everyauth.helpExpress(app);

function index(req, res, resource, page) {
  var type
    , options = {}
    , limit, skip, total_pages;

  page = page || 0;
  limit = 10;
  skip = page * limit;

  if (resource === 'podcast') {
    type = 'episode';
  }
  else if (resource) { // links, posts
    type = resource.slice(0, -1);
  }

  if (type) {
    options.type = type;
  }

  Item.findArray(options, {skip: skip, limit: limit, sort: {created_at: -1}}, function (err, results) {
    Item.count(options, function (err, count) {
      total_pages = Math.ceil(count / limit);
      res.render('index', {title: 'Semàntic Podcast', items: results, page: page, total_pages: total_pages });
    });
  });
}

function show(req, res, permalink, next) {
  var options = { permalink: permalink};
  Item.findOne(options, function (err, item) {
    if (item) {
      res.render('show', {title: item.title, item: item });
    }
    else {
      next();
    }
  });
}

app.get('/', function (req, res) {
  index(req, res);
});

app.get('/page:page', function (req, res) {
  index(req, res, null, +req.params.page);
});

app.get('/auth/callback', function (req, res) {
  res.redirect(req.session.redirectTo || '/');
});

app.get('/login/:provider', function (req, res) {
  req.session.redirectTo = req.header('Referrer', app.route);
  res.redirect('/auth/' + req.params.provider);
});

app.get('/feed', function (req, res) {
  Item.findArray({type: 'episode'}, {sort: {created_at: -1}}, function (err, results) {
    res.contentType('application/rss+xml');
    res.render('feed', {layout: false, items: results});
  });
});

app.get(/^\/(jordi|bernat|masumi)$/, function (req, res) {
  res.redirect('/membres', 301);
});

app.get('/membres', function (req, res) {
  res.render('team', {title: 'Equip de Semàntic'});
});

app.get('/que-es-semantic', function (req, res) {
  res.render('about', {title: 'Què és Semàntic'});
});

app.get(/^\/(podcast|posts|links)$/, function (req, res) {
  index(req, res, req.params[0]);
});

app.post('/comment', function (req, res, next) {
  var _id
    , comment = {};

  _id = mongo.ObjectID(req.body.item_id);

  Item.findOne({_id: _id}, function (err, item) {
    if (item) {
      if ((typeof req.body.body === 'undefined') || req.body.body.length === 0 || (typeof req.user === 'undefined')) {
        console.log('ERROR validating comment: ', req.body.body, ' or user: ', req.user);
        return res.redirect('/' + item.permalink);
      }

      comment.body = req.body.body;
      comment.created_at = Date.now();
      comment.author = User.simple_user(req.user);

      Item.update({_id: _id}, { $push: { comments: comment } }, {safe: true}, function (err) {
        res.redirect('/' + item.permalink);
      });
    }
    else {
      next();
    }
  });
});

// ADMIN
app.get('/admin', authorize, function (req, res) {
  Item.findArray({}, {sort: {created_at: -1}}, function (err, results) {
    res.render('admin/index', { items: results });
  });
});

app.get('/admin/users', authorize, function (req, res) {
  User.findArray({}, {sort: {admin: 1, created_at: -1}}, function (err, results) {
    res.render('admin/users', { users: results });
  });
});

app.get('/admin/new', authorize, function (req, res) {
  res.render('admin/new');
});

app.post('/admin/new', authorize, function (req, res) {
  Item.validateAndInsert(req.body, function (err, validator) {
    if (validator.hasErrors()) {
      console.log('Error validating new item!', validator.errors);
      res.render('admin/new', { item: validator.updated_document });
    }
    else {
      res.redirect('/admin');
    }
  });
});

app.get('/admin/edit/:id', authorize, function (req, res) {
  var _id = mongo.ObjectID(req.params.id);
  Item.findOne({_id: _id}, function (err, item) {
    if (item) {
      res.render('admin/edit', { item: item });
    }
    else {
      res.redirect('/admin');
    }
  });
});

app.post('/admin/update/:id', authorize, function (req, res) {
  var _id = mongo.ObjectID(req.params.id);
  Item.update({_id: _id}, { $set: req.body }, {safe: true}, function (err) {
    res.redirect('/admin');
  });
});

app.post('/admin/destroy/:id', authorize, function (req, res) {
  var _id = mongo.ObjectID(req.params.id);
  Item.remove({_id: _id}, function (err, results) {
    res.redirect('/admin');
  });
});

app.get('/episodes/:number-:permalink', function (req, res, next) {
  res.redirect('/' + req.params.permalink, 301);
});

app.get('/:permalink', function (req, res, next) {
  show(req, res, req.params.permalink, next);
});

app.listen(process.env.PORT || 3000);

console.log("Express server listening on port " + process.env.PORT || 3000);
