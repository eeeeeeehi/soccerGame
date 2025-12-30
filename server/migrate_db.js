import mysql from 'mysql2';

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    database: 'soccer_game'
});

// Check if ID exists, if not add it
pool.query("SHOW COLUMNS FROM players LIKE 'id'", (err, results) => {
    if (results.length === 0) {
        console.log("Adding ID column...");
        pool.query("ALTER TABLE players ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST", (err) => {
            if (err) console.error(err);
            else console.log("ID column added successfully.");
            process.exit();
        });
    } else {
        console.log("ID column already exists.");
        process.exit();
    }
});
