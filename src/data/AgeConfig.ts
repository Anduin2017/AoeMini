import { Cost } from "../core/Types";

export interface AgeUpConfig {
    cost: Cost;
    totalWork: number; // 总工作量 (村民·ticks)，2村民 = 600 ticks = 60秒(中等难度)
    label: string;     // 目标时代的名称
    roman: string;     // 目标时代的罗马数字
}

// 时代升级配置：key 是目标时代 (2=升到封建, 3=升到城堡, 4=升到帝国)
export const AGE_UP_CONFIG: Record<number, AgeUpConfig> = {
    2: { cost: { food: 400, gold: 200 },   totalWork: 2880, label: '封建时代', roman: 'II' },
    3: { cost: { food: 1200, gold: 600 },   totalWork: 2880, label: '城堡时代', roman: 'III' },
    4: { cost: { food: 2400, gold: 1200 },  totalWork: 2880, label: '帝国时代', roman: 'IV' }
};

// 各时代的显示信息
export const AGE_LABELS: Record<number, { label: string, roman: string }> = {
    1: { label: '黑暗时代', roman: 'I' },
    2: { label: '封建时代', roman: 'II' },
    3: { label: '城堡时代', roman: 'III' },
    4: { label: '帝国时代', roman: 'IV' }
};

// 铁匠铺科技等级上限 (受时代限制)
export const AGE_MAX_TECH_LEVEL: Record<number, number> = {
    1: 0, // 黑暗时代：不能造铁匠铺，无科技
    2: 1, // 封建时代：最高 Lv.1
    3: 2, // 城堡时代：最高 Lv.2
    4: 3  // 帝国时代：最高 Lv.3
};
