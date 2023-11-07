const { database } = require('../config/config');
const mysql = require('mysql');

const connection = mysql.createConnection(database);

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database.');
});
