import { FactionType, ResourceType } from "./Types";
import { CONSTANTS } from "./Constants";
import { Building } from "../entities/buildings/Building";
import { Unit } from "../entities/units/Unit";

export class Faction {
    public type: FactionType;

    // 资源
    public resources: Record<ResourceType, number>;
    public workers: Record<ResourceType, number>; // 分配到各资源的工人数
    public totalWorkers: number = 0;
    public idleWorkers: number = 0;

    // 实体列表
    public buildings: Building[] = [];
    public constructions: any[] = []; // 建造中的任务
    public units: Unit[] = []; // *这个阵营拥有的单位引用*

    // 城镇中心状态
    public baseHp: number = CONSTANTS.BASE_HP;
    public popCap: number = CONSTANTS.INITIAL_POP_CAP;
    public armyCount: number = 0;

    // 科技与防御
    public turretCooldown: number = 0;
    public techLevels = { atk_m: 0, def_m: 0, atk_r: 0, def_r: 0 };

    // 时代系统
    public currentAge: number = 1; // 当前时代 (1=黑暗, 2=封建, 3=城堡, 4=帝国)
    public ageUpProgress: { remaining: number, total: number } | null = null; // 上本进度
    public ageWorkers: number = 0; // 分配到上本的村民数

    // 采矿场锁系统
    public miningUnlocked: { gold: boolean, stone: boolean } = { gold: false, stone: false };
    public miningUnlockQueue: { type: 'gold' | 'stone', ticksLeft: number, totalTicks: number } | null = null;

    constructor(type: FactionType, initialWorkers?: number) {
        this.type = type;
        this.resources = { ...CONSTANTS.INITIAL_RES };

        // 初始人口分配 logic
        // 玩家默认为 6 (中等难度)，电脑由 Game 传入
        const defaultWorkers = type === FactionType.Player ? 6 : 9;
        const startWorkers = initialWorkers !== undefined ? initialWorkers : defaultWorkers;

        this.workers = { food: startWorkers, wood: 0, gold: 0, stone: 0 };
        this.totalWorkers = startWorkers;
        this.idleWorkers = 0;
        this.turretCooldown = 0;
    }

    public get currentPop(): number {
        return this.totalWorkers + this.armyCount;
    }
}