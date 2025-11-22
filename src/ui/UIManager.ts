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
        // 姿态
        ['defend', 'hold', 'attack'].forEach(s => {
            const btn = document.getElementById(`btn-stance-${s}`);
            if (btn) btn.onclick = () => {
                this.game.playerStance = s as any;
                this.updateStanceUI();
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
            const laneY = u.lane === 1 ? (h / 2 - 20) : (h / 2 + 20);
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
            html += `<div class="tt-row"><span>🛡️ 近战防御:</span> <span>${foundUnit.def_m}</span></div>`;
            html += `<div class="tt-row"><span>🎯 远程防御:</span> <span>${foundUnit.def_r}</span></div>`;
            html += `<div class="tt-row"><span>🏹 射程:</span> <span>${foundUnit.range}</span></div>`;
            tt.innerHTML = html;
            tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px'; tt.style.display = 'block';
            return;
        } 

        // 2. 查找基地 (=== 修复核心：对齐 Canvas 坐标系 ===)
        let foundBase: any = null;
        
        // 垂直范围：h/2 - 40 到 h/2 + 40
        const topY = h/2 - 40;
        const bottomY = h/2 + 40;
        
        if (my >= topY && my <= bottomY) {
            const baseW = (CONSTANTS.BASE_WIDTH / 100 * w);
            
            // 玩家基地检测
            const pCx = (CONSTANTS.PLAYER_BASE_POS / 100) * w;
            if (Math.abs(mx - pCx) < baseW / 2) foundBase = this.game.player;
            
            // 敌人基地检测
            const eCx = (CONSTANTS.ENEMY_BASE_POS / 100) * w;
            if (Math.abs(mx - eCx) < baseW / 2) foundBase = this.game.enemy;
        }

        if (foundBase) {
            const isPlayer = foundBase.type === FactionType.Player;
            const turretDmg = (UNIT_CONFIG[UnitType.Spearman].damage * 1.5);
            
            tt.className = isPlayer ? '' : 'tt-enemy';
            
            let html = `<div class="tt-header">${isPlayer ? '我方' : '敌方'}基地</div>`;
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
        ['defend', 'hold', 'attack'].forEach(s => {
            const el = document.getElementById(`btn-stance-${s}`)!;
            el.className = `tactic-btn ${this.game.playerStance === s ? 'active' : ''}`;
        });
    }
}