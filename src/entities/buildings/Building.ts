import { Entity } from "../Entity";
import { FactionType, QueueItem, Cost } from "../../core/Types";
import { BUILDING_CONFIG } from "../../data/UnitConfig";

export interface MenuOption {
    id: string; // UnitType or TechId
    icon: string;
    label: string;
    cost: Cost;
    time: number;
    desc?: string; // 额外描述
    type: 'unit' | 'tech';
}

export abstract class Building extends Entity {
    public queue: QueueItem[] = [];
    
    constructor(id: string, type: string, owner: FactionType) {
        super(id, type, owner, owner === FactionType.Player ? 0 : 100);
    }

    public enqueue(item: QueueItem): boolean {
        if (this.queue.length >= 5) return false;
        this.queue.push(item);
        return true;
    }

    // === 新增：自我描述能力 ===

    // 1. 获取当前状态文本 (用于 UI 实时显示)
    public getStatusText(): string {
        if (this.queue.length === 0) return "空闲";
        const current = this.queue[0];
        // 简单的阻塞判断
        if (current.ticksLeft <= 0.5 && current.ticksLeft > 0) return "⚠️ 生产阻塞";
        const pct = Math.floor((1 - current.ticksLeft / current.totalTicks) * 100);
        // 这里其实应该去 Config 查 label，暂时简化
        return `生产中 ${pct}%`; 
    }

    // 2. 获取菜单选项 (核心：子类重写此方法)
    public getMenuOptions(factionData: any): MenuOption[] {
        return [];
    }
    
    // 3. 是否支持分组 (如房屋)
    public get isGroupable(): boolean { return false; }
}