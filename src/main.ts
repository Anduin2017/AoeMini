import { Game } from "./core/Game";

declare global {
    interface Window {
        game: Game;
        show_me_the_money: () => void;
        operation_cwal: () => void; // 新增类型声明
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();

    // 1. 资源秘籍
    window.show_me_the_money = () => {
        if (game && game.player) {
            game.player.resources = { food: 9999, wood: 9999, gold: 9999, stone: 9999 };
            console.log("💰 Resources granted: 99999 [Food, Wood, Gold, Stone]");
            game.uiManager.update();
        }
    };

    // 2. 快速建造秘籍 (Operation CWAL)
    window.operation_cwal = () => {
        if (game) {
            game.isInstantBuild = !game.isInstantBuild;
            console.log(`⚡ Operation CWAL: ${game.isInstantBuild ? 'ENABLED (Player Only)' : 'DISABLED'}`);
        }
    };

    console.log("Minimalist Empire Engine Started!");
    console.log("Cheats:");
    console.log("  - show_me_the_money(): Get resources");
    console.log("  - operation_cwal(): Instant build/research");
});