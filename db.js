var mysql = require("mysql");

//- Connection configuration
var db_config = {
  connectionLimit: 5,
  host: "<db-host>",
  user: "<db-user>",
  password: "<db-password>",
  database: "<db-database-name>"
};

//- Create the connection variable
module.exports = mysql.createPool(db_config);
