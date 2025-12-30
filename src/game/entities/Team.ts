import { Player, type PlayerRole } from './Player';
import { Ball } from './Ball';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';
import { Input } from '../Input';
import { Formations } from '../Formations';
import playersData from '../data/players.json'; // Fallback Data

// SAFETY NET: Hardcoded roster in case JSON import fails
const DEFAULT_ROSTER = {
    "teams": [
        { "id": 1, "name": "Dream Team", "color": "#3b82f6" },
        { "id": 2, "name": "Legends", "color": "#ef4444" }
    ],
    "players": [
        { "teamId": 1, "name": "Courtois", "number": 1, "role": "GK", "stats": { "speed": 65, "kick_power": 85, "stamina": 80, "technique": 70 } },
        { "teamId": 1, "name": "Ederson", "number": 31, "role": "GK", "stats": { "speed": 70, "kick_power": 95, "stamina": 80, "technique": 85 } },
        { "teamId": 1, "name": "Van Dijk", "number": 4, "role": "DF", "stats": { "speed": 85, "kick_power": 85, "stamina": 90, "technique": 80 } },
        { "teamId": 1, "name": "Rúben Dias", "number": 3, "role": "DF", "stats": { "speed": 80, "kick_power": 82, "stamina": 92, "technique": 78 } },
        { "teamId": 1, "name": "Rüdiger", "number": 22, "role": "DF", "stats": { "speed": 92, "kick_power": 80, "stamina": 95, "technique": 75 } },
        { "teamId": 1, "name": "Saliba", "number": 2, "role": "DF", "stats": { "speed": 84, "kick_power": 78, "stamina": 88, "technique": 80 } },
        { "teamId": 1, "name": "Walker", "number": 2, "role": "DF", "stats": { "speed": 95, "kick_power": 85, "stamina": 90, "technique": 75 } },
        { "teamId": 1, "name": "T. Hernández", "number": 19, "role": "DF", "stats": { "speed": 96, "kick_power": 82, "stamina": 92, "technique": 82 } },
        { "teamId": 1, "name": "Hakimi", "number": 2, "role": "DF", "stats": { "speed": 97, "kick_power": 80, "stamina": 94, "technique": 85 } },
        { "teamId": 1, "name": "Davies", "number": 19, "role": "DF", "stats": { "speed": 98, "kick_power": 78, "stamina": 90, "technique": 85 } },
        { "teamId": 1, "name": "De Bruyne", "number": 17, "role": "MF", "stats": { "speed": 78, "kick_power": 92, "stamina": 85, "technique": 98 } },
        { "teamId": 1, "name": "Bellingham", "number": 5, "role": "MF", "stats": { "speed": 85, "kick_power": 88, "stamina": 98, "technique": 92 } },
        { "teamId": 1, "name": "Rodri", "number": 16, "role": "MF", "stats": { "speed": 72, "kick_power": 85, "stamina": 95, "technique": 95 } },
        { "teamId": 1, "name": "Modric", "number": 10, "role": "MF", "stats": { "speed": 75, "kick_power": 80, "stamina": 80, "technique": 99 } },
        { "teamId": 1, "name": "Kroos", "number": 8, "role": "MF", "stats": { "speed": 60, "kick_power": 90, "stamina": 75, "technique": 98 } },
        { "teamId": 1, "name": "Valverde", "number": 15, "role": "MF", "stats": { "speed": 90, "kick_power": 92, "stamina": 99, "technique": 85 } },
        { "teamId": 1, "name": "Pedri", "number": 8, "role": "MF", "stats": { "speed": 80, "kick_power": 75, "stamina": 85, "technique": 96 } },
        { "teamId": 1, "name": "B. Fernandes", "number": 8, "role": "MF", "stats": { "speed": 75, "kick_power": 88, "stamina": 95, "technique": 90 } },
        { "teamId": 1, "name": "Messi", "number": 10, "role": "FW", "stats": { "speed": 80, "kick_power": 90, "stamina": 75, "technique": 100 } },
        { "teamId": 1, "name": "Ronaldo", "number": 7, "role": "FW", "stats": { "speed": 82, "kick_power": 98, "stamina": 80, "technique": 90 } },
        { "teamId": 1, "name": "Mbappé", "number": 9, "role": "FW", "stats": { "speed": 99, "kick_power": 90, "stamina": 90, "technique": 92 } },
        { "teamId": 1, "name": "Haaland", "number": 9, "role": "FW", "stats": { "speed": 94, "kick_power": 99, "stamina": 90, "technique": 80 } },
        { "teamId": 2, "name": "Alisson", "number": 1, "role": "GK", "stats": { "speed": 70, "kick_power": 90, "stamina": 80, "technique": 85 } },
        { "teamId": 2, "name": "Marquinhos", "number": 5, "role": "DF", "stats": { "speed": 82, "kick_power": 75, "stamina": 88, "technique": 80 } },
        { "teamId": 2, "name": "Militão", "number": 3, "role": "DF", "stats": { "speed": 88, "kick_power": 80, "stamina": 88, "technique": 78 } },
        { "teamId": 2, "name": "Araújo", "number": 4, "role": "DF", "stats": { "speed": 88, "kick_power": 80, "stamina": 85, "technique": 75 } },
        { "teamId": 2, "name": "Robertson", "number": 26, "role": "DF", "stats": { "speed": 85, "kick_power": 82, "stamina": 95, "technique": 82 } },
        { "teamId": 2, "name": "Kimmich", "number": 6, "role": "MF", "stats": { "speed": 75, "kick_power": 85, "stamina": 95, "technique": 92 } },
        { "teamId": 2, "name": "Rice", "number": 41, "role": "MF", "stats": { "speed": 80, "kick_power": 82, "stamina": 96, "technique": 88 } },
        { "teamId": 2, "name": "Saka", "number": 7, "role": "MF", "stats": { "speed": 90, "kick_power": 85, "stamina": 90, "technique": 88 } },
        { "teamId": 2, "name": "Vinícius Jr", "number": 7, "role": "MF", "stats": { "speed": 98, "kick_power": 85, "stamina": 92, "technique": 96 } },
        { "teamId": 2, "name": "Salah", "number": 11, "role": "FW", "stats": { "speed": 92, "kick_power": 88, "stamina": 85, "technique": 90 } },
        { "teamId": 2, "name": "Kane", "number": 9, "role": "FW", "stats": { "speed": 75, "kick_power": 95, "stamina": 90, "technique": 92 } }
    ]
};

export class Team {
    id: number;
    players: Player[] = [];
    isHuman: boolean;
    input: Input | null;

    // Data cache
    private static apiData: any = playersData || DEFAULT_ROSTER; // Sync Init with Fallback
    private static isFetching: boolean = false;

    // Manual Control Override
    private manualSelectIndex: number = -1;
    private defenseSwitchCooldown: number = 0;
    private actionBlockTimer: number = 0;

    constructor(id: number, isHuman: boolean, input: Input | null) {
        this.id = id;
        this.isHuman = isHuman;
        this.input = input;

        // DEBUG LOG
        console.log("Team Constructor ID:", this.id);
        console.log("Initial playersData:", playersData);
        console.log("Static apiData:", Team.apiData);

        // Try fetch (async update)
        this.loadDataAndInit();

        // Ensure initial sync population (since apiData has default)
        this.initFormation();
    }

    async loadDataAndInit() {
        // Sync init ensures we have data immediately.
        // Try async fetch to update if available?
        // If we already have playersData set, we don't strictly need to wait.
        // But if user has API, we prefer API.

        if (!Team.isFetching) {
            // ... fetch ...
            Team.isFetching = true;
            try {
                // Fetch from Local Backend
                const res = await fetch('http://localhost:3000/api/players');
                if (res.ok) {
                    const data = await res.json();
                    if (data.players && data.players.length > 0) {
                        Team.apiData = data;
                        console.log("Loaded players from API:", Team.apiData);
                    } else {
                        console.warn("API returned empty data, using local JSON fallback.");
                        Team.apiData = playersData || DEFAULT_ROSTER;
                    }
                } else {
                    console.warn("API load failed, using local JSON fallback.");
                    Team.apiData = playersData || DEFAULT_ROSTER; // Fallback
                }
            } catch (e) {
                console.error("API Error, using fallback:", e);
                // Team.apiData already has defaults, re-assign to be safe
                Team.apiData = playersData || DEFAULT_ROSTER;
            }
            Team.isFetching = false;
        }

        // No need for an additional check here, as Team.apiData is always initialized
        // with playersData either at declaration or explicitly in catch/else blocks
        // if the initial declaration was somehow missed or overwritten.
        // The current logic ensures it's always set to playersData if API fails.

        this.initFormation();
    }

    initFormation() {
        this.players = [];

        const getX = (pct: number) => {
            return this.id === 1
                ? pct * Constants.FIELD_WIDTH
                : (1 - pct) * Constants.FIELD_WIDTH;
        };

        const getY = (pct: number) => pct * Constants.FIELD_HEIGHT;

        // Data Loading
        let myData: any[] = [];
        if (Team.apiData && Team.apiData.players) {
            myData = Team.apiData.players.filter((p: any) => p.teamId === this.id);
        }

        // Config Loading (Team 1)
        let formationName = '4-4-2';
        let squadIds: number[] = [];

        if (this.id === 1) {
            const configStr = localStorage.getItem('myTeamConfig');
            if (configStr) {
                try {
                    const config = JSON.parse(configStr);
                    if (config.formation) formationName = config.formation;
                    if (config.lineup) squadIds = config.lineup;
                    console.log("Loaded Squad Config:", formationName, squadIds);
                } catch (e) {
                    console.error("Failed to parse team config", e);
                }
            }
        }

        const currentFormation = Formations[formationName] || Formations['4-4-2'];

        // Helper to find player data
        const usedIndices = new Set<number>();

        const getPlayerData = (role: PlayerRole, slotIndex: number) => {
            let idx = -1;

            // 1. Check Specific Squad Slot
            if (squadIds.length > slotIndex) {
                const targetId = squadIds[slotIndex];
                if (targetId) {
                    idx = myData.findIndex(p => p.id === targetId);
                }
            }

            // 2. Role Match (Fallback)
            if (idx === -1) {
                idx = myData.findIndex((p: any, i: number) => p.role === role && !usedIndices.has(i));
            }

            // 3. Any (Fallback)
            if (idx === -1) {
                idx = myData.findIndex((_, i) => !usedIndices.has(i));
            }

            if (idx !== -1) {
                usedIndices.add(idx);
                return myData[idx];
            }
            return null;
        }

        currentFormation.forEach((node: any, i: number) => {
            const data = getPlayerData(node.role, i);

            // Map JSON stats
            let stats = undefined;
            if (data && data.stats) {
                stats = {
                    speed: data.stats.speed,
                    kickPower: data.stats.kick_power,
                    stamina: data.stats.stamina,
                    technique: data.stats.technique
                };
            }

            const p = new Player(getX(node.x), getY(node.y), this.id, node.role, this.isHuman, this.input, stats);

            if (data) {
                p.name = data.name;
                p.number = data.number;
            }

            this.players.push(p);
        });
    }

    update(ball: Ball, opponent: Team, isSetPiece: boolean = false) {
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

        // DEFENSE INPUT (Auto Switch + Tackle)
        if (this.isHuman && this.input && this.defenseSwitchCooldown <= 0) {
            // Only if we don't have possession (approx)
            const weHaveBall = myClosestDist < 30; // Very close
            if (!weHaveBall && this.input.isDown('Space')) {
                // Switch to closest
                if (this.manualSelectIndex !== myClosestIdx) {
                    this.manualSelectIndex = myClosestIdx;
                    this.defenseSwitchCooldown = 10;

                    // Prevent "Switch & Tackle": Block input for the new player briefly
                    if (this.players[myClosestIdx]) {
                        this.players[myClosestIdx].actionBlockTimer = 10;
                    }
                }

                // Trigger Tackle immediately if close enough and input is fresh
                // actually, handleInput in Player will trigger slide if Space is held.
                // But we just switched, so Player.handleInput will run this frame or next.
                // If we set selection, Player.handleInput runs!
                // So switching is enough? User says "Make it tackle".
                // If I hold space, Player.ts sees space and Slides. valid.
            }
        }
        if (this.defenseSwitchCooldown > 0) this.defenseSwitchCooldown--;

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
        // 1. Player who is currently "possessing" the ball (very close) -> AUTO SELECT
        // 2. Manual Selection (if active)
        // 3. Closest player to the ball

        let chaserIdx = -1;

        // Check Possessing Player (High Priority - Always auto switch to ball carrier)
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            const dist = p.position.dist(ball.position);
            if (dist < p.radius + ball.radius + 15) { // Generous possession
                chaserIdx = i;
                this.manualSelectIndex = i; // Sync manual index
                break;
            }
        }

        // If no carrier, check Manual or Closest
        if (chaserIdx === -1) {
            if (this.manualSelectIndex !== -1) {
                chaserIdx = this.manualSelectIndex;
            } else {
                chaserIdx = myClosestIdx;
            }
        }

        // 3. Update Players
        this.players.forEach((p, i) => {
            const isChaser = (i === chaserIdx);

            // Pass Context
            // Teammates: this.players
            // Opponents: opponentTeam.players

            p.isSelected = isChaser; // Restore selection visual

            // Determine if set piece taker (freeze movement)
            // If Set Piece, Human, and Is Selected -> Freeze
            let shouldFreeze = false;
            // manualSelectIndex is sync'd to chaserIdx in logic above (lines 285-303) usually.
            // But strict check:
            // Do NOT freeze the Chaser(Taker) if it is Human during Set Piece.
            // We want them to input commands (Pass/Shot).
            // Logic removed: if (isSetPiece && this.isHuman && isChaser) { shouldFreeze = true; }

            p.update(ball, isChaser, isAttacking, this.players, opponent.players, shouldFreeze, isSetPiece);
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
        this.reset(); // Reset velocity/state

        // Identify Set Piece Taker (Closest to Ball)
        // We prioritize the closest player to take the set piece.
        let closestDist = Infinity;
        let takerIdx = -1;

        this.players.forEach((p, i) => {
            const d = p.homePos.dist(ballPos);
            if (d < closestDist) {
                closestDist = d;
                takerIdx = i;
            }
        });

        if (this.isHuman) {
            this.manualSelectIndex = takerIdx; // Auto-select taker
        }

        // Defensive/Offensive setups
        const goalX = this.id === 1 ? Constants.FIELD_WIDTH : 0; // Enemy goal
        const myGoalX = this.id === 1 ? 0 : Constants.FIELD_WIDTH;

        this.players.forEach((p, i) => {
            const isTaker = (i === takerIdx);

            if (type === 'GOAL_KICK') {
                if (isAttacking) {
                    // Taker (GK or DF) at ball
                    if (isTaker) {
                        p.position = ballPos.clone();
                        // Offset slightly behind ball?
                        p.position.x += (this.id === 1 ? -10 : 10);
                    } else {
                        // Spread out
                        p.position = p.homePos.clone();
                    }
                } else {
                    // Defending
                    p.position = p.homePos.clone();
                }
            }
            else if (type === 'CORNER_KICK') {
                if (isAttacking) {
                    // Reset State
                    p.isChargingShot = false;
                    p.shotPower = 0;
                    p.isChargingPass = false;
                    p.passPower = 0;
                    p.velocity = new Vector2(0, 0);

                    if (isTaker) {
                        p.position = ballPos.clone(); // At Corner
                    } else {
                        // SHORT CORNER OPTION
                        // If this player is the "Short Option" candidate (e.g., closest non-taker)
                        // Simple check: If index is (takerIdx + 1) % length?
                        // Or just pick the first available non-taker

                        // Let's use specific logic: One player comes close.
                        // How to ensure only ONE?
                        // Use a flag or check index distance.

                        // Let's make index 0 (if not taker) or index 1 be the short option.
                        const shortOptionIdx = (takerIdx === 0) ? 1 : 0;

                        if (i === shortOptionIdx) {
                            // Short Option Position: 120px from corner, slightly inside
                            p.position = ballPos.clone();
                            const inboundDir = (this.id === 1 ? new Vector2(-1, 0) : new Vector2(1, 0));
                            // Add some Y offset towards center
                            const yDir = (ballPos.y < Constants.FIELD_HEIGHT / 2) ? 1 : -1;

                            p.position.x += inboundDir.x * 100;
                            p.position.y += yDir * 50;
                        } else {
                            // STRATEGIC POSITIONING IN BOX (4 Players)
                            // We need to distribute them to key danger zones.
                            // Indices of "others": 
                            // We can just iterate a counter or use player index to decide slot.

                            // Define 4 Target Zones relative to Goal Center
                            const enemyGoalX = this.id === 1 ? Constants.FIELD_WIDTH : 0;
                            const myGoalX = this.id === 1 ? 0 : Constants.FIELD_WIDTH;
                            const goalCenter = new Vector2(enemyGoalX, Constants.FIELD_HEIGHT / 2);
                            const attackDir = (this.id === 1 ? 1 : -1);

                            // Zone 1: Near Post (10px out, 50px offset Y)
                            // Zone 2: Far Post (10px out, -50px offset Y)
                            // Zone 3: Penalty Spot Area (80px out, Center)
                            // Zone 4: Top of Box (150px out, Center - Rebound)

                            // To map arbitrary players to zones, we can calculate an offset index.
                            // simple hash or counter? We are inside a loop `this.players.forEach((p, i)`.
                            // let's use `i` modulo 4 or something.

                            // But we have GK and Short Option and Taker excluded.
                            // Simply Randomize within specific clusters?
                            // Or better: Assign based on Role? 
                            // FW -> Near/Far Post. MF -> Edge. DF -> Back?

                            if (p.role === 'GK') {
                                p.position = new Vector2(myGoalX + (this.id === 1 ? 30 : -30), Constants.FIELD_HEIGHT / 2);
                            } else {
                                // Field Players
                                // Use `i` to distribute
                                const slot = i % 4;
                                let target = new Vector2(0, 0);

                                if (slot === 0) { // Near Post
                                    target = new Vector2(enemyGoalX - (100 * attackDir), Constants.FIELD_HEIGHT / 2 + 80);
                                } else if (slot === 1) { // Far Post
                                    target = new Vector2(enemyGoalX - (100 * attackDir), Constants.FIELD_HEIGHT / 2 - 80);
                                } else if (slot === 2) { // Penalty Spot / Center Chaos
                                    target = new Vector2(enemyGoalX - (150 * attackDir), Constants.FIELD_HEIGHT / 2);
                                } else { // Edge of Box (Rebound)
                                    target = new Vector2(enemyGoalX - (250 * attackDir), Constants.FIELD_HEIGHT / 2 + (Math.random() * 100 - 50));
                                }

                                // Add small random jitter so they don't stack perfectly
                                target.x += (Math.random() - 0.5) * 40;
                                target.y += (Math.random() - 0.5) * 40;

                                p.position = target;
                            }
                        }
                    }
                } else {
                    // Defending Corner
                    if (p.role === 'GK') {
                        p.position = new Vector2(myGoalX + (this.id === 1 ? 10 : -10), Constants.FIELD_HEIGHT / 2);
                    } else {
                        // Man mark / Zone defense in box
                        const boxX = this.id === 1 ? 50 : Constants.FIELD_WIDTH - 50;
                        // Wait, we are defending OUR goal.
                        const myBoxX = this.id === 1 ? 50 : Constants.FIELD_WIDTH - 50;

                        const ox = (Math.random() - 0.5) * 150;
                        const oy = (Math.random() - 0.5) * 200;
                        p.position = new Vector2(myBoxX + ox, Constants.FIELD_HEIGHT / 2 + oy);
                    }
                }
            }
            else if (type === 'THROW_IN') {
                if (isAttacking) {
                    if (isTaker) {
                        p.position = ballPos.clone();
                        // Snap to line exactly or slightly out?
                        // ballPos is on the line.
                    } else {
                        // Teammates give options nearby
                        // But not too close (rules).
                        const targetBase = ballPos.clone();
                        targetBase.x += (this.id === 1 ? 100 : -100); // 100px forward/inland?
                        // Actually inland is towards center Y.
                        targetBase.y = Constants.FIELD_HEIGHT / 2; // Center-ish

                        // Just spread around the thrower, but ON FIELD.
                        // Simple: Use homePos but shift towards ball?
                        let target = p.homePos.clone();
                        // Shift towards ball
                        target = target.add(ballPos.sub(target).mult(0.5));
                        p.position = target;
                    }
                } else {
                    // Defending Throw-in
                    // Mark opponents / Block lanes
                    const target = p.homePos.clone();
                    // Shift towards ball
                    p.position = target.add(ballPos.sub(target).mult(0.3));
                }
            }
        });
    }

    reset() {
        this.players.forEach(p => {
            p.setPos(p.homePos.x, p.homePos.y);
            p.velocity = new Vector2(0, 0);
            p.state = 'IDLE';
        });
        this.manualSelectIndex = -1;
    }

    switchPlayer(ball: Ball) {
        // Find best candidate for switch
        // Candidates: Sorted by distance to ball, excluding current manual selection

        let candidates = this.players.map((p, i) => ({
            index: i,
            dist: p.position.dist(ball.position)
        }));

        // Sort by distance
        candidates.sort((a, b) => a.dist - b.dist);

        // Find current selection index in the sorted list
        // If undefined/none, we pick the first (closest)
        // If defined, we pick the next one

        let targetIndex = -1;

        if (this.manualSelectIndex === -1) {
            // Currently auto (closest). Switch to 2nd closest.
            targetIndex = candidates[1] ? candidates[1].index : candidates[0].index;
        } else {
            // Find current in list
            const currentRank = candidates.findIndex(c => c.index === this.manualSelectIndex);

            // Pick next rank? Or closest excluding me?
            // "Switch Player" usually means "Give me the next best option".
            // If I am closest (Rank 0), give me Rank 1.
            // If I am Rank 1, give me Rank 0? Or Rank 2?
            // Usually cycles through nearby players.

            // Let's toggle between Top 3 closest.
            // If I am not in Top 3, pick Top 0.

            if (currentRank !== -1 && currentRank < 2) {
                // Return next one (0->1, 1->2, 2->0)
                const nextRank = (currentRank + 1) % 3; // Cycle top 3
                // Safety check array bounds
                if (nextRank < candidates.length) {
                    targetIndex = candidates[nextRank].index;
                } else {
                    targetIndex = candidates[0].index;
                }
            } else {
                // I was far away or weird rank, reset to Best
                targetIndex = candidates[0].index;
            }
        }

        this.manualSelectIndex = targetIndex;
    }
    public setManualSelection(index: number) {
        if (index >= 0 && index < this.players.length) {
            this.manualSelectIndex = index;
        }
    }
}
