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
    
    // 基地状态
    public baseHp: number = CONSTANTS.BASE_HP;
    public popCap: number = CONSTANTS.INITIAL_POP_CAP;
    public armyCount: number = 0;
    
    // 科技与防御
    public turretCooldown: number = 0;
    public techLevels = { atk_m: 0, def_m: 0, atk_r: 0, def_r: 0 };

    constructor(type: FactionType) {
        this.type = type;
        this.resources = { ...CONSTANTS.INITIAL_RES };
        
        // 初始人口分配 logic
        const initialW = type === FactionType.Player ? 6 : 7;
        this.workers = { food: initialW, wood: 0, gold: 0, stone: 0 };
        this.totalWorkers = initialW;
        this.idleWorkers = 0;
        this.turretCooldown = 0;
    }

    public get currentPop(): number {
        return this.totalWorkers + this.armyCount;
    }
}