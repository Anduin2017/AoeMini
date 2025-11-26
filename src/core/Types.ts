// === 基础枚举 ===

export enum FactionType {
    Player = 'player',
    Enemy = 'enemy'
}

// 兵种标签系统 (Tags)
export enum UnitTag {
    Infantry = 'INFANTRY',   // 步兵
    Cavalry = 'CAVALRY',     // 骑兵
    Archer = 'ARCHER',       // 射手
    Siege = 'SIEGE',         // 攻城 (预留)

    Melee = 'MELEE',         // 近战
    Ranged = 'RANGED',       // 远程

    Light = 'LIGHT',         // 轻甲
    Heavy = 'HEAVY',         // 重甲

    Worker = 'WORKER'        // 工人
}

// 兵种类型标识符
export enum UnitType {
    Worker = 'worker',
    Spearman = 'spearman',       // 原 Clubman
    ManAtArms = 'man_at_arms',   // 原 Samurai
    Longbowman = 'longbowman',   // 原 Longbowman
    Crossbowman = 'crossbowman', // 弩手
    Horseman = 'Horseman',             // 骑手 (Rider)
    Knight = 'knight',           // 骑士
    Mangonel = 'mangonel'        // 轻型投石机
}

// 建筑类型标识符
export enum BuildingType {
    TownCenter = 'towncenter',
    House = 'house',
    Barracks = 'barracks',
    ArcheryRange = 'archery_range',
    Stable = 'stable',
    SiegeWorkshop = 'siege_workshop',
    Blacksmith = 'blacksmith'
}

// 资源类型
export type ResourceType = 'food' | 'wood' | 'gold' | 'stone';

// 战术姿态
export type StanceType = 'retreat' | 'defend' | 'hold' | 'attack' | 'advance';

// === 接口定义 ===

export interface Cost {
    food?: number;
    wood?: number;
    gold?: number;
    stone?: number;
}

// 科技升级相关 Key
export type TechTypeKey = 'atk_m' | 'def_m' | 'atk_r' | 'def_r';

// 实体通用接口
export interface EntityData {
    id: number | string;
    type: string;
    owner: FactionType;
    pos: number; // 0-100
}

// 用于 UI 交互的数据传输对象
export interface QueueItem {
    type: string; // UnitType | TechID
    ticksLeft: number;
    totalTicks: number;
}

// === 新增：投射物接口 ===
export interface Projectile {
    // 贝塞尔曲线的三个控制点 (像素坐标)
    p0: { x: number, y: number }; // 起点
    p1: { x: number, y: number }; // 控制点（顶峰）
    p2: { x: number, y: number }; // 终点

    progress: number; // 当前进度 0.0 ~ 1.0
    speed: number;    // 飞行速度
    color: string;    // 箭矢颜色
    trailLength: number; // 拖尾长度 (0.0 ~ 0.1)
}