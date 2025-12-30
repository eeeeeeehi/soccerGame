import { Constants } from './Constants';
import { Input } from './Input';
import { Ball } from './entities/Ball';
import { Team } from './entities/Team';
import { Vector2 } from './utils/Vector2';
import { Camera } from './Camera';

type GameState = 'KICKOFF' | 'PLAYING' | 'GOAL' | 'THROW_IN' | 'CORNER_KICK' | 'GOAL_KICK' | 'GAME_OVER';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private input: Input;

    private ball!: Ball;
    private team1!: Team; // Blue (Human)
    private team2!: Team; // Red (CPU)

    private state: GameState = 'KICKOFF';
    private score: { p1: number, p2: number } = { p1: 0, p2: 0 };
    private goalTimer: number = 0;

    // Match Timer
    // 3 minutes real time = 90 minutes game time
    // 60fps * 180s = 10800 frames
    private maxMatchTime: number = 180 * 60;
    private matchTimer: number = 180 * 60;

    // Set Piece Info
    private setPieceTeamId: number = 0;
    private setPieceTimer: number = 0;

    private lastTime: number = 0;

    private camera: Camera;

    private padding: number = 80; // Stadium border size

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Container not found');

        this.canvas = document.createElement('canvas');
        this.canvas.width = Constants.CANVAS_WIDTH;
        this.canvas.height = Constants.CANVAS_HEIGHT;
        container.appendChild(this.canvas);

        this.canvas.style.backgroundColor = '#4ade80';

        this.ctx = this.canvas.getContext('2d')!;
        this.input = new Input();
        this.camera = new Camera();

        this.initEntities();

        requestAnimationFrame(this.loop.bind(this));
    }

    initEntities() {
        this.ball = new Ball(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);

        // Team 1: Human, ID 1
        this.team1 = new Team(1, true, this.input);

        // Team 2: CPU, ID 2
        this.team2 = new Team(2, false, null);
    }

    loop(timestamp: number) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update();
        this.draw();

        requestAnimationFrame(this.loop.bind(this));
    }

    update() {
        if (this.state === 'KICKOFF') {
            if (this.input.isDown('Space') || this.input.isDown('ArrowUp') || this.input.isDown('ArrowDown') || this.input.isDown('ArrowLeft') || this.input.isDown('ArrowRight')) {
                this.state = 'PLAYING';
            }
        }

        if (this.state === 'PLAYING') {
            this.ball.update();
            this.team1.update(this.ball, this.team2);
            this.team2.update(this.ball, this.team1);

            // Check collisions between teams
            this.team1.checkCollisionWithTeam(this.team2);

            this.checkBounds(); // Handles Goals and Set Pieces

            // Camera follow
            this.camera.zoom = 1.2;
            this.camera.follow(this.ball.position);

            // Toggle Help
            if (this.input.isDown('Digit0') && this.helpToggleTimer <= 0) {
                this.showHelp = !this.showHelp;
                this.helpToggleTimer = 20; // Debounce
            }
            if (this.helpToggleTimer > 0) this.helpToggleTimer--;

            // Manual Player Switch (S)
            if (this.input.isDown('KeyS') && this.switchTimer <= 0) {
                this.team1.switchPlayer(this.ball);
                this.switchTimer = 20; // Debounce
            }

            // Space Switch (If too far to tackle)
            if (this.input.isDown('Space') && this.switchTimer <= 0) {
                const selected = this.team1.players[this.team1.manualSelectIndex];
                if (selected) {
                    // Check possession
                    const distToBall = selected.position.dist(this.ball.position);
                    const hasPossession = distToBall < selected.radius + this.ball.radius + 15;

                    if (!hasPossession && !this.ball.owner) {
                        // Loose ball situation
                        // If far from ball, switch to closest
                        // Tackle range ~50
                        if (distToBall > 50) {
                            this.team1.switchPlayer(this.ball);
                            this.switchTimer = 20;
                        }
                    } else if (!hasPossession && this.ball.owner && this.ball.owner.teamId !== 1) {
                        // Opponent has ball
                        const distToCarrier = selected.position.dist(this.ball.owner.position);
                        if (distToCarrier > 50) {
                            // Too far to tackle, Switch!
                            this.team1.switchPlayer(this.ball);
                            this.switchTimer = 20;
                        }
                    }
                }
            }
            if (this.switchTimer > 0) this.switchTimer--;
        }

        // Handling Set Pieces (Simple Wait for Input)
        if (['THROW_IN', 'CORNER_KICK', 'GOAL_KICK'].includes(this.state)) {
            // Reposition players if needed (once)
            // Just wait for pass/shoot to resume
            if (this.input.isDown('Space') || this.input.isDown('KeyX') || this.input.isDown('KeyC')) {
                this.state = 'PLAYING';
            }

            // Allow some movement behind the ball? For simplicity, frozen until kick.
            // Actually, let's allow the controlling player to aim.
            // Just run update logic for the kicking team?
            this.ball.velocity = new Vector2(0, 0); // Freeze ball
            // Update team 1 so human can aim (if it's their turn)
            if (this.setPieceTeamId === 1) {
                // Pass isSetPiece = true to freeze movement but allow input (aiming/action)
                this.team1.update(this.ball, this.team2, true);
            } else {
                // AI Delay then kick
                this.setPieceTimer++;
                if (this.setPieceTimer > 60) {
                    // AI Kick logic (random direction back into play)
                    const target = this.team2.id === 1 ? new Vector2(Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2) : new Vector2(0, Constants.FIELD_HEIGHT / 2);
                    const kickDir = target.sub(this.ball.position).normalize();
                    this.ball.velocity = kickDir.mult(10);
                    this.state = 'PLAYING';
                }
            }
        }

        if (this.state === 'GOAL') {
            this.goalTimer++;
            if (this.goalTimer > 180) { // Wait ~3 seconds (60fps)
                this.resetKickoff();
            }
        }
    }

    resetKickoff(scoringTeamId: number = 2) {
        this.state = 'KICKOFF';

        // Reset positions
        this.team1.initFormation();
        this.team2.initFormation();

        // Ball to Center
        this.ball.position = new Vector2(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);
        this.ball.velocity = new Vector2(0, 0);
        this.ball.owner = null;

        // Give Possession to Team 1 (Requested by User)
        // Or specific team if we want alternate kickoffs later.
        // For now, force Team 1 FW.

        const isTeam1Kickoff = true; // Always T1 for now per user? "Start with Blue having ball"

        if (isTeam1Kickoff) {
            const kicker = this.team1.players.find(p => p.role === 'FW');
            if (kicker) {
                // Pos slightly behind center? Or AT center.
                kicker.position = new Vector2(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2 + 10);
                // Assign owner
                this.ball.owner = kicker;
                kicker.isDribbling = true;
                // Force camera
                this.camera.follow(this.ball.position);
            }
        }
    }

    checkBounds() {
        const p = this.ball.position;
        const r = this.ball.radius;
        const w = Constants.FIELD_WIDTH;
        const h = Constants.FIELD_HEIGHT;
        const goalTop = (Constants.FIELD_HEIGHT - Constants.GOAL_HEIGHT) / 2;
        const goalBottom = (Constants.FIELD_HEIGHT + Constants.GOAL_HEIGHT) / 2;
        const inGoalRange = p.y > goalTop && p.y < goalBottom;

        // GOAL CHECK
        if (p.x < -r && inGoalRange) {
            console.log("Goal Team 2!");
            this.score.p2++;
            this.state = 'GOAL';
            this.goalTimer = 0;
            return;
        }
        if (p.x > w + r && inGoalRange) {
            console.log("Goal Team 1!");
            this.score.p1++;
            this.state = 'GOAL';
            this.goalTimer = 0;
            return;
        }

        // OUT OF BOUNDS CHECK
        let out = false;
        let type: GameState = 'PLAYING';

        // SIDE LINE (Top/Bottom) -> Throw In
        if (p.y < -r || p.y > h + r) {
            out = true;
            type = 'THROW_IN';
        }

        // END LINE (Left/Right) -> Corner or Goal Kick
        else if ((p.x < -r || p.x > w + r) && !inGoalRange) {
            out = true;
            // Who touched last?
            // If Left Side (Team 1 Goal): 
            //   Last Touch Team 1 (Def) -> Corner Kick (for T2)
            //   Last Touch Team 2 (Att) -> Goal Kick (for T1)

            // If Right Side (Team 2 Goal):
            //   Last Touch Team 2 (Def) -> Corner Kick (for T1)
            //   Last Touch Team 1 (Att) -> Goal Kick (for T2)

            const lastId = this.ball.lastTouch || 0;
            const side = p.x < 0 ? 'LEFT' : 'RIGHT';

            if (side === 'LEFT') {
                if (lastId === 1) type = 'CORNER_KICK'; // Self goal line touch
                else type = 'GOAL_KICK';
            } else {
                if (lastId === 2) type = 'CORNER_KICK';
                else type = 'GOAL_KICK';
            }
        }

        if (out) {
            // Determine whose ball it is
            // Throw In: Opposite of last touch
            // Corner: Attackers (Opposite of side owner)
            // Goal Kick: Defenders (Side owner)

            let pos = p.clone();
            // Clamp Position to line
            if (pos.x < 0) pos.x = 0;
            if (pos.x > w) pos.x = w;
            if (pos.y < 0) pos.y = 0;
            if (pos.y > h) pos.y = h;

            let teamId = (this.ball.lastTouch === 1) ? 2 : 1; // Default swap

            if (type === 'GOAL_KICK') {
                // Goal Kick is taken by the defender of that side
                teamId = (p.x < w / 2) ? 1 : 2;
                // Place ball at corner of 6-yard box (approx)
                const boxX = (teamId === 1) ? 50 : w - 50;
                pos = new Vector2(boxX, h / 2);
            } else if (type === 'CORNER_KICK') {
                // Corner taken by attacker
                teamId = (p.x < w / 2) ? 2 : 1;
                // Place at corner
                const cornerX = (p.x < w / 2) ? 0 : w;
                const cornerY = (p.y < h / 2) ? 0 : h;
                pos = new Vector2(cornerX, cornerY);
            }

            this.setSetPiece(type, teamId, pos);
        }
    }

    setSetPiece(type: GameState, teamId: number, pos: Vector2) {
        this.state = type;
        this.setPieceTeamId = teamId;
        this.ball.position = pos;
        this.ball.velocity = new Vector2(0, 0);
        this.setPieceTimer = 0;

        // Reposition players

        // Logic check:
        // Corner: Attacking team takes it.
        // Goal Kick: Defending team takes it (but they are "Attacking" in possession sense?)
        // Let's pass "Taking Set Piece" as context.

        this.team1.resetForSetPiece(type, pos, teamId === 1);
        this.team2.resetForSetPiece(type, pos, teamId === 2);

        // Move kicker to ball
        const team = (teamId === 1) ? this.team1 : this.team2;
        // Find closest to ball of that team and move them there
        let bestP = team.players[0];
        let minD = Infinity;
        team.players.forEach(p => {
            const d = p.position.dist(pos); // Use current pos (which was just reset, roughly)
            if (d < minD) { minD = d; bestP = p; }
        });

        // Ensure kicker is close
        bestP.position = pos.clone();
        // nudge back slightly so they can kick
        const center = new Vector2(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);
        const dir = center.sub(pos).normalize();

        // CORNER override: Place exactly at corner?
        // THROW IN: On line
        // GOAL KICK: In box

        bestP.position = bestP.position.add(dir.mult(-15)); // Back up 15px

        // Force kicker selection if human
        if (teamId === 1) {
            team.players.forEach(p => p.isSelected = false);
            bestP.isSelected = true;
        }
    }



    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Sidebars (Background)
        this.drawSidebars();

        // 2. Draw Field (Centered/Offset)
        this.ctx.save();
        this.ctx.translate(Constants.SIDEBAR_WIDTH, 0);

        // Apply Camera
        this.camera.apply(this.ctx);

        this.drawField();

        this.team1.draw(this.ctx);
        this.team2.draw(this.ctx);
        this.ball.draw(this.ctx);

        this.camera.unapply(this.ctx);

        // Draw In-Game UI (Overlays like Goal Text)
        this.drawGameOverlays(); // Renamed from drawUI to specific overlays

        this.ctx.restore();
    }

    drawSidebars() {
        const w = Constants.SIDEBAR_WIDTH;
        const h = Constants.CANVAS_HEIGHT;

        // LEFT BAR (Player Data)
        this.ctx.fillStyle = '#1e293b'; // Dark Slate
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("PLAYER DATA", w / 2, 30);

        // Find selected player (Team 1)
        const selected = this.team1.players.find(p => p.isSelected) || this.team1.players.find(p => p.isDribbling);

        if (selected) {
            this.ctx.textAlign = 'left';
            this.ctx.font = '16px Arial';
            let y = 80;
            const x = 20;

            this.ctx.fillText(`Name: ${selected.name}`, x, y); y += 30;
            this.ctx.fillText(`Role: ${selected.role}`, x, y); y += 30;
            this.ctx.fillText(`Stamina: ${Math.floor(selected.stamina)}`, x, y); y += 30;

            // Bars
            this.ctx.fillStyle = '#475569';
            this.ctx.fillRect(x, y, 200, 10);
            this.ctx.fillStyle = '#22c55e';
            this.ctx.fillRect(x, y, 200 * (selected.stamina / 100), 10);
            y += 30;

            this.ctx.fillStyle = 'white';
            this.ctx.fillText(`Speed: ${selected.stats.speed}`, x, y); y += 30;
            this.ctx.fillText(`Kick: ${selected.stats.kickPower}`, x, y); y += 30;
        }


        // RIGHT BAR (Formation / Management)
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fillRect(Constants.CANVAS_WIDTH - w, 0, w, h);

        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.font = '20px Arial';
        this.ctx.fillText("TEAM MANAGEMENT", Constants.CANVAS_WIDTH - w / 2, 30);

        // List Team 1 Players
        this.ctx.textAlign = 'left';
        this.ctx.font = '14px Arial';
        let ry = 80;
        const rx = Constants.CANVAS_WIDTH - w + 20;

        this.team1.players.forEach(p => {
            this.ctx.fillStyle = p.isSelected ? '#fbbf24' : 'white';
            const status = p.stamina < 30 ? '(!)' : '';
            this.ctx.fillText(`${p.role} ${p.name} ${status}`, rx, ry);

            // Mini Stamina
            this.ctx.fillStyle = p.stamina > 50 ? '#22c55e' : '#ef4444';
            this.ctx.fillRect(rx + 120, ry - 10, 50 * (p.stamina / 100), 5);

            ry += 25;
        });
    }

    drawGameOverlays() {
        // Renamed from drawUI, draws specific game text centered on field
        this.ctx.font = '30px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${this.score.p1} - ${this.score.p2}`, Constants.FIELD_WIDTH / 2, 40);

        if (this.state === 'GOAL') {
            this.ctx.font = '60px Arial';
            this.ctx.fillStyle = 'yellow';
            this.ctx.fillText("GOAL!!!", Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);
        }

        if (this.state === 'KICKOFF') {
            this.ctx.font = '20px Arial';
            this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
            this.ctx.fillText("Press Arrow Keys or Space to Start", Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2 + 80);
        }

        if (['THROW_IN', 'CORNER_KICK', 'GOAL_KICK'].includes(this.state)) {
            const text = this.state.replace('_', ' ');
            const teamName = this.setPieceTeamId === 1 ? "BLUE" : "RED";
            const color = this.setPieceTeamId === 1 ? "#3b82f6" : "#ef4444";

            this.ctx.font = '40px Arial';
            this.ctx.fillStyle = color;
            this.ctx.fillText(`${text} (${teamName})`, Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2 - 50);
        }

        if (this.showHelp) {
            const x = 20;
            const y = 20;
            const w = 250;
            const h = 220;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(x, y, w, h);

            this.ctx.textAlign = 'left';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '16px monospace';

            let ly = y + 25;
            const lh = 22;
            this.ctx.fillText("[0] Toggle Help", x + 10, ly); ly += lh;
            this.ctx.fillText("Arrows: Move", x + 10, ly); ly += lh;
            this.ctx.fillText("Space : Action", x + 10, ly); ly += lh;
            this.ctx.fillText("      (Kick/Dash/Tackle)", x + 10, ly); ly += lh;
            this.ctx.fillText("Shift : Sprint (Auto)", x + 10, ly); ly += lh;
            this.ctx.fillText("S     : Switch Player", x + 10, ly); ly += lh;
            this.ctx.fillText("D     : Squad Manager", x + 10, ly); ly += lh;
        } else {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.font = '14px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText("Press 0 for Help", 20, 30);
        }
    }

    drawField() {
        // 1. Grass Stripes
        const stripWidth = 100;
        for (let x = 0; x < Constants.FIELD_WIDTH; x += stripWidth) {
            this.ctx.fillStyle = (x / stripWidth) % 2 === 0 ? '#4ade80' : '#22c55e'; // Light vs Dark Green
            this.ctx.fillRect(x, 0, stripWidth, Constants.FIELD_HEIGHT);
        }

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;

        // Outer Boundary
        this.ctx.strokeRect(0, 0, Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT);

        // Center line
        this.ctx.beginPath();
        this.ctx.moveTo(Constants.FIELD_WIDTH / 2, 0);
        this.ctx.lineTo(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT);
        this.ctx.stroke();

        // Center circle
        this.ctx.beginPath();
        this.ctx.arc(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2, 70, 0, Math.PI * 2);
        this.ctx.stroke();

        // Penalty Areas (Optional simple boxes)
        // Left
        this.ctx.strokeRect(0, (Constants.FIELD_HEIGHT - 400) / 2, 150, 400);
        // Right
        this.ctx.strokeRect(Constants.FIELD_WIDTH - 150, (Constants.FIELD_HEIGHT - 400) / 2, 150, 400);


        // Goals (Nets)
        this.drawGoal(0, true); // Left
        this.drawGoal(Constants.FIELD_WIDTH, false); // Right
    }

    drawGoal(x: number, isLeft: boolean) {
        const h = Constants.GOAL_HEIGHT;
        const y = (Constants.FIELD_HEIGHT - h) / 2;
        const d = 40; // Depth of goal

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;

        // Posts
        const frontX = x;
        const backX = isLeft ? x - d : x + d;

        // Top and Bottom Frames
        this.ctx.beginPath();
        this.ctx.moveTo(frontX, y); // Top Front
        this.ctx.lineTo(backX, y);   // Top Back
        this.ctx.lineTo(backX, y + h); // Bottom Back
        this.ctx.lineTo(frontX, y + h); // Bottom Front
        this.ctx.stroke();

        // Net (Crosshatch)
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;

        // Horizontal lines
        for (let i = 0; i <= h; i += 10) {
            this.ctx.moveTo(frontX, y + i);
            this.ctx.lineTo(backX, y + i);
        }
        // Vertical lines (Side)
        for (let i = 0; i <= d; i += 10) {
            const bx = isLeft ? frontX - i : frontX + i;
            this.ctx.moveTo(bx, y);
            this.ctx.lineTo(bx, y + h);
        }
        this.ctx.stroke();

        // Draw Post Lines again for clarity
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(frontX, y);
        this.ctx.lineTo(frontX, y + h);
        this.ctx.stroke();
    }

    private showHelp: boolean = true;
    private helpToggleTimer: number = 0;
    private switchTimer: number = 0;
}




