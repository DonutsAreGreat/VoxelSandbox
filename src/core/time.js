export class Time {
  constructor() {
    this.last = performance.now();
    this.delta = 0;
    this.elapsed = 0;
    this.smoothFPS = 60;
  }

  update() {
    const now = performance.now();
    this.delta = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += this.delta;
    // Simple exponential moving average for FPS display
    const instantFPS = this.delta > 0 ? 1 / this.delta : 0;
    this.smoothFPS = this.smoothFPS * 0.9 + instantFPS * 0.1;
  }
}
