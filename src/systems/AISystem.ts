import { Game } from "../core/Game";
import { UnitType, BuildingType, ResourceType, UnitTag } from "../core/Types";
import { UNIT_CONFIG, BUILDING_CONFIG } from "../data/UnitConfig";
import { TECH_CONFIG } from "../data/TechConfig";
import { AGE_UP_CONFIG, AGE_MAX_TECH_LEVEL } from "../data/AgeConfig";
import { Building } from "../entities/buildings/Building";
import { CONSTANTS } from "../core/Constants";

export class AISystem {
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    public update() {
        // 降低 AI 思考频率，每 10 帧思考一次
        if (this.game.tickCount % 10 !== 0) return;

        // 让 AI 控制双方
        // 让 AI 控制双方
        this.runAI(this.game.enemy, this.game.player, false);

        if (this.game.isAIControllingPlayer) {
            this.runAI(this.game.player, this.game.enemy, true);
        }
    }

    private runAI(me: any, opponent: any, isPlayer: boolean) {
        // === 1. 经济自动平衡 ===
        this.autoBalanceEconomy(me);

        // === 2. 战术姿态 ===
        let stance: any = 'defend';

        // 2.1 防止生产阻塞 (Anti-Jam)
        // 如果有单位即将造好 (ticksLeft <= 0.2)，强制进攻以腾出出生点空间
        let isJammed = false;
        me.buildings.forEach((b: any) => {
            if (b.queue.length > 0 && b.queue[0].ticksLeft <= 0.2) isJammed = true;
        });

        // 2.2 基地防御 (Base Defense)
        // 如果基地的二倍射程内 (15 * 2 = 30) 有对方单位，不顾一切进攻
        const basePos = isPlayer ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;
        const threatRange = 16;
        const hasThreat = opponent.units.some((u: any) => Math.abs(u.pos - basePos) <= threatRange);

        if (isJammed || hasThreat) {
            stance = 'attack';
        } else {
            // 2.3 正常战术判断
            if (me.armyCount > opponent.armyCount * 1.2 || me.armyCount > 20) {
                stance = 'attack';
            } else {
                stance = 'defend';
            }
        }

        if (isPlayer) {
            this.game.playerStance = stance;
            // 同步 Lane Stances
            this.game.laneStances[0] = stance;
            this.game.laneStances[1] = stance;
            this.game.laneStances[2] = stance;
            this.game.laneStances[3] = stance;
        } else {
            this.game.enemyStance = stance;
        }

        // === 3. 核心决策逻辑 ===

        // 3.0 分析局势，决定出什么兵
        const desiredUnit = this.getCounterUnit(me, opponent.units);

        // 3.1 [优先级 1] 避免卡人口
        if (me.popCap - me.currentPop < 7 && me.popCap < CONSTANTS.MAX_TOTAL_POP) {
            const houseCount = me.constructions.filter((c: any) => c.type === BuildingType.House).length;
            if (houseCount < 2) {
                this.tryBuild(me, BuildingType.House);
            }
        }

        // 3.1.5 [优先级 1.5] 时代升级 (Age Up) — 必须在生产农民/军队之前，否则资源被花光
        this.maintainAgeWorkers(me);
        const savingForAge = this.tryAgeUp(me);
        // 如果正在攒钱上本且还没开始，暂停后续所有生产（保留资源）
        if (savingForAge) return;

        // 3.2 [优先级 2] 持续生产农民
        // @ts-ignore
        const diffConfig = CONSTANTS.DIFFICULTY_LEVELS[this.game.difficultyKey] || CONSTANTS.DIFFICULTY_LEVELS.MEDIUM;
        const maxWorkers = (diffConfig as any).maxWorkers || 50;

        if (me.totalWorkers < maxWorkers) {
            const tcs = me.buildings.filter((b: any) => b.type === BuildingType.TownCenter);
            tcs.forEach((tc: any) => {
                if (tc.queue.length < 2) this.tryQueueUnit(me, tc, UnitType.Worker);
            });
        }

        // 3.2.5 [优先级 2.5] 解锁采金场 (仅限黄金，永远不解锁石头)
        if (!me.miningUnlocked.gold && !me.miningUnlockQueue) {
            if (me.resources.wood >= CONSTANTS.MINING_CAMP_COST.wood) {
                me.resources.wood -= CONSTANTS.MINING_CAMP_COST.wood;
                me.miningUnlockQueue = {
                    type: 'gold' as const,
                    ticksLeft: CONSTANTS.MINING_CAMP_TICKS,
                    totalTicks: CONSTANTS.MINING_CAMP_TICKS
                };
                console.log('[AI] Starting gold mining camp construction');
            }
        }

        // 3.3 [优先级 3] 确保产兵建筑队列没满，满了就补建筑
        const prodBuildingType = this.getProductionBuildingFor(desiredUnit, me);
        if (prodBuildingType) {
            const buildings = me.buildings.filter((b: any) => b.type === prodBuildingType);
            const constructions = me.constructions.filter((c: any) => c.type === prodBuildingType);

            const allFull = buildings.length > 0 && buildings.every((b: any) => b.queue.length >= 5);

            if (allFull || (buildings.length === 0 && constructions.length === 0)) {
                this.tryBuild(me, prodBuildingType);
            }
        }

        // 3.5 [优先级 5] 建造铁匠铺 (如果军队数量 > 8 且没有铁匠铺, 且已到封建时代)
        const hasBlacksmith = me.buildings.some((b: any) => b.type === BuildingType.Blacksmith) ||
            me.constructions.some((c: any) => c.type === BuildingType.Blacksmith);

        if (me.currentAge >= 2 && me.armyCount > 8 && !hasBlacksmith) {
            this.tryBuild(me, BuildingType.Blacksmith);
            return; // 暂停后续生产，攒钱造铁匠铺
        }

        // 3.6 [优先级 6] 铁匠铺升级
        const blacksmith = me.buildings.find((b: any) => b.type === BuildingType.Blacksmith);
        if (blacksmith && blacksmith.queue.length === 0) {
            // 检查是否还有可升级的科技 (受时代科技等级上限限制)
            const maxLevel = AGE_MAX_TECH_LEVEL[me.currentAge] || 0;
            const hasAvailableTech = ['atk_m', 'def_m', 'atk_r', 'def_r'].some(type => me.techLevels[type] < maxLevel);

            if (hasAvailableTech) {
                this.tryUpgradeTech(me, blacksmith);
                return; // 暂停后续生产，攒钱升级铁匠铺
            }
        }

        // 3.7 [优先级 7] 生产对应的兵
        if (prodBuildingType) {
            const buildings = me.buildings.filter((b: any) => b.type === prodBuildingType);
            buildings.forEach((b: any) => {
                if (b.queue.length < 5) {
                    this.tryQueueUnit(me, b, desiredUnit);
                }
            });
        }
    }

    // === AI 配比配置 ===
    private static readonly UNIT_ORDER = [
        UnitType.Spearman,
        UnitType.ManAtArms,
        UnitType.Longbowman,
        UnitType.Crossbowman,
        UnitType.Horseman,
        UnitType.Knight,
        UnitType.Mangonel
    ];

    private static readonly COUNTER_RATIOS: Record<string, number[]> = {
        [UnitType.Spearman]: [2, 4, 4, 2, 1, 1, 1],
        [UnitType.ManAtArms]: [0, 2, 0, 4, 1, 2, 0],
        [UnitType.Longbowman]: [0, 2, 2, 0, 4, 3, 1],
        [UnitType.Crossbowman]: [2, 0, 3, 2, 4, 1, 2],
        [UnitType.Horseman]: [4, 2, 0, 2, 2, 2, 0],
        [UnitType.Knight]: [4, 2, 0, 4, 1, 2, 0],
        [UnitType.Mangonel]: [2, 3, 0, 0, 4, 3, 1]
    };

    // === 核心算法：克制分析 ===
    private getCounterUnit(me: any, opponentUnits: any[]): UnitType {
        // 1. 统计对手兵种数量，找出主力
        const opponentCounts: Record<string, number> = {};
        let maxType: UnitType | null = null;
        let maxCount = -1;

        opponentUnits.forEach((u: any) => {
            if (u.type !== UnitType.Worker) {
                opponentCounts[u.type] = (opponentCounts[u.type] || 0) + 1;
                if (opponentCounts[u.type] > maxCount) {
                    maxCount = opponentCounts[u.type];
                    maxType = u.type as UnitType;
                }
            }
        });

        // 如果对手没有军队，默认针对长枪兵（或者默认出长弓骚扰）
        if (!maxType) {
            // 如果完全没兵，默认按对手是长枪兵来配比（均衡发展），或者直接出长弓
            // 这里为了让 AI 动起来，如果没有敌人，默认假设敌人是长枪兵，进行均衡配比
            maxType = UnitType.Spearman;
        }

        // 2. 获取目标配比
        // 如果 maxType 不在配置表中（比如是新单位），默认用长枪兵的配比
        const targetRatios = AISystem.COUNTER_RATIOS[maxType] || AISystem.COUNTER_RATIOS[UnitType.Spearman];

        // 3. 统计我方当前兵种数量 (包括正在生产的？暂时只算现有的，简化逻辑)
        // 优化：应该包含生产队列中的，否则会瞬间造很多同一种
        const myCounts: Record<string, number> = {};

        // 3.1 统计现有单位
        me.units.forEach((u: any) => {
            myCounts[u.type] = (myCounts[u.type] || 0) + 1;
        });

        // 3.2 统计生产队列中的单位
        me.buildings.forEach((b: any) => {
            b.queue.forEach((item: any) => {
                myCounts[item.type] = (myCounts[item.type] || 0) + 1;
            });
        });

        // 4. 计算最缺少的单位
        // 算法：计算 (当前数量 / 目标比例)，得分最低的即为最缺少的

        // 判定是否进入后期高质量部队阶段
        const minRes = Math.min(me.resources.food, me.resources.wood, me.resources.gold);
        const shouldUpgradeQuality = minRes > 2000 && me.currentPop > 180;

        let bestUnit = shouldUpgradeQuality ? UnitType.ManAtArms : UnitType.Spearman;
        let minScore = Infinity;

        AISystem.UNIT_ORDER.forEach((uType, index) => {
            // 时代限制：跳过当前时代无法生产的单位
            const unitMinAge = UNIT_CONFIG[uType]?.minAge || 1;
            if (unitMinAge > me.currentAge) return;

            // 后期不再生产低质量兵种
            if (shouldUpgradeQuality) {
                if (uType === UnitType.Spearman || uType === UnitType.Longbowman || uType === UnitType.Horseman) {
                    return;
                }
            }

            const ratio = targetRatios[index];
            if (ratio > 0) {
                const count = myCounts[uType] || 0;
                // score = count / ratio
                // 为了避免除以 0 (虽然 ratio > 0)，以及让 0/2 比 0/1 更优先 (需要更多)，
                // 我们可以用 (count) / ratio。
                // 例如：
                // A: count 0, ratio 2 => score 0
                // B: count 0, ratio 1 => score 0
                // 这样无法区分。
                // 改进：score = count / ratio。
                // 如果 count 都是 0，score 都是 0。此时应该优先 ratio 大的。
                // 所以当 score 相等时，取 ratio 大的。

                const score = count / ratio;

                if (score < minScore) {
                    minScore = score;
                    bestUnit = uType;
                } else if (score === minScore) {
                    // 如果得分相同（比如都是 0），优先造比例要求更高的
                    const currentBestIndex = AISystem.UNIT_ORDER.indexOf(bestUnit);
                    const currentBestRatio = targetRatios[currentBestIndex];
                    if (ratio > currentBestRatio) {
                        bestUnit = uType;
                    }
                }
            }
        });

        // Debug: 仅针对敌方 AI 输出日志
        if (me === this.game.enemy) {
            this.debugAI(maxType, targetRatios, myCounts, bestUnit);
        }

        return bestUnit;
    }

    private debugAI(opponentMain: string | null, targetRatios: number[], myCounts: Record<string, number>, decision: string) {
        // 每 50 tick 输出一次 (约 5 秒)
        if (this.game.tickCount % 50 !== 0) return;

        console.groupCollapsed(`[AI Debug] Tick ${this.game.tickCount} | Countering: ${opponentMain || 'None'} | Decision: ${decision}`);

        const data = AISystem.UNIT_ORDER.map((uType, index) => {
            const ratio = targetRatios[index];
            const count = myCounts[uType] || 0;
            const score = ratio > 0 ? (count / ratio).toFixed(2) : 'N/A';
            return {
                'Unit': uType,
                'Target Ratio': ratio,
                'Current Count': count,
                'Score (Count/Ratio)': score
            };
        });

        console.table(data);
        console.groupEnd();
    }

    private getProductionBuildingFor(desiredUnit: UnitType, me: any): BuildingType | null {
        let bType: BuildingType | null = null;
        switch (desiredUnit) {
            case UnitType.Spearman:
            case UnitType.ManAtArms:
                bType = BuildingType.Barracks; break;
            case UnitType.Longbowman:
            case UnitType.Crossbowman:
                bType = BuildingType.ArcheryRange; break;
            case UnitType.Horseman:
            case UnitType.Knight:
                bType = BuildingType.Stable; break;
            case UnitType.Mangonel:
                bType = BuildingType.SiegeWorkshop; break;
            default:
                return null;
        }
        // 时代限制：如果建筑还不能建造，返回 null
        const bConf = BUILDING_CONFIG[bType];
        if (bConf && (bConf.minAge || 1) > me.currentAge) return null;
        return bType;
    }

    // === AI 时代升级逻辑 ===

    /**
     * AI 决定是否开始上本。基于 aiStrategy 和当前时间/时代。
     * 返回 true 表示 AI 正在攒资源准备上本（应暂停其他花钱行为）。
     * - fast_feudal: ASAP升2 → 在tick 7800(~13min)升3 → tick 15000(~25min)升4
     * - fast_castle: ASAP升2 → ASAP升3 → tick 12000(~20min)升4
     * - fast_imperial: ASAP升2 → ASAP升3 → ASAP升4
     */
    private tryAgeUp(me: any): boolean {
        // 已经帝国时代，不需要上本
        if (me.currentAge >= 4) return false;
        // 正在上本中，不需要攒钱（已经扣过了）
        if (me.ageUpProgress) return false;

        const nextAge = me.currentAge + 1;
        const config = AGE_UP_CONFIG[nextAge];
        if (!config) return false;

        // 判断当前策略是否应该启动上本
        if (!this.shouldAgeUp(me, nextAge)) return false;

        // 检查是否买得起
        if (!this.canAfford(me, config.cost)) {
            // 买不起但想上本 → 攒钱，暂停其他花费
            return true;
        }

        // 扣资源，启动上本
        this.payCost(me, config.cost);
        me.ageUpProgress = { remaining: config.totalWork, total: config.totalWork };

        // 分配村民：50% 总村民 (最少 2)
        const assignCount = Math.max(2, Math.floor(me.totalWorkers * 0.5));
        me.ageWorkers = Math.min(assignCount, me.totalWorkers);

        console.log(`[AI] Starting age up to ${nextAge} (${config.label}), assigning ${me.ageWorkers} workers`);
        return false; // 已经开始上本，不需要再攒钱
    }

    /**
     * 根据策略判断 AI 是否应该在当前时刻开始上本
     */
    private shouldAgeUp(me: any, nextAge: number): boolean {
        const strategy = this.game.aiStrategy;
        const tick = this.game.tickCount;

        switch (strategy) {
            case 'fast_feudal':
                // ASAP 升到 2, 然后延迟升 3 和 4
                if (nextAge === 2) return true; // ASAP
                if (nextAge === 3) return tick >= 7800;  // ~13 min
                if (nextAge === 4) return tick >= 15000; // ~25 min
                return false;

            case 'fast_castle':
                // ASAP 升到 2 和 3, 延迟升 4
                if (nextAge === 2) return true; // ASAP
                if (nextAge === 3) return true; // ASAP
                if (nextAge === 4) return tick >= 12000; // ~20 min
                return false;

            case 'fast_imperial':
                // 全部 ASAP
                return true;

            default:
                return false;
        }
    }

    /**
     * 每次 AI 思考时维持上本村民分配 (50% 总村民, 最少 2)
     */
    private maintainAgeWorkers(me: any) {
        if (!me.ageUpProgress) {
            // 不在上本状态，确保 ageWorkers 为 0
            me.ageWorkers = 0;
            return;
        }

        // 重新计算理想的上本村民数
        const targetCount = Math.max(2, Math.floor(me.totalWorkers * 0.5));
        me.ageWorkers = Math.min(targetCount, me.totalWorkers);
    }

    private autoBalanceEconomy(ai: any) {
        // 减去上本工人后再分配
        const availableWorkers = ai.totalWorkers - ai.ageWorkers;
        ai.idleWorkers = availableWorkers;
        ai.workers = { food: 0, wood: 0, gold: 0, stone: 0 };

        // 只考虑已解锁的资源 (food/wood 始终可用, gold/stone 需要采矿场)
        const resources: { type: string, amount: number }[] = [
            { type: 'food', amount: ai.resources.food },
            { type: 'wood', amount: ai.resources.wood }
        ];
        if (ai.miningUnlocked.gold) {
            resources.push({ type: 'gold', amount: ai.resources.gold });
        }
        // AI 永远不解锁石头，所以不加 stone

        resources.sort((a, b) => a.amount - b.amount);

        let targetRes: ResourceType = resources[0].type as ResourceType;
        if (ai.resources.food < 50) targetRes = 'food';

        ai.workers[targetRes] = availableWorkers;
        ai.idleWorkers = 0;
    }

    private tryUpgradeTech(ai: any, blacksmith: Building) {
        // 简单策略：找最便宜的能升的
        let bestTechId: string | null = null;
        let minCost = 99999;

        // 当前时代科技等级上限
        const maxLevel = AGE_MAX_TECH_LEVEL[ai.currentAge] || 0;

        // 遍历所有可能的科技 (这里简化，假设我们知道 ID 格式)
        // 实际应该遍历 TECH_CONFIG
        const techTypes = ['atk_m', 'def_m', 'atk_r', 'def_r'];

        techTypes.forEach(type => {
            const currentLv = ai.techLevels[type];
            if (currentLv < maxLevel) {
                const nextId = `tech_${type}_${currentLv + 1}`;
                const conf = TECH_CONFIG[nextId];
                if (conf) {
                    const totalCost = (conf.cost.food || 0) + (conf.cost.wood || 0) + (conf.cost.gold || 0);
                    if (totalCost < minCost && this.canAfford(ai, conf.cost)) {
                        minCost = totalCost;
                        bestTechId = nextId;
                    }
                }
            }
        });

        if (bestTechId) {
            const conf = TECH_CONFIG[bestTechId];
            this.payCost(ai, conf.cost);
            blacksmith.enqueue({
                type: bestTechId,
                ticksLeft: conf.time,
                totalTicks: conf.time
            });
        }
    }

    // === 基础辅助方法 (保持不变) ===
    private canAfford(f: any, cost: any): boolean {
        return f.resources.food >= (cost.food || 0) &&
            f.resources.wood >= (cost.wood || 0) &&
            f.resources.gold >= (cost.gold || 0) &&
            f.resources.stone >= (cost.stone || 0);
    }

    private payCost(f: any, cost: any) {
        f.resources.food -= (cost.food || 0);
        f.resources.wood -= (cost.wood || 0);
        f.resources.gold -= (cost.gold || 0);
        f.resources.stone -= (cost.stone || 0);
    }

    private tryQueueUnit(f: any, building: Building, uType: string): boolean {
        // 时代限制：不生产当前时代无法解锁的单位
        const unitMinAge = UNIT_CONFIG[uType]?.minAge || 1;
        if (unitMinAge > f.currentAge) return false;

        const cost = UNIT_CONFIG[uType].cost;
        const time = UNIT_CONFIG[uType].time;

        if (this.canAfford(f, cost)) {
            if (uType !== UnitType.Worker && f.currentPop >= f.popCap) return false;

            this.payCost(f, cost);
            building.enqueue({
                type: uType,
                ticksLeft: time,
                totalTicks: time
            });
            return true;
        }
        return false;
    }

    private tryBuild(f: any, bType: string) {
        // 时代限制
        const bConf = BUILDING_CONFIG[bType];
        if (bConf && (bConf.minAge || 1) > f.currentAge) return;

        // 如果已经在造同类建筑，且不是房子，先别急着造第二个(除非是队列满逻辑触发的)
        // 但这里的逻辑是：如果是队列满触发的，说明确实需要。
        // 所以这里只限制：不要同时造两个一样的建筑 (防止瞬间把资源花光造了10个兵营)
        if (f.constructions.some((c: any) => c.type === bType)) return;

        const conf = BUILDING_CONFIG[bType];
        if (this.canAfford(f, conf.cost)) {
            this.payCost(f, conf.cost);
            f.constructions.push({
                id: Math.random(),
                type: bType,
                ticksLeft: conf.time,
                totalTicks: conf.time
            });
        }
    }
}