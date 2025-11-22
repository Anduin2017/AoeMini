import { EntityData, FactionType } from "../core/Types";

export abstract class Entity implements EntityData {
    public id: number | string;
    public type: string;
    public owner: FactionType;
    public pos: number; // 0-100 (百分比位置)
    public width: number = 0; // 碰撞体积宽度
    public hp: number = 0;
    public maxHp: number = 0;

    constructor(id: number | string, type: string, owner: FactionType, pos: number) {
        this.id = id;
        this.type = type;
        this.owner = owner;
        this.pos = pos;
    }

    // 简单的存活检查
    public get isAlive(): boolean {
        return this.hp > 0;
    }
}