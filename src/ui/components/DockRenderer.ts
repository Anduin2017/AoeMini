import { Game } from "../../core/Game";
import { BuildingType } from "../../core/Types";
import { BUILDING_CONFIG, UNIT_CONFIG } from "../../data/UnitConfig";
import { Building } from "../../entities/buildings/Building";
import { TECH_CONFIG } from "../../data/TechConfig";

export class DockRenderer {
    private game: Game;
    private dockEl: HTMLElement;
    private buildBtn: HTMLElement | null = null;
    public currentSortedItems: any[] = [];

    private static SORT_ORDER: Record<string, number> = {
        [BuildingType.TownCenter]: 1,
        [BuildingType.Barracks]: 2,
        [BuildingType.ArcheryRange]: 3,
        [BuildingType.Stable]: 4,
        [BuildingType.Blacksmith]: 5,
        [BuildingType.House]: 6
    };

    constructor(game: Game) {
        this.game = game;
        this.dockEl = document.getElementById('dock')!;
        this.initStaticDock();
    }

    private initStaticDock() {
        this.dockEl.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'dock-icon build-icon';
        div.id = 'dock-btn-build';
        div.innerHTML = '🔨<div style="position:absolute; bottom:2px; left:4px; font-size:10px; color:rgba(255,255,255,0.7); font-weight:bold; pointer-events:none;">B</div>';
        this.dockEl.appendChild(div);
        this.buildBtn = div;
    }

    public render(activeId: string | null, onClickCallback: (id: string, item: any) => void) {
        const p = this.game.player;
        const dockItems = new Map<string, any>();
        const houses: Building[] = [];

        // 1. 数据收集
        p.buildings.forEach(b => {
            if (b.isGroupable) {
                houses.push(b);
            } else {
                dockItems.set(String(b.id), {
                    id: b.id, type: 'building', entity: b, origin: b,
                    queue: b.queue, isConstruction: false, sortType: b.type
                });
            }
        });

        if (houses.length > 0) {
            dockItems.set('group-house', {
                id: 'group-house', type: 'group', entity: houses,
                icon: '🏠', sortType: BuildingType.House
            });
        }

        p.constructions.forEach(c => {
            dockItems.set(`const-${c.id}`, {
                id: `const-${c.id}`, type: 'construction', entity: c, origin: c,
                isConstruction: true, ticksLeft: c.ticksLeft, totalTicks: c.totalTicks,
                sortType: c.type
            });
        });

        // 2. 逻辑排序
        const sortedItems = Array.from(dockItems.values()).sort((a, b) => {
            const scoreA = DockRenderer.SORT_ORDER[a.sortType] || 99;
            const scoreB = DockRenderer.SORT_ORDER[b.sortType] || 99;
            if (scoreA !== scoreB) return scoreA - scoreB;
            if (a.isConstruction !== b.isConstruction) return a.isConstruction ? 1 : -1;
            return a.id > b.id ? 1 : -1;
        });
        this.currentSortedItems = sortedItems;

        // 3. === 关键优化：先清理 DOM ===
        // 我们先算出这一帧所有合法的 ID 集合
        const validIds = new Set(['dock-btn-build']);
        sortedItems.forEach(item => validIds.add(`dock-item-${item.id}`));

        // 移除不在合法集合里的 DOM 节点 (垃圾回收)
        Array.from(this.dockEl.children).forEach(child => {
            if (!validIds.has(child.id)) this.dockEl.removeChild(child);
        });

        // 4. === 关键优化：Diff & Patch (仅在位置不对时移动) ===
        // 我们遍历排序后的数据，并依次检查 DOM 的对应位置

        let domIndex = 0; // 当前应该在 DOM 中的位置索引

        sortedItems.forEach(item => {
            const domId = `dock-item-${item.id}`;
            let icon = document.getElementById(domId);

            // 如果图标不存在，创建它
            if (!icon) {
                icon = this.createIconDom(domId, item);
                icon.onclick = () => onClickCallback(item.id, item);
                // 新创建的元素，直接插入到当前索引位置
                // 注意：insertBefore(node, null) 等同于 appendChild
                const refNode = this.dockEl.children[domIndex] || null;
                this.dockEl.insertBefore(icon, refNode);
            } else {
                // 如果图标已存在，检查位置是否正确
                const currentChildAtPos = this.dockEl.children[domIndex];

                // 如果当前位置的元素不是我们想要的 icon，说明顺序不对，需要移动
                if (currentChildAtPos !== icon) {
                    this.dockEl.insertBefore(icon, currentChildAtPos || null);
                }
                // 如果相等，说明位置正确，什么都不做！这就保留了 hover 状态！
            }

            // 更新视觉状态 (这个操作开销很小，不影响布局)
            this.updateIconVisuals(icon, item, domIndex + 1);

            if (activeId === item.id) icon.classList.add('active');
            else icon.classList.remove('active');

            domIndex++; // 指向下一个位置
        });

        // 5. 确保 Build 按钮永远在最后
        if (this.buildBtn) {
            // 只有当它不是最后一个子元素时，才移动它
            if (this.dockEl.lastElementChild !== this.buildBtn) {
                this.dockEl.appendChild(this.buildBtn);
            }

            this.buildBtn.onclick = () => onClickCallback('build_menu', { type: 'menu' });
            if (activeId === 'build_menu') this.buildBtn.classList.add('active');
            else this.buildBtn.classList.remove('active');
        }
    }

    private createIconDom(domId: string, item: any): HTMLElement {
        const el = document.createElement('div');
        el.id = domId;
        el.className = 'dock-icon';
        el.innerHTML = `
            <div class="icon-content">${this.getIconEmoji(item)}</div>
            <div class="icon-progress-bg" style="display:none"><div class="icon-progress-fill"></div></div>
            <div class="icon-badge" style="display:none"></div>
            <div class="const-overlay" style="display:none"></div>
            <div class="shortcut-key" style="position:absolute; bottom:2px; left:4px; font-size:10px; color:rgba(255,255,255,0.7); font-weight:bold; pointer-events:none;"></div>
        `;
        return el;
    }

    private getIconEmoji(item: any): string {
        if (item.type === 'group') return item.icon;
        return BUILDING_CONFIG[item.entity.type]?.icon || '?';
    }

    private updateIconVisuals(icon: HTMLElement, item: any, index: number) {
        const bg = icon.querySelector('.icon-progress-bg') as HTMLElement;
        const fill = icon.querySelector('.icon-progress-fill') as HTMLElement;
        const badge = icon.querySelector('.icon-badge') as HTMLElement;
        const overlay = icon.querySelector('.const-overlay') as HTMLElement;
        const shortcut = icon.querySelector('.shortcut-key') as HTMLElement;

        if (shortcut) {
            shortcut.innerText = index <= 9 ? index.toString() : '';
        }

        if (item.type === 'construction') {
            icon.classList.add('constructing');
            bg.style.display = 'block';
            const pct = Math.floor(100 - (item.ticksLeft / item.totalTicks * 100));
            fill.style.width = pct + '%';
            fill.style.backgroundColor = '#eab308';

            if (overlay) {
                overlay.style.display = 'flex';
                overlay.innerText = `${pct}%`;
            }
            badge.style.display = 'none';
            icon.style.pointerEvents = 'none';

        } else {
            icon.style.pointerEvents = 'auto';
            icon.classList.remove('constructing');
            if (overlay) overlay.style.display = 'none';

            if (item.type === 'group') {
                bg.style.display = 'none';
                badge.style.display = 'flex';
                badge.style.backgroundColor = '#f59e0b';
                badge.innerText = item.entity.length.toString();
            } else {
                const b = item.origin as Building;
                if (b.queue.length > 0) {
                    bg.style.display = 'block';
                    const q = b.queue[0];
                    const pct = (100 - (q.ticksLeft / q.totalTicks * 100));
                    fill.style.width = pct + '%';

                    if (q.ticksLeft <= 0.2) fill.style.backgroundColor = '#ef4444';
                    else if (TECH_CONFIG[q.type] || q.type === 'turret_tech') fill.style.backgroundColor = '#22c55e';
                    else fill.style.backgroundColor = '#3b82f6';

                    badge.style.display = 'flex';
                    badge.style.backgroundColor = '#ef4444';
                    badge.innerText = b.queue.length.toString();
                } else {
                    bg.style.display = 'none';
                    badge.style.display = 'none';
                }
            }
        }
    }
}