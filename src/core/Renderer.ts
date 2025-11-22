import { Game } from "./Game";
import { FactionType, UnitType } from "./Types";
import { CONSTANTS } from "./Constants";

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
        this.bgCtx.beginPath(); this.bgCtx.moveTo(0, h/2 - 20); this.bgCtx.lineTo(w, h/2 - 20); this.bgCtx.stroke();
        this.bgCtx.beginPath(); this.bgCtx.moveTo(0, h/2 + 20); this.bgCtx.lineTo(w, h/2 + 20); this.bgCtx.stroke();

        // 2. 绘制基地
        this.drawBase(this.game.player, CONSTANTS.PLAYER_BASE_POS, CONSTANTS.COLORS.PLAYER);
        this.drawBase(this.game.enemy, CONSTANTS.ENEMY_BASE_POS, CONSTANTS.COLORS.ENEMY);

        // 3. 绘制所有单位
        const allUnits = [...this.game.player.units, ...this.game.enemy.units];
        
        // 按照 Y 轴排序，保证遮挡关系正确 (虽然现在是 2D 侧视，但保持这个习惯很好)
        allUnits.sort((a, b) => a.lane - b.lane);

        for (const u of allUnits) {
            const x = (u.pos / 100) * w;
            const laneY = u.lane === 1 ? (h / 2 - 20) : (h / 2 + 20);
            
            // === 新增：单位阴影 ===
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.beginPath();
            // 在脚下画一个扁扁的椭圆
            this.ctx.ellipse(x, laneY - 2, 6, 3, 0, 0, Math.PI * 2);
            this.ctx.fill();
            // ===================

            this.ctx.fillStyle = u.owner === FactionType.Player ? CONSTANTS.COLORS.PLAYER : CONSTANTS.COLORS.ENEMY;

            if (u.type === UnitType.ManAtArms) {
                this.ctx.fillRect(x - 8, laneY - 20, 16, 20);
            } else if (u.type === UnitType.Spearman) {
                this.ctx.beginPath(); this.ctx.arc(x, laneY - 8, 8, 0, Math.PI * 2); this.ctx.fill();
            } else if (u.type === UnitType.Longbowman) {
                this.ctx.fillStyle = u.owner === FactionType.Player ? '#8b5cf6' : '#a855f7';
                this.ctx.beginPath(); 
                this.ctx.moveTo(x, laneY - 20); 
                this.ctx.lineTo(x - 6, laneY); 
                this.ctx.lineTo(x + 6, laneY); 
                this.ctx.fill();
            } else {
                this.ctx.fillRect(x - 5, laneY - 15, 10, 15);
            }

            this.ctx.fillStyle = '#ccc';
            if (u.type === UnitType.Spearman) {
                this.ctx.fillRect(u.owner === FactionType.Player ? x + 2 : x - 12, laneY - 10, 10, 2);
            } else if (u.type !== UnitType.Longbowman) {
                this.ctx.fillRect(u.owner === FactionType.Player ? x + 5 : x - 5, laneY - 15, 8, 2);
            }

            if (u.attackAnimTimer > 0) {
                this.ctx.strokeStyle = '#ffff00'; this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(u.owner === FactionType.Player ? x + 5 : x - 5, laneY - 15);
                
                // 攻击连线修正：打基地时指向基地边缘
                let tx = 0;
                if (u.targetId === "base") {
                    const targetBasePos = u.owner === FactionType.Player ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
                    const dir = u.owner === FactionType.Player ? 1 : -1;
                    // 指向基地边缘
                    tx = (targetBasePos - dir * CONSTANTS.BASE_WIDTH / 2) / 100 * w;
                } else {
                    tx = u.owner === FactionType.Player ? x + 30 : x - 30;
                }
                
                this.ctx.lineTo(tx, laneY - 10);
                this.ctx.stroke();
            }

            // 单位血条
            const hpPct = u.hp / u.maxHp;
            this.ctx.fillStyle = 'red'; this.ctx.fillRect(x - 8, laneY - 28, 16, 3);
            this.ctx.fillStyle = CONSTANTS.COLORS.PLAYER_HP; this.ctx.fillRect(x - 8, laneY - 28, 16 * hpPct, 3);
        }

        // 4. 绘制炮台激光
        this.game.turretShots.forEach(shot => {
            this.ctx.strokeStyle = shot.color;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo((shot.start / 100) * w, h / 2 - 30); // 发射点稍微调高一点，像从塔顶射出
            this.ctx.lineTo((shot.end / 100) * w, h / 2);
            this.ctx.stroke();
            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.arc((shot.end / 100) * w, h / 2, 5, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    private drawBase(faction: any, posPct: number, color: string) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        const cx = (posPct / 100) * w;
        const halfW = (CONSTANTS.BASE_WIDTH / 100 * w) / 2;
        const topY = h/2 - 40;
        const bottomY = h/2 + 40;
        
        // 1. 基地主体
        this.ctx.fillStyle = color;
        this.ctx.fillRect(cx - halfW, topY, halfW * 2, 80);
        
        // 2. 城垛 (让它看起来像个城堡)
        const battlementW = halfW * 0.4;
        this.ctx.fillRect(cx - halfW, topY - 10, battlementW, 10);
        this.ctx.fillRect(cx + halfW - battlementW, topY - 10, battlementW, 10);
        this.ctx.fillRect(cx - battlementW/2, topY - 10, battlementW, 10);

        // 3. 边框
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(cx - halfW, topY, halfW * 2, 80);

        // 4. 大门 (更高、更明显)
        this.ctx.fillStyle = '#0f172a'; // 深色门洞
        const doorW = halfW * 0.8;
        const doorH = 50; // 门高一点
        
        this.ctx.beginPath();
        // 拱门画法
        this.ctx.moveTo(cx - doorW/2, bottomY);
        this.ctx.lineTo(cx - doorW/2, bottomY - doorH + doorW/2);
        this.ctx.arc(cx, bottomY - doorH + doorW/2, doorW/2, Math.PI, 0);
        this.ctx.lineTo(cx + doorW/2, bottomY);
        this.ctx.fill();
        
        // 门框
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // 5. === 新增：基地血条 ===
        const hpBarW = halfW * 2.4; // 比基地宽一点
        const hpBarH = 6;
        const hpY = topY - 25; // 在城垛上面
        
        // 血条背景
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(cx - hpBarW/2, hpY, hpBarW, hpBarH);
        
        // 血条填充
        const hpPct = Math.max(0, faction.baseHp / CONSTANTS.BASE_HP);
        this.ctx.fillStyle = CONSTANTS.COLORS.PLAYER_HP;
        this.ctx.fillRect(cx - hpBarW/2, hpY, hpBarW * hpPct, hpBarH);
        
        // 血条边框
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cx - hpBarW/2, hpY, hpBarW, hpBarH);

        // 6. 炮台帽子 (可选，既然自带防御，可以画个小塔顶)
        if (faction.hasTurret) {
            this.ctx.fillStyle = '#64748b'; 
            // 画在中间城垛上方
            this.ctx.beginPath();
            this.ctx.moveTo(cx - 15, topY - 10);
            this.ctx.lineTo(cx + 15, topY - 10);
            this.ctx.lineTo(cx, topY - 25);
            this.ctx.fill();
        }
    }
}