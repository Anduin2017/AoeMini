import { Faction } from "./Faction";
import { FactionType, Projectile, StanceType, BuildingType } from "./Types";
import { Renderer } from "./Renderer";
import { Loop } from "./Loop";
import { CombatSystem } from "../systems/CombatSystem";
import { EconomySystem } from "../systems/EconomySystem";
import { AISystem } from "../systems/AISystem";
import { UIManager } from "../ui/UIManager";
import { TownCenter } from "../entities/buildings/ConcreteBuildings";

export class Game {
    public player: Faction;
    public enemy: Faction;
    public tickCount: number = 0;
    public gameOver: boolean = false;
    public isInstantBuild: boolean = false; // 作弊标记
    public isAIControllingPlayer: boolean = false; // AI 托管标记

    public projectiles: Projectile[] = [];
    public worldWidth: number = 0;
    public baseWidthPct: number = 6;

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
        2: 'attack'  // Cavalry
    };

    private static entityIdCounter: number = 0;
    public static nextId(): number { return ++this.entityIdCounter; }

    constructor(difficultyWorkers: number = 9) {
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

        // AI 调试
        setInterval(() => this.debugAI(), 3000);
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

        if (isVictory) {
            titleEl.innerText = "VICTORY";
            // 使用 style.css 中的工具类
            titleEl.className = "text-5xl font-bold mb-4 text-green-500";
        } else {
            titleEl.innerText = "DEFEAT";
            titleEl.className = "text-5xl font-bold mb-4 text-red-500";
        }

        reasonEl.innerText = message;
    }

    private debugAI() {
        if (this.gameOver) return;
        const ai = this.enemy;
        console.groupCollapsed(`🤖 AI 状态监控 (Tick: ${this.tickCount})`);
        console.log(`💰 资源: F${Math.floor(ai.resources.food)} W${Math.floor(ai.resources.wood)} G${Math.floor(ai.resources.gold)} S${Math.floor(ai.resources.stone)}`);
        console.log(`👷 人口: ${ai.currentPop}/${ai.popCap} (闲置: ${ai.idleWorkers})`);
        console.log(`⚔️ 军队: ${ai.armyCount}`);
        console.log(`🏗️ 建筑:`, ai.buildings.map(b => `${b.type}(${b.queue.length})`));
        console.log(`⚔️ 战术姿态: ${this.enemyStance}`);
        console.log(`⚔️ 科研: AtkM:${ai.techLevels.atk_m} DefM:${ai.techLevels.def_m} AtkR:${ai.techLevels.atk_r} DefR:${ai.techLevels.def_r}`);
        console.log(`⚔️ 铁匠铺队列: ${ai.buildings.find(b => b.type === BuildingType.Blacksmith)?.queue.length || 0}`);
        console.groupEnd();
    }
}