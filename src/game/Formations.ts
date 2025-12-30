import type { PlayerRole } from './entities/Player';

export interface FormationNode {
    role: PlayerRole;
    x: number; // Percentage 0-1
    y: number; // Percentage 0-1
}

export const Formations: Record<string, FormationNode[]> = {
    '4-4-2': [
        { role: 'GK', x: 0.05, y: 0.5 },
        // DF
        { role: 'DF', x: 0.15, y: 0.20 },
        { role: 'DF', x: 0.12, y: 0.40 },
        { role: 'DF', x: 0.12, y: 0.60 },
        { role: 'DF', x: 0.15, y: 0.80 },
        // MF
        { role: 'MF', x: 0.35, y: 0.15 },
        { role: 'MF', x: 0.28, y: 0.35 },
        { role: 'MF', x: 0.28, y: 0.65 },
        { role: 'MF', x: 0.35, y: 0.85 },
        // FW
        { role: 'FW', x: 0.45, y: 0.45 },
        { role: 'FW', x: 0.45, y: 0.55 }
    ],
    '4-3-3': [
        { role: 'GK', x: 0.05, y: 0.5 },
        // DF
        { role: 'DF', x: 0.15, y: 0.20 },
        { role: 'DF', x: 0.12, y: 0.40 },
        { role: 'DF', x: 0.12, y: 0.60 },
        { role: 'DF', x: 0.15, y: 0.80 },
        // MF (Triangle)
        { role: 'MF', x: 0.25, y: 0.5 },  // DM
        { role: 'MF', x: 0.35, y: 0.3 },  // CM
        { role: 'MF', x: 0.35, y: 0.7 },  // CM
        // FW
        { role: 'FW', x: 0.45, y: 0.2 },  // Wing
        { role: 'FW', x: 0.45, y: 0.8 },  // Wing
        { role: 'FW', x: 0.50, y: 0.5 }   // CF
    ],
    '3-5-2': [
        { role: 'GK', x: 0.05, y: 0.5 },
        // DF (3 CB)
        { role: 'DF', x: 0.12, y: 0.30 },
        { role: 'DF', x: 0.10, y: 0.50 },
        { role: 'DF', x: 0.12, y: 0.70 },
        // MF (5)
        { role: 'MF', x: 0.25, y: 0.20 }, // WB
        { role: 'MF', x: 0.25, y: 0.80 }, // WB
        { role: 'MF', x: 0.25, y: 0.50 }, // DM
        { role: 'MF', x: 0.35, y: 0.35 }, // OM
        { role: 'MF', x: 0.35, y: 0.65 }, // OM
        // FW
        { role: 'FW', x: 0.45, y: 0.45 },
        { role: 'FW', x: 0.45, y: 0.55 }
    ]
};
