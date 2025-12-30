import { Constants } from './Constants';
import { Input } from './Input';
import { Ball } from './entities/Ball';
import { Team } from './entities/Team';
import { Vector2 } from './utils/Vector2';

type GameState = 'KICKOFF' | 'PLAYING' | 'GOAL';

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

    private lastTime: number = 0;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Container not found');

        this.canvas = document.createElement('canvas');
        this.canvas.width = Constants.FIELD_WIDTH;
        this.canvas.height = Constants.FIELD_HEIGHT;
        container.appendChild(this.canvas);

        this.canvas.style.backgroundColor = '#4ade80';

        this.ctx = this.canvas.getContext('2d')!;
        this.input = new Input();

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
            // Wait for input to start? Or just start?
            // Let's allow moving immediately, switching to PLAYING once ball moves or input press
            // For now, if space is pressed, start.
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

            this.checkGoal();
        }

        if (this.state === 'GOAL') {
            this.goalTimer++;
            if (this.goalTimer > 180) { // Wait ~3 seconds (60fps)
                this.resetKickoff();
            }
        }
    }

    checkGoal() {
        // Goal detection
        // Simple X check + Y range
        const inGoalRange = this.ball.position.y > (Constants.FIELD_HEIGHT - Constants.GOAL_HEIGHT) / 2 &&
            this.ball.position.y < (Constants.FIELD_HEIGHT + Constants.GOAL_HEIGHT) / 2;

        if (this.ball.position.x < 5 && inGoalRange) { // < 5 to be sure it's in
            console.log("Goal Team 2!");
            this.score.p2++;
            this.state = 'GOAL';
            this.goalTimer = 0;
            // Force ball out to avoid double triggers?
            // Actually change state usually prevents update loop from calling checkGoal again if we guard it.
        }
        if (this.ball.position.x > Constants.FIELD_WIDTH - 5 && inGoalRange) {
            console.log("Goal Team 1!");
            this.score.p1++;
            this.state = 'GOAL';
            this.goalTimer = 0;
        }
    }

    resetKickoff() {
        this.ball.position = new Vector2(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);
        this.ball.velocity = new Vector2(0, 0);

        this.team1.reset();
        this.team2.reset();

        // Optional: Swap sides? No, simple reset.
        this.state = 'KICKOFF';
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawField();

        this.team1.draw(this.ctx);
        this.team2.draw(this.ctx);
        this.ball.draw(this.ctx); // Draw ball last

        this.drawUI();
    }

    drawField() {
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;

        // Center line
        this.ctx.beginPath();
        this.ctx.moveTo(Constants.FIELD_WIDTH / 2, 0);
        this.ctx.lineTo(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT);
        this.ctx.stroke();

        // Center circle
        this.ctx.beginPath();
        this.ctx.arc(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2, 50, 0, Math.PI * 2);
        this.ctx.stroke();

        // Goals
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        const goalY = (Constants.FIELD_HEIGHT - Constants.GOAL_HEIGHT) / 2;
        this.ctx.fillRect(0, goalY, 5, Constants.GOAL_HEIGHT);
        this.ctx.fillRect(Constants.FIELD_WIDTH - 5, goalY, 5, Constants.GOAL_HEIGHT);
    }

    drawUI() {
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
            this.ctx.fillText("Press Arrow Keys to Start", Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2 + 80);
        }
    }
}
