export const CONSTANTS = {
    TICK_RATE: 80,
    MAX_QUEUE_SIZE: 5,
    MAX_TOTAL_POP: 200,

    INITIAL_RES: { food: 200, wood: 200, gold: 100, stone: 0 },

    BASE_HP: 2000,
    INITIAL_POP_CAP: 10,

    MAP_WIDTH_PERCENT: 100,
    UNIT_SIZE_PERCENT: 0.8,

    // === 核心修正：城镇中心的物理定义 ===
    // 城镇中心宽度 8% (比普通单位大10倍)
    BASE_WIDTH: 4,
    // 玩家城镇中心中心点：4% (这样它的左边缘正好贴着 0)
    PLAYER_BASE_POS: 4,
    // 敌人城镇中心中心点：96% (这样它的右边缘正好贴着 100)
    ENEMY_BASE_POS: 96,

    COLORS: {
        PLAYER: '#3b82f6',
        ENEMY: '#ef4444',
        PLAYER_HP: '#22c55e',
        TEXT_FLOAT_DMG: '#fff',
        TEXT_FLOAT_BASE: '#f00'
    },

    // === 轨道配置 ===
    // 定义每个轨道的 Y 轴偏移量 (相对于屏幕中心)
    LANE_CONFIG: {
        0: 40,   // 主路 (步兵): 下方
        1: -40,  // 侧路 (射手): 上方
        2: 0     // 中路 (预留): 中间
    } as Record<number, number>
};