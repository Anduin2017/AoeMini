import { Faction } from "./Faction";
import { FactionType, Projectile, StanceType, BuildingType, ResourceType } from "./Types";
import { Renderer } from "./Renderer";
import { Loop } from "./Loop";
import { CombatSystem } from "../systems/CombatSystem";
import { EconomySystem } from "../systems/EconomySystem";
import { AISystem } from "../systems/AISystem";
import { UIManager } from "../ui/UIManager";
import { TownCenter } from "../entities/buildings/ConcreteBuildings";

import { CONSTANTS } from "./Constants";

export class Game {
    public player: Faction;
    public enemy: Faction;
    public tickCount: number = 0;
    public gameOver: boolean = false;
    public isInstantBuild: boolean = false; // 作弊标记
    public isAIControllingPlayer: boolean = false; // AI 托管标记

    public projectiles: Projectile[] = [];
    public delayedDamageQueue: any[] = []; // 延迟伤害队列（用于投石机等）
    public worldWidth: number = 0;
    public baseWidthPct: number = 6;
    public tickRate: number = 50;

    public renderer: Renderer;
    public loop: Loop;

    public combatSystem: CombatSystem;
    public economySystem: EconomySystem;
    public aiSystem: AISystem;
    public uiManager: UIManager;

    public playerStance: StanceType = 'attack';
    public enemyStance: StanceType = 'attack';
    public laneStances: Record<number, StanceType> = {
        0: 'attack', // Infantry
        1: 'attack', // Ranged
        2: 'attack', // Cavalry
        3: 'attack'  // Siege
    };

    private static entityIdCounter: number = 0;
    public static nextId(): number { return ++this.entityIdCounter; }

    public difficultyKey: string = 'MEDIUM'; // 默认为中等
    public pinnedResource: ResourceType = 'food'; // 默认扎在食物上
    public aiStrategy: 'fast_feudal' | 'fast_castle' | 'fast_imperial' = 'fast_feudal';

    constructor(difficultyKey: string = 'MEDIUM') {
        this.difficultyKey = difficultyKey;
        // @ts-ignore
        const diffConfig = CONSTANTS.DIFFICULTY_LEVELS[difficultyKey as any] || CONSTANTS.DIFFICULTY_LEVELS.MEDIUM;
        const difficultyWorkers = diffConfig.workers;
        this.tickRate = (diffConfig as any).tickRate || 50;

        // 随机选择 AI 策略: 40% fast_feudal, 40% fast_castle, 20% fast_imperial
        const roll = Math.random();
        if (roll < 0.4) {
            this.aiStrategy = 'fast_feudal';
        } else if (roll < 0.8) {
            this.aiStrategy = 'fast_castle';
        } else {
            this.aiStrategy = 'fast_imperial';
        }
        console.log(`[AI] Strategy chosen: ${this.aiStrategy}`);

        this.player = new Faction(FactionType.Player, 6); // 玩家固定 6 农民
        this.enemy = new Faction(FactionType.Enemy, difficultyWorkers); // 电脑根据难度

        this.player.buildings.push(new TownCenter("p-tc", FactionType.Player));
        this.enemy.buildings.push(new TownCenter("e-tc", FactionType.Enemy));

        this.renderer = new Renderer(this);
        this.loop = new Loop(this);

        this.combatSystem = new CombatSystem(this);
        this.economySystem = new EconomySystem(this);
        this.aiSystem = new AISystem(this);
        this.uiManager = new UIManager(this);

        this.loop.start();
        (window as any).game = this;


    }

    public update() {
        if (this.gameOver) return;

        this.tickCount++;

        this.economySystem.update();
        this.aiSystem.update();
        this.combatSystem.update();

        this.uiManager.update();

        // 更新投射物
        this.projectiles.forEach(p => {
            p.progress += p.speed;
        });
        this.projectiles = this.projectiles.filter(p => p.progress < 1);

        this.renderer.draw();
    }

    // === 核心修复：接收消息并更新 UI ===
    public endGame(isVictory: boolean, message: string) {
        this.gameOver = true;
        this.loop.stop();

        const el = document.getElementById('game-over')!;
        el.style.display = 'flex';

        const titleEl = document.getElementById('end-title')!;
        const reasonEl = document.getElementById('end-reason')!;

        // 计算耗时
        // TICK_RATE 是每帧的毫秒数
        const totalMs = this.tickCount * this.tickRate;
        const seconds = Math.floor(totalMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const timeStr = `${minutes}分${remainingSeconds}秒`;

        if (isVictory) {
            titleEl.innerText = "VICTORY";
            titleEl.className = "text-5xl font-bold mb-4 text-green-500";

            // 保存进度
            this.saveProgress(seconds);

            // @ts-ignore
            const diffLabel = CONSTANTS.DIFFICULTY_LEVELS[this.difficultyKey].label;
            reasonEl.innerHTML = `${message}<br><span class="text-sm text-gray-400 mt-2 block">难度: ${diffLabel} | 耗时: ${timeStr}</span>`;

        } else {
            titleEl.innerText = "DEFEAT";
            titleEl.className = "text-5xl font-bold mb-4 text-red-500";
            reasonEl.innerText = message;
        }
    }

    private saveProgress(seconds: number) {
        try {
            const key = 'aoemini_progress';
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            const currentBest = data[this.difficultyKey];

            if (!currentBest || seconds < currentBest) {
                data[this.difficultyKey] = seconds;
                localStorage.setItem(key, JSON.stringify(data));
                console.log(`🏆 New Record for ${this.difficultyKey}: ${seconds}s`);
            }
        } catch (e) {
            console.error("Failed to save progress", e);
        }
    }


}