module.exports = function (db) {
  var ITEM = require('mongolia').model(db, 'items');

  return ITEM;
};
