import mysql from 'mysql2';

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'soccer_game'
});

pool.query('DESCRIBE players', (err, results) => {
    if (err) {
        console.error(err);
    } else {
        console.log(results);
    }
    process.exit();
});
