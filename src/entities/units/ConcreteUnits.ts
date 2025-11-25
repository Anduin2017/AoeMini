import { Unit } from "./Unit";
import { UnitType, FactionType, UnitTag } from "../../core/Types";
import { UNIT_CONFIG } from "../../data/UnitConfig";
import { CONSTANTS } from "../../core/Constants";

export class Worker extends Unit {
    constructor(id: number, owner: FactionType, pos: number) {
        super(id, UnitType.Worker, owner, pos);
        this.applyConfig(UNIT_CONFIG[UnitType.Worker]);
    }
}

export class Spearman extends Unit {
    constructor(id: number, owner: FactionType, pos: number) {
        super(id, UnitType.Spearman, owner, pos);
        this.applyConfig(UNIT_CONFIG[UnitType.Spearman]);
    }

    // 核心：克制逻辑
    public getBonusDamage(targetTags: UnitTag[]): number {
        // 示例：长枪兵克制骑兵 (虽然现在还没有马，但逻辑已就绪)
        if (targetTags.includes(UnitTag.Cavalry)) {
            return 8; // 对骑兵 +8 攻击
        }
        return 0;
    }
}

export class ManAtArms extends Unit {
    constructor(id: number, owner: FactionType, pos: number) {
        super(id, UnitType.ManAtArms, owner, pos);
        this.applyConfig(UNIT_CONFIG[UnitType.ManAtArms]);
    }
}

export class Longbowman extends Unit {
    constructor(id: number, owner: FactionType, pos: number) {
        super(id, UnitType.Longbowman, owner, pos);
        this.applyConfig(UNIT_CONFIG[UnitType.Longbowman]);
    }
}

export class Crossbowman extends Unit {
    constructor(id: number, owner: FactionType, pos: number) {
        super(id, UnitType.Crossbowman, owner, pos);
        this.applyConfig(UNIT_CONFIG[UnitType.Crossbowman]);
    }
}

export class Horseman extends Unit {
    constructor(id: number, owner: FactionType, pos: number) {
        super(id, UnitType.Horseman, owner, pos);
        this.applyConfig(UNIT_CONFIG[UnitType.Horseman]);
    }
}

export class Knight extends Unit {
    constructor(id: number, owner: FactionType, pos: number) {
        super(id, UnitType.Knight, owner, pos);
        this.applyConfig(UNIT_CONFIG[UnitType.Knight]);
    }
}
