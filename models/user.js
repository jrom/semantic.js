module.exports = function (db) {
  var USER = require('mongolia').model(db, 'users');

  USER.simple_user = function (user) {
    return {
      name: user.name
    , avatar: user.avatar
    , url: user.url
    };
  };

  USER.from_provider = function (provider, provider_id, raw) {
    return {
      provider: provider
    , provider_id: raw.id
    , provider_raw: raw
    // twitter specific, please refactor ASAP
    , login: raw.screen_name
    , name: raw.name
    , url: raw.url
    , avatar: raw.profile_image_url
    };
  };

  return USER;
};
