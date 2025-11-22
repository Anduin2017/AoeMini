import { Faction } from "./Faction";
import { BuildingType, FactionType, StanceType } from "./Types";
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
    
    public turretShots: Array<{start: number, end: number, color: string}> = [];
    public worldWidth: number = 0;
    public baseWidthPct: number = 6; // 注意：虽然用了 CONSTANTS，但这变量留着也没事

    public renderer: Renderer;
    public loop: Loop;
    
    public combatSystem: CombatSystem;
    public economySystem: EconomySystem;
    public aiSystem: AISystem;
    public uiManager: UIManager;

    public playerStance: StanceType = 'attack';
    public enemyStance: StanceType = 'attack';

    private static entityIdCounter: number = 0;
    public static nextId(): number { return ++this.entityIdCounter; }

    constructor() {
        this.player = new Faction(FactionType.Player);
        this.enemy = new Faction(FactionType.Enemy);
        
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
        
        // === 修复核心：每一帧开始时，先清空上一帧的特效数据 ===
        // 这样 System 计算产生的新数据才能保留到 Render 阶段
        this.turretShots = []; 
        // ==================================================

        this.tickCount++;

        this.economySystem.update();
        this.aiSystem.update();
        this.combatSystem.update();
        
        this.uiManager.update();
        
        this.renderer.draw();
    }

    public endGame(isVictory: boolean) {
        this.gameOver = true;
        this.loop.stop();
        const el = document.getElementById('game-over')!;
        el.style.display = 'flex';
        document.getElementById('end-title')!.innerText = isVictory ? "VICTORY" : "DEFEAT";
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
        // 科研状态、铁匠铺忙碌情况、攻防等级
        console.log(`⚔️ 科研状态: 近战攻击 / 近战防御 / 远程攻击 / 远程防御`);
        console.log(`⚔️ ${ai.techLevels.atk_m} / ${ai.techLevels.def_m} / ${ai.techLevels.atk_r}, ${ai.techLevels.def_r}`);
        console.log(`⚔️ 铁匠铺忙碌情况: ${ai.buildings.find(b => b.type === BuildingType.Blacksmith)?.queue.length}`);
        console.groupEnd();
    }
}