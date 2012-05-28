module.exports = function (db) {
  var ITEM = require('mongolia').model(db, 'items');

  ITEM.validate = function (document, update, callback) {
    var validator = require('mongolia').validator(document, update);

    validator.validateExistence({
      title: "Required field"
    , permalink: "Required field"
    , excerpt: "Required field"
    , body: "Required field"
    , type: "Required field"
    });

    callback(null, validator);
  };

  return ITEM;
};
