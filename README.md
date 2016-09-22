# Node, Passport, and Postgres

Add Description
  - test first

## Contents

Add Contents

## Objectives

Add Objectives

## Project Setup

Create an Express boilerplate with the following [generator](https://www.npmjs.com/package/generator-galvanize-express):

```sh
$ npm install -g generator-galvanize-express@1.2.3
```

Once installed, create a new project directory, and then scaffold a new app:

```sh
$ yo galvanize-express
? Your name (for the LICENSE)? Michael Herman
? Project name (for package.json)? Change Me
? Do you want to use Gulp Notify? No
? Do you want to use pg-promise or Knex? knex
? Database name? passport_local_knex
```

Install the dependencies, and then fire up the app by running `gulp` to make sure all is well.

## Database Setup

We'll be using [Knex.js](http://knexjs.org/) to interact with the database.

> **NOTE**: New to [Knex.js](http://knexjs.org/)? Check out the [documentation](http://knexjs.org/) along with the "Database Setup" section of the [Testing Node and Express](http://mherman.org/blog/2016/09/12/testing-node-and-express/) blog post for more information on how to use it to interact with Postgres.

### Migrations

First, fire up your local Postgres server and create two new databases:

```sh
$ psql
# create database passport_local_knex;
CREATE DATABASE
# create database passport_local_knex_testing;
CREATE DATABASE
```

Generate a new migration template:

```sh
$ knex migrate:make users
```

Then update the script:

```javascript
exports.up = (knex, Promise) => {
  return knex.schema.createTable('users', (table) => {
    table.increments();
    table.string('username').unique().notNullable();
    table.string('password').notNullable();
    table.boolean('admin').notNullable().defaultTo(false);
    table.timestamps();
  });
};

exports.down = (knex, Promise) => {
  return knex.schema.dropTable('users');
};
```

Apply the migration:

```sh
knex migrate:latest --env development
```

### Sanity Check

Did it work?

```sh
$ psql
# \c passport_local_knex
# \d

                     List of relations
 Schema |          Name          |   Type   |     Owner
--------+------------------------+----------+---------------
 public | knex_migrations        | table    | michaelherman
 public | knex_migrations_id_seq | sequence | michaelherman
 public | knex_migrations_lock   | table    | michaelherman
 public | users                  | table    | michaelherman
 public | users_id_seq           | sequence | michaelherman
(5 rows)
```

## Passport Config

Install [Passport](https://github.com/jaredhanson/passport):

```sh
$ npm install passport@0.3.2 --save
```

Update *src/server/config/main-config.js* to mount Passport to the app middleware and utilize [express-session](https://www.npmjs.com/package/express-session) in order to save sessions server-side:

```javascript
// *** app middleware *** //
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// uncomment if using express-session
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(express.static(path.join(__dirname, '..', '..', 'client')));
```

ADD info about secret key:

```
>>> import os
>>> os.urandom(24)
"\x02\xf3\xf7r\t\x9f\xee\xbbu\xb1\xe1\x90\xfe'\xab\xa6L6\xdd\x8d[\xccO\xfe"
```

Don't forget the dependency:

```javascript
const passport = require('passport');
```

Next, we need to handle serializing and de-serializing the user information into the session cookie. Create a new directory called "auth" in the "server" and add the following code into a new file called *passport.js*:

```javascript
const passport = require('passport');
const knex = require('../db/knex');

module.exports = () => {

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    knex('users').where({id}).first()
    .then((user) => { done(null, user); })
    .catch((err) => { done(err,null); });
  });

};
```

## Passport Local

With Passport configured, we can now set up [passport-local](https://github.com/jaredhanson/passport-local) for authenticating with usernames and passwords.

Install:

```sh
$ npm install passport-local@1.0.0 --save
```

Create a new file in "auth" called *local.js*:

  ```javascript
  const passport = require('passport');
  const LocalStrategy = require('passport-local').Strategy;

  const init = require('./init');
  const knex = require('../db/knex');

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
  ```

  ADD description
    - https://github.com/jaredhanson/passport-local#available-options
    - https://github.com/jaredhanson/passport-local#configure-strategy
    - Plain text password

## Password Hashing

Install [bcrypt.js](https://www.npmjs.com/package/bcryptjs) for salting and hashing passwords:

```sh
$ npm install bcryptjs@2.3.0 --save
```

Add a new file called *_helpers.js* to the "auth" folder:

```javascript
const bcrypt = require('bcryptjs');

function comparePass(userPassword, databasePassword) {
  return bcrypt.compareSync(userPassword, databasePassword);
}

module.exports = {
  comparePass
};
```

Back in the *local.js* file add the requirement:

```javascript
const _helpers = require('./_helpers');
```

With that, we can now add the routes for handling authentication.

## Auth Routes

Let's take a test-first approach to writing our routes:

- `/auth/register`
- `/auth/login`
- `/auth/logout`
- `/user`
- `/admin`

Add the following code to a new file called *routes.auth.test.js* in "test/integration":

```javascript
process.env.NODE_ENV = 'test';

const chai = require('chai');
const should = chai.should();
const chaiHttp = require('chai-http');
chai.use(chaiHttp);

const server = require('../../src/server/app');
const knex = require('../../src/server/db/connection');

describe('routes : auth', () => {

  beforeEach((done) => {
    return knex.migrate.rollback()
    .then(() => { return knex.migrate.latest(); })
    .then(() => { return knex.seed.run(); })
    .then(() => { done(); });
  });

  afterEach((done) => {
    return knex.migrate.rollback()
    .then(() => { done(); });
  });

});
```

ADD description

### Register

Start with a test...

### Test

Add a new test:

```javascript
describe('POST /auth/register', () => {
  it('should register a new user', (done) => {
    chai.request(server)
    .post('/auth/register')
    .end((err, res) => {
      should.not.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(200);
      res.type.should.eql('application/json');
      res.body.status.should.eql('success');
      res.body.value.should.eql('User registered!');
      done();
    });
  });
});
```

Run the tests

### Login

#### Test

### Logout

### User

### Admin
