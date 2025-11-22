import { Game } from "../../core/Game";
import { BuildingType } from "../../core/Types";
import { BUILDING_CONFIG, UNIT_CONFIG } from "../../data/UnitConfig";
import { TECH_CONFIG } from "../../data/TechConfig";
import { Building } from "../../entities/buildings/Building";
import { House } from "../../entities/buildings/ConcreteBuildings";
import { Helpers } from "../../utils/Helpers";

export class PopoverRenderer {
    private game: Game;
    private container: HTMLElement;

    constructor(game: Game) {
        this.game = game;
        this.container = document.getElementById('popover-container')!;
    }

    public hide() {
        this.container.style.display = 'none';
    }

    public render(activeId: string, triggerElId: string) {
        this.container.style.display = 'flex';
        this.setPosition(triggerElId);

        if (activeId === 'build_menu') {
            this.renderBuildMenu();
        } else if (activeId.startsWith('group')) {
            // 简单处理房屋组
            // 实际项目中可以传入 group data，这里简化直接找
            const houses = this.game.player.buildings.filter(b => b.isGroupable) as House[];
            this.renderGroupMenu(houses);
        } else {
            const b = this.game.player.buildings.find(x => x.id === activeId);
            if (b) this.renderBuildingMenu(b);
        }
        
        this.updateStatus(activeId);
    }

    // === 实时刷新状态 (进度文字、按钮置灰) ===
    public updateStatus(activeId: string) {
        const p = this.game.player;
        
        // 1. 按钮置灰
        this.container.querySelectorAll('.menu-btn').forEach((btn: any) => {
            if (btn.dataset.costWood !== undefined) {
                const cF = parseInt(btn.dataset.costFood || '0');
                const cW = parseInt(btn.dataset.costWood || '0');
                const cG = parseInt(btn.dataset.costGold || '0');
                const cS = parseInt(btn.dataset.costStone || '0');
                
                if (p.resources.food >= cF && p.resources.wood >= cW && p.resources.gold >= cG && p.resources.stone >= cS) {
                    btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
                } else {
                    btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none';
                }
            }
        });

        // 2. 建筑状态文本
        if (activeId !== 'build_menu' && !activeId.startsWith('group')) {
            const b = p.buildings.find(x => x.id === activeId);
            if (b) {
                const statusEl = document.getElementById('popover-status-text');
                if (statusEl) {
                    if (b.queue.length > 0) {
                        const q = b.queue[0];
                        const pct = Math.floor((1 - q.ticksLeft / q.totalTicks) * 100);
                        const isTech = TECH_CONFIG[q.type] || q.type === 'turret_tech';
                        
                        if (q.ticksLeft <= 0.2) {
                            statusEl.innerText = `⚠️ 生产阻塞`; 
                            statusEl.className = 'text-xs text-center mb-2 font-bold text-red-500';
                        } else {
                            statusEl.innerText = `${isTech ? '研发中' : '生产中'} ${pct}%`;
                            statusEl.className = `text-xs text-center mb-2 font-bold ${isTech ? 'text-green-500' : 'text-blue-400'}`;
                        }
                    } else {
                        statusEl.innerText = '空闲';
                        statusEl.className = 'text-xs text-center mb-2 font-bold text-gray-500';
                    }
                }
                const qInfo = document.getElementById('popover-queue-info');
                if (qInfo) qInfo.innerText = `队列: ${b.queue.length} / 5`;
            }
        }
    }

    private setPosition(triggerElId: string) {
        const targetEl = document.getElementById(triggerElId);
        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            this.container.style.left = `${centerX}px`;
        }
    }

    // === 具体菜单内容渲染 ===

    private renderGroupMenu(buildings: House[]) {
        const desc = BUILDING_CONFIG['house'].desc;
        this.container.innerHTML = `
            <div class="popover-title">房屋群 (${buildings.length})</div>
            <div class="p-2 text-sm text-gray-300 text-center">${desc}</div>
            <div class="text-xs text-gray-500 text-center pb-2">总计提供人口: ${buildings.length * 10}</div>
        `;
    }

    private renderBuildMenu() {
        this.container.innerHTML = `<div class="popover-title">建造建筑</div>`;
        
        Object.entries(BUILDING_CONFIG).forEach(([type, conf]) => {
            // === 修复：允许建造基地 (移除了 if type == TownCenter return) ===
            
            const btn = document.createElement('div');
            btn.className = 'menu-btn build-action-btn';
            btn.dataset.costWood = (conf.cost.wood || 0).toString();
            btn.dataset.costStone = (conf.cost.stone || 0).toString();
            
            btn.innerHTML = `
                <span class="btn-icon">${conf.icon}</span>
                <div class="btn-info">
                    <span>${conf.label}</span>
                    <span class="btn-cost text-xs text-gray-400">${conf.desc}</span>
                    <div class="btn-cost mt-1">
                        ${conf.cost.wood ? conf.cost.wood + '木 ' : ''}${conf.cost.stone ? conf.cost.stone + '石' : ''}
                    </div>
                </div>
            `;
            
            btn.onclick = () => {
                const p = this.game.player;
                if (p.resources.wood >= (conf.cost.wood||0) && p.resources.stone >= (conf.cost.stone||0)) {
                    p.resources.wood -= (conf.cost.wood||0);
                    p.resources.stone -= (conf.cost.stone||0);
                    const constId = `const-${Math.floor(Math.random()*100000)}`;
                    p.constructions.push({ id: constId, type: type, ticksLeft: conf.time, totalTicks: conf.time });
                    Helpers.showToast(`${conf.label} 开始建造`, '#3b82f6');
                    // 触发外部关闭 (通过状态同步)
                    // 这里稍微有点耦合，理想是 callback，但暂且依赖 Game 状态
                    // 在 UIManager 里会处理关闭逻辑
                    document.getElementById('game-wrapper')?.click(); // 模拟点击空白关闭
                } else {
                    Helpers.showToast("资源不足");
                }
            };
            this.container.appendChild(btn);
        });
    }

    private renderBuildingMenu(b: Building) {
        const bConfig = BUILDING_CONFIG[b.type];
        const p = this.game.player;
        
        // 状态占位符
        this.container.innerHTML = `
            <div class="popover-title">${bConfig.label}</div>
            <div id="popover-status-text" class="text-xs text-center mb-2 font-bold text-gray-500">空闲</div>
            <div class="text-xs text-gray-400 text-center mb-2">${bConfig.desc}</div>
        `;

        const options = b.getMenuOptions(p);
        
        if (options.length === 0) {
             this.container.innerHTML += `<div class="text-xs text-gray-500 text-center p-2">无可用操作</div>`;
        } else {
            options.forEach(opt => {
                const btn = document.createElement('div');
                btn.className = 'menu-btn produce-action-btn';
                btn.dataset.costFood = (opt.cost.food || 0).toString();
                btn.dataset.costWood = (opt.cost.wood || 0).toString();
                btn.dataset.costGold = (opt.cost.gold || 0).toString();
                btn.dataset.costStone = (opt.cost.stone || 0).toString();

                let costStr = '';
                if (opt.cost.food) costStr += `${opt.cost.food}肉 `;
                if (opt.cost.wood) costStr += `${opt.cost.wood}木 `;
                if (opt.cost.gold) costStr += `${opt.cost.gold}金 `;
                if (opt.cost.stone) costStr += `${opt.cost.stone}石 `;

                btn.innerHTML = `
                    <span class="btn-icon">${opt.icon}</span>
                    <div class="btn-info">
                        <span>${opt.label}</span>
                        <span class="btn-cost">${costStr}</span>
                    </div>
                `;
                
                btn.onclick = () => {
                    if (p.resources.food >= (opt.cost.food||0) && p.resources.wood >= (opt.cost.wood||0) && p.resources.gold >= (opt.cost.gold||0) && p.resources.stone >= (opt.cost.stone||0)) {
                        if (b.enqueue({ type: opt.id, ticksLeft: opt.time, totalTicks: opt.time })) {
                            p.resources.food -= (opt.cost.food||0);
                            p.resources.wood -= (opt.cost.wood||0);
                            p.resources.gold -= (opt.cost.gold||0);
                            p.resources.stone -= (opt.cost.stone||0);
                            
                            // 立即重绘当前菜单以防止重复点击 (如科技)
                            this.renderBuildingMenu(b);
                            this.updateStatus(b.id as string);
                        } else {
                            Helpers.showToast("队列已满");
                        }
                    } else {
                        Helpers.showToast("资源不足");
                    }
                };
                this.container.appendChild(btn);
            });
        }

        const qInfo = document.createElement('div');
        qInfo.id = 'popover-queue-info';
        qInfo.className = 'text-xs text-gray-400 text-center mt-1';
        this.container.appendChild(qInfo);
    }
}