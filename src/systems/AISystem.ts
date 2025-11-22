import { Game } from "../core/Game";
import { FactionType, UnitType, BuildingType, ResourceType } from "../core/Types";
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
        // 降低 AI 思考频率，每 10 帧思考一次，模拟反应延迟，也优化性能
        if (this.game.tickCount % 10 !== 0) return;

        const ai = this.game.enemy;
        const player = this.game.player;

        // 1. === 经济自动平衡 (Auto-Balance) ===
        // 逻辑：统计哪种资源最少，就把所有空闲工人派过去
        // 实际上老逻辑更狠：把所有工人（包括正在干活的）重置，然后重新分配
        // 这里我们采用稍微柔和一点的策略：动态调整 assignments
        
        // 先把所有人都设为闲置（逻辑上），重新分配
        ai.idleWorkers = ai.totalWorkers;
        ai.workers = { food: 0, wood: 0, gold: 0, stone: 0 };

        // 排序资源存量：从小到大
        const resources = [
            { type: 'food', amount: ai.resources.food },
            { type: 'wood', amount: ai.resources.wood },
            { type: 'gold', amount: ai.resources.gold }
            // AI 暂时不采石头，除非我们要它造基地
        ];
        resources.sort((a, b) => a.amount - b.amount);

        // 核心策略：最缺的资源分配 100% 的劳动力 (早期暴力发展)
        // 到了后期可以优化为 5:3:2，但目前复刻老逻辑：All-in 最缺的
        // 如果都很少，优先食物（造人）
        let targetRes: ResourceType = resources[0].type as ResourceType;
        if (ai.resources.food < 50) targetRes = 'food'; 

        ai.workers[targetRes] = ai.idleWorkers;
        ai.idleWorkers = 0;


        // 2. === 战术姿态 (Tactics) ===
        // 计算前线位置
        const eUnits = ai.units;
        const pUnits = player.units;
        let enemyFront = 100; 
        if (eUnits.length > 0) enemyFront = Math.min(...eUnits.map(u => u.pos));
        
        let playerFront = 0; 
        if (pUnits.length > 0) playerFront = Math.max(...pUnits.map(u => u.pos));

        const distance = enemyFront - playerFront;
        const battleLine = (playerFront + enemyFront) / 2;

        // 阻塞检测：如果门口堵了，强制进攻疏通
        let isJammed = false;
        ai.buildings.forEach(b => {
            if (b.queue.length > 0 && b.queue[0].ticksLeft <= 0.2) isJammed = true;
        });

        if (isJammed) {
            this.game.enemyStance = 'attack';
        } else {
            // 兵力优势或者兵线太靠近家里时反击
            if (eUnits.length > pUnits.length * 1.2 || eUnits.length > 15) {
                this.game.enemyStance = 'attack';
            } else if (distance < 30 && battleLine > 65) {
                // 敌人压到家门口了 (65%位置)，防守反击
                this.game.enemyStance = 'defend';
            } else {
                // 默认进攻 (保持压制力)
                this.game.enemyStance = 'attack';
            }
        }


        // 3. === 决策树 (Decision Tree) ===
        // 我们按优先级执行操作。只要钱够，就执行。
        
        // [优先级 S] 紧急造房 (如果人口余量 < 3 且没达到上限)
        if (ai.popCap - ai.currentPop < 3 && ai.popCap < CONSTANTS.MAX_TOTAL_POP) {
            // 检查是否已经在造了
            const isBuildingHouse = ai.constructions.some(c => c.type === BuildingType.House);
            if (!isBuildingHouse) {
                this.tryBuild(ai, BuildingType.House);
            }
        }

        // [优先级 A] 憋科技 (当且仅当：有铁匠铺，且没什么兵线压力，或者非常有钱)
        // 只有当攒够资源时才不再造兵，专心升级
        let savingForTech = false;
        const blacksmith = ai.buildings.find(b => b.type === BuildingType.Blacksmith);
        
        if (blacksmith && blacksmith.queue.length === 0) {
            // 简单策略：按顺序升级。攻 -> 防
            // 查找下一个可升级的科技
            let targetTechId: string | null = null;
            
            // 优先升级攻击
            if (ai.techLevels.atk_m < 3) targetTechId = `tech_atk_m_${ai.techLevels.atk_m + 1}`;
            else if (ai.techLevels.def_m < 3) targetTechId = `tech_def_m_${ai.techLevels.def_m + 1}`;
            
            if (targetTechId && TECH_CONFIG[targetTechId]) {
                const cost = TECH_CONFIG[targetTechId].cost;
                // 此时判断：如果我比较富裕，或者兵力还行，就攒钱
                if (ai.armyCount > 8 || ai.resources.gold > 300) {
                    if (this.canAfford(ai, cost)) {
                        this.payCost(ai, cost);
                        blacksmith.enqueue({ 
                            type: targetTechId, 
                            ticksLeft: TECH_CONFIG[targetTechId].time, 
                            totalTicks: TECH_CONFIG[targetTechId].time 
                        });
                    } else {
                        // 钱不够，但我想升，所以这回合别乱花钱造兵了 (攒钱模式)
                        savingForTech = true;
                    }
                }
            }
        }

        // [优先级 B] 核心循环：造兵与基建
        if (!savingForTech) {
            // 1. 造农民 (最高优先级，直到 60 个)
            // 计算正在造的
            let pendingWorkers = 0;
            ai.buildings.forEach(b => b.queue.forEach(q => { if (q.type === UnitType.Worker) pendingWorkers++; }));
            
            if (ai.totalWorkers + pendingWorkers < 60) {
                const tcs = ai.buildings.filter(b => b.type === BuildingType.TownCenter);
                tcs.forEach(tc => {
                    if (tc.queue.length < 5) this.tryQueueUnit(ai, tc, UnitType.Worker);
                });
            }

            // 2. 建造军事建筑 (按固定顺序)
            // 顺序：兵营 -> 靶场 -> 铁匠铺 -> 兵营xN
            const count = (t: string) => ai.buildings.filter(b => b.type === t).length + ai.constructions.filter(c => c.type === t).length;
            
            let targetBuilding = null;
            if (count(BuildingType.Barracks) < 1) targetBuilding = BuildingType.Barracks;
            else if (count(BuildingType.ArcheryRange) < 1) targetBuilding = BuildingType.ArcheryRange;
            else if (count(BuildingType.Blacksmith) < 1) targetBuilding = BuildingType.Blacksmith;
            else if (count(BuildingType.Barracks) < 4 && ai.resources.wood > 400) targetBuilding = BuildingType.Barracks; // 有钱就补兵营

            if (targetBuilding) {
                this.tryBuild(ai, targetBuilding);
            }

            // 3. 暴兵 (混合部队)
            // 策略：如果有大量木头，出长弓；如果有大量食物/金子，出武士；否则出长枪
            ai.buildings.forEach(b => {
                if (b.queue.length < 5) {
                    if (b.type === BuildingType.Barracks) {
                        // 只有当有一定数量肉盾(长枪)后，才出武士，或者如果不缺金子
                        const spearCount = ai.units.filter(u => u.type === UnitType.Spearman).length;
                        if (spearCount > 5 && ai.resources.gold > 50) {
                            this.tryQueueUnit(ai, b, UnitType.ManAtArms);
                        } else {
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

    private tryQueueUnit(f: any, building: Building, uType: string) {
        const cost = UNIT_CONFIG[uType].cost;
        const time = UNIT_CONFIG[uType].time;
        
        if (this.canAfford(f, cost)) {
            // 检查人口
            if (uType !== UnitType.Worker && f.currentPop >= f.popCap) return;

            this.payCost(f, cost);
            building.enqueue({
                type: uType,
                ticksLeft: time,
                totalTicks: time
            });
        }
    }

    private tryBuild(f: any, bType: string) {
        // 检查是否已经有一个正在建造同类型的 (避免 AI 一口气点下 10 个兵营)
        // 对于房屋除外，房屋可以多造
        if (bType !== BuildingType.House) {
            if (f.constructions.some((c: any) => c.type === bType)) return;
        } else {
            // 房屋限制一次造一个
            if (f.constructions.some((c: any) => c.type === BuildingType.House)) return;
        }

        const conf = BUILDING_CONFIG[bType];
        if (this.canAfford(f, conf.cost)) {
            this.payCost(f, conf.cost);
            f.constructions.push({
                id: Math.random(), // AI 的 ID 随意
                type: bType,
                ticksLeft: conf.time,
                totalTicks: conf.time
            });
        }
    }
}