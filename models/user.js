module.exports = function (db) {
  var USER = require('mongolia').model(db, 'users');

  return USER;
};
