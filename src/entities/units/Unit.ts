import { Entity } from "../Entity";
import { UnitTag, FactionType, StanceType } from "../../core/Types";
import { CONSTANTS } from "../../core/Constants";

export abstract class Unit extends Entity {
    public tags: UnitTag[] = [];

    // 战斗属性
    public damage: number = 0;
    public def_m: number = 0; // 近战防御
    public def_r: number = 0; // 远程防御
    public range: number = 5;
    public speed: number = 0;

    // 状态机
    public state: 'move' | 'attack' | 'idle' = 'move';
    public targetId: string | number | null = null;
    public lane: number = 0; // 0: 主路, 1: 侧路 (防重叠)

    // 攻击冷却相关
    public attackCooldown: number = 0;
    public attackAnimTimer: number = 0;
    public isDeployed: boolean = false;   // 是否已走出基地

    constructor(id: number, type: string, owner: FactionType, pos: number) {
        super(id, type, owner, pos);
    }

    // 获取对某个标签的攻击加成 (将在 Phase 3 的具体兵种中覆盖)
    public getBonusDamage(targetTags: UnitTag[]): number {
        return 0;
    }

    protected applyConfig(conf: any) {
        this.hp = conf.hp;
        this.maxHp = conf.hp;
        this.damage = conf.damage;
        this.def_m = conf.def_m;
        this.def_r = conf.def_r;
        this.range = conf.range;
        this.speed = conf.speed / (1000 / CONSTANTS.TICK_RATE); // 换算速度
        this.tags = [...conf.tags];
        this.lane = conf.lane;
        this.width = CONSTANTS.UNIT_SIZE_PERCENT * (conf.widthScale || 1);
        this.attackCooldown = Math.floor(Math.random() * 10);
    }
}