import { Entity } from './Entity';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';
import { Input } from '../Input';
import { Ball } from './Ball';

export type PlayerRole = 'GK' | 'DF' | 'MF' | 'FW';
// Extended states for advanced tactics
export type PlayerState = 'IDLE' | 'CHASE' | 'RETURN' | 'DRIBBLE' | 'SHOOT' | 'PASS' | 'MARKING' | 'SUPPORT' | 'WAIT';

export class Player extends Entity {
    teamId: number;
    role: PlayerRole;
    homePos: Vector2;
    state: PlayerState = 'IDLE';

    isHuman: boolean;
    isSelected: boolean = false;
    input: Input | null;

    // Visuals
    selectionAnim: number = 0; // For pulse effect

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
    update(ball: Ball, isChaser: boolean, isAttacking: boolean, teammates: Player[], opponents: Player[], markTarget?: Player): void {
        this.velocity = new Vector2(0, 0);

        // Update selection animation
        if (this.isSelected) {
            this.selectionAnim += 0.1;
        } else {
            this.selectionAnim = 0;
        }

        if (this.isHuman && this.isSelected && this.input) {
            this.handleInput(ball, teammates);
        } else {
            this.handleAI(ball, isChaser, isAttacking, teammates, opponents, markTarget);
        }

        super.update();
        this.checkBounds();
        this.checkBallCollision(ball);
    }

    handleInput(ball: Ball, teammates: Player[]): void {
        if (!this.input) return;

        // Movement
        if (this.input.isDown('ArrowUp')) this.velocity.y -= Constants.PLAYER_SPEED;
        if (this.input.isDown('ArrowDown')) this.velocity.y += Constants.PLAYER_SPEED;
        if (this.input.isDown('ArrowLeft')) this.velocity.x -= Constants.PLAYER_SPEED;
        if (this.input.isDown('ArrowRight')) this.velocity.x += Constants.PLAYER_SPEED;

        if (this.velocity.mag() > Constants.PLAYER_SPEED) {
            this.velocity = this.velocity.normalize().mult(Constants.PLAYER_SPEED);
        }

        // Actions
        const distToBall = this.position.dist(ball.position);
        const hasPossession = distToBall < this.radius + ball.radius + 15;

        if (hasPossession) {
            // SHOOT (Space)
            if (this.input.isDown('Space')) {
                const goalPos = new Vector2(Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2);
                this.shoot(ball, goalPos);
            }
            // PASS (X)
            else if (this.input.isDown('KeyX')) {
                let bestTarget: Player | null = null;
                let minScore = Infinity;

                teammates.forEach(tm => {
                    if (tm === this) return;
                    const d = this.position.dist(tm.position);
                    if (d < minScore) {
                        minScore = d;
                        bestTarget = tm;
                    }
                });

                if (bestTarget) {
                    this.pass(ball, (bestTarget as Player).position);
                }
            }
        }
    }

    handleAI(ball: Ball, isChaser: boolean, isAttacking: boolean, teammates: Player[], opponents: Player[], markTarget?: Player): void {
        const goalX = this.teamId === 1 ? Constants.FIELD_WIDTH : 0;
        const goalPos = new Vector2(goalX, Constants.FIELD_HEIGHT / 2);
        const distToBall = this.position.dist(ball.position);

        // 1. BALL POSSESSION LOGIC (AI Only - Human handled in handleInput)
        // If I am chaser and very close to ball, I "have" the ball.
        // Or if I am effectively dribbling (collision logic pushes ball).
        // Let's deduce possession intent.

        if (isChaser && distToBall < this.radius + ball.radius + 10) {
            // I have the ball! Decide what to do.
            this.decideBallAction(ball, goalPos, teammates, opponents);
            return;
        }

        // 2. CHASER / DEFENSE CHASE
        if (isChaser) {
            this.moveTo(ball.position);
            this.state = 'CHASE';
            return;
        }

        // 3. GK Logic
        if (this.role === 'GK') {
            const targetY = Math.max(
                Constants.FIELD_HEIGHT / 2 - 100,
                Math.min(Constants.FIELD_HEIGHT / 2 + 100, ball.position.y)
            );
            // Stay on goal line, slightly forward
            // Team 1 GK at x=20, Team 2 GK at x=WIDTH-20
            const xPos = this.teamId === 1 ? 40 : Constants.FIELD_WIDTH - 40;
            this.moveTo(new Vector2(xPos, targetY));
            this.state = 'WAIT';
            return;
        }

        // 4. OFF-BALL MOVEMENT
        if (isAttacking) {
            // ATTACK FORMATION
            // Shift entire formation X towards opponent goal
            // FW: Run into channels
            // MF: Support behind ball
            // DF: High line

            // Simple vector field approach:
            // Base: homePos
            // Modifier: Attack offset (e.g. +200px towards goal)
            const attackDir = this.teamId === 1 ? 1 : -1;

            let target = this.homePos.clone();

            // Shift formation forward based on ball X (optional, but let's stick to simple offset)
            if (this.role === 'FW') {
                target.x += 250 * attackDir;
                // Drift towards ball Y slightly
                target.y = this.homePos.y * 0.7 + ball.position.y * 0.3;
            } else if (this.role === 'MF') {
                target.x += 150 * attackDir;
                // Stay behind ball if ball is behind us
                if ((this.teamId === 1 && ball.position.x < target.x) || (this.teamId === 2 && ball.position.x > target.x)) {
                    target.x = ball.position.x - (50 * attackDir);
                }
            } else if (this.role === 'DF') {
                target.x += 100 * attackDir;
            }

            this.moveTo(target);
            this.state = 'SUPPORT';

        } else {
            // DEFENSE FORMATION
            // If marking, stick to target
            if (markTarget) {
                // Position between Opponent and My Goal
                const myGoal = new Vector2(this.teamId === 1 ? 0 : Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2);
                const toGoal = myGoal.sub(markTarget.position);
                const markPos = markTarget.position.add(toGoal.normalize().mult(40));
                this.moveTo(markPos);
                this.state = 'MARKING';
            } else {
                // Return to formation, but compress towards center
                // 4-4-2 compacts in defense
                const defenseDir = this.teamId === 1 ? -1 : 1;
                let target = this.homePos.clone();

                // Shift back
                target.x += 50 * defenseDir;

                // Compact Y
                target.y = (target.y - Constants.FIELD_HEIGHT / 2) * 0.7 + Constants.FIELD_HEIGHT / 2;

                // Shift Y towards ball to crate overload
                target.y += (ball.position.y - Constants.FIELD_HEIGHT / 2) * 0.2;

                this.moveTo(target);
                this.state = 'RETURN';
            }
        }
    }

    decideBallAction(ball: Ball, goalPos: Vector2, teammates: Player[], opponents: Player[]) {
        // Priority 1: SHOOT
        // If close to goal and clear angle
        const distToGoal = this.position.dist(goalPos);
        const shootRange = 350;

        if (distToGoal < shootRange) {
            // Just shoot for now!
            // Aim at goal
            const shootDir = goalPos.sub(this.position).normalize();
            // Kick!
            // We need a way to 'kick' the ball. For now, we just set ball velocity high and separate it.
            // But we are in 'update', so we change ball behavior.
            // "Kick" means instant velocity change.

            // Check cooldown or random chance to not shoot instantly every frame
            if (Math.random() < 0.05) {
                this.shoot(ball, goalPos);
                this.state = 'SHOOT';
                return;
            }
        }

        // Priority 2: PASS
        // Find teammate closer to goal and open
        // Simple: Find teammate with best score (dist to goal < my dist)
        let bestPassTarget: Player | null = null;
        let bestScore = -Infinity;

        teammates.forEach(tm => {
            if (tm === this) return;
            // Metric: Closer to goal?
            const tmDistGoal = tm.position.dist(goalPos);
            const myDistGoal = distToGoal;

            if (tmDistGoal < myDistGoal - 50) { // Significant gain
                // Check if open (no opponent in path) - doing simple dot product or dist check
                // let's just use distance gain for now
                if (tmDistGoal < bestScore || bestScore === -Infinity) { // Actually we want MIN distance
                    // wait, bestScore logic: we want smallest dist.
                }
            }
        });

        // Simpler Pass Logic: Pass to any FW if I am MF/DF
        if (this.role !== 'FW') {
            const fws = teammates.filter(t => t.role === 'FW');
            if (fws.length > 0) {
                // Pick random or closest
                const target = fws[Math.floor(Math.random() * fws.length)];
                if (Math.random() < 0.02) {
                    this.pass(ball, target.position);
                    this.state = 'PASS';
                    return;
                }
            }
        }

        // Priority 3: DRIBBLE
        // Move towards goal
        this.moveTo(goalPos);
        this.state = 'DRIBBLE';
        // Dribbling happens naturally via collision pushing, 
        // but we can add small kicks if we want "realistic" dribble.
        // For arcade, collision pushing (Vel based) is fine, but maybe faster?
        this.velocity = this.velocity.mult(1.1);
    }

    shoot(ball: Ball, target: Vector2) {
        const kickDir = target.sub(this.position).normalize();
        // Add some random variety to Y
        kickDir.y += (Math.random() - 0.5) * 0.2;

        const speed = 12 + Math.random() * 5; // fast!
        ball.velocity = kickDir.normalize().mult(speed);
        ball.position = ball.position.add(ball.velocity.mult(2)); // Detach
    }

    pass(ball: Ball, target: Vector2) {
        const kickDir = target.sub(this.position).normalize();
        const speed = 8 + Math.random() * 2;
        ball.velocity = kickDir.mult(speed);
        ball.position = ball.position.add(ball.velocity.mult(2)); // Detach
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
        // Human player (if handled here for some reason) should be fast
        // AI speeds
        if (this.state === 'RETURN' || this.state === 'WAIT') speed *= 0.8; // Defenders sprint back? No, usually slower unless emergency
        if (this.state === 'MARKING') speed *= 0.85;
        if (this.state === 'SUPPORT') speed *= 0.85;
        if (this.state === 'CHASE') speed *= 1.0;
        if (this.state === 'DRIBBLE') speed *= 0.9; // Dribbling is slower

        this.velocity = dir.mult(speed);
    }

    // ... existing helpers ...
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
            // Arcade collision: Push ball
            if (this.velocity.mag() > 0) {
                // If moving, kick/dribble ball
                const dribbleDist = this.radius + ball.radius + 1;
                // Add velocity to ball
                ball.velocity = ball.velocity.add(this.velocity.mult(0.2));
                // Keep ball in front
                let logicDir = this.velocity.normalize();

                // If ball is way behind, don't teleport it to front instantly, pushing logic handles it
                ball.position = this.position.add(logicDir.mult(dribbleDist));
            } else {
                // Static: gentle push out
                const pushDir = ball.position.sub(this.position).normalize();
                ball.position = this.position.add(pushDir.mult(minDist));
                ball.velocity = pushDir.mult(2);
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

    draw(ctx: CanvasRenderingContext2D) {
        // Draw selection indicator
        if (this.isSelected) {
            ctx.beginPath();
            ctx.strokeStyle = '#00ff00'; // Green
            ctx.lineWidth = 3 + Math.sin(this.selectionAnim) * 1;
            const ringRadius = this.radius + 5 + Math.sin(this.selectionAnim * 2) * 2;
            ctx.ellipse(this.position.x, this.position.y + this.radius - 5, ringRadius, ringRadius * 0.6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw Player
        super.draw(ctx);

        // Debug Role/State
        // ctx.fillStyle = 'white';
        // ctx.font = '10px Arial';
        // ctx.fillText(this.role, this.position.x - 5, this.position.y + 5);
    }
}
