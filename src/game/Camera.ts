import { Vector2 } from './utils/Vector2';
import { Constants } from './Constants';

export class Camera {
    position: Vector2;
    zoom: number = 1.1;

    constructor() {
        this.position = new Vector2(0, 0);
    }

    follow(target: Vector2) {
        // Simple Lerp
        const lerp = 0.05;

        // Center the target
        const viewWidth = Constants.FIELD_WIDTH / this.zoom;
        const viewHeight = Constants.FIELD_HEIGHT / this.zoom; // This is a bit wrong, we need canvas dims.
        // But assuming canvas wraps field...

        // Actually, we want to center the target on SCREEN.
        // So camera position (top-left) should be target - screenHalf.

        // Let's assume Screen Size ~ Field Size for now, but zoomed in?
        // Wait, current canvas is FIXED to field size.
        // Use a virtual viewport. 
        // Let's assume we want to show a 800x600 portion?
        // Or just zoom in 1.2x and clamp?

        // Let's try centering on target relative to Field Center
        // desiredX = target.x - (FieldWidth / 2 / zoom)
        // This is getting complicated without knowing screen size.
        // Let's assume the Canvas IS the screen size (1200x800).

        const centerX = Constants.FIELD_WIDTH / 2;
        const centerY = Constants.FIELD_HEIGHT / 2;

        // We want the camera to look AT the target.
        // So camera acts as an offset.
        // Offset = Center - Target

        const desiredX = centerX - target.x;
        const desiredY = centerY - target.y; // If target is at center, offset is 0.

        // Lerp
        this.position.x += (desiredX - this.position.x) * lerp;
        this.position.y += (desiredY - this.position.y) * lerp;

        // Clamp? 
        // If we want to stay within bounds...
        // Limit offset so edges don't show void.
        // Max offset?
        const maxOffsetX = (Constants.FIELD_WIDTH * (this.zoom - 1)) / 2;
        // Actually this depends on zoom logic in draw.
    }

    apply(ctx: CanvasRenderingContext2D) {
        ctx.save();

        // 1. Translate to Center
        ctx.translate(Constants.FIELD_WIDTH / 2, Constants.FIELD_HEIGHT / 2);

        // 2. Scale
        ctx.scale(this.zoom, this.zoom);

        // 3. Translate back (but with camera offset)
        // If camera.pos is (0,0), we are centered.
        // If camera.pos is (-100, 0), we shifted View LEFT, so we see RIGHT.
        ctx.translate(-Constants.FIELD_WIDTH / 2 + this.position.x, -Constants.FIELD_HEIGHT / 2 + this.position.y);
    }

    unapply(ctx: CanvasRenderingContext2D) {
        ctx.restore();
    }
}
