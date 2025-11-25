import { Game } from "./Game";
import { CONSTANTS } from "./Constants";

export class Loop {
    private game: Game;
    private intervalId: any;
    private isRunning: boolean = false;

    constructor(game: Game) {
        this.game = game;
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;

        let lastTime = performance.now();
        let accumulator = 0;
        const step = CONSTANTS.TICK_RATE; // 80ms

        const loop = (currentTime: number) => {
            if (!this.isRunning) return;

            const dt = currentTime - lastTime;
            lastTime = currentTime;
            accumulator += dt;

            // 螺旋死亡保护：如果 dt 太大（比如切后台回来），限制最大循环次数
            if (accumulator > 1000) accumulator = 1000;

            while (accumulator >= step) {
                this.game.update(); // 逻辑更新 (固定步长)
                accumulator -= step;
            }

            // 计算插值系数 alpha (0 ~ 1)
            const alpha = accumulator / step;
            this.game.renderer.draw(alpha); // 渲染更新 (带插值)

            this.intervalId = requestAnimationFrame(loop);
        };

        this.intervalId = requestAnimationFrame(loop);
    }

    public stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.intervalId);
    }
}