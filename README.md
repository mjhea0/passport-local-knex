# Node, Passport, and Postgres

## Want to learn how to build this project?

Check out the [blog post](http://mherman.org/blog/2016/09/25/node-passport-and-postgres/#.V-gocpMrJE4).

## Want to use this project?

1. Fork/Clone
1. Install dependencies - `npm install`
1. Add a *.env* file
1. Create two local Postgres databases - `passport_local_knex` and `passport_local_knex_test`
1. Migrate - `knex migrate:latest --env development`
1. Seed - `knex seed:run --env development`
1. Run the development server - `gulp`
1. Test - `npm test`
