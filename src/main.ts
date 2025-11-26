import { Game } from "./core/Game";

import { CONSTANTS } from "./core/Constants";

declare global {
    interface Window {
        game: Game;
        show_me_the_money: () => void;
        operation_cwal: () => void;
        let_ai_control_me: () => void;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 读取进度
    const progress = JSON.parse(localStorage.getItem('aoemini_progress') || '{}');

    // 创建难度选择界面
    const container = document.createElement('div');
    container.id = 'difficulty-screen';
    container.className = 'fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50';

    const buttonsHtml = Object.entries(CONSTANTS.DIFFICULTY_LEVELS).map(([key, diff]) => {
        const bestTime = progress[key];
        let badgeHtml = '';
        if (bestTime) {
            const m = Math.floor(bestTime / 60);
            const s = bestTime % 60;
            badgeHtml = `<span class="absolute -top-3 -right-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-md transform rotate-12 border border-yellow-300">🏆 ${m}m${s}s</span>`;
        }

        return `
            <button class="group relative px-6 py-4 bg-gray-800 hover:bg-blue-600 border-2 border-gray-700 hover:border-blue-400 text-white rounded-xl font-bold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-between w-full"
                data-key="${key}">
                ${badgeHtml}
                <div class="flex items-center text-left">
                    <span class="text-3xl mr-4 group-hover:animate-bounce">${(diff as any).emoji}</span>
                    <div class="flex flex-col">
                        <span class="tracking-wider">${diff.label}</span>
                        <span class="text-xs text-gray-400 group-hover:text-blue-100 font-normal mt-1">${(diff as any).shortText}</span>
                    </div>
                </div>
                <span class="text-2xl ml-2 opacity-0 group-hover:opacity-100 transition-opacity">➜</span>
            </button>
        `;
    }).join('');

    container.innerHTML = `
        <div class="flex flex-col gap-4 w-96">
            ${buttonsHtml}
        </div>
        <div class="mt-8 text-gray-500 text-sm">选择你的对手强度</div>
    `;
    document.body.appendChild(container);

    // 绑定点击事件
    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key') || 'MEDIUM';
            container.remove(); // 移除界面
            startGame(key);
        });
    });
});

function startGame(difficultyKey: string) {
    const game = new Game(difficultyKey);

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

    // 3. AI 托管秘籍
    window.let_ai_control_me = () => {
        if (game) {
            if (game.isAIControllingPlayer) {
                console.warn("⚠️ AI is already controlling you!");
            } else {
                game.isAIControllingPlayer = true;
                console.log("🤖 AI Control ENABLED: Sit back and relax!");
            }
        }
    };

    console.log(`Minimalist Empire Engine Started! Difficulty: ${difficultyKey}`);
    console.log("Cheats:");
    console.log("  - show_me_the_money(): Get resources");
    console.log("  - operation_cwal(): Instant build/research");
    console.log("  - let_ai_control_me(): Enable AI auto-play");
}