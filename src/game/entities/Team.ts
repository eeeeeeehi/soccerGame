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

        add('GK', 0.05, 0.5);
        add('DF', 0.2, 0.2);
        add('DF', 0.2, 0.4);
        add('DF', 0.2, 0.6);
        add('DF', 0.2, 0.8);
        add('MF', 0.45, 0.2);
        add('MF', 0.45, 0.4);
        add('MF', 0.45, 0.6);
        add('MF', 0.45, 0.8);
        add('FW', 0.7, 0.4);
        add('FW', 0.7, 0.6);
    }

    // Updated update method: Needs Opponent Team for Marking logic
    update(ball: Ball, opponent: Team) {
        // 1. Determine Possession / Game State
        // Simple heuristic: If any of MY players is close to ball, we are "Attacking" (or loose ball fighting)
        // Ideally we should check who actually "has" the ball, but proximity is fine for AI switch.
        // Actually, let's define "Attacking" as: My team is closer to ball than opponent team's closest player?
        // Or simpler: If I have a player within 50px, I am attacking.

        let myClosestDist = Infinity;
        let myClosestIdx = -1;

        this.players.forEach((p, i) => {
            const dist = p.position.dist(ball.position);
            if (dist < myClosestDist) {
                myClosestDist = dist;
                myClosestIdx = i;
            }
            p.isSelected = false;
        });

        const isAttacking = myClosestDist < 100; // If we are somewhat close, act aggressive/supportive

        // 2. Assign Marking Targets (If Defending)
        // For each of my players (except Chaser/GK), find closest opponent to mark
        // Optimization: Could be heavy 11x11. Let's do simple role matching or distance.
        // Simple distance for now.

        this.players.forEach((p, i) => {
            const isChaser = (i === myClosestIdx);

            // Human Control Logic
            if (isChaser && this.isHuman) {
                p.isSelected = true;
            }

            let markTarget: Player | undefined = undefined;

            if (!isAttacking && !isChaser && p.role !== 'GK') {
                // Find nearest opponent to mark
                let minDist = Infinity;
                let nearestOpp = null;

                // Optimization: Search only within reasonable range (e.g. 300px)
                // to avoid defenders marking forwards who are miles away
                for (const opp of opponent.players) {
                    const d = p.position.dist(opp.position);
                    if (d < 300 && d < minDist) {
                        minDist = d;
                        nearestOpp = opp;
                    }
                }
                if (nearestOpp) {
                    markTarget = nearestOpp;
                }
            }

            p.update(ball, isChaser, isAttacking, markTarget);
        });

        // 3. Collisions
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                this.players[i].checkPlayerCollision(this.players[j]);
            }
        }
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
        });
    }
}
