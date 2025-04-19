const Sequelize = require('sequelize');
const sequelize = require('../config/db');
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

const DataTypes = Sequelize.DataTypes;

// Initialize models
db.Admin = require('./Admin')(sequelize, DataTypes);
db.Employee = require('./Employee')(sequelize, DataTypes);
db.Attendance = require('./Attendance')(sequelize, DataTypes);
db.Category = require('./Category')(sequelize, DataTypes);
db.MenuItem = require('./menuItem')(sequelize, DataTypes);
db.Order = require('./Order')(sequelize, DataTypes);
db.Report = require('./Report')(sequelize, DataTypes);
db.TillStatus = require('./TillStatus')(sequelize, DataTypes);

// ✅ Initialize associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
