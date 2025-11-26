import { UnitType, UnitTag, Cost, BuildingType } from "../core/Types";
import { CONSTANTS } from "../core/Constants";

interface UnitStats {
    cost: Cost;
    time: number;
    hp: number;
    damage: number;
    def_m: number;
    def_r: number;
    range: number;
    speed: number;
    tags: UnitTag[];
    label: string;
    lane: number;
    widthScale?: number;
    attackType?: 'melee' | 'ranged';
    attackSpeed?: number; // 秒 (1.875s 等)
    canMoveAttack?: boolean; // === 新增：是否允许移动攻击 ===
    bonusAttack?: (targetTags: UnitTag[]) => number; // === 新增：攻击加成 Lambda ===
    bonusDesc?: string; // === 新增：加成描述 ===
    visual?: {
        type: 'emoji';
        value: string;
        color?: string;
        shouldMirrorIcon?: boolean; // true: 玩家反向(默认), false: 电脑反向
    };
    // === 新增：AOE 与 攻城属性 ===
    aoeRadius?: number;       // 溅射半径 (0-100 坐标系)
    aoeDamage?: number;       // 溅射伤害 (固定值)
    bonusBaseDamage?: number; // 对基地的额外伤害
    projectileFlightTime?: number; // 炮弹飞行时间（秒），用于延迟结算
}

export const UNIT_CONFIG: Record<string, UnitStats> = {
    [UnitType.Worker]: {
        cost: { food: 50 }, time: 200, hp: 10, damage: 0, def_m: 0, def_r: 0,
        range: 1, speed: 0, tags: [UnitTag.Worker], label: '村民', lane: 0,
        visual: { type: 'emoji', value: '👨‍🌾' }
    },
    [UnitType.Spearman]: {
        cost: { food: 60, wood: 20 }, time: 150, hp: 90, damage: 8, def_m: 0, def_r: 0,
        range: 5, speed: 1.25,
        tags: [UnitTag.Infantry, UnitTag.Melee, UnitTag.Light],
        label: '长枪兵', lane: 0, attackType: 'melee', attackSpeed: 1.875, canMoveAttack: true,
        visual: { type: 'emoji', value: '🔱' },
        // === 新增：对骑兵造成 +20 伤害 ===
        bonusAttack: (tags: UnitTag[]) => {
            if (tags.includes(UnitTag.Cavalry)) return 20;
            return 0;
        },
        bonusDesc: "+20 vs 骑兵"
    },
    [UnitType.ManAtArms]: {
        cost: { food: 100, gold: 20 }, time: 150, hp: 140, damage: 11, def_m: 2, def_r: 3,
        range: 3.75, speed: 1.125,
        tags: [UnitTag.Infantry, UnitTag.Melee, UnitTag.Heavy],
        label: '武士', lane: 0, attackType: 'melee', attackSpeed: 1.375, canMoveAttack: true,
        visual: { type: 'emoji', value: '🗡️' }
    },
    [UnitType.Longbowman]: {
        cost: { food: 40, wood: 50 }, time: 150, hp: 70, damage: 6, def_m: 0, def_r: 0,
        range: 11, // === 修改：射程提升 ===
        speed: 1.125,
        tags: [UnitTag.Infantry, UnitTag.Ranged, UnitTag.Light],
        label: '长弓兵', lane: 1, widthScale: 0.5, attackType: 'ranged', attackSpeed: 1.625,
        visual: { type: 'emoji', value: '🏹', shouldMirrorIcon: false },
        // === 新增：对 Light + Melee + Infantry 造成 +6 伤害 ===
        bonusAttack: (tags: UnitTag[]) => {
            if (tags.includes(UnitTag.Light) && tags.includes(UnitTag.Melee) && tags.includes(UnitTag.Infantry)) {
                return 6;
            }
            return 0;
        },
        bonusDesc: "+6 vs 轻装近战步兵"
    },
    [UnitType.Crossbowman]: {
        cost: { food: 80, gold: 40 }, time: 230, hp: 80, damage: 11, def_m: 0, def_r: 0,
        range: 10, // 长弓兵(11) - 1
        speed: 1.125,
        tags: [UnitTag.Infantry, UnitTag.Ranged, UnitTag.Light],
        label: '弩手', lane: 1, widthScale: 0.5, attackType: 'ranged', attackSpeed: 2.125,
        visual: { type: 'emoji', value: '☦️' }, // 机械臂代表弩? 或者用 🏹
        // === 对 Heavy 单位 +10 ===
        bonusAttack: (tags: UnitTag[]) => {
            if (tags.includes(UnitTag.Heavy)) return 10;
            return 0;
        },
        bonusDesc: "+10 vs 重装单位"
    },
    [UnitType.Horseman]: {
        cost: { food: 100, wood: 20 },
        time: 230, // 23s * 10
        hp: 125, damage: 9, def_m: 0, def_r: 2,
        range: 3.75, speed: 1.875,
        tags: [UnitTag.Cavalry, UnitTag.Melee, UnitTag.Light],
        label: '骑手', lane: 2, attackType: 'melee', attackSpeed: 1.75, canMoveAttack: true,
        widthScale: 1.5,
        visual: { type: 'emoji', value: '🐎' },
        // === 新增：对远程单位造成 +9 伤害 ===
        bonusAttack: (tags: UnitTag[]) => {
            if (tags.includes(UnitTag.Ranged)) return 9;
            if (tags.includes(UnitTag.Siege)) return 9;
            return 0;
        },
        bonusDesc: "+9 vs 远程单位， +9 vs 攻城单位"
    },
    [UnitType.Knight]: {
        cost: { food: 140, gold: 100 }, time: 350, // 35s * 10
        hp: 230, damage: 24, def_m: 4, def_r: 4,
        range: 3.75, speed: 1.625,
        tags: [UnitTag.Cavalry, UnitTag.Melee, UnitTag.Heavy],
        label: '骑士', lane: 2, attackType: 'melee', attackSpeed: 1.5, canMoveAttack: true,
        widthScale: 1.5,
        visual: { type: 'emoji', value: '🦁' }
    },
    [UnitType.Mangonel]: {
        cost: { wood: 400, gold: 200 }, time: 400,
        hp: 130, damage: 40, def_m: 0, def_r: 0,
        range: 12, speed: 0.75,
        tags: [UnitTag.Siege],
        label: '轻型投石机', lane: 3, attackType: 'ranged', attackSpeed: 6.875,
        widthScale: 1.8,
        visual: { type: 'emoji', value: '🛞' },
        aoeRadius: 1.6,
        aoeDamage: 40,
        bonusBaseDamage: 240,
        projectileFlightTime: 2.7 // 炮弹飞行2.7逻辑秒（基于tick=100ms，实际时间取决于难度）
    }
};

export const BUILDING_CONFIG: Record<string, { cost: Cost, time: number, label: string, icon: string, pop?: number, desc: string }> = {
    'house': { cost: { wood: 50 }, time: 150, label: '房屋', icon: '🏠', pop: 10, desc: '提供人口上限' },
    'barracks': { cost: { wood: 150 }, time: 300, label: '兵营', icon: '⚔️', desc: '训练步兵单位' },
    'archery_range': { cost: { wood: 150 }, time: 300, label: '靶场', icon: '🏹', desc: '训练远程单位' },
    'stable': { cost: { wood: 150 }, time: 300, label: '马厩', icon: '🐎', desc: '训练骑兵单位' }, // 30s * 10
    'towncenter': { cost: { wood: 400, stone: 350 }, time: 1200, label: '城镇中心', icon: '🏛️', pop: 10, desc: '村民生产建筑' },
    'blacksmith': { cost: { wood: 150 }, time: 250, label: '铁匠铺', icon: '⚒️', desc: '升级攻击与防御科技' },
    'siege_workshop': { cost: { wood: 250 }, time: 450, label: '工程武器厂', icon: '🏚️', desc: '生产攻城武器' }
};