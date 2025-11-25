import { Game } from "../core/Game";
import { ResourceType, FactionType, UnitType } from "../core/Types";
import { UNIT_CONFIG, BUILDING_CONFIG } from "../data/UnitConfig";
import { Helpers } from "../utils/Helpers";
import { CONSTANTS } from "../core/Constants";
// 引入组件
import { DockRenderer } from "./components/DockRenderer";
import { PopoverRenderer } from "./components/PopoverRenderer";

export class UIManager {
    private game: Game;
    private dockRenderer: DockRenderer;
    private popoverRenderer: PopoverRenderer;

    private activePopoverId: string | null = null;
    private lastTechState: string = '';

    constructor(game: Game) {
        this.game = game;
        this.dockRenderer = new DockRenderer(game);
        this.popoverRenderer = new PopoverRenderer(game);

        this.setupListeners();
        this.setupTooltipListeners();
    }

    private setupListeners() {
        // 注册所有 5 个模式的点击事件
        ['retreat', 'defend', 'hold', 'attack', 'advance'].forEach(s => {
            const btn = document.getElementById(`btn-stance-${s}`);
            if (btn) {
                btn.onclick = () => {
                    this.game.playerStance = s as any;
                    // 同时更新所有 Lane 的姿态
                    this.game.laneStances[0] = s as any;
                    this.game.laneStances[1] = s as any;
                    this.game.laneStances[2] = s as any;
                    this.updateStanceUI();
                };
            }
        });

        // === 新增：Lane Toggle 逻辑 ===
        const toggleBtn = document.getElementById('btn-lane-toggle');
        const laneControls = document.getElementById('lane-controls');
        if (toggleBtn && laneControls) {
            toggleBtn.onclick = (e) => {
                e.stopPropagation(); // 防止冒泡触发 document click
                laneControls.classList.toggle('hidden');
            };
        }

        // === 新增：Lane Button 逻辑 (Refactored) ===
        const laneBtns = document.querySelectorAll('.lane-btn');
        laneBtns.forEach((btn: any) => {
            btn.onclick = () => {
                const lane = parseInt(btn.dataset.lane);
                const stance = btn.dataset.stance;
                this.game.laneStances[lane] = stance;
                this.checkGlobalStance();
            };
        });

        // 资源
        const bindRes = (r: ResourceType) => {
            const addBtn = document.getElementById(`add-${r}`);
            const subBtn = document.getElementById(`sub-${r}`);
            if (addBtn) addBtn.onclick = () => this.modWork(r, 1);
            if (subBtn) subBtn.onclick = () => this.modWork(r, -1);
        };
        (['food', 'wood', 'gold', 'stone'] as ResourceType[]).forEach(bindRes);

        // 全局点击关闭
        document.getElementById('game-wrapper')!.addEventListener('click', (e: any) => {
            // 如果点击的不是dock图标也不是菜单内部，就关闭
            if (!e.target.closest('.dock-icon') && !e.target.closest('.popover-menu')) {
                this.closePopover();
            }
            // === 新增：点击外部关闭 Lane Controls ===
            if (laneControls && !laneControls.classList.contains('hidden') && !e.target.closest('.lane-controls') && !e.target.closest('.lane-toggle-btn')) {
                laneControls.classList.add('hidden');
            }
        });
    }

    private setupTooltipListeners() {
        // ... (这里保持原有的 Tooltip 逻辑，为了节省篇幅，请直接保留 Phase 4.4 的代码) ...
        // 你可以把之前 UIManager 中的 setupTooltipListeners 和 handleTooltip 完整复制过来
        // 它们没有变动。
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        canvas.addEventListener('mousemove', (e: any) => this.handleTooltip(e));
        canvas.addEventListener('mouseleave', () => {
            const tt = document.getElementById('unit-tooltip');
            if (tt) tt.style.display = 'none';
        });
    }

    private handleTooltip(e: MouseEvent) {
        if (this.game.gameOver) return;

        const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const w = canvas.width;
        const h = canvas.height;

        // 1. 查找单位 (保持不变)
        let foundUnit: any = null;
        const allUnits = [...this.game.player.units, ...this.game.enemy.units];
        for (let i = allUnits.length - 1; i >= 0; i--) {
            const u = allUnits[i];
            const unitX = (u.pos / 100) * w;
            const laneOffset = CONSTANTS.LANE_CONFIG[u.lane] || 0;
            const laneY = h / 2 + laneOffset;
            if (Math.abs(mx - unitX) < 15 && Math.abs(my - laneY) < 20) {
                foundUnit = u; break;
            }
        }

        const tt = document.getElementById('unit-tooltip')!;
        if (foundUnit) {
            // ... (单位 Tooltip 逻辑保持不变) ...
            const uData = UNIT_CONFIG[foundUnit.type];
            const isPlayer = foundUnit.owner === FactionType.Player;
            const baseDmg = uData.damage || 0;
            const bonusDmg = foundUnit.damage - baseDmg;
            tt.className = isPlayer ? '' : 'tt-enemy';
            let html = `<div class="tt-header">${uData.label} (${isPlayer ? '我方' : '敌方'})</div>`;
            html += `<div class="tt-row"><span>❤️ 生命:</span> <span>${Math.ceil(foundUnit.hp)}/${foundUnit.maxHp}</span></div>`;
            html += `<div class="tt-row"><span>🗡️ 基础攻击:</span> <span>${baseDmg}</span></div>`;
            if (bonusDmg > 0) html += `<div class="tt-row"><span>🔥 攻击加成:</span> <span class="val-bonus">+${bonusDmg}</span></div>`;

            // === 新增：显示标签 ===
            if (uData.tags && uData.tags.length > 0) {
                const tagStr = uData.tags.map(t => Helpers.translateTag(t)).join(', ');
                html += `<div class="tt-row" style="font-size:10px; color:#94a3b8;">🏷️ ${tagStr}</div>`;
            }

            // === 新增：显示加成描述 ===
            if (uData.bonusDesc) {
                html += `<div class="tt-row" style="font-size:10px; color:#fbbf24;">🌟 ${uData.bonusDesc}</div>`;
            }

            html += `<div class="tt-row"><span>🛡️ 近战防御:</span> <span>${foundUnit.def_m}</span></div>`;
            html += `<div class="tt-row"><span>🎯 远程防御:</span> <span>${foundUnit.def_r}</span></div>`;
            html += `<div class="tt-row"><span>🏹 射程:</span> <span>${foundUnit.range}</span></div>`;
            tt.innerHTML = html;
            tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px'; tt.style.display = 'block';
            return;
        }

        // 2. 查找城镇中心 (=== 修复核心：对齐 Canvas 坐标系 ===)
        let foundBase: any = null;

        // 垂直范围：h/2 - 40 到 h/2 + 40
        const topY = h / 2 - 40;
        const bottomY = h / 2 + 40;

        if (my >= topY && my <= bottomY) {
            const baseW = (CONSTANTS.BASE_WIDTH / 100 * w);

            // 玩家城镇中心检测
            const pCx = (CONSTANTS.PLAYER_BASE_POS / 100) * w;
            if (Math.abs(mx - pCx) < baseW / 2) foundBase = this.game.player;

            // 敌人城镇中心检测
            const eCx = (CONSTANTS.ENEMY_BASE_POS / 100) * w;
            if (Math.abs(mx - eCx) < baseW / 2) foundBase = this.game.enemy;
        }

        if (foundBase) {
            const isPlayer = foundBase.type === FactionType.Player;
            const turretDmg = (UNIT_CONFIG[UnitType.Spearman].damage * 1.5);

            tt.className = isPlayer ? '' : 'tt-enemy';

            let html = `<div class="tt-header">${isPlayer ? '我方' : '敌方'}城镇中心</div>`;
            // 精确显示当前血量
            html += `<div class="tt-row"><span>❤️ 生命:</span> <span>${Math.ceil(foundBase.baseHp)}/${CONSTANTS.BASE_HP}</span></div>`;
            html += `<div class="tt-row"><span>🛡️ 近战防御:</span> <span>2</span></div>`;
            html += `<div class="tt-row"><span>🎯 远程防御:</span> <span>50</span></div>`;
            html += `<div class="tt-row"><span>⚔️ 炮台伤害:</span> <span>${turretDmg}</span></div>`;
            html += `<div class="tt-row"><span>🏹 炮台射程:</span> <span>15</span></div>`;

            tt.innerHTML = html;
            tt.style.left = (e.clientX + 15) + 'px';
            tt.style.top = (e.clientY + 15) + 'px';
            tt.style.display = 'block';
        } else {
            tt.style.display = 'none';
        }
    }

    private modWork(type: ResourceType, change: number) {
        const p = this.game.player;
        if (change > 0) {
            if (p.idleWorkers > 0) { p.idleWorkers--; p.workers[type]++; }
        } else {
            if (p.workers[type] > 0) { p.workers[type]--; p.idleWorkers++; }
        }
    }

    public update() {
        const p = this.game.player;

        // 1. 顶部面板更新
        (['food', 'wood', 'gold', 'stone'] as ResourceType[]).forEach(r => {
            document.getElementById(`res-stock-${r}`)!.innerText = Math.floor(p.resources[r]).toString();
            document.getElementById(`res-workers-${r}`)!.innerText = p.workers[r].toString();

            // 按钮置灰逻辑
            const btnAdd = document.getElementById(`add-${r}`);
            const btnSub = document.getElementById(`sub-${r}`);
            if (btnAdd) { if (p.idleWorkers > 0) btnAdd.classList.remove('disabled'); else btnAdd.classList.add('disabled'); }
            if (btnSub) { if (p.workers[r] > 0) btnSub.classList.remove('disabled'); else btnSub.classList.add('disabled'); }
        });

        const popEl = document.getElementById('disp-pop')!;
        const currentPop = p.currentPop;
        popEl.innerText = `${currentPop}/${p.popCap}`;
        if (currentPop >= p.popCap) { popEl.style.color = '#ef4444'; popEl.classList.add('warning'); }
        else if (currentPop >= p.popCap * 0.8) { popEl.style.color = '#eab308'; popEl.classList.remove('warning'); }
        else { popEl.style.color = '#e5e5e5'; popEl.classList.remove('warning'); }

        document.getElementById('disp-idle')!.innerText = p.idleWorkers.toString();
        if (p.idleWorkers > 0) document.getElementById('disp-idle')?.classList.add('warning');
        else document.getElementById('disp-idle')?.classList.remove('warning');

        document.getElementById('p-base-hp')!.style.width = (p.baseHp / 2000 * 100) + '%';
        document.getElementById('e-base-hp')!.style.width = (this.game.enemy.baseHp / 2000 * 100) + '%';

        // 2. 调用组件渲染
        this.dockRenderer.render(this.activePopoverId, (id, item) => {
            this.handleDockClick(id, item);
        });

        if (this.activePopoverId) {
            // 3. 检测科技变化强制重绘
            const currentTechState = JSON.stringify(p.techLevels);
            if (this.lastTechState !== currentTechState) {
                this.lastTechState = currentTechState;
                // 如果正在看建筑菜单，且不是建造菜单，重绘以显示新科技
                if (this.activePopoverId !== 'build_menu' && !this.activePopoverId.startsWith('group')) {
                    // 重新触发一次 click 逻辑即可重绘
                    this.popoverRenderer.render(this.activePopoverId, this.activePopoverId === 'build_menu' ? 'dock-btn-build' : `dock-item-${this.activePopoverId}`);
                }
            }

            // 实时更新状态
            this.popoverRenderer.updateStatus(this.activePopoverId);
        } else {
            this.lastTechState = JSON.stringify(p.techLevels);
        }
    }

    private handleDockClick(id: string, item: any) {
        if (item.type === 'construction') return;

        if (this.activePopoverId === id) {
            this.closePopover();
            return;
        }

        this.activePopoverId = id;
        // 渲染菜单
        const triggerId = id === 'build_menu' ? 'dock-btn-build' : `dock-item-${id}`;
        this.popoverRenderer.render(id, triggerId);
    }

    private closePopover() {
        this.activePopoverId = null;
        this.popoverRenderer.hide();
    }

    private updateStanceUI() {
        // 1. 更新全局按钮高亮
        // 只有当所有 Lane 姿态一致且等于全局姿态时，才高亮全局按钮
        const isUniform = Object.values(this.game.laneStances).every(s => s === this.game.playerStance);

        ['retreat', 'defend', 'hold', 'attack', 'advance'].forEach(s => {
            const el = document.getElementById(`btn-stance-${s}`)!;
            if (el) {
                if (isUniform && this.game.playerStance === s) {
                    el.className = 'tactic-btn active';
                } else {
                    el.className = 'tactic-btn';
                }
            }
        });

        // 2. 更新 Lane 按钮的高亮
        const laneBtns = document.querySelectorAll('.lane-btn');
        laneBtns.forEach((btn: any) => {
            const lane = parseInt(btn.dataset.lane);
            const stance = btn.dataset.stance;
            if (this.game.laneStances[lane] === stance) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    private checkGlobalStance() {
        const s0 = this.game.laneStances[0];
        const s1 = this.game.laneStances[1];
        const s2 = this.game.laneStances[2];

        // 如果三个 Lane 姿态一致，则更新全局姿态并高亮对应按钮
        if (s0 === s1 && s1 === s2) {
            this.game.playerStance = s0;
        } else {
            // 否则，全局姿态设为一个特殊值或保持原样，但不高亮任何全局按钮
            // 这里我们保持 playerStance 不变，但在 updateStanceUI 中处理高亮逻辑
        }
        this.updateStanceUI();
    }
}