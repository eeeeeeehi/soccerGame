import { Entity } from './Entity';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';
import { Input } from '../Input';
import { Ball } from './Ball';

export type PlayerRole = 'GK' | 'DF' | 'MF' | 'FW';
// Extended states for advanced tactics
export type PlayerState = 'IDLE' | 'CHASE' | 'RETURN' | 'DRIBBLE' | 'SHOOT' | 'PASS' | 'MARKING' | 'SUPPORT' | 'WAIT';

export interface PlayerStats {
    speed: number;       // 0-100 (Default ~70, Max ~100 maps to 5.0)
    kickPower: number;   // 0-100
    stamina: number;     // 0-100
    technique: number;   // 0-100
}

export class Player extends Entity {
    teamId: number;
    role: PlayerRole;
    homePos: Vector2;
    state: PlayerState = 'IDLE';

    // Info
    name: string = '';
    number: number = 0;

    isHuman: boolean;
    isSelected: boolean = false;
    input: Input | null;

    // Visuals
    selectionAnim: number = 0; // For pulse effect
    reactionTimer: number = 0; // For AI delay
    // Modifiers
    isSprinting: boolean = false;
    isChargingShot: boolean = false;
    isChargingPass: boolean = false;
    isKeyHeld_Space: boolean = false;
    isKeyHeld_X: boolean = false;

    shotPower: number = 0;
    passPower: number = 0;

    // Advanced
    stamina: number = 100;
    maxStamina: number = 100;
    // Slide Tackle
    isSliding: boolean = false;
    slideTimer: number = 0;
    slideDir: Vector2 = new Vector2(0, 0);

    // Stats
    stats: PlayerStats;

    constructor(x: number, y: number, teamId: number, role: PlayerRole, isHuman: boolean = false, input: Input | null = null, stats?: PlayerStats) {
        const color = teamId === 1 ? Constants.TEAM_1_COLOR : Constants.TEAM_2_COLOR;
        super(x, y, Constants.PLAYER_RADIUS, color);
        this.teamId = teamId;
        this.role = role;
        this.homePos = new Vector2(x, y);
        this.isHuman = isHuman;
        this.input = input;

        // Default stats if not provided
        this.stats = stats || {
            speed: 70,
            kickPower: 70,
            stamina: 70,
            technique: 70
        };

        this.stamina = this.stats.stamina;
        this.maxStamina = this.stats.stamina;

        // Randomize initial reaction slightly to avoid synchronized movement
        this.reactionTimer = Math.random() * 20;
    }

    // Update loop called by Team
    update(ball: Ball, isChaser: boolean, isAttacking: boolean, teammates: Player[], opponents: Player[]): void {
        this.velocity = new Vector2(0, 0);

        // Update selection animation
        if (this.isSelected) {
            this.selectionAnim += 0.1;
        } else {
            this.selectionAnim = 0;
        }

        // Count down reaction timer
        if (this.reactionTimer > 0) this.reactionTimer--;

        // SLIDING LOGIC
        if (this.isSliding) {
            this.slideTimer--;
            this.velocity = this.slideDir.mult(6.0 * (this.slideTimer / 20)); // Decelerate
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                this.velocity = new Vector2(0, 0);
            }
            super.update();
            this.checkBounds();
            this.checkBallCollision(ball);
            return; // Skip other input/AI
        }

        // STAMINA REGEN
        if (!this.isSprinting && this.stamina < this.maxStamina) {
            this.stamina += 0.5;
        }

        // Magnetic Steal Logic (Defense / Loose Ball)
        // If close to ball and not possessing, snap towards it
        const distToBall = this.position.dist(ball.position);
        if (distToBall < 40 && distToBall > this.radius + ball.radius) {
            // "Magnetic" pull - strongly encourage moving to ball center
            const pullDir = ball.position.sub(this.position).normalize();
            // Add extra velocity component
            this.velocity = this.velocity.add(pullDir.mult(2.0));
        }

        if (this.isHuman && this.isSelected && this.input) {
            this.handleInput(ball, teammates);
        } else {
            this.handleAI(ball, isChaser, isAttacking, teammates, opponents);
        }

        super.update();
        this.checkBounds();
        this.checkBallCollision(ball);
    }

    handleInput(ball: Ball, teammates: Player[]): void {
        if (!this.input) return;

        // TACKLE (Z)
        if (this.input?.isDown('KeyZ') && !this.isSliding && this.stamina > 20) {
            this.startSlide();
        }

        // CHARGING PASS (X)
        if (this.input?.isDown('KeyX')) {
            if (!this.isKeyHeld_X) {
                this.isKeyHeld_X = true;
                this.isChargingPass = true;
                this.passPower = 0;
            }
            if (this.isChargingPass) {
                this.passPower += 2.0;
                if (this.passPower > 100) this.passPower = 100;
            }
        } else {
            if (this.isKeyHeld_X) {
                // RELEASED X -> PASS
                this.isKeyHeld_X = false;
                this.isChargingPass = false;
                this.state = 'PASS'; // Trigger pass in update logic
            }
        }

        // CHARGING SHOT (Space)
        if (this.input?.isDown('Space')) {
            if (!this.isKeyHeld_Space) {
                this.isKeyHeld_Space = true;
                this.isChargingShot = true;
                this.shotPower = 0;
            }
            if (this.isChargingShot) {
                this.shotPower += 2.0;
                if (this.shotPower > 100) this.shotPower = 100;
            }
        } else {
            if (this.isKeyHeld_Space) {
                // RELEASED SPACE -> SHOOT
                this.isKeyHeld_Space = false;
                this.isChargingShot = false;
                this.state = 'SHOOT'; // Trigger shot in update logic
            }
        }

        // Sprint Check
        const canSprint = this.stamina > 5;
        this.isSprinting = (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight')) && canSprint;

        if (this.isSprinting) this.stamina -= 1.0;

        // Speed Mapping: 70 -> 3.0, 100 -> 4.5. Sprint -> * 1.5
        const baseSpeed = 2.0 + (this.stats.speed / 100) * 2.0;
        const sprintMult = this.isSprinting ? 1.5 : 1.0;
        const currentSpeed = baseSpeed * sprintMult;

        // Movement
        // Calculate input direction explicitly for actions
        let inputDir = new Vector2(0, 0);
        if (this.input.isDown('ArrowUp')) inputDir.y -= 1;
        if (this.input.isDown('ArrowDown')) inputDir.y += 1;
        if (this.input.isDown('ArrowLeft')) inputDir.x -= 1;
        if (this.input.isDown('ArrowRight')) inputDir.x += 1;

        // Apply movement velocity
        if (inputDir.y < 0) this.velocity.y -= currentSpeed;
        if (inputDir.y > 0) this.velocity.y += currentSpeed;
        if (inputDir.x < 0) this.velocity.x -= currentSpeed;
        if (inputDir.x > 0) this.velocity.x += currentSpeed;

        if (this.velocity.mag() > currentSpeed) {
            this.velocity = this.velocity.normalize().mult(currentSpeed);
        }

        // Actions
        const distToBall = this.position.dist(ball.position);

        // Relax possession check slightly for sprint Dribble logic which pushes ball further
        // But for actions (pass/shoot), we still need to be close.
        const hasPossession = distToBall < this.radius + ball.radius + 15;

        // If charging, keep ball close
        if (this.isChargingShot || this.isChargingPass) {
            if (hasPossession) {
                // Keep ball close, but allow player to move
                // This is handled by checkBallCollision's dribble logic
            } else {
                // If we lose possession while charging, reset charge
                this.isChargingShot = false;
                this.isChargingPass = false;
                this.shotPower = 0;
                this.passPower = 0;
                this.isKeyHeld_Space = false;
                this.isKeyHeld_X = false;
            }
        }

        // THROUGH BALL (C)
        // Prioritize space ahead of teammate
        if (this.input.isDown('KeyC')) {
            // Simple logic: Find furthest forward teammate or one making a run
            // For now, find teammate closest to goal but ahead of me
            let candidates = teammates.filter(t => t !== this);
            if (candidates.length > 0) {
                // Pick best
                // Metric: (Dist to Goal) inverted + (Forward Alignment)
                // Let's just pick random forward player
                const target = candidates[Math.floor(Math.random() * candidates.length)];
                // Pass 150px ahead of them
                const leadPos = target.position.add(new Vector2(150, 0));
                if (this.teamId === 2) leadPos.x -= 300; // Reverse for team 2 (if playing as them)

                this.pass(ball, 100, teammates); // Faster pass
            }
        }

        // State Machine execution
        switch (this.state) {
            case 'IDLE':
            case 'WAIT':
            case 'RETURN':
                // AI Movement logic is handled by Team.ts usually, but here is local micro-adjust
                break;
            case 'CHASE':
                this.moveTo(ball.position);
                break;
            case 'DRIBBLE':
                // Dribble towards goal or pass target
                // Simply move to goal for basic AI
                const goalPos = this.teamId === 1 ? new Vector2(Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2) : new Vector2(0, Constants.FIELD_HEIGHT / 2);
                this.moveTo(goalPos);
                break;
            case 'SHOOT':
                const targetGoal = this.teamId === 1 ? new Vector2(Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2) : new Vector2(0, Constants.FIELD_HEIGHT / 2);
                this.shoot(ball, targetGoal, this.shotPower); // Use charged power
                this.state = 'IDLE';
                this.shotPower = 0; // Reset after shot
                break;
            case 'PASS':
                // If human, use stored passPower and input direction
                if (this.isHuman) {
                    this.pass(ball, this.passPower, teammates);
                } else {
                    // AI Pass
                    // Pick random teammate for now or simple logic
                    // ...
                }
                this.state = 'IDLE';
                this.passPower = 0; // Reset after pass
                break;
        }
    }

    handleAI(ball: Ball, isChaser: boolean, isAttacking: boolean, teammates: Player[], opponents: Player[], markTarget?: Player): void {
        // AI Logic Update

        // 0. Nerf Reaction (Team 2 only)
        if (this.teamId === 2 && this.reactionTimer > 0) {
            this.velocity = this.velocity.mult(0.5);
            return;
        }

        const myGoalX = this.teamId === 1 ? 0 : Constants.FIELD_WIDTH;
        const enemyGoalX = this.teamId === 1 ? Constants.FIELD_WIDTH : 0;
        const goalPos = new Vector2(enemyGoalX, Constants.FIELD_HEIGHT / 2);
        const myGoalPos = new Vector2(myGoalX, Constants.FIELD_HEIGHT / 2);

        const distToBall = this.position.dist(ball.position);

        // ============================
        // 1. BALL POSSESSION / ACTION
        // ============================
        if (isChaser && distToBall < this.radius + ball.radius + 15) {
            this.decideBallAction(ball, goalPos, teammates, opponents);
            return;
        }

        // ============================
        // 2. CHASER LOGIC (Smart Approach)
        // ============================
        if (isChaser) {
            this.state = 'CHASE';

            // FIX: Don't run straight at ball if it puts me on the wrong side (Own Goal Risk)
            // Target Point: Ideally "Behind" the ball relative to enemy goal.

            const ballToGoal = goalPos.sub(ball.position).normalize();
            // Best spot to touch ball is: ballPos - (directionToGoal * small_offset)
            // This puts player between ball and OWN goal, pushing towards ENEMY goal.
            const approachSpot = ball.position.sub(ballToGoal.mult(20)); // 20px behind ball

            // If I am already "behind" the ball close enough, just go for center
            // "Behind" means dot product check? Or just distance check.
            // Simple: Is player closer to own goal than ball?
            const distSelfToEnemy = this.position.dist(goalPos);
            const distBallToEnemy = ball.position.dist(goalPos);

            if (distSelfToEnemy > distBallToEnemy) {
                // I am BEHIND the ball (Good!). Attack direct.
                this.moveTo(ball.position);
            } else {
                // I am AHEAD of the ball (Bad!). If I run straight, I might kick it back.
                // Circle around? Or move to approach spot first.
                // If very close, approach spot might be weird.

                if (distToBall < 50) {
                    // Micro adjust: Move perpendicular to clear line of sight?
                    // Just move to approach spot strongly
                    this.moveTo(approachSpot);
                } else {
                    this.moveTo(approachSpot);
                }
            }
            return;
        }

        // Auto-Chase Check (If loose ball and very close)
        // Only if no one else is closer? handled by Team really.
        this.checkAutoChase(ball);
        if (this.state === 'CHASE') return; // State changed in checkAutoChase

        // ============================
        // 3. GOALKEEPER LOGIC
        // ============================
        if (this.role === 'GK') {
            // Stay in box. Follow Ball Y but clamped.
            const boxTop = Constants.FIELD_HEIGHT / 2 - 150;
            const boxBottom = Constants.FIELD_HEIGHT / 2 + 150;
            const boxFrontX = this.teamId === 1 ? 120 : Constants.FIELD_WIDTH - 120; // 120px out

            let targetY = ball.position.y;
            // Clamp Y
            if (targetY < boxTop + 20) targetY = boxTop + 20;
            if (targetY > boxBottom - 20) targetY = boxBottom - 20;

            let targetX = this.teamId === 1 ? 30 : Constants.FIELD_WIDTH - 30; // Line

            // If ball is dangerous, move forward slightly
            if (Math.abs(ball.position.x - myGoalX) < 300) {
                targetX = this.teamId === 1 ? 60 : Constants.FIELD_WIDTH - 60;
            }

            this.moveTo(new Vector2(targetX, targetY));
            this.state = 'WAIT';
            return;
        }

        // ============================
        // 4. FIELD PLAYER POSITIONING
        // ============================

        // Calculate Dynamic Home Position
        // Shift base formation X based on Ball X
        let dynamicPos = this.homePos.clone();

        // Horizontal Shift (Compactness)
        // If ball is at 0, Team 1 shifts back. If at Width, Team 1 shifts forward.
        // Base homePos is 0..Width.
        const center = Constants.FIELD_WIDTH / 2;
        const ballOffset = ball.position.x - center;

        // Attacking team shifts forward, Defending shifts back
        // But simpler: Everyone follows ball somewhat.
        const shiftFactor = 0.6; // How much formation slides with ball

        // Apply shift
        dynamicPos.x += ballOffset * shiftFactor;

        // Clamp to logical bounds (Don't run off field)
        if (dynamicPos.x < 100) dynamicPos.x = 100;
        if (dynamicPos.x > Constants.FIELD_WIDTH - 100) dynamicPos.x = Constants.FIELD_WIDTH - 100;

        if (isAttacking) {
            // ATTACK BEHAVIOR
            // FW: Find space / Run deep
            // MF: Support
            if (this.role === 'FW') {
                // Push high
                dynamicPos.x += (this.teamId === 1 ? 150 : -150);
                // Drift to ball Y slightly
                dynamicPos.y = dynamicPos.y * 0.8 + ball.position.y * 0.2;
            }
            else if (this.role === 'MF') {
                // Support distance
                dynamicPos.x += (this.teamId === 1 ? 50 : -50);
            }

            this.state = 'SUPPORT';
            this.moveTo(dynamicPos);

        } else {
            // DEFENSE BEHAVIOR
            this.state = 'RETURN';

            // DF: MARKING LOGIC
            // Find dangerous opponent nearby
            if (this.role === 'DF' || this.role === 'MF') {
                let bestTarget: Player | null = null;
                let minThreat = Infinity;

                opponents.forEach(opp => {
                    // Is this opponent in my "zone"?
                    const dist = opp.position.dist(this.homePos); // Check vs my base zone
                    if (dist < 250) {
                        const d = opp.position.dist(myGoalPos);
                        if (d < minThreat) {
                            minThreat = d;
                            bestTarget = opp;
                        }
                    }
                });

                if (bestTarget) {
                    // MARK: Position between Opponent and Goal
                    // And slightly biased towards ball (cutting lane)
                    // Simple "Goal Side" marking:
                    const opp = (bestTarget as Player);
                    const toGoal = myGoalPos.sub(opp.position).normalize();
                    const markSpot = opp.position.add(toGoal.mult(40)); // 40px goal-side of opponent

                    this.moveTo(markSpot);
                    this.state = 'MARKING';
                    return;
                }
            }

            // If no mark, retreat to formation
            // Compress Y
            dynamicPos.y = (dynamicPos.y - Constants.FIELD_HEIGHT / 2) * 0.6 + Constants.FIELD_HEIGHT / 2;
            this.moveTo(dynamicPos);
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

            // Kick!
            // We need a way to 'kick' the ball. For now, we just set ball velocity high and separate it.
            // But we are in 'update', so we change ball behavior.
            // "Kick" means instant velocity change.

            // Check cooldown or random chance to not shoot instantly every frame
            if (Math.random() < 0.05) {
                this.shoot(ball, goalPos);
                this.state = 'SHOOT';
                // Reset reaction timer after action (cooldown)
                if (this.teamId === 2) this.reactionTimer = 30 + Math.random() * 20;
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
                    this.pass(ball, 80, teammates); // AI pass power
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

    checkAutoChase(ball: Ball) {
        // If I am not the selected chaser (handled in Team), I usually return/wait.
        // BUT, if the ball is VERY close to me (loose ball), I should react even if not selected.

        if (this.state === 'IDLE' || this.state === 'WAIT' || this.state === 'RETURN' || this.state === 'SUPPORT') {
            const dist = this.position.dist(ball.position);
            const reactionRange = 150; // 150px awareness

            if (dist < reactionRange) {
                // Simple check: Is ball moving towards me or slow?
                // For now, just chase if close.
                this.state = 'CHASE';
            }
        }
    }

    startSlide(): void {
        this.isSliding = true;
        this.slideTimer = 30; // 0.5s slide
        this.stamina -= 20; // Cost

        // Slide Direction: Input Dir OR Current Facing (Velocity)
        let slideVec = new Vector2(0, 0);
        if (this.input?.isDown('ArrowUp')) slideVec.y -= 1;
        if (this.input?.isDown('ArrowDown')) slideVec.y += 1;
        if (this.input?.isDown('ArrowLeft')) slideVec.x -= 1;
        if (this.input?.isDown('ArrowRight')) slideVec.x += 1;

        if (slideVec.mag() === 0 && this.velocity.mag() > 0) {
            slideVec = this.velocity.normalize();
        } else if (slideVec.mag() > 0) {
            slideVec = slideVec.normalize();
        } else {
            slideVec.x = 1; // Default right
        }
        this.slideDir = slideVec;
        this.velocity = this.slideDir.mult(6.0); // Burst
    }

    moveTo(target: Vector2): void {
        const dist = this.position.dist(target);
        if (dist < 5) {
            this.velocity = new Vector2(0, 0);
            return;
        }

        const dir = target.sub(this.position).normalize();

        // Speed modulation
        const baseSpeed = 2.0 + (this.stats.speed / 100) * 2.0;
        let speed = baseSpeed;

        // Human logic handled in handleInput
        // AI speeds
        if (this.state === 'RETURN' || this.state === 'WAIT') speed *= 0.8; // Defenders sprint back? No, usually slower unless emergency
        if (this.state === 'MARKING') speed *= 0.85;
        if (this.state === 'SUPPORT') speed *= 0.85;
        if (this.state === 'CHASE') speed *= 1.0;
        if (this.state === 'DRIBBLE') speed *= 0.9; // Dribbling is slower

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

        // SLIDING TACKLE HIT
        if (this.isSliding) {
            const range = this.radius + ball.radius + 10;
            if (dist < range) {
                ball.lastTouch = this.teamId; // TRACK TOUCH
                // BIG KICK
                const kickDir = this.slideDir.clone();
                ball.velocity = kickDir.mult(15); // Clear the ball
                ball.position = this.position.add(kickDir.mult(range + 5));
            }
            return;
        }

        // Dribbling "Reach": Wider than physical collision to catch the ball during turns
        // Radius(10) + Ball(6) + Buffer(14) = 30
        const dribbleMsg = 14;
        const controlDist = this.radius + ball.radius + dribbleMsg;
        const physicalDist = this.radius + ball.radius;

        // 1. Dribble Control Logic
        if (dist < controlDist) {
            // Static or Loose Ball Check
            // If ball is fast, ignore
            if (ball.velocity.mag() > 10) {
                if (dist < physicalDist) {
                    // Elastic bounce
                    const pushDir = ball.position.sub(this.position).normalize();
                    const overlap = physicalDist - dist;
                    ball.position = ball.position.add(pushDir.mult(overlap));
                }
                return;
            }

            // Dribble Logic
            if (this.velocity.mag() > 0.1) {
                // SPRINT DRIBBLE (KNOCK ON)
                if (this.isSprinting) {
                    // Kick ball far ahead
                    // No magnet. Just heavy impact.
                    const kickDir = this.velocity.normalize();
                    // Knock distance ~ 60px ahead
                    const knockSpeed = this.velocity.mag() * 1.8;

                    ball.velocity = kickDir.mult(knockSpeed);

                    // Push out to avoid immediate re-collision
                    ball.position = this.position.add(kickDir.mult(physicalDist + 5));
                    return;
                }

                // NORMAL STICKY DRIBBLE
                // "Magnet" - Pull ball to ideal position in front of player
                const dribbleSpeed = this.velocity.mag() * 1.1; // Slightly faster to stay ahead

                // Ideal position: Exactly in front of current velocity
                const idealDir = this.velocity.normalize();
                const idealPos = this.position.add(idealDir.mult(physicalDist + 2)); // 2px gap

                // Lerp ball position towards ideal position for smoothness, but strong enough to catch
                // If dist is large (turning), snap harder
                const snapFactor = 0.3;

                // Set Velocity: Match player direction + speed
                // This ensures if we stop next frame, ball still has momentum
                ball.velocity = idealDir.mult(dribbleSpeed);

                // Adjust Position
                const toIdeal = idealPos.sub(ball.position);
                ball.position = ball.position.add(toIdeal.mult(snapFactor));

                // Hard constraint: Don't pull INSIDE the player
                const newDist = this.position.dist(ball.position);
                if (newDist < physicalDist) {
                    const pushDir = ball.position.sub(this.position).normalize();
                    ball.position = this.position.add(pushDir.mult(physicalDist));
                }

                return; // Controlled, skip default collision
            }
        }

        // 2. Static / Loose Ball Collision (Physical)
        if (dist < physicalDist) {
            // Static or slow movement: gentle push out
            const pushDir = ball.position.sub(this.position).normalize();
            // Prevent NaN if exact center overlap
            if (pushDir.mag() === 0) pushDir.x = 1;

            ball.position = this.position.add(pushDir.mult(physicalDist));

            // Transfer some momentum if we just nudged it
            ball.velocity = pushDir.mult(2);
            ball.lastTouch = this.teamId; // TRACK TOUCH
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
        if (this.isSelected && this.isHuman) {
            ctx.beginPath();
            ctx.strokeStyle = '#ffff00'; // Yellow
            ctx.lineWidth = 4 + Math.sin(this.selectionAnim) * 1;
            const ringRadius = this.radius + 8 + Math.sin(this.selectionAnim * 4) * 2;
            ctx.ellipse(this.position.x, this.position.y + this.radius - 5, ringRadius, ringRadius * 0.6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw Player
        if (this.isSliding) {
            // Draw slide trail or shape
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            // Rotate to slide direction
            const angle = Math.atan2(this.slideDir.y, this.slideDir.x);
            ctx.rotate(angle);

            ctx.fillStyle = this.color;
            // Draw elongated shape
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius + 5, this.radius - 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Speed lines
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.moveTo(-15, -5); ctx.lineTo(-25, -5);
            ctx.moveTo(-15, 5); ctx.lineTo(-25, 5);
            ctx.stroke();

            ctx.restore();
        } else {
            super.draw(ctx);
        }

        // Draw Power Gauge (Shot)
        if (this.isChargingShot) {
            const barWidth = 40;
            const barHeight = 5;
            const x = this.position.x - barWidth / 2;
            const y = this.position.y - this.radius - 15;

            ctx.fillStyle = 'red';
            ctx.fillRect(x, y, barWidth, barHeight);

            ctx.fillStyle = 'yellow';
            ctx.fillRect(x, y, barWidth * (this.shotPower / 100), barHeight);
        }

        // Draw Power Gauge (Pass)
        if (this.isChargingPass) {
            const barWidth = 40;
            const barHeight = 5;
            const x = this.position.x - barWidth / 2;
            const y = this.position.y - this.radius - 22; // Above shot bar

            ctx.fillStyle = 'blue';
            ctx.fillRect(x, y, barWidth, barHeight);

            ctx.fillStyle = 'cyan';
            ctx.fillRect(x, y, barWidth * (this.passPower / 100), barHeight);
        }

        // Draw Stamina Bar
        if (this.isHuman) {
            ctx.fillStyle = this.stamina > 20 ? '#00ff00' : '#ff0000';
            const width = 30 * (this.stamina / this.maxStamina);
            ctx.fillRect(this.position.x - 15, this.position.y + 20, width, 3);
        }
    }

    shoot(ball: Ball, target: Vector2, power: number = 50) {
        let kickDir = target.sub(this.position).normalize();

        // Enemy AI Nerf: Accuracy
        // Team 2 has larger spread
        const spread = this.teamId === 2 ? 0.4 : 0.05; // Reduced spread for Human/Team 1
        kickDir.y += (Math.random() - 0.5) * spread;

        // Stats Check: Kick Power (0-100)
        // Base max speed: 20 + (kickPower/100)*10
        // Charge power (0-100) scales result

        const myPowerFactor = this.stats.kickPower / 100; // 0.8 usually
        const maxSpeed = 15 + (myPowerFactor * 15); // 15 to 30

        const speed = 10 + (power / 100) * (maxSpeed - 10); // Lerp min 10 to max

        ball.velocity = kickDir.normalize().mult(speed);
        ball.position = ball.position.add(ball.velocity.mult(2));
    }

    pass(ball: Ball, power: number, teammates: Player[]) {
        // Smart Targeting
        let inputDir = new Vector2(0, 0);
        if (this.input) {
            if (this.input.isDown('ArrowUp')) inputDir.y -= 1;
            if (this.input.isDown('ArrowDown')) inputDir.y += 1;
            if (this.input.isDown('ArrowLeft')) inputDir.x -= 1;
            if (this.input.isDown('ArrowRight')) inputDir.x += 1;
        }

        if (inputDir.mag() === 0) {
            inputDir = this.velocity.mag() > 0 ? this.velocity.normalize() : (this.teamId === 1 ? new Vector2(1, 0) : new Vector2(-1, 0));
        } else {
            inputDir = inputDir.normalize();
        }

        let bestTarget: Player | null = null;
        let maxScore = -Infinity;

        teammates.forEach(tm => {
            if (tm === this) return;
            const toTeammate = tm.position.sub(this.position);
            const dist = toTeammate.mag();
            const dir = toTeammate.normalize();

            const angleScore = inputDir.dot(dir);

            if (angleScore > 0.5) {
                const score = angleScore * 1000 - dist;
                if (score > maxScore) {
                    maxScore = score;
                    bestTarget = tm;
                }
            }
        });

        let kickDir = inputDir;
        if (bestTarget) {
            kickDir = (bestTarget as Player).position.sub(this.position).normalize();
        }

        const speed = 8 + (power / 100) * 17;
        ball.velocity = kickDir.mult(speed);
        ball.position = ball.position.add(ball.velocity.mult(2));
    }
}
