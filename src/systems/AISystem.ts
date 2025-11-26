import { Game } from "../core/Game";
import { UnitType, BuildingType, ResourceType } from "../core/Types";
import { UNIT_CONFIG, BUILDING_CONFIG } from "../data/UnitConfig";
import { TECH_CONFIG } from "../data/TechConfig";
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
        } else {
            this.game.enemyStance = stance;
        }

        // === 3. 核心决策逻辑 ===

        // 3.0 分析局势，决定出什么兵
        const desiredUnit = this.getCounterUnit(opponent.units);

        // 3.1 [优先级 1] 避免卡人口
        if (me.popCap - me.currentPop < 7 && me.popCap < CONSTANTS.MAX_TOTAL_POP) {
            const houseCount = me.constructions.filter((c: any) => c.type === BuildingType.House).length;
            if (houseCount < 2) {
                this.tryBuild(me, BuildingType.House);
            }
        }

        // 3.2 [优先级 2] 持续生产农民
        if (me.totalWorkers < 70) {
            const tcs = me.buildings.filter((b: any) => b.type === BuildingType.TownCenter);
            tcs.forEach((tc: any) => {
                if (tc.queue.length < 2) this.tryQueueUnit(me, tc, UnitType.Worker);
            });
        }

        // 3.3 [优先级 3] 确保产兵建筑队列没满，满了就补建筑
        const prodBuildingType = this.getProductionBuildingFor(desiredUnit);
        if (prodBuildingType) {
            const buildings = me.buildings.filter((b: any) => b.type === prodBuildingType);
            const constructions = me.constructions.filter((c: any) => c.type === prodBuildingType);

            const allFull = buildings.length > 0 && buildings.every((b: any) => b.queue.length >= 5);

            if (allFull || (buildings.length === 0 && constructions.length === 0)) {
                this.tryBuild(me, prodBuildingType);
            }
        }

        // 3.5 [优先级 5] 建造铁匠铺 (如果军队数量 > 8 且没有铁匠铺)
        const hasBlacksmith = me.buildings.some((b: any) => b.type === BuildingType.Blacksmith) ||
            me.constructions.some((c: any) => c.type === BuildingType.Blacksmith);

        if (me.armyCount > 8 && !hasBlacksmith) {
            this.tryBuild(me, BuildingType.Blacksmith);
            return; // 暂停后续生产，攒钱造铁匠铺
        }

        // 3.6 [优先级 6] 铁匠铺升级
        const blacksmith = me.buildings.find((b: any) => b.type === BuildingType.Blacksmith);
        if (blacksmith && blacksmith.queue.length === 0) {
            // 检查是否还有可升级的科技
            const hasAvailableTech = ['atk_m', 'def_m', 'atk_r', 'def_r'].some(type => me.techLevels[type] < 3);

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

    // === 核心算法：克制分析 ===
    private getCounterUnit(playerUnits: any[]): UnitType {
        if (playerUnits.length === 0) return UnitType.Spearman; // 默认出长枪

        // 1. 统计玩家兵种数量
        const counts: Record<string, number> = {};
        playerUnits.forEach(u => {
            counts[u.type] = (counts[u.type] || 0) + 1;
        });

        // 2. 找到最多的兵种
        let maxType: UnitType = UnitType.Worker; // 默认
        let maxCount = -1;

        // 排除农民，只看战斗单位
        Object.keys(counts).forEach(type => {
            if (type !== UnitType.Worker) {
                if (counts[type] > maxCount) {
                    maxCount = counts[type];
                    maxType = type as UnitType;
                }
            }
        });

        if (maxCount === -1) return UnitType.Longbowman; // 只有农民，出长弓骚扰

        // 3. 根据克制关系返回
        switch (maxType) {
            case UnitType.Spearman: return UnitType.ManAtArms; // 长枪 -> 武士/长弓 (武士更优)
            case UnitType.ManAtArms: return UnitType.Crossbowman; // 武士 -> 弩手
            case UnitType.Crossbowman: return UnitType.Horseman; // 弩手 -> 骑手
            case UnitType.Horseman: return UnitType.Spearman; // 骑手 -> 长枪
            case UnitType.Knight: return UnitType.Spearman; // 骑士 -> 长枪
            case UnitType.Longbowman: return UnitType.Knight; // 长弓 -> 骑士
            default: return UnitType.Longbowman;
        }
    }

    private getProductionBuildingFor(uType: UnitType): BuildingType | null {
        switch (uType) {
            case UnitType.Spearman:
            case UnitType.ManAtArms:
                return BuildingType.Barracks;
            case UnitType.Longbowman:
            case UnitType.Crossbowman:
                return BuildingType.ArcheryRange;
            case UnitType.Horseman:
            case UnitType.Knight:
                return BuildingType.Stable;
            default:
                return null;
        }
    }

    private autoBalanceEconomy(ai: any) {
        ai.idleWorkers = ai.totalWorkers;
        ai.workers = { food: 0, wood: 0, gold: 0, stone: 0 };

        const resources = [
            { type: 'food', amount: ai.resources.food },
            { type: 'wood', amount: ai.resources.wood },
            { type: 'gold', amount: ai.resources.gold }
        ];
        resources.sort((a, b) => a.amount - b.amount);

        let targetRes: ResourceType = resources[0].type as ResourceType;
        if (ai.resources.food < 50) targetRes = 'food';

        ai.workers[targetRes] = ai.idleWorkers;
        ai.idleWorkers = 0;
    }

    private tryUpgradeTech(ai: any, blacksmith: Building) {
        // 简单策略：找最便宜的能升的
        let bestTechId: string | null = null;
        let minCost = 99999;

        // 遍历所有可能的科技 (这里简化，假设我们知道 ID 格式)
        // 实际应该遍历 TECH_CONFIG
        const techTypes = ['atk_m', 'def_m', 'atk_r', 'def_r'];

        techTypes.forEach(type => {
            const currentLv = ai.techLevels[type];
            if (currentLv < 3) {
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