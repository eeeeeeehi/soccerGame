import { Player, type PlayerRole } from './Player';
import { Ball } from './Ball';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';
import { Input } from '../Input';
// import playersData from '../data/players.json'; // REMOVED

export class Team {
    id: number;
    players: Player[] = [];
    isHuman: boolean;
    input: Input | null;

    // Data cache
    private static apiData: any = null;
    private static isFetching: boolean = false;

    constructor(id: number, isHuman: boolean, input: Input | null) {
        this.id = id;
        this.isHuman = isHuman;
        this.input = input;

        // Try fetch
        this.loadDataAndInit();
    }

    async loadDataAndInit() {
        if (!Team.apiData && !Team.isFetching) {
            Team.isFetching = true;
            try {
                // Fetch from Local Backend
                const res = await fetch('http://localhost:3000/api/players');
                if (res.ok) {
                    Team.apiData = await res.json();
                    console.log("Loaded players from API:", Team.apiData);
                } else {
                    console.error("Failed to load from API, using fallback.");
                }
            } catch (e) {
                console.error("API Error:", e);
            }
            Team.isFetching = false;
        }

        // Wait a bit if fetching (polling simple)
        if (!Team.apiData) {
            // If failed or waiting, we might want to fallback to defaults instantly OR wait?
            // Let's implement a simple poller check for this instance.
            setTimeout(() => this.loadDataAndInit(), 100);
            return;
        }

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

        // Data Loading
        // Filter players for this team from API data
        let myData: any[] = [];
        if (Team.apiData && Team.apiData.players) {
            myData = Team.apiData.players.filter((p: any) => p.teamId === this.id);
        }

        // Helper to find unused player for role
        const usedIndices = new Set<number>();

        const getNextPlayer = (role: PlayerRole) => {
            // Priority: Find matches role & not used
            let idx = myData.findIndex((p: any, i: number) => p.role === role && !usedIndices.has(i));

            // Fallback: Find any not used
            if (idx === -1) {
                idx = myData.findIndex((p: any, i: number) => !usedIndices.has(i));
            }

            if (idx !== -1) {
                usedIndices.add(idx);
                return myData[idx];
            }
            return null;
        }

        const add = (role: PlayerRole, xPct: number, yPct: number) => {
            const data = getNextPlayer(role);

            // Map JSON stats (snake_case) to PlayerStats (camelCase)
            let stats = undefined;
            if (data && data.stats) {
                stats = {
                    speed: data.stats.speed,
                    kickPower: data.stats.kick_power, // Mapped
                    stamina: data.stats.stamina,
                    technique: data.stats.technique
                };
            }

            const p = new Player(getX(xPct), getY(yPct), this.id, role, this.isHuman, this.input, stats);

            if (data) {
                p.name = data.name;
                p.number = data.number;
            }

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

        // 2. Select Chaser / Player to Control
        // Priority: 
        // 1. Player who is currently "possessing" the ball (very close)
        // 2. Closest player to the ball

        let chaserIdx = myClosestIdx;
        const possessionDist = 30; // Close enough to be "dribbling"

        // Check if anyone has possession
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            const dist = p.position.dist(ball.position);
            if (dist < p.radius + ball.radius + 10) { // Slightly generous "possession" check
                chaserIdx = i;
                break; // Found the holder, they are the selected one
            }
        }

        // 3. Update Players
        this.players.forEach((p, i) => {
            const isChaser = (i === chaserIdx);

            // Pass Context
            // Teammates: this.players
            // Opponents: opponent.players
            p.update(ball, isChaser, isAttacking, this.players, opponent.players);
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

    resetForSetPiece(type: string, ballPos: Vector2, isAttacking: boolean) {
        this.reset(); // Reset velocity/state first

        // Defensive/Offensive setups
        const goalX = this.id === 1 ? Constants.FIELD_WIDTH : 0; // Enemy goal
        const myGoalX = this.id === 1 ? 0 : Constants.FIELD_WIDTH;

        this.players.forEach((p, i) => {
            if (type === 'GOAL_KICK') {
                if (isAttacking) {
                    // We are taking the kick. 
                    // GK takes it usually, or DF. 
                    // Defenders spread wide, MFs deep.
                    // For now, reset to somewhat standard but compressed
                    p.position = p.homePos.clone();
                } else {
                    // We are defending goal kick. Press high? Or retreat?
                    // Typically standard formation but backed off slightly
                    p.position = p.homePos.clone();
                }
            }
            else if (type === 'CORNER_KICK') {
                // Ball is at corner. 
                const nearPost = new Vector2(isAttacking ? goalX : myGoalX, Constants.FIELD_HEIGHT / 2 - 50);
                const farPost = new Vector2(isAttacking ? goalX : myGoalX, Constants.FIELD_HEIGHT / 2 + 50);
                const penaltySpot = new Vector2(isAttacking ? (this.id === 1 ? Constants.FIELD_WIDTH - 100 : 100) : (this.id === 1 ? 100 : Constants.FIELD_WIDTH - 100), Constants.FIELD_HEIGHT / 2);

                if (p.role === 'GK') {
                    p.position = new Vector2(myGoalX + (this.id === 1 ? 20 : -20), Constants.FIELD_HEIGHT / 2);
                } else {
                    // Randomize positions in the box
                    const ox = (Math.random() - 0.5) * 100;
                    const oy = (Math.random() - 0.5) * 150;
                    p.position = penaltySpot.add(new Vector2(ox, oy));
                }
            }
            else if (type === 'THROW_IN') {
                // Move towards ball side
                let target = p.homePos.clone();
                // Bias Y towards ball Y
                target.y = target.y * 0.5 + ballPos.y * 0.5;
                // Bias X towards ball X
                target.x = target.x * 0.5 + ballPos.x * 0.5;
                p.position = target;
            }
            else {
                p.position = p.homePos.clone();
            }
        });
    }

    reset() {
        this.players.forEach(p => {
            p.setPos(p.homePos.x, p.homePos.y);
            p.velocity = new Vector2(0, 0);
            p.state = 'IDLE';
        });
    }
}
