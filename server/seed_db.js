import mysql from 'mysql2';

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    database: 'soccer_game'
});

const team1Players = [
    { name: "Wakabayashi", role: "GK", number: 1, stats: { speed: 60, kick: 90, stamina: 80, tech: 90 } },
    { name: "Ishizaki", role: "DF", number: 4, stats: { speed: 70, kick: 60, stamina: 90, tech: 60 } },
    { name: "Jito", role: "DF", number: 5, stats: { speed: 60, kick: 95, stamina: 85, tech: 60 } },
    { name: "Matsuyama", role: "DF", number: 12, stats: { speed: 75, kick: 75, stamina: 95, tech: 80 } },
    { name: "Soda", role: "DF", number: 7, stats: { speed: 85, kick: 80, stamina: 80, tech: 75 } },
    { name: "Misaki", role: "MF", number: 11, stats: { speed: 80, kick: 80, stamina: 85, tech: 95 } },
    { name: "Misugi", role: "MF", number: 14, stats: { speed: 75, kick: 85, stamina: 60, tech: 99 } },
    { name: "Tachibana", role: "MF", number: 2, stats: { speed: 90, kick: 70, stamina: 80, tech: 80 } },
    { name: "Sawada", role: "MF", number: 15, stats: { speed: 80, kick: 70, stamina: 75, tech: 85 } },
    { name: "Hyuga", role: "FW", number: 9, stats: { speed: 85, kick: 99, stamina: 90, tech: 75 } },
    { name: "Nitta", role: "FW", number: 18, stats: { speed: 95, kick: 75, stamina: 85, tech: 70 } }
];

// Team 2 uses same names but ID will be different
const team2Players = team1Players.map(p => ({ ...p, name: p.name + " (CPU)" }));

const insertPlayer = (teamId, p) => {
    return new Promise((resolve, reject) => {
        pool.query(
            `INSERT INTO players (team_id, name, number, position, speed, kick_power, stamina, technique) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [teamId, p.name, p.number, p.role, p.stats.speed, p.stats.kick, p.stats.stamina, p.stats.tech],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

async function seed() {
    console.log("Truncating players table...");
    await new Promise((resolve) => pool.query('TRUNCATE TABLE players', resolve));

    console.log("Seeding Team 1...");
    for (const p of team1Players) {
        await insertPlayer(1, p);
    }

    console.log("Seeding Team 2...");
    for (const p of team2Players) {
        await insertPlayer(2, p);
    }

    console.log("Done!");
    process.exit();
}

seed();
