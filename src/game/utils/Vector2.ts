export class Vector2 {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  mult(n: number): Vector2 {
    return new Vector2(this.x * n, this.y * n);
  }

  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2 {
    const m = this.mag();
    if (m === 0) return new Vector2(0, 0);
    return new Vector2(this.x / m, this.y / m);
  }

  limit(max: number): Vector2 {
    if (this.mag() > max) {
      return this.normalize().mult(max);
    }
    return this; // Return this if not limited
  }

  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  dist(v: Vector2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }
}
