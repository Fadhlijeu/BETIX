const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Koneksi database
const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'bioskop_db',
  port: 3306
});

// cek koneksi
db.connect((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log('Database connected');
  }
});

// API ambil film
app.get('/api/film', (req, res) => {
  db.query('SELECT * FROM film', (err, result) => {
    if (err) {
      res.status(500).json(err);
    } else {
      res.json(result);
    }
  });
});

// API register
app.use(express.json());

app.post('/register', (req, res) => {

  const { nama, email, password, role } = req.body;

  const sql = `
    INSERT INTO user (nama, email, password, role)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [nama, email, password, role || 'user'], (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).json(err);
    }

    res.json({
      success: true,
      message: 'Register berhasil'
    });

  });

});

//API login
app.post('/login', (req, res) => {

  const { email, password } = req.body;

  const sql = `
    SELECT * FROM user
    WHERE email = ? AND password = ?
  `;

  db.query(sql, [email, password], (err, result) => {

    if (err) {
      return res.status(500).json(err);
    }

    if (result.length > 0) {

      res.json({
        success: true,
        user: result[0]
      });

    } else {

      res.status(401).json({
        success: false,
        message: 'Login gagal'
      });

    }

  });

});

// jalankan server
app.listen(3000, () => {
  console.log('Server running di http://localhost:3000');
});