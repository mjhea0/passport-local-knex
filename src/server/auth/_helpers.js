const bcrypt = require('bcryptjs');

function comparePass(userPassword, databasePassword) {
  return bcrypt.compareSync(userPassword, databasePassword);
}

module.exports = {
  comparePass
};
