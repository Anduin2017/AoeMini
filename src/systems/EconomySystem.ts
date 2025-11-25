import { Game } from "../core/Game";
import { FactionType, UnitType, QueueItem, BuildingType, UnitTag } from "../core/Types";
import { UNIT_CONFIG, BUILDING_CONFIG } from "../data/UnitConfig";
import { TECH_CONFIG } from "../data/TechConfig";
import { Worker, Spearman, ManAtArms, Longbowman, Crossbowman, Horseman, Knight } from "../entities/units/ConcreteUnits";
import { Helpers } from "../utils/Helpers";
import { Building } from "../entities/buildings/Building";
import { CONSTANTS } from "../core/Constants";
import { House, TownCenter, Barracks, ArcheryRange, Blacksmith, Stable } from "../entities/buildings/ConcreteBuildings";
import { Unit } from "../entities/units/Unit";

export class EconomySystem {
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    public update() {
        if (this.game.tickCount % 10 === 0) {
            this.gather(this.game.player);
            this.gather(this.game.enemy);
        }
        this.processQueues(this.game.player);
        this.processQueues(this.game.enemy);
        this.processConstructions(this.game.player);
        this.processConstructions(this.game.enemy);
    }

    private gather(f: any) {
        const RATE = 0.6;
        f.resources.food += f.workers.food * RATE;
        f.resources.wood += f.workers.wood * RATE;
        f.resources.gold += f.workers.gold * RATE;
        f.resources.stone += f.workers.stone * RATE;
    }

    private processQueues(f: any) {
        f.buildings.forEach((b: any) => {
            if (b.queue.length > 0) {
                const item = b.queue[0] as QueueItem;

                // 作弊检测
                if (f.type === FactionType.Player && this.game.isInstantBuild) {
                    item.ticksLeft = 0;
                } else {
                    if (item.ticksLeft > 0) item.ticksLeft--;
                }

                if (item.ticksLeft <= 0) {
                    let isBlocked = false;
                    const isUnit = !item.type.startsWith('tech_');

                    // 1. 人口检查
                    if (isUnit && f.type === FactionType.Player) {
                        if (f.currentPop >= f.popCap) isBlocked = true;
                    }

                    // 2. 物理阻塞检查 (分轨道！)
                    if (!isBlocked && isUnit && item.type !== UnitType.Worker) {
                        const spawnPos = f.type === FactionType.Player ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;

                        // === 修复核心：获取目标单位的轨道 ===
                        const uConfig = UNIT_CONFIG[item.type];
                        const targetLane = uConfig ? uConfig.lane : 0;
                        // =================================

                        const checkRadius = 1.0;
                        const allUnits = [...this.game.player.units, ...this.game.enemy.units];

                        // === 修复核心：只检测同一轨道上的碰撞 ===
                        const hasCollision = allUnits.some(u =>
                            u.lane === targetLane && // 关键：轨道必须相同才算阻塞
                            Math.abs(u.pos - spawnPos) < (u.width / 2 + checkRadius / 2)
                        );

                        if (hasCollision) isBlocked = true;
                    }

                    if (isBlocked) {
                        item.ticksLeft = 0.1;
                    } else {
                        this.resolveProduction(f, item.type);
                        b.queue.shift();
                    }
                }
            }
        });
    }

    private resolveProduction(f: any, type: string) {
        if (type.startsWith('tech_')) {
            const tech = TECH_CONFIG[type];
            if (tech && tech.type && tech.level) {
                f.techLevels[tech.type] = tech.level;
                f.units.forEach((u: Unit) => {
                    this.applySingleTechEffect(u, tech.type!, 1);
                });
                if (f.type === FactionType.Player) Helpers.showToast(`${tech.label} 研发完成`, '#8b5cf6');
            }
            return;
        }

        if (type === UnitType.Worker) {
            f.totalWorkers++;
            f.idleWorkers++;
            return;
        }

        const spawnPos = f.type === FactionType.Player ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;

        let u: any;
        const nextId = Game.nextId();

        switch (type) {
            case UnitType.Spearman: u = new Spearman(nextId, f.type, spawnPos); break;
            case UnitType.ManAtArms: u = new ManAtArms(nextId, f.type, spawnPos); break;
            case UnitType.Longbowman: u = new Longbowman(nextId, f.type, spawnPos); break;
            case UnitType.Crossbowman: u = new Crossbowman(nextId, f.type, spawnPos); break;
            case UnitType.Horseman: u = new Horseman(nextId, f.type, spawnPos); break;
            case UnitType.Knight: u = new Knight(nextId, f.type, spawnPos); break;
        }

        if (u) {
            this.applyAllTechsToNewUnit(u, f);
            f.armyCount++;
            f.units.push(u);
        }
    }

    private applySingleTechEffect(u: Unit, techType: string, value: number) {
        const uConfig = UNIT_CONFIG[u.type];
        const attackType = uConfig.attackType || 'melee';

        if (techType === 'atk_m' && attackType === 'melee') u.damage += value;
        if (techType === 'atk_r' && attackType === 'ranged') u.damage += value;
        if (techType === 'def_m') u.def_m += value;
        if (techType === 'def_r') u.def_r += value;
    }

    private applyAllTechsToNewUnit(u: Unit, f: any) {
        if (f.techLevels.atk_m > 0) this.applySingleTechEffect(u, 'atk_m', f.techLevels.atk_m);
        if (f.techLevels.def_m > 0) this.applySingleTechEffect(u, 'def_m', f.techLevels.def_m);
        if (f.techLevels.atk_r > 0) this.applySingleTechEffect(u, 'atk_r', f.techLevels.atk_r);
        if (f.techLevels.def_r > 0) this.applySingleTechEffect(u, 'def_r', f.techLevels.def_r);
    }

    private processConstructions(f: any) {
        const activeConstructions: any[] = [];
        f.constructions.forEach((c: any) => {

            if (f.type === FactionType.Player && this.game.isInstantBuild) {
                c.ticksLeft = 0;
            } else {
                if (c.ticksLeft > 0) c.ticksLeft--;
            }

            if (c.ticksLeft <= 0) {
                let newBuilding: Building;
                switch (c.type) {
                    case BuildingType.House: newBuilding = new House(c.id, f.type); break;
                    case BuildingType.Barracks: newBuilding = new Barracks(c.id, f.type); break;
                    case BuildingType.ArcheryRange: newBuilding = new ArcheryRange(c.id, f.type); break;
                    case BuildingType.TownCenter: newBuilding = new TownCenter(c.id, f.type); break;
                    case BuildingType.Blacksmith: newBuilding = new Blacksmith(c.id, f.type); break;
                    case BuildingType.Stable: newBuilding = new Stable(c.id, f.type); break;
                    default: newBuilding = new Barracks(c.id, f.type); break;
                }

                f.buildings.push(newBuilding);

                const bConfig = BUILDING_CONFIG[c.type];
                if (bConfig && bConfig.pop) {
                    f.popCap += bConfig.pop;
                    if (f.popCap > CONSTANTS.MAX_TOTAL_POP) f.popCap = CONSTANTS.MAX_TOTAL_POP;
                }

                if (f.type === FactionType.Player) {
                    Helpers.showToast(`${bConfig.label} 建造完成`, '#22c55e');
                }

            } else {
                activeConstructions.push(c);
            }
        });

        f.constructions = activeConstructions;
    }
}