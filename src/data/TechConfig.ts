import { Cost } from "../core/Types";

export interface TechStats {
    cost: Cost;
    time: number;
    label: string;
    icon: string;
    description: string;
    effect?: (faction: any) => void;
    level?: number; // 增加 level 字段方便调试
    type?: string;  // 增加 type 字段对应 atk_m 等
}

export const TECH_CONFIG: Record<string, TechStats> = {
    // 近战攻击 I, II, III
    'tech_atk_m_1': { cost: { food: 50, gold: 125 }, time: 600, label: '近战攻击 I', icon: '⚔️', level: 1, type: 'atk_m', description: '近战单位攻击 +1' },
    'tech_atk_m_2': { cost: { food: 100, gold: 250 }, time: 600, label: '近战攻击 II', icon: '⚔️', level: 2, type: 'atk_m', description: '近战单位攻击 +1' },
    'tech_atk_m_3': { cost: { food: 150, gold: 300 }, time: 600, label: '近战攻击 III', icon: '⚔️', level: 3, type: 'atk_m', description: '近战单位攻击 +1' },

    // 近战防御 I, II, III
    'tech_def_m_1': { cost: { food: 50, gold: 125 }, time: 600, label: '近战防御 I', icon: '🛡️', level: 1, type: 'def_m', description: '近战单位防御 +1' },
    'tech_def_m_2': { cost: { food: 100, gold: 250 }, time: 600, label: '近战防御 II', icon: '🛡️', level: 2, type: 'def_m', description: '近战单位防御 +1' },
    'tech_def_m_3': { cost: { food: 150, gold: 300 }, time: 600, label: '近战防御 III', icon: '🛡️', level: 3, type: 'def_m', description: '近战单位防御 +1' },

    // 远程攻击 I, II, III
    'tech_atk_r_1': { cost: { wood: 50, gold: 125 }, time: 600, label: '远程攻击 I', icon: '🏹', level: 1, type: 'atk_r', description: '远程单位攻击 +1' },
    'tech_atk_r_2': { cost: { wood: 100, gold: 250 }, time: 600, label: '远程攻击 II', icon: '🏹', level: 2, type: 'atk_r', description: '远程单位攻击 +1' },
    'tech_atk_r_3': { cost: { wood: 150, gold: 300 }, time: 600, label: '远程攻击 III', icon: '🏹', level: 3, type: 'atk_r', description: '远程单位攻击 +1' },

    // 远程防御 I, II, III
    'tech_def_r_1': { cost: { wood: 50, gold: 125 }, time: 600, label: '远程防御 I', icon: '🎯', level: 1, type: 'def_r', description: '远程单位防御 +1' },
    'tech_def_r_2': { cost: { wood: 100, gold: 250 }, time: 600, label: '远程防御 II', icon: '🎯', level: 2, type: 'def_r', description: '远程单位防御 +1' },
    'tech_def_r_3': { cost: { wood: 150, gold: 300 }, time: 600, label: '远程防御 III', icon: '🎯', level: 3, type: 'def_r', description: '远程单位防御 +1' }
};