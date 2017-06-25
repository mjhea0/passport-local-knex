process.env.NODE_ENV = 'test';

const chai = require('chai');
const should = chai.should();
const chaiHttp = require('chai-http');
const passportStub = require('passport-stub');

const server = require('../../src/server/app');
const knex = require('../../src/server/db/connection');

chai.use(chaiHttp);
passportStub.install(server);

describe('routes : auth', () => {

  beforeEach(() => {
    return knex.migrate.rollback()
    .then(() => { return knex.migrate.latest(); })
    .then(() => { return knex.seed.run(); });
  });

  afterEach(() => {
    passportStub.logout();
    return knex.migrate.rollback();
  });

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
  });

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
  });

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
  });

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
      .get('/admin')
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

});
