const config = require('./config');

const databaseConfig = config.database;

const mysql = require('mysql');

const connection = mysql.createConnection(databaseConfig);

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }

  console.log('Connected to the database.');

  // Your database operations here.
});

