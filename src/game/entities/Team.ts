import { Player, type PlayerRole } from './Player';
import { Ball } from './Ball';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';
import { Input } from '../Input';

export class Team {
    id: number;
    players: Player[] = [];
    isHuman: boolean;
    input: Input | null;

    constructor(id: number, isHuman: boolean, input: Input | null) {
        this.id = id;
        this.isHuman = isHuman;
        this.input = input;
        this.initFormation_4_4_2();
    }

    initFormation_4_4_2() {
        this.players = [];

        // Helper to get X based on side (Team 1 Left, Team 2 Right)
        // Team 1 (Left): 0 -> 1
        // Team 2 (Right): 1 -> 0
        const getX = (pct: number) => {
            return this.id === 1
                ? pct * Constants.FIELD_WIDTH
                : (1 - pct) * Constants.FIELD_WIDTH;
        };

        const getY = (pct: number) => pct * Constants.FIELD_HEIGHT;

        const add = (role: PlayerRole, xPct: number, yPct: number) => {
            const p = new Player(getX(xPct), getY(yPct), this.id, role, this.isHuman, this.input);
            this.players.push(p);
        }

        // GK
        add('GK', 0.05, 0.5);

        // Defenders (4) - Arced line
        add('DF', 0.15, 0.20);
        add('DF', 0.12, 0.40); // CB slightly back
        add('DF', 0.12, 0.60); // CB slightly back
        add('DF', 0.15, 0.80);

        // Midfielders (4) - Slightly advanced but in half
        add('MF', 0.35, 0.15); // Wing
        add('MF', 0.28, 0.35); // CM
        add('MF', 0.28, 0.65); // CM
        add('MF', 0.35, 0.85); // Wing

        // Forwards (2) - Near center circle but not over
        add('FW', 0.45, 0.45);
        add('FW', 0.45, 0.55);
    }

    update(ball: Ball, opponent: Team) {
        // 1. Determine Attacking State
        // Simple heuristic: Are we closer to the ball than the opponent?
        // Or simply: Do we have possession?
        // Let's use a "Team Distance" check for now.

        let myClosestDist = Infinity;
        let myClosestIdx = -1;

        this.players.forEach((p, i) => {
            const dist = p.position.dist(ball.position);
            if (dist < myClosestDist) {
                myClosestDist = dist;
                myClosestIdx = i;
            }
            p.isSelected = false; // Reset selection
        });

        // Determine if we are "Attacking" (Team has possession or advantage)
        // For AI purposes, let's say if we are within 100px we are attacking/fighting for it.
        // But for formation, if opponent has ball, we should compact.
        // Let's look at ball velocity or last touch? simpler:
        // Assume attacking if our closest player is closer than opponent's closest player?
        // We don't have opponent data easily here without iterating them too.
        // Let's pass "IsAttacking" as "Is closest player < 200px" for now (simple Aggression).
        const isAttacking = myClosestDist < 200;

        // 2. Select Chaser / Player to Control
        // The closest player is ALWAYS the chaser/controlled player.
        // Exception: GK usually doesn't chase far.
        // If closest is GK and ball is far, maybe 2nd closest? 
        // For simplicity: Closest is chaser.

        /* 
           Crucial Check: If Human, we only select ONE. 
           If AI, 'Chaser' is just the one pressing.
        */

        const chaserIdx = myClosestIdx;

        // 3. Update Players
        this.players.forEach((p, i) => {
            const isChaser = (i === chaserIdx);

            // Mark Target Logic (for Defenders)
            // Ideally: Find opponent in my "Zone" or nearest opponent.
            let markTarget: Player | undefined = undefined;
            if (!isAttacking && !isChaser && p.role !== 'GK') {
                // Find closest opponent
                let minDist = Infinity;
                opponent.players.forEach(opp => {
                    const d = p.position.dist(opp.position);
                    if (d < 300 && d < minDist) { // Range check
                        minDist = d;
                        markTarget = opp;
                    }
                });
            }

            if (isChaser) {
                p.isSelected = true; // Visual indicator
            }

            // Pass Context
            // Teammates: this.players
            // Opponents: opponent.players
            p.update(ball, isChaser, isAttacking, this.players, opponent.players, markTarget);
        });

        // 4. Collisions (Intra-team)
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                this.players[i].checkPlayerCollision(this.players[j]);
            }
        }

        // 5. Bounds (Double check, though player handles it)
        // Handled in Player.ts
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.players.forEach(p => p.draw(ctx));
    }

    checkCollisionWithTeam(other: Team) {
        for (let i = 0; i < this.players.length; i++) {
            for (let j = 0; j < other.players.length; j++) {
                this.players[i].checkPlayerCollision(other.players[j]);
            }
        }
    }

    reset() {
        this.players.forEach(p => {
            p.setPos(p.homePos.x, p.homePos.y);
            p.velocity = new Vector2(0, 0);
            p.state = 'IDLE';
        });
    }
}
