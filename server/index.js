import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Connection Pool
// Assuming XAMPP defaults: user 'root', no password, database 'soccer_game'
// User needs to create DB 'soccer_game' if not exists, or we use a common one.
// Let's assume database name 'soccer_game' based on context, 
// OR we can default to just connecting and letting user configure.
// I'll try to connect to 'soccer_game'.
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // XAMPP default
    database: 'soccer_game',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Get All Players with Team Info
app.get('/api/players', (req, res) => {
    const query = 'SELECT * FROM players';

    pool.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }

        console.log("Raw DB Results:", results);

        const formatted = results.map(row => ({
            id: row.id,
            teamId: row.team_id || row.teamId, // Handle both snake/camel if needed
            name: String(row.name),
            number: row.number,
            role: String(row.position || row.role), // Handle mismatch
            stats: {
                speed: row.speed,
                kick_power: row.kick || row.kick_power, // Fallback
                stamina: row.stamina,
                technique: row.tequnique || row.technique // Handle typo 'tequnique'
            }
        }));

        res.json({ players: formatted });
    });
});

// Add Player
app.post('/api/players', (req, res) => {
    const { teamId, name, number, role, stats } = req.body;

    // Validation
    if (!name || !role) {
        return res.status(400).json({ error: "Name and Role are required" });
    }

    const query = `
        INSERT INTO players 
        (team_id, name, number, position, speed, kick_power, stamina, technique) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        teamId || 1,
        name,
        number || 0,
        role,
        stats?.speed || 50,
        stats?.kickPower || 50,
        stats?.stamina || 50,
        stats?.technique || 50
    ];

    pool.query(query, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Player registered!", id: result.insertId });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
