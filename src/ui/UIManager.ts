import { Game } from "../core/Game";
import { ResourceType, FactionType, UnitType } from "../core/Types";
import { UNIT_CONFIG, BUILDING_CONFIG } from "../data/UnitConfig";
import { AGE_UP_CONFIG, AGE_LABELS } from "../data/AgeConfig";
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
        this.setupKeyboardShortcuts();
        this.setupResourceLongPress();
        this.setupPinListeners();
        this.setupAgeUpListeners();
        this.setupMiningLockListeners();
    }

    private setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (this.game.gameOver) return;

            const key = e.key.toUpperCase();

            // 1. 建筑快捷键 (1-9)
            if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key)) {
                const index = parseInt(key) - 1;
                const items = this.dockRenderer.currentSortedItems;
                if (items && items[index]) {
                    this.handleDockClick(items[index].id, items[index]);
                }
                return;
            }

            // 2. 建造面板 (B)
            if (key === 'B') {
                this.handleDockClick('build_menu', { type: 'menu' });
                return;
            }

            // 3. 菜单选项 (Q, W, E, R)
            if (this.activePopoverId) {
                const map: Record<string, number> = { 'Q': 0, 'W': 1, 'E': 2, 'R': 3, 'T': 4, 'Y': 5, 'U': 6, 'I': 7, 'O': 8, 'P': 9 };
                if (map[key] !== undefined) {
                    const btns = document.querySelectorAll('#popover-container .menu-btn');
                    const btn = btns[map[key]] as HTMLElement;
                    if (btn && btn.style.pointerEvents !== 'none') {
                        btn.click();
                        // 添加按键反馈动画
                        btn.style.transform = 'scale(0.95)';
                        setTimeout(() => btn.style.transform = '', 100);
                    }
                    return;
                }
            }

            // 4. 姿态切换 (A, S, D, F, G)
            // 只有在没有打开菜单或者菜单不是输入框时才触发 (这里没有输入框，所以直接触发)
            const stanceMap: Record<string, any> = {
                'A': 'attack',
                'S': 'hold',
                'D': 'defend',
                'F': 'retreat',
                'G': 'advance'
            };

            if (stanceMap[key]) {
                const s = stanceMap[key];
                this.game.playerStance = s;
                this.game.laneStances[0] = s;
                this.game.laneStances[1] = s;
                this.game.laneStances[2] = s;
                this.game.laneStances[3] = s;
                this.updateStanceUI();
                Helpers.showToast(`姿态切换: ${s.toUpperCase()}`, '#3b82f6');
            }
        });
    }

    private setupResourceLongPress() {
        const bindLongPress = (id: string, action: () => void) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            let intervalId: any = null;
            let timeoutId: any = null;

            const start = () => {
                if (intervalId || timeoutId) return;
                // 必须按住 0.6 秒后才开始触发
                timeoutId = setTimeout(() => {
                    action(); // 触发第一次
                    intervalId = setInterval(action, 100); // 10次/秒
                }, 600);
            };

            const stop = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            };

            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', stop);
            btn.addEventListener('mouseleave', stop);
            // 防止触摸屏长按弹出菜单
            btn.addEventListener('contextmenu', (e) => e.preventDefault());
        };

        (['food', 'wood', 'gold', 'stone'] as ResourceType[]).forEach(r => {
            bindLongPress(`add-${r}`, () => this.modWork(r, 1));
            bindLongPress(`sub-${r}`, () => this.modWork(r, -1));
        });
    }

    private setupPinListeners() {
        (['food', 'wood', 'gold', 'stone'] as ResourceType[]).forEach(r => {
            const btn = document.getElementById(`pin-${r}`);
            if (btn) {
                btn.onclick = () => {
                    // Block pinning to locked mining resources
                    const p = this.game.player;
                    if ((r === 'gold' || r === 'stone') && !p.miningUnlocked[r]) {
                        Helpers.showToast('需要先建造采矿场', '#ef4444');
                        return;
                    }
                    this.game.pinnedResource = r;
                    this.updatePinUI();
                    Helpers.showToast(`新村民将自动采集: ${this.getResourceName(r)}`, '#eab308');
                };
            }
        });
    }

    private updatePinUI() {
        (['food', 'wood', 'gold', 'stone'] as ResourceType[]).forEach(r => {
            const btn = document.getElementById(`pin-${r}`);
            if (btn) {
                if (this.game.pinnedResource === r) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    private getResourceName(r: string): string {
        switch (r) {
            case 'food': return '食物';
            case 'wood': return '木材';
            case 'gold': return '黄金';
            case 'stone': return '石头';
            default: return r;
        }
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
                    this.game.laneStances[3] = s as any;
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

    private setupAgeUpListeners() {
        // Age-up button: starts the age upgrade
        const ageUpBtn = document.getElementById('age-up-btn');
        if (ageUpBtn) {
            ageUpBtn.onclick = () => {
                const p = this.game.player;
                const nextAge = p.currentAge + 1;
                if (nextAge > 4) return;
                if (p.ageUpProgress) return; // already upgrading

                const config = AGE_UP_CONFIG[nextAge];
                if (!config) return;

                // Check resources
                if (p.resources.food < (config.cost.food || 0) || p.resources.gold < (config.cost.gold || 0)) {
                    Helpers.showToast("资源不足", '#ef4444');
                    return;
                }

                // Deduct resources
                p.resources.food -= (config.cost.food || 0);
                p.resources.gold -= (config.cost.gold || 0);

                // Start age-up progress
                p.ageUpProgress = { remaining: config.totalWork, total: config.totalWork };

                // Assign all idle villagers to age-up
                const idleCount = p.idleWorkers;
                if (idleCount > 0) {
                    p.ageWorkers += idleCount;
                    p.idleWorkers = 0;
                }

                // If no villagers assigned, assign at least from food
                if (p.ageWorkers === 0 && p.totalWorkers > 0) {
                    // Try to pull one from the largest resource group
                    const maxRes = (['food', 'wood', 'gold', 'stone'] as ResourceType[])
                        .reduce((a, b) => p.workers[a] > p.workers[b] ? a : b);
                    if (p.workers[maxRes] > 0) {
                        p.workers[maxRes]--;
                        p.ageWorkers++;
                    }
                }

                Helpers.showToast(`开始升级到 ${config.label}`, '#eab308');
            };
        }

        // +/- age worker buttons
        const addAgeBtn = document.getElementById('add-age');
        const subAgeBtn = document.getElementById('sub-age');
        if (addAgeBtn) addAgeBtn.onclick = () => this.modAgeWork(1);
        if (subAgeBtn) subAgeBtn.onclick = () => this.modAgeWork(-1);

        // Long-press support for age +/- buttons
        const bindLongPress = (id: string, action: () => void) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            let intervalId: any = null;
            let timeoutId: any = null;
            const start = () => {
                if (intervalId || timeoutId) return;
                timeoutId = setTimeout(() => {
                    action();
                    intervalId = setInterval(action, 100);
                }, 600);
            };
            const stop = () => {
                if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
                if (intervalId) { clearInterval(intervalId); intervalId = null; }
            };
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', stop);
            btn.addEventListener('mouseleave', stop);
            btn.addEventListener('contextmenu', (e) => e.preventDefault());
        };
        bindLongPress('add-age', () => this.modAgeWork(1));
        bindLongPress('sub-age', () => this.modAgeWork(-1));
    }

    private setupMiningLockListeners() {
        (['gold', 'stone'] as const).forEach(resType => {
            const btn = document.getElementById(`unlock-${resType}`);
            if (btn) {
                btn.onclick = () => {
                    const p = this.game.player;
                    if (p.miningUnlocked[resType]) return;
                    if (p.miningUnlockQueue) {
                        Helpers.showToast('已有采矿场正在建造中', '#ef4444');
                        return;
                    }
                    if (p.resources.wood < CONSTANTS.MINING_CAMP_COST.wood) {
                        Helpers.showToast('木材不足', '#ef4444');
                        return;
                    }
                    // Deduct cost and start building
                    p.resources.wood -= CONSTANTS.MINING_CAMP_COST.wood;
                    p.miningUnlockQueue = {
                        type: resType,
                        ticksLeft: CONSTANTS.MINING_CAMP_TICKS,
                        totalTicks: CONSTANTS.MINING_CAMP_TICKS
                    };
                    const label = resType === 'gold' ? '采金场' : '采石场';
                    Helpers.showToast(`开始建造${label}`, '#eab308');
                };
            }
        });
    }

    private modAgeWork(change: number) {
        const p = this.game.player;
        if (!p.ageUpProgress) return;
        if (change > 0) {
            if (p.idleWorkers > 0) { p.idleWorkers--; p.ageWorkers++; }
        } else {
            if (p.ageWorkers > 0) { p.ageWorkers--; p.idleWorkers++; }
        }
    }

    private modWork(type: ResourceType, change: number) {
        const p = this.game.player;
        // Block worker assignment to locked mining resources
        if ((type === 'gold' || type === 'stone') && !p.miningUnlocked[type]) return;
        if (change > 0) {
            if (p.idleWorkers > 0) { p.idleWorkers--; p.workers[type]++; }
        } else {
            if (p.workers[type] > 0) { p.workers[type]--; p.idleWorkers++; }
        }
    }

    public update() {
        const p = this.game.player;

        // === 采矿场锁 UI 更新 ===
        this.updateMiningLockUI(p);

        // 1. 顶部面板更新
        (['food', 'wood', 'gold', 'stone'] as ResourceType[]).forEach(r => {
            document.getElementById(`res-stock-${r}`)!.innerText = Math.floor(p.resources[r]).toString();
            document.getElementById(`res-workers-${r}`)!.innerText = p.workers[r].toString();

            // 按钮置灰逻辑
            const isLocked = (r === 'gold' || r === 'stone') && !p.miningUnlocked[r];
            const btnAdd = document.getElementById(`add-${r}`);
            const btnSub = document.getElementById(`sub-${r}`);
            if (isLocked) {
                if (btnAdd) btnAdd.classList.add('disabled');
                if (btnSub) btnSub.classList.add('disabled');
            } else {
                if (btnAdd) { if (p.idleWorkers > 0) btnAdd.classList.remove('disabled'); else btnAdd.classList.add('disabled'); }
                if (btnSub) { if (p.workers[r] > 0) btnSub.classList.remove('disabled'); else btnSub.classList.add('disabled'); }
            }
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

        // === 时代升级 UI 更新 ===
        this.updateAgeUI(p);

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

    private updateAgeUI(p: any) {
        const ageRow = document.getElementById('age-up-row');
        const ageLabel = document.getElementById('age-label');
        const ageUpBtn = document.getElementById('age-up-btn') as HTMLButtonElement;
        const ageCost = document.getElementById('age-up-cost');
        const ageProgressBar = document.getElementById('age-progress-bar');
        const ageProgressFill = document.getElementById('age-progress-fill');
        const ageWorkerRow = document.getElementById('age-worker-row');
        const ageWorkersEl = document.getElementById('age-workers');
        const agePctEl = document.getElementById('age-pct');
        const addAgeBtn = document.getElementById('add-age');
        const subAgeBtn = document.getElementById('sub-age');

        if (!ageRow) return;

        // Hide entire row at Age IV
        if (p.currentAge >= 4) {
            ageRow.style.display = 'none';
            return;
        }
        ageRow.style.display = '';

        // Update age label
        const currentAgeInfo = AGE_LABELS[p.currentAge];
        if (ageLabel) {
            ageLabel.innerText = `${currentAgeInfo?.roman || ''} ${currentAgeInfo?.label || ''}`;
        }

        const nextAge = p.currentAge + 1;
        const config = AGE_UP_CONFIG[nextAge];

        if (p.ageUpProgress) {
            // Currently upgrading
            if (ageUpBtn) ageUpBtn.style.display = 'none';
            if (ageCost) ageCost.style.display = 'none';
            if (ageProgressBar) ageProgressBar.style.display = '';
            if (ageWorkerRow) ageWorkerRow.style.display = '';

            const pct = Math.floor((1 - p.ageUpProgress.remaining / p.ageUpProgress.total) * 100);
            if (ageProgressFill) ageProgressFill.style.width = pct + '%';
            if (ageWorkersEl) ageWorkersEl.innerText = p.ageWorkers.toString();
            if (agePctEl) agePctEl.innerText = pct + '%';

            // +/- button states
            if (addAgeBtn) {
                if (p.idleWorkers > 0) addAgeBtn.classList.remove('disabled');
                else addAgeBtn.classList.add('disabled');
            }
            if (subAgeBtn) {
                if (p.ageWorkers > 0) subAgeBtn.classList.remove('disabled');
                else subAgeBtn.classList.add('disabled');
            }
        } else {
            // Not upgrading - show button
            if (ageProgressBar) ageProgressBar.style.display = 'none';
            if (ageWorkerRow) ageWorkerRow.style.display = 'none';

            if (config) {
                if (ageUpBtn) {
                    ageUpBtn.style.display = '';
                    ageUpBtn.innerText = AGE_LABELS[nextAge]?.roman || `${nextAge}`;

                    // Check affordability
                    const canAfford = p.resources.food >= (config.cost.food || 0) && p.resources.gold >= (config.cost.gold || 0);
                    ageUpBtn.disabled = !canAfford;
                }
                if (ageCost) {
                    ageCost.style.display = '';
                    let costStr = '';
                    if (config.cost.food) costStr += `${config.cost.food}肉 `;
                    if (config.cost.gold) costStr += `${config.cost.gold}金`;
                    ageCost.innerText = costStr;
                }
            }
        }
    }

    private updateMiningLockUI(p: any) {
        (['gold', 'stone'] as const).forEach(resType => {
            const overlay = document.getElementById(`mining-lock-${resType}`);
            const unlockBtn = document.getElementById(`unlock-${resType}`) as HTMLButtonElement;
            const progressBar = document.getElementById(`mining-progress-${resType}`);
            const progressFill = document.getElementById(`mining-progress-fill-${resType}`);

            if (!overlay) return;

            if (p.miningUnlocked[resType]) {
                // Already unlocked - hide overlay
                overlay.classList.add('hidden');
                return;
            }

            // Still locked - show overlay
            overlay.classList.remove('hidden');

            // Check if currently building this type
            if (p.miningUnlockQueue && p.miningUnlockQueue.type === resType) {
                // Show progress bar, hide button
                if (unlockBtn) unlockBtn.style.display = 'none';
                if (progressBar) progressBar.style.display = '';
                const pct = Math.floor((1 - p.miningUnlockQueue.ticksLeft / p.miningUnlockQueue.totalTicks) * 100);
                if (progressFill) progressFill.style.width = pct + '%';
            } else {
                // Show button, hide progress
                if (unlockBtn) {
                    unlockBtn.style.display = '';
                    // Disable if can't afford or another unlock is in progress
                    unlockBtn.disabled = p.resources.wood < CONSTANTS.MINING_CAMP_COST.wood || !!p.miningUnlockQueue;
                }
                if (progressBar) progressBar.style.display = 'none';
            }
        });
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
        const s3 = this.game.laneStances[3];

        // 如果四个 Lane 姿态一致，则更新全局姿态并高亮对应按钮
        if (s0 === s1 && s1 === s2 && s2 === s3) {
            this.game.playerStance = s0;
        } else {
            // 否则，全局姿态设为一个特殊值或保持原样，但不高亮任何全局按钮
            // 这里我们保持 playerStance 不变，但在 updateStanceUI 中处理高亮逻辑
        }
        this.updateStanceUI();
    }
}