import { Game } from "../core/Game";
import { Unit } from "../entities/units/Unit";
import { FactionType, UnitTag, UnitType } from "../core/Types";
import { CONSTANTS } from "../core/Constants";
import { Helpers } from "../utils/Helpers";
import { UNIT_CONFIG } from "../data/UnitConfig";

export class CombatSystem {
    private game: Game;

    // 定义箭矢飞行时间 (ms) = (1 / speed) * TICK_RATE
    // 1 / 0.25 * 100 = 400ms
    private readonly ARROW_FLIGHT_TIME = 400;
    private readonly ARROW_SPEED = 0.25;

    constructor(game: Game) {
        this.game = game;
    }

    public update() {
        this.processFaction(this.game.player, this.game.enemy, 1);
        this.processFaction(this.game.enemy, this.game.player, -1);
        this.cleanupDead();
        this.processTurrets();
    }

    private processFaction(friendFaction: any, enemyFaction: any, dir: number) {
        const friends = [...friendFaction.units];
        const stance = dir === 1 ? this.game.playerStance : this.game.enemyStance;

        // 排序：进攻/前进模式靠前的先动，防守模式靠后的先动
        if (stance === 'attack' || stance === 'move') {
            friends.sort((a, b) => dir === 1 ? b.pos - a.pos : a.pos - b.pos);
        } else {
            friends.sort((a, b) => dir === 1 ? a.pos - b.pos : b.pos - a.pos);
        }

        const enemies = [...enemyFaction.units];

        friends.forEach((u, i) => {
            // 1. 尝试战斗
            const hasTarget = this.handleCombat(u, enemies, enemyFaction, dir);

            // 2. 尝试移动
            // === 核心重构：基于 canMoveAttack 判断是否需要停下 ===
            const uConfig = UNIT_CONFIG[u.type];

            // 如果 (正在攻击 且 无法移动攻击)，则必须停下 (禁止进入移动逻辑)
            const mustStop = u.state === 'attack' && !uConfig.canMoveAttack;

            if (!mustStop) {
                const laneFriends = friends.filter(f => f.lane === u.lane);
                const laneIndex = laneFriends.findIndex(f => f.id === u.id);
                this.handleMovement(u, laneFriends, enemies, laneIndex, dir, stance);
            }
            // ==================================================
        });
    }

    private handleCombat(u: Unit, enemies: Unit[], enemyFaction: any, dir: number): boolean {
        if (u.attackAnimTimer > 0) u.attackAnimTimer--;
        if (u.attackCooldown > 0) u.attackCooldown--;

        const uConfig = UNIT_CONFIG[u.type];
        const attackType = uConfig.attackType || 'melee';
        const isMeleeUnit = attackType === 'melee';

        const stance = dir === 1 ? this.game.playerStance : this.game.enemyStance;

        // === Move 模式逻辑 ===
        // 如果是前进模式，且单位不支持移动攻击（如弓箭手），强制放弃索敌
        // 这样它就不会进入 attack 状态，从而在 processFaction 里可以继续移动
        if (stance === 'move') {
            if (!uConfig.canMoveAttack) {
                u.state = 'move';
                return false;
            }
        }

        const enemyBasePos = dir === 1 ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
        const enemyBaseEdge = enemyBasePos - (dir * CONSTANTS.BASE_WIDTH / 2);

        let targets = enemies.filter(e => {
            if (Math.abs(u.pos - e.pos) > u.range) return false;
            if (isMeleeUnit) {
                if (dir === 1 && u.pos < enemyBaseEdge && e.pos > enemyBaseEdge) return false;
                if (dir === -1 && u.pos > enemyBaseEdge && e.pos < enemyBaseEdge) return false;
            }
            return true;
        });

        let target: Unit | "base" | null = null;

        if (targets.length > 0) {
            targets.sort((a, b) => Math.abs(u.pos - a.pos) - Math.abs(u.pos - b.pos));
            target = targets[0];
        } else {
            const distToEdge = Math.abs(u.pos - enemyBaseEdge);
            if (distToEdge <= u.range) target = "base";
        }

        if (target) {
            u.state = 'attack';
            u.targetId = target === "base" ? "base" : target.id;

            if (u.attackCooldown <= 0) {
                u.attackCooldown = uConfig.cooldown || 15;
                u.attackAnimTimer = 3;

                let dmg = u.damage;
                if (target !== "base") {
                    dmg += u.getBonusDamage(target.tags);
                }

                if (!isMeleeUnit) {
                    this.createProjectile(u, target, dir, u.owner === FactionType.Player ? '#8b5cf6' : '#a855f7');
                }

                let actualDmg = 0;
                let hitPos = 0;
                let color = '';

                if (target === "base") {
                    // 基地远程防御 50
                    const baseDef = (attackType === 'ranged') ? 50 : 2;
                    actualDmg = Math.max(1, dmg - baseDef);
                    enemyFaction.baseHp -= actualDmg;
                    hitPos = enemyBaseEdge;
                    color = CONSTANTS.COLORS.TEXT_FLOAT_BASE;
                } else {
                    const defenseVal = (attackType === 'ranged') ? target.def_r : target.def_m;
                    actualDmg = Math.max(1, dmg - defenseVal);
                    target.hp -= actualDmg;
                    hitPos = target.pos;
                    color = CONSTANTS.COLORS.TEXT_FLOAT_DMG;
                }

                if (isMeleeUnit) {
                    Helpers.spawnFloater(hitPos, `-${actualDmg}`, color);
                } else {
                    setTimeout(() => {
                        Helpers.spawnFloater(hitPos, `-${actualDmg}`, color);
                    }, this.ARROW_FLIGHT_TIME);
                }
            }
            return true;
        } else {
            u.state = 'move';
            return false;
        }
    }

    private createProjectile(u: Unit, target: Unit | "base", dir: number, color: string) {
        const w = this.game.worldWidth;
        const h = document.getElementById('gameCanvas')?.offsetHeight || 600;

        const startX = (u.pos / 100) * w;
        const startY = u.lane === 1 ? (h / 2 - 20) : (h / 2 + 20);

        let endX = 0;
        let endY = 0;

        if (target === "base") {
            const enemyBasePos = dir === 1 ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
            endX = (enemyBasePos / 100) * w;
            endY = h / 2;
        } else {
            endX = (target.pos / 100) * w;
            endY = target.lane === 1 ? (h / 2 - 20) : (h / 2 + 20);
        }

        const midX = (startX + endX) / 2;
        const distance = Math.abs(endX - startX);
        const arcHeight = Math.max(30, distance * 0.3);
        const midY = Math.min(startY, endY) - arcHeight;

        this.game.projectiles.push({
            p0: { x: startX, y: startY - 10 },
            p1: { x: midX, y: midY },
            p2: { x: endX, y: endY },
            progress: 0,
            speed: this.ARROW_SPEED,
            color: color,
            trailLength: 0.15
        });
    }

    private handleMovement(u: Unit, friends: Unit[], enemies: Unit[], index: number, dir: number, stance: string) {
        const myBaseCenter = u.owner === FactionType.Player ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;
        const myBaseEdge = myBaseCenter + (dir * CONSTANTS.BASE_WIDTH / 2);

        if (!u.isDeployed) {
            if ((dir === 1 && u.pos > myBaseEdge + u.width / 2) ||
                (dir === -1 && u.pos < myBaseEdge - u.width / 2)) {
                u.isDeployed = true;
            }
        }

        let nextPos = u.pos;
        const speed = u.speed * dir;

        if (stance === 'attack' || stance === 'move') {
            nextPos += speed;
            if (index > 0) {
                const friend = friends[index - 1];
                const limit = friend.pos - (dir * u.width);
                if (dir === 1 ? nextPos > limit : nextPos < limit) nextPos = limit;
            }
            const enemiesInLane = enemies.filter(e => e.lane === u.lane);
            if (enemiesInLane.length > 0) {
                const nearestEnemy = enemiesInLane.sort((a, b) => Math.abs(u.pos - a.pos) - Math.abs(u.pos - b.pos))[0];
                const limit = nearestEnemy.pos - (dir * (u.width + 0.1));
                if (dir === 1 ? nextPos > limit : nextPos < limit) nextPos = limit;
            }
            const enemyBaseCenter = dir === 1 ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
            const attackLimit = enemyBaseCenter - (dir * (CONSTANTS.BASE_WIDTH / 2 + u.width / 2));
            if (dir === 1) {
                if (nextPos > attackLimit) nextPos = attackLimit;
            } else {
                if (nextPos < attackLimit) nextPos = attackLimit;
            }
        } else if (stance === 'defend') {
            nextPos -= speed;
            const wallLimit = myBaseCenter + (dir * (CONSTANTS.BASE_WIDTH / 2 + u.width / 2));
            if (dir === 1) {
                let limit = u.isDeployed ? wallLimit : myBaseCenter;
                if (index > 0) limit = Math.max(limit, friends[index - 1].pos + u.width);
                if (nextPos < limit) nextPos = limit;
            } else {
                let limit = u.isDeployed ? wallLimit : myBaseCenter;
                if (index > 0) limit = Math.min(limit, friends[index - 1].pos - u.width);
                if (nextPos > limit) nextPos = limit;
            }
        }
        u.pos = nextPos;
    }

    private cleanupDead() {
        [this.game.player, this.game.enemy].forEach(f => {
            const deadUnits = f.units.filter(u => u.hp <= 0);
            deadUnits.forEach(u => {
                if (u.tags.includes(UnitTag.Worker)) {
                    f.totalWorkers--;
                    f.workers['food']--;
                    if (f.workers['food'] < 0) f.workers['food'] = 0;
                } else {
                    f.armyCount--;
                }
            });
            f.units = f.units.filter(u => u.hp > 0);
        });

        if (this.game.player.baseHp <= 0) this.game.endGame(false);
        else if (this.game.enemy.baseHp <= 0) this.game.endGame(true);
    }

    private processTurrets() {
        [this.game.player, this.game.enemy].forEach(f => {
            if (f.turretCooldown > 0) { f.turretCooldown--; return; }

            const enemies = f === this.game.player ? this.game.enemy.units : this.game.player.units;
            const turretPos = f === this.game.player ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;
            const range = 15; // 炮台射程 15

            const targets = enemies.filter(e => Math.abs(e.pos - turretPos) <= range);
            if (targets.length > 0) {
                f.turretCooldown = 8;
                const shotCount = Math.min(targets.length, 3);
                for (let i = 0; i < shotCount; i++) {
                    const t = targets[Math.floor(Math.random() * targets.length)];
                    const dmg = UNIT_CONFIG[UnitType.Spearman].damage * 1.5;
                    const actualDmg = Math.max(1, dmg - t.def_r);
                    t.hp -= actualDmg;

                    const w = this.game.worldWidth;
                    const h = document.getElementById('gameCanvas')?.offsetHeight || 600;
                    const startX = (turretPos / 100) * w;
                    const startY = h / 2 - 45;

                    const endX = (t.pos / 100) * w;
                    const endY = t.lane === 1 ? (h / 2 - 20) : (h / 2 + 20);

                    const midX = (startX + endX) / 2;
                    const distance = Math.abs(endX - startX);
                    const arcHeight = Math.max(30, distance * 0.3);
                    const midY = Math.min(startY, endY) - arcHeight;

                    this.game.projectiles.push({
                        p0: { x: startX, y: startY },
                        p1: { x: midX, y: midY },
                        p2: { x: endX, y: endY },
                        progress: 0,
                        speed: this.ARROW_SPEED,
                        color: f === this.game.player ? '#60a5fa' : '#f87171',
                        trailLength: 0.2
                    });

                    setTimeout(() => {
                        Helpers.spawnFloater(t.pos, `-${actualDmg.toFixed(1)}`, '#f0f');
                    }, this.ARROW_FLIGHT_TIME);
                }
            }
        });
    }
}