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

        const ai = this.game.enemy;
        const player = this.game.player;

        // 1. === 经济自动平衡 (Auto-Balance) ===
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


        // 2. === 战术姿态 (Tactics) ===
        const eUnits = ai.units;
        const pUnits = player.units;
        let enemyFront = 100;
        if (eUnits.length > 0) enemyFront = Math.min(...eUnits.map(u => u.pos));

        let playerFront = 0;
        if (pUnits.length > 0) playerFront = Math.max(...pUnits.map(u => u.pos));

        const distance = enemyFront - playerFront;
        const battleLine = (playerFront + enemyFront) / 2;

        let isJammed = false;
        ai.buildings.forEach(b => {
            if (b.queue.length > 0 && b.queue[0].ticksLeft <= 0.2) isJammed = true;
        });

        if (isJammed) {
            this.game.enemyStance = 'attack';
        } else {
            if (eUnits.length > pUnits.length * 1.2 || eUnits.length > 15) {
                this.game.enemyStance = 'attack';
            } else if (distance < 30 && battleLine > 65) {
                this.game.enemyStance = 'defend';
            } else {
                this.game.enemyStance = 'attack';
            }
        }


        // 3. === 决策树 (Decision Tree) ===

        // [优先级 S] 紧急造房
        if (ai.popCap - ai.currentPop < 3 && ai.popCap < CONSTANTS.MAX_TOTAL_POP) {
            const isBuildingHouse = ai.constructions.some(c => c.type === BuildingType.House);
            if (!isBuildingHouse) {
                this.tryBuild(ai, BuildingType.House);
            }
        }

        // [优先级 A] 憋科技
        let savingForTech = false;
        const blacksmith = ai.buildings.find(b => b.type === BuildingType.Blacksmith);

        if (blacksmith && blacksmith.queue.length === 0) {
            let targetTechId: string | null = null;

            // === 修复核心：补全科技树链条 ===
            // 顺序：近攻 -> 近防 -> 远攻 -> 远防
            if (ai.techLevels.atk_m < 3) targetTechId = `tech_atk_m_${ai.techLevels.atk_m + 1}`;
            else if (ai.techLevels.def_m < 3) targetTechId = `tech_def_m_${ai.techLevels.def_m + 1}`;
            else if (ai.techLevels.atk_r < 3) targetTechId = `tech_atk_r_${ai.techLevels.atk_r + 1}`;
            else if (ai.techLevels.def_r < 3) targetTechId = `tech_def_r_${ai.techLevels.def_r + 1}`;
            // ============================

            if (targetTechId && TECH_CONFIG[targetTechId]) {
                const cost = TECH_CONFIG[targetTechId].cost;
                if (ai.armyCount > 8 || ai.resources.gold > 300) {
                    if (this.canAfford(ai, cost)) {
                        this.payCost(ai, cost);
                        blacksmith.enqueue({
                            type: targetTechId,
                            ticksLeft: TECH_CONFIG[targetTechId].time,
                            totalTicks: TECH_CONFIG[targetTechId].time
                        });
                    } else {
                        savingForTech = true;
                    }
                }
            }
        }

        // [优先级 B] 核心循环：造兵与基建
        if (!savingForTech) {
            // 1. 造农民
            let pendingWorkers = 0;
            ai.buildings.forEach(b => b.queue.forEach(q => { if (q.type === UnitType.Worker) pendingWorkers++; }));

            if (ai.totalWorkers + pendingWorkers < 60) {
                const tcs = ai.buildings.filter(b => b.type === BuildingType.TownCenter);
                tcs.forEach(tc => {
                    if (tc.queue.length < 5) this.tryQueueUnit(ai, tc, UnitType.Worker);
                });
            }

            // 2. 建造军事建筑
            const count = (t: string) => ai.buildings.filter(b => b.type === t).length + ai.constructions.filter(c => c.type === t).length;

            let targetBuilding = null;
            if (count(BuildingType.Barracks) < 1) targetBuilding = BuildingType.Barracks;
            else if (count(BuildingType.ArcheryRange) < 1) targetBuilding = BuildingType.ArcheryRange;
            else if (count(BuildingType.Blacksmith) < 1) targetBuilding = BuildingType.Blacksmith;
            else if (count(BuildingType.Barracks) < 4 && ai.resources.wood > 400) targetBuilding = BuildingType.Barracks;

            if (targetBuilding) {
                this.tryBuild(ai, targetBuilding);
            }

            // 3. 暴兵
            ai.buildings.forEach(b => {
                if (b.queue.length < 5) {
                    if (b.type === BuildingType.Barracks) {
                        const spearCount = ai.units.filter(u => u.type === UnitType.Spearman).length;
                        const manCount = ai.units.filter(u => u.type === UnitType.ManAtArms).length;

                        // 1. 优先尝试出武士 (主力)
                        // 条件：有一定金币，或者武士比例太低 (比如少于长枪的 1/3)
                        let tryManAtArms = false;
                        if (ai.resources.gold >= UNIT_CONFIG[UnitType.ManAtArms].cost.gold!) {
                            tryManAtArms = true;
                        }

                        if (tryManAtArms) {
                            // 尝试造武士，如果成功，return (本建筑本帧操作结束)
                            // 注意：这里需要改造 tryQueueUnit 让它返回 boolean 表示是否成功
                            if (this.tryQueueUnit(ai, b, UnitType.ManAtArms)) return;
                        }

                        // 2. 兜底出长枪 (炮灰)
                        // 条件：武士造不起，或者长枪数量不足 (比如少于 3 个)
                        // 关键修改：如果长枪已经很多了(>10)，且没钱造武士，那就宁愿攒钱，别把食物浪费在长枪上
                        if (spearCount < 3 || (spearCount < 15 && !tryManAtArms)) {
                            this.tryQueueUnit(ai, b, UnitType.Spearman);
                        }
                    } else if (b.type === BuildingType.ArcheryRange) {
                        this.tryQueueUnit(ai, b, UnitType.Longbowman);
                    }
                }
            });
        }
    }

    // === 辅助方法 ===

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

    private tryQueueUnit(f: any, building: Building, uType: string): boolean { // <--- 返回 boolean
        const cost = UNIT_CONFIG[uType].cost;
        const time = UNIT_CONFIG[uType].time;

        if (this.canAfford(f, cost)) {
            if (uType !== UnitType.Worker && f.currentPop >= f.popCap) return false; // <--- 失败

            this.payCost(f, cost);
            building.enqueue({
                type: uType,
                ticksLeft: time,
                totalTicks: time
            });
            return true; // <--- 成功
        }
        return false; // <--- 失败
    }

    private tryBuild(f: any, bType: string) {
        if (bType !== BuildingType.House) {
            if (f.constructions.some((c: any) => c.type === bType)) return;
        } else {
            if (f.constructions.some((c: any) => c.type === BuildingType.House)) return;
        }

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