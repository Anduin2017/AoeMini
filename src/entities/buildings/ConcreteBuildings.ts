import { Building, MenuOption } from "./Building";
import { BuildingType, FactionType, UnitType } from "../../core/Types";
import { UNIT_CONFIG, BUILDING_CONFIG } from "../../data/UnitConfig";
import { TECH_CONFIG } from "../../data/TechConfig";

export class House extends Building {
    constructor(id: number | string, owner: FactionType) {
        super(id, BuildingType.House, owner);
    }
    // House has no menu options
}

export class Barracks extends Building {
    constructor(id: number | string, owner: FactionType) {
        super(id, BuildingType.Barracks, owner);
    }

    public getMenuOptions(factionData: any): MenuOption[] {
        return [
            this.createUnitOption(UnitType.Spearman),
            this.createUnitOption(UnitType.ManAtArms)
        ];
    }

    private createUnitOption(type: string): MenuOption {
        const conf = UNIT_CONFIG[type];
        return {
            id: type,
            icon: '⚔️', // 简化，实际可以用 conf.icon (如果加了的话)
            label: conf.label,
            cost: conf.cost,
            time: conf.time,
            type: 'unit'
        };
    }
}

export class ArcheryRange extends Building {
    constructor(id: number | string, owner: FactionType) {
        super(id, BuildingType.ArcheryRange, owner);
    }

    public getMenuOptions(factionData: any): MenuOption[] {
        return [
            this.createUnitOption(UnitType.Longbowman)
        ];
    }

    private createUnitOption(type: string): MenuOption {
        const conf = UNIT_CONFIG[type];
        return {
            id: type,
            icon: '🏹',
            label: conf.label,
            cost: conf.cost,
            time: conf.time,
            type: 'unit'
        };
    }
}

export class Stable extends Building {
    constructor(id: number | string, owner: FactionType) {
        super(id, BuildingType.Stable, owner);
    }

    public getMenuOptions(factionData: any): MenuOption[] {
        return [
            this.createUnitOption(UnitType.Horseman),
            this.createUnitOption(UnitType.Knight)
        ];
    }

    private createUnitOption(type: string): MenuOption {
        const conf = UNIT_CONFIG[type];
        return {
            id: type,
            icon: '🐎',
            label: conf.label,
            cost: conf.cost,
            time: conf.time,
            type: 'unit'
        };
    }
}

export class TownCenter extends Building {
    constructor(id: number | string, owner: FactionType) {
        super(id, BuildingType.TownCenter, owner);
    }

    public getMenuOptions(factionData: any): MenuOption[] {
        return [
            this.createUnitOption(UnitType.Worker)
        ];
    }

    private createUnitOption(type: string): MenuOption {
        const conf = UNIT_CONFIG[type];
        return {
            id: type,
            icon: '村民',
            label: conf.label,
            cost: conf.cost,
            time: conf.time,
            type: 'unit'
        };
    }
}

export class Blacksmith extends Building {
    constructor(id: number | string, owner: FactionType) {
        super(id, BuildingType.Blacksmith, owner);
    }

    public getMenuOptions(factionData: any): MenuOption[] {
        const options: MenuOption[] = [];

        // 简单的科技树逻辑
        this.addTechOption(options, factionData, 'atk_m', '近战攻击');
        this.addTechOption(options, factionData, 'def_m', '近战防御');
        this.addTechOption(options, factionData, 'atk_r', '远程攻击');
        this.addTechOption(options, factionData, 'def_r', '远程防御');

        return options;
    }

    private addTechOption(list: MenuOption[], f: any, type: string, labelBase: string) {
        const currentLevel = f.techLevels[type] || 0;
        const nextLevel = currentLevel + 1;
        const techId = `tech_${type}_${nextLevel}`;
        const conf = TECH_CONFIG[techId];

        if (conf) {
            list.push({
                id: techId,
                icon: '⚡',
                label: `${labelBase} Lv.${nextLevel}`,
                cost: conf.cost,
                time: conf.time,
                type: 'tech',
                desc: conf.description
            });
        }
    }
}