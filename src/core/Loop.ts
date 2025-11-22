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

        // 逻辑循环 (固定 Tick Rate)
        this.intervalId = setInterval(() => {
            this.game.update();
        }, CONSTANTS.TICK_RATE);

        // 渲染循环 (依赖屏幕刷新率)
        const animate = () => {
            if (!this.isRunning) return;
            this.game.renderer.draw(); // 强制重绘，保证流畅度
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    public stop() {
        this.isRunning = false;
        clearInterval(this.intervalId);
    }
}