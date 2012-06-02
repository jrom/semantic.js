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
  db_options.database = db_uri_split[5];
} else {
  db_options.host = 'localhost';
  db_options.port = 27017;
  db_options.database = 'semantic';
}

var server = new Server(db_options.host, db_options.port, {auto_reconnect: true})
  , db = new Db(db_options.database, server)
  , Item = require('./models/item.js')(db);

var episodes = JSON.parse(require('fs').readFileSync('episodes.json'));

db.open(function (err, db) {
  Item.remove();
  episodes.forEach(function (post) {
    post = post.episode;
    post.legacy = true;
    post.body = post.description + "\n\n" + post.notes;
    post.excerpt = post.description;
    post.type = 'episode';
    console.log(post);
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
