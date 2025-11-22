import { UnitType, UnitTag, Cost, BuildingType } from "../core/Types";
import { CONSTANTS } from "../core/Constants";

interface UnitStats {
    cost: Cost;
    time: number; // 训练 tick 数
    hp: number;
    damage: number;
    def_m: number;
    def_r: number;
    range: number;
    speed: number; // 像素/10tick
    tags: UnitTag[];
    label: string;
    lane: number; // 0: 主路, 1: 侧路
    widthScale?: number; // 体积缩放
    attackType?: 'melee' | 'ranged';
    cooldown?: number;
}

export const UNIT_CONFIG: Record<string, UnitStats> = {
    [UnitType.Worker]: {
        cost: { food: 50 }, time: 200, hp: 10, damage: 0, def_m: 0, def_r: 0,
        range: 1, speed: 0, tags: [UnitTag.Worker], label: '村民', lane: 0
    },
    [UnitType.Spearman]: { // 原 Clubman -> 长枪兵
        cost: { food: 60, wood: 20 }, time: 150, hp: 90, damage: 8, def_m: 0, def_r: 0,
        range: 5, speed: 1.25, 
        tags: [UnitTag.Infantry, UnitTag.Melee, UnitTag.Light], 
        label: '长枪兵', lane: 0, attackType: 'melee', cooldown: 19
    },
    [UnitType.ManAtArms]: { // 原 Samurai -> 武士
        cost: { food: 100, gold: 20 }, time: 150, hp: 140, damage: 11, def_m: 2, def_r: 3,
        range: 3.75, speed: 1.125,
        tags: [UnitTag.Infantry, UnitTag.Melee, UnitTag.Heavy],
        label: '武士', lane: 0, attackType: 'melee', cooldown: 14
    },
    [UnitType.Longbowman]: { // 长弓兵
        cost: { food: 40, wood: 50 }, time: 150, hp: 70, damage: 6, def_m: 0, def_r: 0,
        range: 11, speed: 1.125,
        tags: [UnitTag.Infantry, UnitTag.Ranged, UnitTag.Light],
        label: '长弓兵', lane: 1, widthScale: 0.5, attackType: 'ranged', cooldown: 16
    }
};

export const BUILDING_CONFIG: Record<string, {cost: Cost, time: number, label: string, icon: string, pop?: number, desc: string}> = {
    'house': { cost: { wood: 50 }, time: 150, label: '房屋', icon: '🏠', pop: 10, desc: '提供 10 人口上限' },
    'barracks': { cost: { wood: 150 }, time: 300, label: '兵营', icon: '⚔️', desc: '训练步兵单位' },
    'archery_range': { cost: { wood: 150 }, time: 300, label: '靶场', icon: '🏹', desc: '训练远程单位' },
    'towncenter': { cost: { wood: 400, stone: 350 }, time: 1200, label: '基地', icon: '🏛️', pop: 10, desc: '资源中心与村民生产' },
    'blacksmith': { cost: { wood: 150 }, time: 250, label: '铁匠铺', icon: '⚒️', desc: '升级攻击与防御科技' }
};