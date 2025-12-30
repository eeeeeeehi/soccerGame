CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    color_hex VARCHAR(7) NOT NULL
);

CREATE TABLE players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT,
    name VARCHAR(50) NOT NULL,
    number INT NOT NULL,
    position ENUM('GK', 'DF', 'MF', 'FW') NOT NULL,
    
    -- Abilities (0-100)
    speed INT DEFAULT 70,
    kick_power INT DEFAULT 70,
    stamina INT DEFAULT 70,
    technique INT DEFAULT 70, -- For dribble control
    
    FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- Insert Sample Data
INSERT INTO teams (id, name, color_hex) VALUES 
(1, 'Blue Lock', '#3b82f6'),
(2, 'Red Devils', '#ef4444');

-- Team 1 (Blue)
INSERT INTO players (team_id, name, number, position, speed, kick_power, stamina, technique) VALUES
(1, 'Isagi', 11, 'FW', 85, 80, 90, 85),
(1, 'Bachira', 8, 'MF', 88, 75, 85, 95),
(1, 'Kunigami', 9, 'FW', 82, 95, 88, 70),
(1, 'Chigiri', 44, 'MF', 98, 70, 80, 75),
(1, 'Gagamaru', 1, 'GK', 70, 80, 90, 60);

-- Team 2 (Red)
INSERT INTO players (team_id, name, number, position, speed, kick_power, stamina, technique) VALUES
(2, 'Rin', 10, 'FW', 90, 90, 90, 90),
(2, 'Barou', 13, 'FW', 85, 92, 85, 80),
(2, 'Nagi', 7, 'MF', 75, 85, 70, 99),
(2, 'Reo', 14, 'MF', 85, 85, 85, 85),
(2, 'Aryu', 2, 'DF', 80, 75, 88, 70),
(2, 'Aiku', 5, 'DF', 82, 80, 90, 80);
