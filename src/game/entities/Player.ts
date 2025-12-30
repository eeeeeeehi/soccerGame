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
    public aiDecisionTimer: number = 0;
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

    // Dribble State
    isDribbling: boolean = false;

    // Stats
    stats: PlayerStats;

    public actionHoldTime: number = 0;
    public actionBlockTimer: number = 0; // Fix missing property

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
    update(ball: Ball, isChaser: boolean, isAttacking: boolean, teammates: Player[], opponents: Player[], shouldFreeze: boolean = false, isSetPiece: boolean = false): void {
        this.velocity = new Vector2(0, 0);

        // Update selection animation
        if (this.isSelected) {
            this.selectionAnim += 0.1;
        } else {
            this.selectionAnim = 0;
        }

        // Count down reaction timer
        if (this.reactionTimer > 0) this.reactionTimer--;
        if (this.actionBlockTimer > 0) this.actionBlockTimer--;

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
        // DISABLE for human controlled player to prevent "moving on its own"
        // The condition `!this.isHuman || !this.isSelected` already prevents selected human players from being affected.
        // To disable for *all* human players (selected or not), the condition should be `!this.isHuman`.
        // However, the user's intent was to prevent the *player* from moving on its own.
        // The current logic already prevents the *selected* human player from being pulled.
        // If the user wants to disable it for *all* human players (even unselected ones),
        // the condition would be `if (!this.isHuman) { ... }`.
        // For now, based on the instruction "DISABLE for human controlled player to prevent 'moving on its own'",
        // and the existing code, the most direct interpretation is to remove the block entirely if it's deemed
        // to be causing issues for human players, or to adjust the condition.
        // Given the previous thought process, the user wants to remove this "magnetic pull" for human players.
        // The current condition `!this.isHuman || !this.isSelected` means:
        // - If it's an AI player (`!this.isHuman` is true), apply pull.
        // - If it's a human player (`!this.isHuman` is false) AND it's NOT selected (`!this.isSelected` is true), apply pull.
        // This means unselected human players *do* get the pull.
        // To disable for *all* human players, the condition should be `if (!this.isHuman) { ... }`.
        // Let's apply that change.
        if (!this.isHuman) { // Only apply magnetic pull to AI players
            const distToBall = this.position.dist(ball.position);
            if (distToBall < 40 && distToBall > this.radius + ball.radius) {
                // "Magnetic" pull - strongly encourage moving to ball center
                const pullDir = ball.position.sub(this.position).normalize();
                // Add extra velocity component
                this.velocity = this.velocity.add(pullDir.mult(2.0));
            }
        }



        // ... (existing logic)

        if (this.isHuman && this.isSelected && this.input) {
            this.handleInput(ball, teammates, opponents, shouldFreeze, isSetPiece);
        } else {
            // AI Logic
            this.handleAI(ball, isChaser, isAttacking, teammates, opponents, undefined, isSetPiece);
        }

        // ...

        // Reset dribble state before collision check re-evaluates it
        this.isDribbling = false;

        super.update();
        this.checkBounds(shouldFreeze); // Use shouldFreeze as 'isSetPiece' context if appropriate?
        // Actually checkBounds logic uses isSetPiece to relax bounds. 
        // If shouldFreeze is true, it means we ARE set piece taker.
        // But checkBounds might need the general 'isSetPiece' game state?
        // For now, let's allow passing 'shouldFreeze' implies 'isSetPiece' for bound checking?
        // Or we need both?
        // Let's pass shouldFreeze as 'isSetPieceRelaxed' flag?
        // Wait, checkBounds(isSetPiece) expects boolean.
        // If we are set piece taker (shouldFreeze=true), we definitely want relaxed bounds.
        // If we are NOT taker but it IS set piece, we also want relaxed bounds (receivers).
        // Problem: 'shouldFreeze' is only true for Taker.
        // So receivers get false.
        // If receivers get false, they are constrained to field.
        // That is fine. 
        // Only Taker needs to go out of bounds (Throw in / Corner).

        this.checkBounds(shouldFreeze);
        this.checkBallCollision(ball);
    }

    handleInput(ball: Ball, teammates: Player[], opponents: Player[], shouldFreeze: boolean, isSetPiece: boolean = false): void {
        if (!this.input || this.actionBlockTimer > 0) return; // Block input if timer active

        const distToBall = this.position.dist(ball.position);
        const hasPossession = distToBall < this.radius + ball.radius + 15;
        const isAction = this.input.isDown('Space');
        const isSprint = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');

        // SPRINT LOGIC (Shift)
        if (isSprint && this.stamina > 5) {
            this.isSprinting = true;
            this.stamina -= 0.5;
        } else {
            this.isSprinting = false;
        }

        // MOVEMENT (Disabled during Set Pieces for Taker)
        let inputDir = new Vector2(0, 0);
        if (!isSetPiece) {
            if (this.input.isDown('ArrowUp')) inputDir.y -= 1;
            if (this.input.isDown('ArrowDown')) inputDir.y += 1;
            if (this.input.isDown('ArrowLeft')) inputDir.x -= 1;
            if (this.input.isDown('ArrowRight')) inputDir.x += 1;
        } else {
            // Allow rotation/aiming logic? Rotation is implicit in kick direction usually.
            // For now, simple freeze.
        }

        // DEFENSE: TACKLE (Space Tap)
        // Handled by Team.ts for "Switch First, Tackle Second" logic
        // DEFENSE: TACKLE (Space Tap)
        // Handled by Team.ts for "Switch First, Tackle Second" logic

        // DEFENSE: TACKLE (Space Tap)
        // CHECK: Is there an opponent with the ball OR an opponent close to the loose ball?
        // We want to avoid sliding at empty space, but allow slicing at a dribbler who technically "lost" the ball for a frame.

        // Find closest opponent to BALL (not me)
        let closestOppToBall: Player | null = null;
        let minDistToBall = 200; // Activation range

        if (ball.owner && ball.owner !== this && ball.owner.teamId !== this.teamId) {
            closestOppToBall = ball.owner;
            minDistToBall = 0;
        } else if (!ball.owner) {
            // Check loose ball context
            for (const opp of opponents) {
                const d = opp.position.dist(ball.position);
                if (d < minDistToBall) {
                    minDistToBall = d;
                    closestOppToBall = opp;
                }
            }
        }

        // Allow tackle if we have a valid target context
        if (closestOppToBall && !hasPossession) {
            // Allow tackle even with low stamina (but accuracy drops)
            if (isAction && !this.isSliding && this.stamina > 5) {
                // Determine tackle direction from input
                let slideDir = inputDir.clone();
                if (slideDir.mag() === 0 && this.velocity.mag() > 0) {
                    slideDir = this.velocity.normalize();
                }

                // AIM ASSIST
                // Always target the active opponent context
                let assistTarget = closestOppToBall.position;

                this.slide(slideDir, assistTarget);
            }
        } else if (!closestOppToBall && !hasPossession) {
            // If completely safe/empty, reset charge if we were charging (rare in defense)
            if (this.isChargingShot || this.isChargingPass) {
                this.isChargingShot = false;
                this.isChargingPass = false;
                this.shotPower = 0;
                this.passPower = 0;
            }
        }

        // OFFENSE: CHARGE & ACTION
        if (ball.owner === this || hasPossession) {
            // Fix: ensure we don't accidentally double-trigger if we just switched?
            // Usually fine, but maybe verify we aren't "sliding" (which we check).

            if (isAction) {
                // CHARGING
                if (!this.isChargingShot && !this.isChargingPass) {
                    // Start Charging
                    this.isChargingShot = true;
                    this.shotPower = 0;
                }

                if (this.isChargingShot) {
                    this.shotPower += 2.0; // Charge Rate
                    if (this.shotPower > 100) this.shotPower = 100;
                }
            } else {
                // RELEASED
                if (this.isChargingShot) {
                    // Execute Action based on Power
                    // SET PIECE OVERRIDE: Always Pass on release
                    if (this.shotPower < 30 || isSetPiece) {
                        // TAP (< 30) -> PASS
                        // TAP (< 30) -> PASS

                        // AUTO CENTERING (CROSS) LOGIC
                        // If on wing (near edge) and attacking, force pass to box center
                        const isWing = Math.abs(this.position.y - Constants.FIELD_HEIGHT / 2) > 150;
                        const isAttackingHalf = (this.teamId === 1 && this.position.x > Constants.FIELD_WIDTH / 2) || (this.teamId === 2 && this.position.x < Constants.FIELD_WIDTH / 2);

                        let centerTarget: Vector2 | undefined = undefined;

                        if (isWing && isAttackingHalf) {
                            // Find teammate in the box
                            const boxTop = Constants.FIELD_HEIGHT / 2 - 150;
                            const boxBottom = Constants.FIELD_HEIGHT / 2 + 150;
                            const enemyGoalX = this.teamId === 1 ? Constants.FIELD_WIDTH : 0;

                            // Simple heuristic: Find teammate closest to penalty spot?
                            const penaltySpot = new Vector2(this.teamId === 1 ? Constants.FIELD_WIDTH - 80 : 80, Constants.FIELD_HEIGHT / 2);

                            let bestT = null;
                            let minD = Infinity;

                            teammates.forEach(tm => {
                                if (tm === this) return;
                                const d = tm.position.dist(penaltySpot);
                                if (d < 200 && d < minD) {
                                    minD = d;
                                    bestT = tm;
                                }
                            });

                            if (bestT) {
                                centerTarget = (bestT as Player).position;
                                console.log("Auto-Centering to", (bestT as Player).role);
                            }
                        }

                        this.pass(ball, 45, teammates, centerTarget, true); // Always prioritize closest in Set Piece or Auto-Center
                    } else {
                        // HOLD (> 30) -> SHOOT 
                        const goalPos = this.teamId === 1 ? new Vector2(Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2) : new Vector2(0, Constants.FIELD_HEIGHT / 2);
                        this.shoot(ball, goalPos, this.shotPower);
                    }

                    this.isChargingShot = false;
                    this.shotPower = 0;
                }
                this.isChargingPass = false;
            }
        }


        // Apply Speed
        const baseSpeed = Constants.PLAYER_SPEED + (this.stats.speed / 100) * 1.5;
        const sprintMult = this.isSprinting ? 1.4 : 1.0;
        let currentSpeed = baseSpeed * sprintMult;

        if (this.isDribbling) currentSpeed *= 0.8;

        if (inputDir.y < 0) this.velocity.y -= currentSpeed;
        if (inputDir.y > 0) this.velocity.y += currentSpeed;
        if (inputDir.x < 0) this.velocity.x -= currentSpeed;
        if (inputDir.x > 0) this.velocity.x += currentSpeed;

        if (this.velocity.mag() > currentSpeed) {
            this.velocity = this.velocity.normalize().mult(currentSpeed);
        }
    }

    // ... (Skipping middle of file updates to focus on end-of-file cleanup)

    // REPLACING FROM LINE 1001 TO END (To clean up duplicates)



    handleAI(ball: Ball, isChaser: boolean, isAttacking: boolean, teammates: Player[], opponents: Player[], markTarget?: Player, isSetPiece: boolean = false): void {
        // AI Logic Update

        // SET PIECE LOGIC: If set piece is active, hold position (don't run back to formation)
        // EXCEPTION: The Taker (isChaser) must act.
        if (isSetPiece && !isChaser) {
            // Minimal adjustment or just hold?
            // If we are too close to others, maybe spread? 
            // For now, just HOLD to respect 'resetForSetPiece'
            this.moveTo(this.position);
            this.velocity = new Vector2(0, 0); // Kill drift
            return;
        }

        // REMOVED "Nerf Reaction" block causing AI Freeze.
        // AI will now behave responsively.

        const myGoalX = this.teamId === 1 ? 0 : Constants.FIELD_WIDTH;
        const enemyGoalX = this.teamId === 1 ? Constants.FIELD_WIDTH : 0;
        const goalPos = new Vector2(enemyGoalX, Constants.FIELD_HEIGHT / 2);
        const myGoalPos = new Vector2(myGoalX, Constants.FIELD_HEIGHT / 2);

        const distToBall = this.position.dist(ball.position);

        // ============================
        // 1. BALL POSSESSION / ACTION
        // ============================
        // ============================
        // 1. BALL POSSESSION / ACTION
        // ============================
        if (isChaser && distToBall < this.radius + ball.radius + 15) {

            // SET PIECE EXECUTION (AI)
            if (isSetPiece) {
                if (this.aiDecisionTimer <= 0) {
                    this.aiDecisionTimer = 60; // Cooldown

                    // Determine if Corner Kick (Near corner flags)
                    const isCorner = (this.position.x < 10 || this.position.x > Constants.FIELD_WIDTH - 10) &&
                        (this.position.y < 10 || this.position.y > Constants.FIELD_HEIGHT - 10);

                    if (isCorner) {
                        // CROSS TO BOX
                        const boxCenter = new Vector2(
                            this.teamId === 1 ? Constants.FIELD_WIDTH - 120 : 120,
                            Constants.FIELD_HEIGHT / 2
                        );
                        // Add some randomness
                        boxCenter.y += (Math.random() - 0.5) * 100;
                        this.pass(ball, 70, teammates, boxCenter, true);
                    } else {
                        // THROW IN / GOAL KICK -> Short/Medium Pass
                        // Use simple pass logic (target closest)
                        this.pass(ball, 50, teammates, undefined, true);
                    }
                }
                return;
            }

            // AI DELAY: Don't act instantly
            if (this.aiDecisionTimer > 0) {
                this.aiDecisionTimer--;
                // Still chase ball/dribble, but don't pass/shoot yet
            } else {
                this.decideBallAction(ball, goalPos, teammates, opponents);
                // Reset timer implies we acted (or tried)
                // Or we set timer inside decideBallAction? 
                // If we pass, we state is PASS.
                // If we decide to keep dribbling?
                // Let decideBallAction handle frequency.
            }
            return;
        } else {
            // Not in possession, keep timer ready? 
            // Or slowly charge it? 
            // Ideally reset to X when we LOSE ball or GAIN ball?
            // If we just got ball, timer should be X.
            // Actually, ball.lastTouch check handles "Just got ball".

            // Simple: If I don't have ball, reset timer to Delay.
            // So when I get ball, I must wait 30-40 frames.
            this.aiDecisionTimer = 30 + Math.random() * 20;
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

                if (distToBall < 60) {
                    // VERY RISKY: I am close and in front.
                    // DO NOT move to ball. Move AWAY/SIDEWAYS to clear the line.
                    // Vector from Ball to Goal (Line of fire)
                    const lineFire = goalPos.sub(ball.position).normalize();
                    // Perpendicular
                    const perp = new Vector2(-lineFire.y, lineFire.x);

                    // Which side am I on?
                    const toMe = this.position.sub(ball.position);
                    if (toMe.dot(perp) < 0) {
                        perp.x *= -1;
                        perp.y *= -1;
                    }

                    // Move to the side
                    const safeSpot = ball.position.add(perp.mult(50));
                    this.moveTo(safeSpot);
                } else {
                    // Far enough to circle around
                    this.moveTo(approachSpot);
                }
            }
            return;
        }

        // Auto-Chase Check (If loose ball and very close)
        // Only if no one else is closer? handled by Team really.
        this.checkAutoChase(ball);
        if (this.state === 'CHASE') {
            // If I decided to chase via auto-check, MOVE TO BALL!
            // Reuse Chaser Logic? Or simple follow
            this.moveTo(ball.position);

            // AI TACKLE LOGIC
            // Strictly ONLY for CPU (Team 2) or NON-HUMAN.
            // User requested: "Only yellow circle person should tackle".
            // So logic: If I am Human Team AI, NEVER tackle.
            if (!this.isHuman) { // Was this.teamId === 2
                // Let's enable for all AI controlled players

                // Find carrier
                const carrier = opponents.find(p => p.position.dist(ball.position) < 40);
                if (carrier) {
                    const dist = this.position.dist(carrier.position);
                    if (dist < 80 && dist > 40) { // Slide range
                        // Check alignment? Don't tackle if behind? (Foul?) No fouls yet.
                        // Just Slide if cooldown ready
                        // Random chance 5% per frame if in position
                        if (Math.random() < 0.05 && this.stamina > 30) {
                            // Aim at ball
                            const toBall = ball.position.sub(this.position).normalize();
                            this.slide(toBall);
                            return;
                        }
                    }
                }
            }
            return; // State changed in checkAutoChase, RETURN to prevent Formation Override
        }

        // ============================
        // 3. GOALKEEPER LOGIC
        // ============================
        if (this.role === 'GK') {
            // ... (Keep existing GK logic)
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
        // 1. TEAM SHIFTING (Compactness)
        // Shift entire formation based on ball position (Horizontal mainly)
        // REDUCED Shift to prevent sideline stacking (was 0.4)
        const shiftX = (ball.position.x - Constants.FIELD_WIDTH / 2) * 0.25;
        let dynamicPos = new Vector2(this.homePos.x + shiftX, this.homePos.y);

        // Keep bounds
        if (dynamicPos.x < 10) dynamicPos.x = 10;
        if (dynamicPos.x > Constants.FIELD_WIDTH - 10) dynamicPos.x = Constants.FIELD_WIDTH - 10;

        // 4.1 Check for Teammate Possession
        let carrier: Player | null = null;
        let bestDist = 1000;

        for (const tm of teammates) {
            const d = tm.position.dist(ball.position);
            if (d < 50 && d < bestDist) {
                bestDist = d;
                carrier = tm;
            }
        }

        if (carrier && carrier !== this) {
            const distToCarrier = this.position.dist(carrier.position);

            // PROXIMITY CHECK: Only nearby players actively support. Far players maintain formation.
            // REDUCED Range (400 -> 250) to prevent overcrowding.
            if (distToCarrier < 250 && distToCarrier > 100) {
                this.state = 'SUPPORT';

                // === ROLE SPECIFIC SUPPORT ===
                // Maintain 4-4-2 Shape: Move relative to ASSIGNED SLOT (dynamicPos), not free roaming.

                if (this.role === 'FW') {
                    // FW: Run Forward (make depth)
                    const attackDir = this.teamId === 1 ? 1 : -1;
                    // Move 100-200px forward of formation line
                    dynamicPos.x += 150 * attackDir;

                    // Slide slightly towards ball Y to offer angled pass, but don't cross field
                    const yDiff = carrier.position.y - dynamicPos.y;
                    dynamicPos.y += yDiff * 0.3; // Move 30% towards ball Y
                }
                else if (this.role === 'MF') {
                    // MF: Support
                    // Maintain good linking distance (approx 200px)
                    const toBall = carrier.position.sub(dynamicPos);
                    const currentDist = toBall.mag();

                    if (currentDist > 250) {
                        // Move closer
                        dynamicPos = dynamicPos.add(toBall.normalize().mult(50));
                    } else if (currentDist < 150) {
                        // Too close, give space
                        dynamicPos = dynamicPos.sub(toBall.normalize().mult(50));
                    }
                }
                else {
                    // DF: Hold Line but cover depth
                    // Drop back slightly if ball is close
                    const attackDir = this.teamId === 1 ? 1 : -1;
                    dynamicPos.x -= 50 * attackDir;
                }
            } else {
                // Far away: Return to formation (Shifted)
                // BUT FIRST: DEFENSIVE CUT (Shot Blocking)
                // If opponent has ball and I am not chaser, but I am relatively close, 
                // I should try to cut the passing/shooting lane to goal.
                const ballOwner = ball.owner;
                if (ballOwner && ballOwner.teamId !== this.teamId) {
                    const distToOwner = this.position.dist(ballOwner.position);
                    if (distToOwner < 350) {
                        // I am nearby (but not chaser). Block route to goal.
                        const myGoal = new Vector2(this.teamId === 1 ? 0 : Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2);
                        const dirToGoal = myGoal.sub(ballOwner.position).normalize();
                        // Stand 120px from carrier towards goal
                        const blockSpot = ballOwner.position.add(dirToGoal.mult(120));

                        this.moveTo(blockSpot);
                        return;
                    }
                }

                this.state = 'RETURN';
                this.state = 'RETURN';
                // Compress Y slightly
                dynamicPos.y = (dynamicPos.y - Constants.FIELD_HEIGHT / 2) * 0.7 + Constants.FIELD_HEIGHT / 2;
            }
        } else {
            // NO POSSESSION: Defense Shape
            this.state = 'RETURN';
            // Compress Y
            dynamicPos.y = (dynamicPos.y - Constants.FIELD_HEIGHT / 2) * 0.6 + Constants.FIELD_HEIGHT / 2;
        }

        // 4.2 AVOIDANCE / SPACING (Don't clump)
        teammates.forEach(tm => {
            if (tm === this) return;
            const d = this.position.dist(tm.position);
            if (d < 120) { // Increased avoidance to 120px to prevent clumping
                const push = this.position.sub(tm.position).normalize().mult(120 - d);
                dynamicPos = dynamicPos.add(push);
            }
        });

        // 4.3 BALL AVOIDANCE (Don't block teammate shots or run into dribbler)
        const dist = this.position.dist(ball.position);
        if (dist < 60 && !isChaser && carrier !== this) {
            const away = this.position.sub(ball.position).normalize();
            dynamicPos = dynamicPos.add(away.mult(50));
        }

        this.moveTo(dynamicPos);
    }



    decideBallAction(ball: Ball, goalPos: Vector2, teammates: Player[], opponents: Player[]) {
        // Priority 0: GOALKEEPER CLEARANCE
        if (this.role === 'GK') {
            // If ball is dangerous (close to me or goal), just clear it.
            // Shoot towards center field / away from goal
            const clearTarget = new Vector2(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);
            // Add some randomness
            clearTarget.y += (Math.random() - 0.5) * 500;

            // Just kick it hard
            this.shoot(ball, clearTarget, 100);
            this.state = 'SHOOT';
            this.reactionTimer = 60; // Long cooldown
            return;
        }

        // Priority 1: SHOOT
        // If close to goal and clear angle
        const distToGoal = this.position.dist(goalPos);
        const shootRange = 350;

        if (distToGoal < shootRange) {
            // Just shoot for now!
            // Aim at goal

            // BUT: If angle is bad or teammate is open, Pass might be better?
            // "When passing inside penalty area, it kicks to goal" -> User wants PASS option.

            // If very close, Shoot.
            if (distToGoal < 120) {
                if (Math.random() < 0.05) {
                    this.shoot(ball, goalPos);
                    this.state = 'SHOOT';
                    if (this.teamId === 2) this.reactionTimer = 30 + Math.random() * 20;
                    return;
                }
            } else {
                // In box but not point blank.
                // 50% chance to look for pass first?
                // Or just proceed to Pass Logic? 

                // If we RETURN here, we never check pass.
                // Let's ONLY return if we actually shoot.
                // Increase Shoot chance if very good angle?

                if (Math.random() < 0.03) { // Lower chance to force shoot from distance
                    this.shoot(ball, goalPos);
                    this.state = 'SHOOT';
                    if (this.teamId === 2) this.reactionTimer = 30 + Math.random() * 20;
                    return;
                }

                // Fallthrough allows Pass Logic to run! 
            }
        }

        // Priority 2: PASS
        // Find teammate closer to goal and open
        let bestPassTarget: Player | null = null;
        let bestScore = -Infinity;

        teammates.forEach(tm => {
            if (tm === this) return;

            // 1. Must be closer to goal than me
            const myDistGoal = this.position.dist(goalPos);
            const tmDistGoal = tm.position.dist(goalPos);

            // Forward progress gain
            const gain = myDistGoal - tmDistGoal;

            if (gain > 20) { // At least 20px gain
                // 2. Check Line of Sight (Lane Open)
                let laneOpen = true;
                const toTm = tm.position.sub(this.position);
                const passDist = toTm.mag();
                const passDir = toTm.normalize();

                // Simple raycast check against opponents
                opponents.forEach(opp => {
                    // dist from opp to line segment
                    // Project opp relative pos onto passDir
                    const toOpp = opp.position.sub(this.position);
                    const dot = toOpp.dot(passDir); // distance along line

                    if (dot > 0 && dot < passDist) {
                        // Opponent is between start and end
                        // Check perpendicular distance
                        const projPoint = this.position.add(passDir.mult(dot));
                        const perpDist = projPoint.dist(opp.position);
                        if (perpDist < 30) { // 30px lane width
                            laneOpen = false;
                        }
                    }
                });

                if (laneOpen) {
                    // Score = Gain - Distance (penalize long passes slightly)
                    const score = gain - (passDist * 0.2);
                    if (score > bestScore) {
                        bestScore = score;
                        bestPassTarget = tm;
                    }
                }
            }
        });

        // Decision: Pass vs Dribble
        // If we found a good target, high chance to pass
        if (bestPassTarget) {
            // MF passes more often than FW
            const passChance = this.role === 'MF' ? 0.8 : 0.4;

            if (Math.random() < passChance) {
                this.pass(ball, 60, teammates); // Reduced speed (was 85)
                this.state = 'PASS';
                // AI Cooldown
                if (this.teamId === 2) this.reactionTimer = 40;
                return;
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
        // Disabled to prevent Swarm behavior.
    }

    slide(dir?: Vector2, target?: Vector2): void {
        if (this.isSliding) return;

        this.isSliding = true;
        this.slideTimer = 30; // 0.5s slide
        this.stamina -= 20; // Cost

        // Slide Direction: Input Dir OR Current Facing (Velocity)
        let slideVec = dir ? dir.clone() : new Vector2(0, 0);

        // If dir is not provided or empty, check input (Human fallback)
        if (!dir && this.input) {
            if (this.input?.isDown('ArrowUp')) slideVec.y -= 1;
            if (this.input?.isDown('ArrowDown')) slideVec.y += 1;
            if (this.input?.isDown('ArrowLeft')) slideVec.x -= 1;
            if (this.input?.isDown('ArrowRight')) slideVec.x += 1;
        }

        // AIM ASSIST: If target provided (from auto-tackle), bias towards it
        if (target) {
            const toTarget = target.sub(this.position).normalize();
            // If input is neutral, use target entirely.
            if (slideVec.mag() === 0) {
                slideVec = toTarget;
            } else {
                // DYNAMIC AIM ASSIST based on STAMINA
                // High Stamina (80+) -> High Assist (0.8)
                // Low Stamina (10) -> Low Assist (0.2)

                // Map stamina 0-100 to factor 0.1-0.9
                const staminaFactor = Math.max(0, Math.min(this.stamina, 100)) / 100;
                // Base assist 0.1, Max 0.9
                const assistStrength = 0.1 + (staminaFactor * 0.8);

                // Blend
                slideVec = slideVec.normalize().mult(1 - assistStrength).add(toTarget.mult(assistStrength)).normalize();
            }
        }

        if (slideVec.mag() === 0 && this.velocity.mag() > 0) {
            slideVec = this.velocity.normalize();
        } else if (slideVec.mag() > 0) {
            slideVec = slideVec.normalize();
        } else {
            slideVec.x = 1; // Default right
        }
        this.slideDir = slideVec;
        this.velocity = this.slideDir.mult(8.0); // Faster Burst (was 6.0)
    }

    moveTo(target: Vector2): void {
        const dist = this.position.dist(target);
        if (dist < 5) {
            this.velocity = new Vector2(0, 0);
            return;
        }

        const dir = target.sub(this.position).normalize();

        // Speed modulation
        const baseSpeed = Constants.PLAYER_SPEED + (this.stats.speed / 100) * 1.5;
        let speed = baseSpeed;

        if (this.isDribbling) speed *= 0.7;

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

    checkBounds(isSetPiece: boolean = false): void {
        const padding = isSetPiece ? -20 : 0; // Allow being 20px out if set piece
        // Actually, if set piece, we might WANT them out.
        // Relax bounds completely or clamp to "Outside" range?
        // Just relax for now so resetForSetPiece can place them outside without snap back.

        if (isSetPiece) return; // Strict disable of bounds check for taker (or just relax)

        if (this.position.x - this.radius < 0) this.position.x = this.radius;
        if (this.position.x + this.radius > Constants.FIELD_WIDTH) this.position.x = Constants.FIELD_WIDTH - this.radius;
        if (this.position.y - this.radius < 0) this.position.y = this.radius;
        if (this.position.y + this.radius > Constants.FIELD_HEIGHT) this.position.y = Constants.FIELD_HEIGHT - this.radius;
    }

    checkBallCollision(ball: Ball): void {
        const dist = this.position.dist(ball.position);

        // SLIDING TACKLE HIT
        if (this.isSliding) {
            // WIDER HITBOX for sliding (Aim assist for physics)
            // Radius(10) + Ball(6) + Buffer(15 -> 25)
            const range = this.radius + ball.radius + 25;
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
            // If ball is moving (Pass/Shoot), Try to TRAP it
            if (ball.velocity.mag() > 3) {
                // Trap Radius: Slightly wider than physical to "reach" for it
                if (dist < physicalDist + 8) {
                    // TRAP LOGIC: Cushion the ball

                    // 1. Kill ball velocity (match player)
                    ball.velocity = this.velocity.clone().mult(0.5);

                    // 2. Position ball slightly in front/at feet
                    const trapDir = ball.velocity.mag() > 0 ? ball.velocity.normalize() : new Vector2(1, 0);
                    ball.position = this.position.add(trapDir.mult(physicalDist + 2));

                    // 3. Mark as dribbling immediately
                    this.isDribbling = true;
                    ball.lastTouch = this.teamId;
                }
                // If fast but not close enough yet, let it come closer (Return to skip bounce)
                return;
            }

            // Dribble Logic
            // Dribble / Control Logic
            if (this.velocity.mag() > 0.1 || dist < physicalDist + 5) {
                // SPRINT DRIBBLE (KNOCK ON)
                if (this.isSprinting && this.velocity.mag() > 0.1) {
                    // Kick ball slightly ahead (Knock On)
                    const knockSpeed = this.velocity.mag() * 1.3;
                    const kickDir = this.velocity.normalize();

                    ball.velocity = kickDir.mult(knockSpeed);
                    ball.lastTouch = this.teamId;
                    ball.position = this.position.add(kickDir.mult(physicalDist + 2));
                    return;
                }

                // NORMAL STICKY DRIBBLE / STATIC CONTROL
                this.isDribbling = true;
                ball.lastTouch = this.teamId;

                const dribbleSpeed = this.velocity.mag() * 1.1;
                // Ideal position: Exactly in front of current velocity (or facing if still)
                const idealDir = this.velocity.mag() > 0 ? this.velocity.normalize() : new Vector2(1, 0); // Default right if still
                // If input exists, use input dir?

                const idealPos = this.position.add(idealDir.mult(physicalDist + 2));

                const snapFactor = 0.6;

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

                return;
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

        // Draw Player Name
        if (this.name) {
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.position.x, this.position.y - this.radius - 25);
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

    pass(ball: Ball, power: number, teammates: Player[], forceTarget?: Vector2, prioritizeClosest: boolean = false) {
        // Smart Targeting
        let inputDir = new Vector2(0, 0);
        if (this.input) {
            if (this.input.isDown('ArrowUp')) inputDir.y -= 1;
            if (this.input.isDown('ArrowDown')) inputDir.y += 1;
            if (this.input.isDown('ArrowLeft')) inputDir.x -= 1;
            if (this.input.isDown('ArrowRight')) inputDir.x += 1;
        }

        if (forceTarget) {
            inputDir = forceTarget.sub(this.position).normalize();
        } else {
            if (inputDir.mag() === 0) {
                inputDir = this.velocity.mag() > 0 ? this.velocity.normalize() : (this.teamId === 1 ? new Vector2(1, 0) : new Vector2(-1, 0));
            } else {
                inputDir = inputDir.normalize();
            }
        }

        let bestTarget: Player | null = null;
        let maxScore = -Infinity;

        if (prioritizeClosest) {
            // SHORT PASS MODE (Set Piece / Neutral Tap)
            // Find absolute closest teammate
            let minD = Infinity;
            teammates.forEach(tm => {
                if (tm === this) return;
                const d = tm.position.dist(this.position);
                if (d < minD && d < 300) { // Within reasonable range
                    minD = d;
                    bestTarget = tm;
                }
            });
        } else {
            // NORMAL MODE (Smart Target)
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
        }

        let kickDir = inputDir;
        if (bestTarget) {
            kickDir = (bestTarget as Player).position.sub(this.position).normalize();
        }

        const speed = 8 + (power / 100) * 17;
        ball.velocity = kickDir.mult(speed);
        ball.position = ball.position.add(ball.velocity.mult(2));
    }

    getDynamicPosition(ball: Ball, teammates: Player[], opponents: Player[]): Vector2 {
        // Base: Formation Home (Shifted by Ball X for compactness)
        // Shift less for FW, more for DF to keep lines compact
        const shiftFactor = this.role === 'FW' ? 0.3 : (this.role === 'MF' ? 0.5 : 0.6);
        const shiftX = (ball.position.x - Constants.FIELD_WIDTH / 2) * shiftFactor;

        let target = new Vector2(this.homePos.x + shiftX, this.homePos.y);

        // ROLE SPECIFIC LOGIC
        const isAttacking = (ball.lastTouch === this.teamId);

        // Bounds Clamp (Horizontal)
        // Bounds Clamp (Horizontal)
        if (target.x < 10) target.x = 10;
        if (target.x > Constants.FIELD_WIDTH - 10) target.x = Constants.FIELD_WIDTH - 10;

        // === DANGER ZONE OVERRIDE (Scramble) ===
        // If ball is very close to goal (attacking or defending), ignore formation and SCRAMBLE.
        // This prevents players from walking away after a corner.
        const goalDist1 = ball.position.dist(new Vector2(0, Constants.FIELD_HEIGHT / 2));
        const goalDist2 = ball.position.dist(new Vector2(Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2));
        const isDanger = (goalDist1 < 350 || goalDist2 < 350);

        if (isDanger) {
            // If I am near the ball, stay involved!
            const distToBall = this.position.dist(ball.position);
            if (distToBall < 300) {
                // SCRAMBLE MODE
                if (isAttacking) {
                    // Attackers: Converge on ball/goal
                    // Move towards ball, but keep spacing
                    const toBall = ball.position.sub(this.position);
                    target = this.position.add(toBall.mult(0.6)); // Move 60% towards ball
                } else {
                    // Defenders: Man Mark or Block Goal
                    // Simple: Bias towards goal-side of ball
                    const myGoalX = this.teamId === 1 ? 0 : Constants.FIELD_WIDTH;
                    const goalPos = new Vector2(myGoalX, Constants.FIELD_HEIGHT / 2);

                    // If I am closest to ball, PRESS
                    // Else cover
                    target = this.position.add(ball.position.sub(this.position).mult(0.5));
                    // Drag target towards goal line slightly (Block shot)
                    const toGoal = goalPos.sub(target).normalize();
                    target = target.add(toGoal.mult(20));
                }
                return target; // OVERRIDE FORMATION
            }
        }

        // ROLE SPECIFIC LOGIC
        // isAttacking already defined above

        if (this.role === 'DF' && !isAttacking) {
            // DEFENDER MARKING
            let minD = 300; // Zoning Radius
            let nearestOpp: Player | null = null;

            opponents.forEach(opp => {
                const d = opp.position.dist(target);
                if (d < minD) { minD = d; nearestOpp = opp; }
            });

            if (nearestOpp) {
                const myGoalX = this.teamId === 1 ? 0 : Constants.FIELD_WIDTH;
                const goalPos = new Vector2(myGoalX, Constants.FIELD_HEIGHT / 2);

                const oppToGoal = goalPos.sub((nearestOpp as Player).position).normalize();
                target = (nearestOpp as Player).position.add(oppToGoal.mult(50));
            }
        }
        else if (this.role === 'FW') {
            if (isAttacking) {
                const distToBall = this.position.dist(ball.position);
                if (distToBall > 400) {
                    const toBall = ball.position.sub(target);
                    target = target.add(toBall.mult(0.2));
                } else {
                    const attackDir = this.teamId === 1 ? 1 : -1;
                    target.x += 100 * attackDir;
                }
            }
        }
        else if (this.role === 'MF') {
            if (isAttacking) {
                const isSide = Math.abs(this.homePos.y - Constants.FIELD_HEIGHT / 2) > 150;
                if (isSide) {
                    // Stay wide? Maybe slightly in
                } else {
                    const ballY = ball.position.y;
                    target.y = this.homePos.y + (ballY - this.homePos.y) * 0.3;
                }
            } else {
                const isSide = Math.abs(this.homePos.y - Constants.FIELD_HEIGHT / 2) > 150;
                if (isSide) {
                    const centerY = Constants.FIELD_HEIGHT / 2;
                    target.y = this.homePos.y + (centerY - this.homePos.y) * 0.3;
                }
            }
        }

        return target;
    }



    executeSmartKick(ball: Ball, teammates: Player[]) {
        const goalPos = this.teamId === 1 ? new Vector2(Constants.FIELD_WIDTH, Constants.FIELD_HEIGHT / 2) : new Vector2(0, Constants.FIELD_HEIGHT / 2);
        const distToGoal = this.position.dist(goalPos);

        // 1. Shoot if close
        if (distToGoal < 350) {
            // Charge shot max
            this.shoot(ball, goalPos, 100);
        } else {
            // 2. Pass (Auto Target)
            this.pass(ball, 85, teammates);
        }
    }
}
