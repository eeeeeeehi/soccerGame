import { Entity } from './Entity';
import { Constants } from '../Constants';
import { Vector2 } from '../utils/Vector2';
import type { Player } from './Player'; // Type-only import to prevent cycle

export class Ball extends Entity {
    constructor(x: number, y: number) {
        super(x, y, Constants.BALL_RADIUS, '#ffffff');
    }

    update(): void {
        super.update();

        // Friction
        this.velocity = this.velocity.mult(Constants.BALL_FRICTION);

        // Stop if very stop
        if (this.velocity.mag() < 0.1) {
            this.velocity = new Vector2(0, 0);
        }
    }

    public lastTouch: number = 0;
    public owner: Player | null = null;
}
