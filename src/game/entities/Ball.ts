import { Entity } from './Entity';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';

export class Ball extends Entity {
    constructor(x: number, y: number) {
        super(x, y, Constants.BALL_RADIUS, '#ffffff');
    }

    update(): void {
        super.update();

        // Friction
        this.velocity = this.velocity.mult(Constants.BALL_FRICTION);

        // Wall collision
        const goalTop = (Constants.FIELD_HEIGHT - Constants.GOAL_HEIGHT) / 2;
        const goalBottom = (Constants.FIELD_HEIGHT + Constants.GOAL_HEIGHT) / 2;

        // Left Wall
        if (this.position.x - this.radius < 0) {
            if (this.position.y < goalTop || this.position.y > goalBottom) {
                this.position.x = this.radius;
                this.velocity.x *= -1;
            }
        }
        // Right Wall
        if (this.position.x + this.radius > Constants.FIELD_WIDTH) {
            if (this.position.y < goalTop || this.position.y > goalBottom) {
                this.position.x = Constants.FIELD_WIDTH - this.radius;
                this.velocity.x *= -1;
            }
        }
        if (this.position.y - this.radius < 0) {
            this.position.y = this.radius;
            this.velocity.y *= -1;
        }
        if (this.position.y + this.radius > Constants.FIELD_HEIGHT) {
            this.position.y = Constants.FIELD_HEIGHT - this.radius;
            this.velocity.y *= -1;
        }

        // Stop if very slow
        if (this.velocity.mag() < 0.1) {
            this.velocity = new Vector2(0, 0);
        }
    }
}
