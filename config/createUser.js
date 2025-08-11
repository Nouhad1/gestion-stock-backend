const bcrypt = require('bcryptjs');
const db = require('./db');

const plainPassword = 'nouhad@2004';
const login = 'EMP001@bluestrek';
const matricule = 'EMP001';

bcrypt.hash(plainPassword, 10, (err, hashedPassword) => {
  if (err) throw err;

  const sql = 'INSERT INTO employes (matricule, login, password) VALUES (?, ?, ?)';
  db.query(sql, [matricule, login, hashedPassword], (err, result) => {
    if (err) throw err;
    console.log('User inserted:', result.insertId);
    process.exit();
  });
});
