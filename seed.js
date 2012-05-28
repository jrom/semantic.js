var mongo = require('mongodb')
  , Server = mongo.Server
  , Db = mongo.Db;

var server = new Server('localhost', 27017, {auto_reconnect: true})
  , db = new Db('semantic', server)
  , Item = require('./models/item.js')(db);

var posts = [
  { type: "episode",
    title: "First semantic episode",
    permalink: "first-semantic-episode",
    excerpt: "Lorem ipsum",
    body: "Lorem ipsum",
    number: 1,
    created_at: new Date("2012-04-20")
  }
, { type: "episode",
    title: "Second semantic episode",
    permalink: "second-semantic-episode",
    excerpt: "Something else",
    body: "Something else",
    number: 2,
    created_at: new Date("2012-04-27")
  }
, { type: "post",
    title: "Semantic relaunch",
    permalink: "semantic-relaunch",
    excerpt: "This is a post explaining the relaunch",
    body: "This is a post explaining the relaunch",
    created_at: new Date("2012-04-19")
  }
, { type: "link",
    title: "Camaloon offer",
    permalink: "camaloon-offer",
    excerpt: "Let's explain something about this link",
    body: "Let's explain something about this link",
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
