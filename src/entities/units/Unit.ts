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
    public maxAttackCooldown: number = 15; // 默认值
    public attackAnimTimer: number = 0;
    public isDeployed: boolean = false;   // 是否已走出城镇中心
    public prevPos: number = 0; // 上一帧位置 (用于插值)
    public bonusAttack?: (targetTags: UnitTag[]) => number; // 攻击加成函数

    constructor(id: number, type: string, owner: FactionType, pos: number) {
        super(id, type, owner, pos);
        this.prevPos = pos;
    }

    // 获取对某个标签的攻击加成 (将在 Phase 3 的具体兵种中覆盖)
    public getBonusDamage(targetTags: UnitTag[]): number {
        if (this.bonusAttack) {
            return this.bonusAttack(targetTags);
        }
        return 0;
    }

    protected applyConfig(conf: any, tickRate: number) {
        this.hp = conf.hp;
        this.maxHp = conf.hp;
        this.damage = conf.damage;
        this.def_m = conf.def_m;
        this.def_r = conf.def_r;
        this.range = conf.range;
        this.speed = conf.speed / (1000 / tickRate); // 换算速度
        this.tags = [...conf.tags];
        this.lane = conf.lane;
        this.width = CONSTANTS.UNIT_SIZE_PERCENT * (conf.widthScale || 1);
        this.bonusAttack = conf.bonusAttack; // 绑定加成函数

        // === 核心修正：attackSpeed (秒) -> cooldown (ticks) ===
        // attackSpeed 是秒，tickRate 是毫秒/tick
        // 例如：attackSpeed = 6.875s, tickRate = 50ms
        // cooldown = 6.875s / (50ms/tick) = 6.875 / 0.05 = 137.5 ticks
        if (conf.attackSpeed) {
            this.maxAttackCooldown = Math.round(conf.attackSpeed / (tickRate / 1000));
        } else {
            this.maxAttackCooldown = 15;
        }
        this.attackCooldown = Math.floor(Math.random() * 10);
    }
}