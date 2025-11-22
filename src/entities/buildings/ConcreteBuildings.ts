import { Building, MenuOption } from "./Building";
import { FactionType, UnitType, BuildingType } from "../../core/Types";
import { UNIT_CONFIG } from "../../data/UnitConfig";
import { TECH_CONFIG } from "../../data/TechConfig";

// === 房屋 ===
export class House extends Building {
    constructor(id: string, owner: FactionType) {
        super(id, BuildingType.House, owner);
    }
    public override get isGroupable() { return true; }
    public override getMenuOptions() { return []; }
}

// src/entities/buildings/ConcreteBuildings.ts 中的 TownCenter 类

// === 基地 ===
export class TownCenter extends Building {
    constructor(id: string, owner: FactionType) {
        super(id, BuildingType.TownCenter, owner);
    }

    public override getMenuOptions(f: any): MenuOption[] {
        const options: MenuOption[] = [];
        
        // 1. 造人 (保留)
        const w = UNIT_CONFIG[UnitType.Worker];
        options.push({
            id: UnitType.Worker, icon: '👷', label: w.label,
            cost: w.cost, time: w.time, type: 'unit', desc: '采集资源'
        });

        // 2. 科技：炮台 (=== 删除此处代码 ===)
        // 既然默认自带，这里就不再 push 任何科技选项了
        
        return options;
    }

    // 这个辅助方法也可以删了，不过留着也没事，反正没人调用它了
    private hasTechInQueue(f:any, techId: string): boolean {
        return f.buildings.some((b: Building) => b.queue.some(q => q.type === techId));
    }
}

// === 兵营 ===
export class Barracks extends Building {
    constructor(id: string, owner: FactionType) {
        super(id, BuildingType.Barracks, owner);
    }

    public override getMenuOptions(): MenuOption[] {
        const units = [UnitType.Spearman, UnitType.ManAtArms];
        return units.map(uType => {
            const u = UNIT_CONFIG[uType];
            return {
                id: uType, icon: '⚔️', label: u.label,
                cost: u.cost, time: u.time, type: 'unit', desc: u.label
            };
        });
    }
}

// === 靶场 ===
export class ArcheryRange extends Building {
    constructor(id: string, owner: FactionType) {
        super(id, BuildingType.ArcheryRange, owner);
    }

    public override getMenuOptions(): MenuOption[] {
        const u = UNIT_CONFIG[UnitType.Longbowman];
        return [{
            id: UnitType.Longbowman, icon: '🏹', label: u.label,
            cost: u.cost, time: u.time, type: 'unit', desc: '远程输出'
        }];
    }
}

// === 补全：铁匠铺 ===
export class Blacksmith extends Building {
    constructor(id: string, owner: FactionType) {
        super(id, BuildingType.Blacksmith, owner);
    }

    public override getMenuOptions(f: any): MenuOption[] {
        const options: MenuOption[] = [];
        // 遍历所有科技，找出攻防相关的
        ['atk_m', 'def_m', 'atk_r', 'def_r'].forEach(type => {
            const currentLvl = f.techLevels[type];
            if (currentLvl < 3) { // 假设最高3级
                const nextLvl = currentLvl + 1;
                const techId = `tech_${type}_${nextLvl}`;
                const tech = TECH_CONFIG[techId];
                
                // 检查是否已经在研发中
                const inQueue = f.buildings.some((b: Building) => b.queue.some(q => q.type === techId));
                
                if (tech && !inQueue) {
                    options.push({
                        id: techId, icon: tech.icon, label: tech.label,
                        cost: tech.cost, time: tech.time, type: 'tech', desc: tech.description
                    });
                }
            }
        });
        return options;
    }
}