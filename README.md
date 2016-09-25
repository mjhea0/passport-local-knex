# Node, Passport, and Postgres

This tutorial takes a test-first approach to implementing authentication in a Node app using Passport and Postgres.

## Contents

1. Objectives
1. Project Setup
1. Database Setup
1. Passport Config
1. Passport Local
1. Password Hashing
1. Auth Routes
1. Validation
1. Conclusion

## Objectives

By the end of this tutorial, you will be able to...

1. Add [Passport](https://github.com/jaredhanson/passport) and [passport-local](https://github.com/jaredhanson/passport-local) to an Express app
1. Configure [bcrypt.js](https://www.npmjs.com/package/bcryptjs) for salting and hashing passwords
1. Practice test driven development
1. Authenticate a user
1. Use sessions to store user information
1. Use middleware to validate JSON payloads

## Project Setup

Start by creating an Express boilerplate with the following [generator](https://www.npmjs.com/package/generator-galvanize-express):

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

Then update the newly created file:

```javascript
exports.up = (knex, Promise) => {
  return knex.schema.createTable('users', (table) => {
    table.increments();
    table.string('username').unique().notNullable();
    table.string('password').notNullable();
    table.boolean('admin').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
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

Don't forget the dependency:

```javascript
const passport = require('passport');
```

Make sure to add a secret key to the *.env* file. You can use Python to generate a secure key:

```sh
$ python
>>> import os
>>> os.urandom(24)
"\x02\xf3\xf7r\t\x9f\xee\xbbu\xb1\xe1\x90\xfe'\xab\xa6L6\xdd\x8d[\xccO\xfe"
```

Next, we need to handle serializing and de-serializing the user information into the session cookie. Create a new directory called "auth" in the "server" and add the following code into a new file called *passport.js*:

```javascript
const passport = require('passport');
const knex = require('../db/connection');

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

With Passport configured, we can now set up the  [passport-local](https://github.com/jaredhanson/passport-local) strategy for authenticating with a username and password.

Install:

```sh
$ npm install passport-local@1.0.0 --save
```

Create a new file in "auth" called *local.js*:

  ```javascript
  const passport = require('passport');
  const LocalStrategy = require('passport-local').Strategy;

  const init = require('./passport');
  const knex = require('../db/connection');

  const options = {};

  passport.use(new LocalStrategy(options, (username, password, done) => {
    // check to see if the username exists
    knex('users').where({ username }).first()
    .then((user) => {
      if (!user) return done(null, false);
      if (!authHelpers.comparePass(password, user.password)) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    })
    .catch((err) => { return done(err); });
  }));

  module.exports = passport;
  ```

  Here, we check if the username exists in the database and then pass the appropriate results back to Passport via the callback. Take note of the `comparePass()` function This helper function will be used to compare the provided password with the password in the database.

  Flow:

  - Does the username exist?
    - No? `false` is returned
    - Yes? Does the password match?
      - No? `false` is returned
      - Yes? The user object is returned

Let's write that helper...

## Password Hashing

Since you should never store plain text passwords, install [bcrypt.js](https://www.npmjs.com/package/bcryptjs) for salting and hashing:

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
const authHelpers = require('./_helpers');
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

  beforeEach(() => {
    return knex.migrate.rollback()
    .then(() => { return knex.migrate.latest(); });
  });

  afterEach(() => {
    return knex.migrate.rollback();
  });

});
```

This is a common boilerplate for integration tests with [Chai](http://chaijs.com/) assertions and [Chai HTTP](https://github.com/chaijs/chai-http) for simulating user requests. For more info, check out the [Test Driven Development With Node, Postgres, and Knex (Red/Green/Refactor)](http://mherman.org/blog/2016/04/28/test-driven-development-with-node/#.V-U1PZMrJE4).

### Register

Start with a test:

```javascript
describe('POST /auth/register', () => {
  it('should register a new user', (done) => {
    chai.request(server)
    .post('/auth/register')
    .send({
      username: 'michael',
      password: 'herman'
    })
    .end((err, res) => {
      should.not.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(200);
      res.type.should.eql('application/json');
      res.body.status.should.eql('success');
      done();
    });
  });
});
```

Init a new git repo and commit, and then run the tests. You should see the following error:

```sh
Uncaught AssertionError: expected [Error: Not Found] to not exist
```

Now let's write the code to get the test to pass. First, register the new set of auth routes in *route-config.js*:

```javascript
(function (routeConfig) {

  'use strict';

  routeConfig.init = function (app) {

    // *** routes *** //
    const routes = require('../routes/index');
    const authRoutes = require('../routes/auth');

    // *** register routes *** //
    app.use('/', routes);
    app.use('/auth', authRoutes);

  };

})(module.exports);
```

Then add a new file to the "route" folder called *auth.js*:

```javascript
const express = require('express');
const router = express.Router();

const authHelpers = require('../auth/_helpers');

router.post('/register', (req, res, next)  => {
  return authHelpers.createUser(req, res)
  .then((user) => { handleLogin(res, user[0]); })
  .then(() => { handleResponse(res, 200, 'success'); })
  .catch((err) => { handleResponse(res, 500, 'error'); });
});

function handleLogin(req, user) {
  return new Promise((resolve, reject) => {
    req.login(user, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

function handleResponse(res, code, statusMsg) {
  res.status(code).json({status: statusMsg});
}

module.exports = router;
```

This route simply handles the creation of a new user. To finish, add a `createUser()` function to *src/server/auth/_helpers.js*:

```javascript
function createUser (req) {
  const salt = bcrypt.genSaltSync();
  const hash = bcrypt.hashSync(req.body.password, salt);
  return knex('users')
  .insert({
    username: req.body.username,
    password: hash
  })
  .returning('*');
}
```

Require Knex:

```javascript
const knex = require('../db/connection');
```

Export the function:

```javascript
module.exports = {
  comparePass,
  createUser
};
```

Now let's test! All should pass:

```sh
npm test

jscs
  ✓ should pass for working directory (360ms)

routes : auth
  POST /auth/register
    ✓ should register a new user (396ms)

routes : index
  GET /
    ✓ should render the index
  GET /404
    ✓ should throw an error

jshint
  ✓ should pass for working directory (311ms)

controllers : index
  sum()
    ✓ should return a total
    ✓ should return an error


7 passing (1s)
```

### Login

This time, let's look at how to handle both a success and an error...

#### Handle Success

Again, start with a test:

```javascript
describe('POST /auth/login', () => {
  it('should login a user', (done) => {
    chai.request(server)
    .post('/auth/login')
    .send({
      username: 'jeremy',
      password: 'johnson123'
    })
    .end((err, res) => {
      should.not.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(200);
      res.type.should.eql('application/json');
      res.body.status.should.eql('success');
      done();
    });
  });
});
```

You should see the following failure after running the test:

```sh
Uncaught AssertionError: expected [Error: Not Found] to not exist
```

Now, let's update the code. Start by adding the route handler:

```javascript
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { handleResponse(res, 500, 'error'); }
    if (!user) { handleResponse(res, 404, 'User not found'); }
    if (user) { handleResponse(res, 200, 'success'); }
  })(req, res, next);
});
```

Require Passport:

```javascript
const passport = require('../auth/local');
```

Run the test. You should see:

```sh
Uncaught AssertionError: expected [Error: Not Found] to not exist
```

Why? Well, the user does not exist in the database. To fix this, we just need to seed the database before the tests are ran. Create a new seed file:

```sh
$ knex seed:make users
```

Then add the following code:

```javascript
const bcrypt = require('bcryptjs');

exports.seed = (knex, Promise) => {
  return knex('users').del()
  .then(() => {
    const salt = bcrypt.genSaltSync();
    const hash = bcrypt.hashSync('johnson123', salt);
    return Promise.join(
      knex('users').insert({
        username: 'jeremy',
        password: hash
      })
    );
  });
};
```

Run the tests again. They should pass.

#### Handle Errors

Add another `it` block:

```javascript
it('should not login an unregistered user', (done) => {
  chai.request(server)
  .post('/auth/login')
  .send({
    username: 'michael',
    password: 'johnson123'
  })
  .end((err, res) => {
    should.exist(err);
    res.redirects.length.should.eql(0);
    res.status.should.eql(404);
    res.type.should.eql('application/json');
    res.body.status.should.eql('User not found');
    done();
  });
});
```

The tests should still pass. What other errors should we handle?

### Logout

Test:

```javascript
describe('GET /auth/logout', () => {
  it('should logout a user', (done) => {
    chai.request(server)
    .get('/auth/logout')
    .end((err, res) => {
      should.not.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(200);
      res.type.should.eql('application/json');
      res.body.status.should.eql('success');
      done();
    });
  });
});
```

Route handler:

```javascript
router.get('/logout', (req, res, next) => {
  req.logout();
  handleResponse(res, 200, 'success');
});
```

What if the user is not logged in? They should not be able to access that endpoint. Let's rewrite the test. First, install [passport-stub](https://github.com/gtramontina/passport-stub) for mocking an authenticated user:

```sh
$ npm install passport-stub@1.1.1 --save
```

Add the requirement to *test/integration/routes.auth.test.js*:

```javascript
process.env.NODE_ENV = 'test';

const chai = require('chai');
const should = chai.should();
const chaiHttp = require('chai-http');
const passportStub = require('passport-stub');

const server = require('../../src/server/app');
const knex = require('../../src/server/db/connection');

chai.use(chaiHttp);
passportStub.install(server);
```

Update the `afterEach()`:

```javascript
afterEach(() => {
  passportStub.logout();
  return knex.migrate.rollback();
});
```

Then update the test:

```javascript
describe('GET /auth/logout', () => {
  it('should logout a user', (done) => {
    passportStub.login({
      username: 'jeremy',
      password: 'johnson123'
    });
    chai.request(server)
    .get('/auth/logout')
    .end((err, res) => {
      should.not.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(200);
      res.type.should.eql('application/json');
      res.body.status.should.eql('success');
      done();
    });
  });
});
```

Now add a new test:

```javascript
it('should throw an error if a user is not logged in', (done) => {
  chai.request(server)
  .get('/auth/logout')
  .end((err, res) => {
    should.exist(err);
    res.redirects.length.should.eql(0);
    res.status.should.eql(401);
    res.type.should.eql('application/json');
    res.body.status.should.eql('Please log in');
    done();
  });
});
```

Add a `loginRequired()` function to *src/server/auth/_helpers.js*:

```javascript
function loginRequired(req, res, next) {
  if (!req.user) return res.status(401).json({status: 'Please log in'});
  return next();
}
```

Finally, update the route handler:

```javascript
router.get('/logout', authHelpers.loginRequired, (req, res, next) => {
  req.logout();
  handleResponse(res, 200, 'success');
});
```

The tests should pass.

### User

Once logged in, users should have access to the `/user` endpoint. Start with the tests:

```javascript
describe('GET /user', () => {
  it('should return a success', (done) => {
    passportStub.login({
      username: 'jeremy',
      password: 'johnson123'
    });
    chai.request(server)
    .get('/user')
    .end((err, res) => {
      should.not.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(200);
      res.type.should.eql('application/json');
      res.body.status.should.eql('success');
      done();
    });
  });
  it('should throw an error if a user is not logged in', (done) => {
    chai.request(server)
    .get('/user')
    .end((err, res) => {
      should.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(401);
      res.type.should.eql('application/json');
      res.body.status.should.eql('Please log in');
      done();
    });
  });
});
```

Add a new set of routes to *src/server/config/route-config.js*:

```javascript
(function (routeConfig) {

  'use strict';

  routeConfig.init = function (app) {

    // *** routes *** //
    const routes = require('../routes/index');
    const authRoutes = require('../routes/auth');
    const userRoutes = require('../routes/user');

    // *** register routes *** //
    app.use('/', routes);
    app.use('/auth', authRoutes);
    app.use('/', userRoutes);

  };

})(module.exports);
```

The tests should now pass.

### Admin

Add the tests:

```javascript
describe('GET /admin', () => {
  it('should return a success', (done) => {
    passportStub.login({
      username: 'kelly',
      password: 'bryant123'
    });
    chai.request(server)
    .get('/admin')
    .end((err, res) => {
      should.not.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(200);
      res.type.should.eql('application/json');
      res.body.status.should.eql('success');
      done();
    });
  });
  it('should throw an error if a user is not logged in', (done) => {
    chai.request(server)
    .get('/user')
    .end((err, res) => {
      should.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(401);
      res.type.should.eql('application/json');
      res.body.status.should.eql('Please log in');
      done();
    });
  });
  it('should throw an error if a user is not an admin', (done) => {
    passportStub.login({
      username: 'jeremy',
      password: 'johnson123'
    });
    chai.request(server)
    .get('/admin')
    .end((err, res) => {
      should.exist(err);
      res.redirects.length.should.eql(0);
      res.status.should.eql(401);
      res.type.should.eql('application/json');
      res.body.status.should.eql('You are not authorized');
      done();
    });
  });
});
```

Add the route handler:

```javascript
router.get('/admin', authHelpers.adminRequired, (req, res, next)  => {
  handleResponse(res, 200, 'success');
});
```

Add the helper function:

```javascript
function adminRequired(req, res, next) {
  if (!req.user) res.status(401).json({status: 'Please log in'});
  return knex('users').where({username: req.user.username}).first()
  .then((user) => {
    if (!user.admin) res.status(401).json({status: 'You are not authorized'});
    return next();
  })
  .catch((err) => {
    res.status(500).json({status: 'Something bad happened'});
  });
}
```

Export the function:

```javascript
module.exports = {
  comparePass,
  createUser,
  loginRequired,
  adminRequired
};
```

Update the seed file:

```javascript
const bcrypt = require('bcryptjs');

exports.seed = (knex, Promise) => {
  return knex('users').del()
  .then(() => {
    const salt = bcrypt.genSaltSync();
    const hash = bcrypt.hashSync('johnson123', salt);
    return Promise.join(
      knex('users').insert({
        username: 'jeremy',
        password: hash
      })
    );
  })
  .then(() => {
    const salt = bcrypt.genSaltSync();
    const hash = bcrypt.hashSync('bryant123', salt);
    return Promise.join(
      knex('users').insert({
        username: 'kelly',
        password: hash,
        admin: true
      })
    );
  });
};
```

The tests should now pass.

### Helper

Take a quick look at the `/auth/register` and `/auth/login` endpoints. What happens if there is a user already logged in? As of now, the user can still access those routes, so add another helper function to prevent access:

```javascript
function loginRedirect(req, res, next) {
  if (req.user) return res.status(401).json(
    {status: 'You are already logged in'});
  return next();
}
```

Update the route handlers:

```javascript
router.post('/register', authHelpers.loginRedirect, (req, res, next)  => {
  return authHelpers.createUser(req, res)
  .then((user) => {
    handleLogin(res, user[0]);
  })
  .then(() => { handleResponse(res, 200, 'success'); })
  .catch((err) => { handleResponse(res, 500, 'error'); });
});

router.post('/login', authHelpers.loginRedirect, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { handleResponse(res, 500, 'error'); }
    if (!user) { handleResponse(res, 404, 'User not found'); }
    if (user) { handleResponse(res, 200, 'success'); }
  })(req, res, next);
});
```

Add a new test to `describe('POST /auth/register', () => {`:

```javascript
it('should throw an error if a user is logged in', (done) => {
  passportStub.login({
    username: 'jeremy',
    password: 'johnson123'
  });
  chai.request(server)
  .post('/auth/register')
  .send({
    username: 'michael',
    password: 'herman'
  })
  .end((err, res) => {
    should.exist(err);
    res.redirects.length.should.eql(0);
    res.status.should.eql(401);
    res.type.should.eql('application/json');
    res.body.status.should.eql('You are already logged in');
    done();
  });
});
```

And add a new test to `describe('POST /auth/login', () => {`:

```javascript
it('should throw an error if a user is logged in', (done) => {
  passportStub.login({
    username: 'jeremy',
    password: 'johnson123'
  });
  chai.request(server)
  .post('/auth/login')
  .send({
    username: 'jeremy',
    password: 'johnson123'
  })
  .end((err, res) => {
    should.exist(err);
    res.redirects.length.should.eql(0);
    res.status.should.eql(401);
    res.type.should.eql('application/json');
    res.body.status.should.eql('You are already logged in');
    done();
  });
});
```

Run the tests again. All should pass. Write some unit tests before moving on.

## Validation

At this point we've covered most of the basic functionality. We can add some additional validation rules by first adding the helper function to *src/server/auth/_helpers.js*:

```javascript
function handleErrors(req) {
  return new Promise((resolve, reject) => {
    if (req.body.username.length < 6) {
      reject({
        message: 'Username must be longer than 6 characters'
      });
    }
    else if (req.body.password.length < 6) {
      reject({
        message: 'Password must be longer than 6 characters'
      });
    } else {
      resolve();
    }
  });
}
```

And then update `createUser()`:

```javascript
function createUser(req, res) {
  return handleErrors(req)
  .then(() => {
    const salt = bcrypt.genSaltSync();
    const hash = bcrypt.hashSync(req.body.password, salt);
    return knex('users')
    .insert({
      username: req.body.username,
      password: hash
    })
    .returning('*');
  })
  .catch((err) => {
    res.status(400).json({status: err.message});
  });
}
```

Finally, add two new tests to `POST /auth/register`:

```javascript
it('should throw an error if the username is < 6 characters', (done) => {
  chai.request(server)
  .post('/auth/register')
  .send({
    username: 'six',
    password: 'herman'
  })
  .end((err, res) => {
    should.exist(err);
    res.redirects.length.should.eql(0);
    res.status.should.eql(400);
    res.type.should.eql('application/json');
    res.body.status.should.eql('Username must be longer than 6 characters');
    done();
  });
});
it('should throw an error if the password is < 6 characters', (done) => {
  chai.request(server)
  .post('/auth/register')
  .send({
    username: 'michael',
    password: 'six'
  })
  .end((err, res) => {
    should.exist(err);
    res.redirects.length.should.eql(0);
    res.status.should.eql(400);
    res.type.should.eql('application/json');
    res.body.status.should.eql('Password must be longer than 6 characters');
    done();
  });
});
```

Run the tests:

```sh
$ npm test

  jscs
    ✓ should pass for working directory (752ms)

  routes : auth
    POST /auth/register
      ✓ should register a new user (498ms)
      ✓ should throw an error if a user is logged in
      ✓ should throw an error if the username is < 6 characters
      ✓ should throw an error if the password is < 6 characters
    POST /auth/login
      ✓ should login a user (291ms)
      ✓ should not login an unregistered user
      ✓ should throw an error if a user is logged in
    GET /auth/logout
      ✓ should logout a user
      ✓ should throw an error if a user is not logged in
    GET /user
      ✓ should return a success
      ✓ should throw an error if a user is not logged in
    GET /admin
      ✓ should return a success
      ✓ should throw an error if a user is not logged in
      ✓ should throw an error if a user is not an admin

  routes : index
    GET /
      ✓ should render the index
    GET /404
      ✓ should throw an error

  jshint
    ✓ should pass for working directory (493ms)

  controllers : index
    sum()
      ✓ should return a total
      ✓ should return an error


  20 passing (13s)
```

Yay!
