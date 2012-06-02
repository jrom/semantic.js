var mongo = require('mongodb')
  , Server = mongo.Server
  , Db = mongo.Db;

var db_options = {};

if (process.env.MONGOHQ_URL) {
  var db_uri_split = process.env.MONGOHQ_URL.match(/^mongodb:\/\/(.*):(.*)@(.*):(.*)\/(.*)$/);
  db_options.user = db_uri_split[1];
  db_options.password = db_uri_split[2];
  db_options.host = db_uri_split[3];
  db_options.port = +db_uri_split[4];
} else {
  db_options.host = 'localhost';
  db_options.port = 27017;
}

var server = new Server(db_options.host, db_options.port, {auto_reconnect: true})
  , db = new Db('semantic', server)
  , Item = require('./models/item.js')(db);

var posts = [
  { type: "episode",
    title: "First semantic episode",
    permalink: "first-semantic-episode",
    excerpt: "Lorem ipsum",
    body: "Lorem ipsum BLA BLA",
    number: 1,
    created_at: new Date("2012-04-20")
  }
, { type: "episode",
    title: "Second semantic episode",
    permalink: "second-semantic-episode",
    excerpt: "Something else",
    body: "Something else BLA BLA",
    number: 2,
    created_at: new Date("2012-04-27")
  }
, { type: "post",
    title: "Semantic relaunch",
    permalink: "semantic-relaunch",
    excerpt: "This is a post explaining the relaunch",
    body: "This is a post explaining the relaunch BLA BLA BLA",
    created_at: new Date("2012-04-19")
  }
, { type: "link",
    title: "Camaloon offer",
    permalink: "camaloon-offer",
    excerpt: "Let's explain something about this link",
    body: "Let's explain something about this link BLA BLA BLA BLA",
    url: "http://camaloon.com/some/landing/page",
    created_at: new Date("2012-04-24")
  }
];

db.open(function (err, db) {
  Item.remove();
  posts.forEach(function (post) {
    Item.validateAndInsert(post, function (err, validator) {
      if (validator.hasErrors()) {
        console.log('OMG ERRORS', validator.errors);
      }
      else {
        console.log('created ', post.title);
      }
    });
  });
  db.close();
});
