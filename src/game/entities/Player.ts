import { Entity } from './Entity';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';
import { Input } from '../Input';
import { Ball } from './Ball';

export type PlayerRole = 'GK' | 'DF' | 'MF' | 'FW';
// Extended states for advanced tactics
export type PlayerState = 'IDLE' | 'CHASE' | 'RETURN' | 'DRIBBLE' | 'MARKING' | 'SUPPORT' | 'WAIT';

export class Player extends Entity {
    teamId: number;
    role: PlayerRole;
    homePos: Vector2;
    state: PlayerState = 'IDLE';

    isHuman: boolean;
    isSelected: boolean = false;
    input: Input | null;

    constructor(x: number, y: number, teamId: number, role: PlayerRole, isHuman: boolean = false, input: Input | null = null) {
        const color = teamId === 1 ? Constants.TEAM_1_COLOR : Constants.TEAM_2_COLOR;
        super(x, y, Constants.PLAYER_RADIUS, color);
        this.teamId = teamId;
        this.role = role;
        this.homePos = new Vector2(x, y);
        this.isHuman = isHuman;
        this.input = input;
    }

    // Update loop called by Team
    // Added params: isAttacking (team state), markTarget (for defenders)
    update(ball: Ball, isChaser: boolean, isAttacking: boolean, markTarget?: Player): void {
        this.velocity = new Vector2(0, 0);

        if (this.isHuman && this.isSelected && this.input) {
            this.handleInput(ball);
        } else {
            this.handleAI(ball, isChaser, isAttacking, markTarget);
        }

        super.update();
        this.checkBounds();
        this.checkBallCollision(ball);
    }

    handleInput(ball: Ball): void {
        if (!this.input) return;

        if (this.input.isDown('ArrowUp')) this.velocity.y -= Constants.PLAYER_SPEED;
        if (this.input.isDown('ArrowDown')) this.velocity.y += Constants.PLAYER_SPEED;
        if (this.input.isDown('ArrowLeft')) this.velocity.x -= Constants.PLAYER_SPEED;
        if (this.input.isDown('ArrowRight')) this.velocity.x += Constants.PLAYER_SPEED;

        if (this.velocity.mag() > Constants.PLAYER_SPEED) {
            this.velocity = this.velocity.normalize().mult(Constants.PLAYER_SPEED);
        }
    }

    handleAI(ball: Ball, isChaser: boolean, isAttacking: boolean, markTarget?: Player): void {
        const fieldCenter = new Vector2(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);

        // 1. CHASER Logic (Oversees everything if selected)
        if (isChaser) {
            this.moveTo(ball.position);
            this.state = 'CHASE';
            return;
        }

        // 2. GK Logic (Always specific)
        if (this.role === 'GK') {
            // Move only Y to match ball, clamp Y to goal box area
            // X is fixed at homePos.x
            const targetY = Math.max(
                Constants.FIELD_HEIGHT / 2 - 150,
                Math.min(Constants.FIELD_HEIGHT / 2 + 150, ball.position.y)
            );
            this.moveTo(new Vector2(this.homePos.x, targetY));
            this.state = 'WAIT';
            return;
        }

        // 3. ATTACKING Logic (Off-Ball movement)
        if (isAttacking) {
            // Slide formation X towards opponent goal slightly
            const attackDir = this.teamId === 1 ? 1 : -1;
            const goalX = this.teamId === 1 ? Constants.FIELD_WIDTH : 0;

            if (this.role === 'FW') {
                // Run in behind / towards goal
                // Basic implementation: Move towards goal X, but stay somewhat near Y of homePos (lanes)
                const target = new Vector2(
                    this.homePos.x + (200 * attackDir), // Push forward
                    this.homePos.y
                );
                // Clamp X (don't go offside too much or off field)
                this.moveTo(target);
                this.state = 'SUPPORT'; // "Run"
            }
            else if (this.role === 'MF') {
                // Support: Move towards ball but keep distance (pass option)
                if (ball.position.dist(this.position) > 200) {
                    this.moveTo(ball.position.add(new Vector2(-100 * attackDir, 0))); // Stay behind ball
                } else {
                    // Drift to homePos X adjusted
                    this.moveTo(new Vector2(this.homePos.x + (100 * attackDir), this.homePos.y));
                }
                this.state = 'SUPPORT';
            }
            else if (this.role === 'DF') {
                // Maintain High Line, but don't go past halfway too much
                // Simple: Shift homePos X forward
                this.moveTo(new Vector2(this.homePos.x + (150 * attackDir), this.homePos.y));
                this.state = 'SUPPORT';
            }
            return;
        }

        // 4. DEFENDING Logic
        // Sliding: Everyone shifts X towards their own goal slightly to compact defense
        const defenseDir = this.teamId === 1 ? -1 : 1; // Retreat

        if (markTarget) {
            // MARKING: Position between Mark Target and MY Goal
            const myGoal = new Vector2(this.teamId === 1 ? 0 : Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2);

            // Vector from Opponent to Goal
            const toGoal = myGoal.sub(markTarget.position);
            const markPos = markTarget.position.add(toGoal.normalize().mult(50)); // 50px goal-side of opponent

            this.moveTo(markPos);
            this.state = 'MARKING';
        } else {
            // ZONAL / RETURN: Slide towards ball Y to compact, keep X structure
            // Shift X back
            const target = new Vector2(
                this.homePos.x + (50 * defenseDir),
                this.homePos.y * 0.8 + ball.position.y * 0.2 // Slight tilt towards ball Y
            );
            this.moveTo(target);
            this.state = 'RETURN';
        }
    }

    moveTo(target: Vector2): void {
        const dist = this.position.dist(target);
        if (dist < 5) {
            this.velocity = new Vector2(0, 0);
            return;
        }

        const dir = target.sub(this.position).normalize();

        // Speed modulation
        let speed = Constants.PLAYER_SPEED;
        if (this.state === 'RETURN' || this.state === 'WAIT') speed *= 0.6;
        if (this.state === 'MARKING') speed *= 0.7;
        if (this.state === 'SUPPORT') speed *= 0.8;
        if (this.state === 'CHASE') speed *= 1.0;

        this.velocity = dir.mult(speed);
    }

    setHomePos(pos: Vector2) {
        this.homePos = pos;
    }

    setPos(x: number, y: number) {
        this.position = new Vector2(x, y);
    }

    checkBounds(): void {
        if (this.position.x - this.radius < 0) this.position.x = this.radius;
        if (this.position.x + this.radius > Constants.FIELD_WIDTH) this.position.x = Constants.FIELD_WIDTH - this.radius;
        if (this.position.y - this.radius < 0) this.position.y = this.radius;
        if (this.position.y + this.radius > Constants.FIELD_HEIGHT) this.position.y = Constants.FIELD_HEIGHT - this.radius;
    }

    checkBallCollision(ball: Ball): void {
        const dist = this.position.dist(ball.position);
        const minDist = this.radius + ball.radius;

        if (dist < minDist) {
            if (this.velocity.mag() > 0) {
                const dribbleDist = this.radius + ball.radius + 2;
                ball.position = this.position.add(this.velocity.normalize().mult(dribbleDist));
                ball.velocity = this.velocity.clone();
            } else {
                const pushDir = ball.position.sub(this.position).normalize();
                ball.position = this.position.add(pushDir.mult(minDist));
            }
        }
    }

    checkPlayerCollision(other: Player): void {
        const dist = this.position.dist(other.position);
        const minDist = this.radius + other.radius;

        if (dist < minDist) {
            const pushDir = this.position.sub(other.position).normalize();
            const overlap = minDist - dist;

            this.position = this.position.add(pushDir.mult(overlap / 2));
            other.position = other.position.sub(pushDir.mult(overlap / 2));
        }
    }
}
