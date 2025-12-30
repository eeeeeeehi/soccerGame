
import mysql from 'mysql2';

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'soccer_game'
});

connection.query('SHOW COLUMNS FROM players', (err, results) => {
    if (err) {
        console.error(err);
    } else {
        console.log(results);
    }
    connection.end();
});
