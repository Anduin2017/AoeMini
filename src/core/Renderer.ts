import { Game } from "./Game";
import { FactionType, UnitType } from "./Types";
import { CONSTANTS } from "./Constants";
import { UNIT_CONFIG } from "../data/UnitConfig"; // 引入配置

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private bgCanvas: HTMLCanvasElement;
    private bgCtx: CanvasRenderingContext2D;
    private game: Game;

    constructor(game: Game) {
        this.game = game;
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.bgCanvas = document.getElementById('bgCanvas') as HTMLCanvasElement;
        this.bgCtx = this.bgCanvas.getContext('2d')!;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    private resize() {
        const wrapper = document.getElementById('game-wrapper')!;
        const w = wrapper.offsetWidth;
        const h = wrapper.offsetHeight;
        this.canvas.width = w; this.canvas.height = h;
        this.bgCanvas.width = w; this.bgCanvas.height = h;
        this.game.worldWidth = w;
    }

    public draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);
        this.bgCtx.clearRect(0, 0, w, h);

        // 1. 绘制背景线条
        this.bgCtx.strokeStyle = '#333';
        this.bgCtx.lineWidth = 2;
        this.bgCtx.beginPath(); this.bgCtx.moveTo(0, h / 2 - 20); this.bgCtx.lineTo(w, h / 2 - 20); this.bgCtx.stroke();
        this.bgCtx.beginPath(); this.bgCtx.moveTo(0, h / 2 + 20); this.bgCtx.lineTo(w, h / 2 + 20); this.bgCtx.stroke();

        // 2. 绘制城镇中心
        this.drawBase(this.game.player, CONSTANTS.PLAYER_BASE_POS, CONSTANTS.COLORS.PLAYER);
        this.drawBase(this.game.enemy, CONSTANTS.ENEMY_BASE_POS, CONSTANTS.COLORS.ENEMY);

        // 3. 绘制所有单位
        const allUnits = [...this.game.player.units, ...this.game.enemy.units];

        // 按照 Y 轴排序
        allUnits.sort((a, b) => a.lane - b.lane);

        for (const u of allUnits) {
            const x = (u.pos / 100) * w;
            const laneY = u.lane === 1 ? (h / 2 - 20) : (h / 2 + 20);

            // 阴影
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.ellipse(x, laneY - 2, 6, 3, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // 单位主体
            this.ctx.fillStyle = u.owner === FactionType.Player ? CONSTANTS.COLORS.PLAYER : CONSTANTS.COLORS.ENEMY;

            if (u.type === UnitType.ManAtArms) {
                this.ctx.fillRect(x - 8, laneY - 20, 16, 20);
            } else if (u.type === UnitType.Spearman) {
                this.ctx.beginPath(); this.ctx.arc(x, laneY - 8, 8, 0, Math.PI * 2); this.ctx.fill();
            } else if (u.type === UnitType.Longbowman) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, laneY - 20);
                this.ctx.lineTo(x - 6, laneY);
                this.ctx.lineTo(x + 6, laneY);
                this.ctx.fill();
            } else {
                this.ctx.fillRect(x - 5, laneY - 15, 10, 15);
            }

            // 武器细节
            this.ctx.fillStyle = '#ccc';
            if (u.type === UnitType.Spearman) {
                this.ctx.fillRect(u.owner === FactionType.Player ? x + 2 : x - 12, laneY - 10, 10, 2);
            } else if (u.type !== UnitType.Longbowman) {
                this.ctx.fillRect(u.owner === FactionType.Player ? x + 5 : x - 5, laneY - 15, 8, 2);
            }

            // === 核心修正：基于 attackType 绘制攻击闪光 ===
            if (u.attackAnimTimer > 0) {
                const uConfig = UNIT_CONFIG[u.type];
                // 只有近战才画黄线
                if (!uConfig.attackType || uConfig.attackType === 'melee') {
                    this.ctx.strokeStyle = '#ffff00';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(u.owner === FactionType.Player ? x + 5 : x - 5, laneY - 15);

                    let tx = 0;
                    if (u.targetId === "base") {
                        const targetBasePos = u.owner === FactionType.Player ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
                        const dir = u.owner === FactionType.Player ? 1 : -1;
                        tx = (targetBasePos - dir * CONSTANTS.BASE_WIDTH / 2) / 100 * w;
                    } else {
                        tx = u.owner === FactionType.Player ? x + 30 : x - 30;
                    }

                    this.ctx.lineTo(tx, laneY - 10);
                    this.ctx.stroke();
                }
            }
            // ==========================================

            // 血条
            const hpPct = u.hp / u.maxHp;
            this.ctx.fillStyle = 'red'; this.ctx.fillRect(x - 8, laneY - 28, 16, 3);
            this.ctx.fillStyle = CONSTANTS.COLORS.PLAYER_HP; this.ctx.fillRect(x - 8, laneY - 28, 16 * hpPct, 3);
        }

        // 4. 绘制抛物线弹道 (projectiles)
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';

        this.game.projectiles.forEach(p => {
            const getBezierPos = (t: number) => {
                const safeT = Math.max(0, Math.min(1, t));
                const mt = 1 - safeT;
                const x = mt * mt * p.p0.x + 2 * mt * safeT * p.p1.x + safeT * safeT * p.p2.x;
                const y = mt * mt * p.p0.y + 2 * mt * safeT * p.p1.y + safeT * safeT * p.p2.y;
                return { x, y };
            };

            const head = getBezierPos(p.progress);
            const tail = getBezierPos(p.progress - p.trailLength);

            this.ctx.strokeStyle = p.color;
            this.ctx.beginPath();
            this.ctx.moveTo(tail.x, tail.y);
            this.ctx.lineTo(head.x, head.y);
            this.ctx.stroke();
        });
    }

    private drawBase(faction: any, posPct: number, color: string) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = (posPct / 100) * w;
        const halfW = (CONSTANTS.BASE_WIDTH / 100 * w) / 2;
        const topY = h / 2 - 40;
        const bottomY = h / 2 + 40;

        this.ctx.fillStyle = color;
        this.ctx.fillRect(cx - halfW, topY, halfW * 2, 80);

        const battlementW = halfW * 0.4;
        this.ctx.fillRect(cx - halfW, topY - 10, battlementW, 10);
        this.ctx.fillRect(cx + halfW - battlementW, topY - 10, battlementW, 10);
        this.ctx.fillRect(cx - battlementW / 2, topY - 10, battlementW, 10);

        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(cx - halfW, topY, halfW * 2, 80);

        this.ctx.fillStyle = '#0f172a';
        const doorW = halfW * 0.8;
        const doorH = 50;
        this.ctx.beginPath();
        this.ctx.moveTo(cx - doorW / 2, bottomY);
        this.ctx.lineTo(cx - doorW / 2, bottomY - doorH + doorW / 2);
        this.ctx.arc(cx, bottomY - doorH + doorW / 2, doorW / 2, Math.PI, 0);
        this.ctx.lineTo(cx + doorW / 2, bottomY);
        this.ctx.fill();
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        const hpBarW = halfW * 2.4;
        const hpBarH = 6;
        const hpY = topY - 25;
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(cx - hpBarW / 2, hpY, hpBarW, hpBarH);
        const hpPct = Math.max(0, faction.baseHp / CONSTANTS.BASE_HP);
        this.ctx.fillStyle = CONSTANTS.COLORS.PLAYER_HP;
        this.ctx.fillRect(cx - hpBarW / 2, hpY, hpBarW * hpPct, hpBarH);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cx - hpBarW / 2, hpY, hpBarW, hpBarH);
    }
}