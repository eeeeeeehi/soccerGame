import { Vector2 } from '../utils/Vector2';

export abstract class Entity {
    position: Vector2;
    velocity: Vector2;
    radius: number;
    color: string;

    constructor(x: number, y: number, radius: number, color: string) {
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);
        this.radius = radius;
        this.color = color;
    }

    update(...args: any[]): void {
        this.position = this.position.add(this.velocity);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}
