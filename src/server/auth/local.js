const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const init = require('./init');
const knex = require('../db/knex');
const _helpers = require('./_helpers');

const options = {
  usernameField: 'email',
  passwordField: 'password',
  passReqToCallback: true
};

passport.use(new LocalStrategy(options, (username, password, done) => {
  // check to see if the username exists
  knex('users').where({ username }).first().then((user) => {
    if (!user) return done(null, false);
    if (!_helpers.comparePass(password, user.password)) {
      return done(null, false);
    } else {
      return done(null, user);
    }
  }).catch((err) => { return done(err); });
}));

module.exports = passport;
