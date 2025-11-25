import { Game } from "../core/Game";
import { Unit } from "../entities/units/Unit";
import { FactionType, UnitTag, UnitType } from "../core/Types";
import { CONSTANTS } from "../core/Constants";
import { Helpers } from "../utils/Helpers";
import { UNIT_CONFIG } from "../data/UnitConfig";

export class CombatSystem {
    private game: Game;

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

    // 1. 调度逻辑
    private processFaction(friendFaction: any, enemyFaction: any, dir: number) {
        const friends = [...friendFaction.units];
        const stance = dir === 1 ? this.game.playerStance : this.game.enemyStance;

        // === 排序逻辑 ===
        // 向右走 (进攻/前进)：靠右的先动
        if (stance === 'attack' || stance === 'advance') {
            friends.sort((a, b) => dir === 1 ? b.pos - a.pos : a.pos - b.pos);
        }
        // 向左走 (防御/撤退)：靠左的先动
        else if (stance === 'defend' || stance === 'retreat') {
            friends.sort((a, b) => dir === 1 ? a.pos - b.pos : b.pos - a.pos);
        }
        // 待命：不重要

        const enemies = [...enemyFaction.units];

        friends.forEach((u, i) => {
            // 尝试战斗
            this.handleCombat(u, enemies, enemyFaction, dir);

            // === 移动权判断 ===
            // 1. 待命模式：绝对不移动
            if (stance === 'hold') return;

            // 2. 攻击硬直判断
            // 如果正在攻击，且单位不支持移动攻击，则必须停下 (stopOnAttack 的替代逻辑)
            const uConfig = UNIT_CONFIG[u.type];
            const isAttackingAndCannotMove = u.state === 'attack' && !uConfig.canMoveAttack;

            if (!isAttackingAndCannotMove) {
                const laneFriends = friends.filter(f => f.lane === u.lane);
                const laneIndex = laneFriends.findIndex(f => f.id === u.id);
                this.handleMovement(u, laneFriends, enemies, laneIndex, dir, stance);
            }
        });
    }

    // 2. 战斗逻辑
    private handleCombat(u: Unit, enemies: Unit[], enemyFaction: any, dir: number): boolean {
        if (u.attackAnimTimer > 0) u.attackAnimTimer--;
        if (u.attackCooldown > 0) u.attackCooldown--;

        const uConfig = UNIT_CONFIG[u.type];
        const attackType = uConfig.attackType || 'melee';
        const isMeleeUnit = attackType === 'melee';
        const stance = dir === 1 ? this.game.playerStance : this.game.enemyStance;

        // === 强制移动逻辑 (Blind Move) ===
        // 如果是 [前进/撤退] 模式，且单位不支持移动攻击（如弓箭手）
        // 强制放弃索敌，优先执行移动命令
        // (长枪兵因为 canMoveAttack=true，会跳过此判断，继续索敌并边打边撤/边打边冲)
        if (stance === 'advance' || stance === 'retreat') {
            if (!uConfig.canMoveAttack) {
                u.state = 'move';
                return false;
            }
        }
        // ================================

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
                u.attackCooldown = u.maxAttackCooldown;
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

                if (target === "base") {
                    const baseDef = (attackType === 'ranged') ? 50 : 2;
                    actualDmg = Math.max(1, dmg - baseDef);
                    enemyFaction.baseHp -= actualDmg;
                    hitPos = enemyBaseEdge;
                } else {
                    const defenseVal = (attackType === 'ranged') ? target.def_r : target.def_m;
                    actualDmg = Math.max(1, dmg - defenseVal);
                    target.hp -= actualDmg;
                    hitPos = target.pos;
                }

                let color = '#ffffff';
                if (actualDmg > 11) color = '#d946ef';
                else if (actualDmg >= 3) color = '#ef4444';

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

    // 3. 移动逻辑
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

        // === 分支 A: 向右移动 (进攻/前进) ===
        if (stance === 'attack' || stance === 'advance') {
            nextPos += speed;

            // 友军防重叠
            if (index > 0) {
                const friend = friends[index - 1];
                const limit = friend.pos - (dir * u.width);
                if (dir === 1 ? nextPos > limit : nextPos < limit) nextPos = limit;
            }

            // 敌人碰撞 (无论什么模式，撞上了就是撞上了，不能穿模)
            const enemiesInLane = enemies.filter(e => e.lane === u.lane);
            if (enemiesInLane.length > 0) {
                const nearestEnemy = enemiesInLane.sort((a, b) => Math.abs(u.pos - a.pos) - Math.abs(u.pos - b.pos))[0];
                const limit = nearestEnemy.pos - (dir * (u.width + 0.1));
                if (dir === 1 ? nextPos > limit : nextPos < limit) nextPos = limit;
            }

            // 墙体限制
            const enemyBaseCenter = dir === 1 ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
            const enemyBaseEdge = enemyBaseCenter - (dir * CONSTANTS.BASE_WIDTH / 2);

            // Advance/Attack: 都应该停在城门口 (Edge)，不能穿模进基地
            const baseLimit = enemyBaseEdge;
            const finalLimit = baseLimit - (dir * u.width / 2); // 减去半身位

            if (dir === 1) {
                if (nextPos > finalLimit) nextPos = finalLimit;
            } else {
                if (nextPos < finalLimit) nextPos = finalLimit;
            }
        }
        // === 分支 B: 向左移动 (防御/撤退) ===
        else if (stance === 'defend' || stance === 'retreat') {
            nextPos -= speed; // 反向移动

            const wallEdge = myBaseCenter + (dir * CONSTANTS.BASE_WIDTH / 2);

            // Retreat: 如果未部署(在基地内)，可以退回中心；如果已部署(在外面)，只能退到门口
            // Defend: 停在城门口
            const baseLimit = (stance === 'retreat' && !u.isDeployed) ? myBaseCenter : wallEdge;
            const finalLimit = baseLimit + (dir * u.width / 2); // 加上半身位

            if (dir === 1) {
                let limit = u.isDeployed ? finalLimit : myBaseCenter; // 未部署的永远可以回出生点

                // 防守队列逻辑
                if (index > 0) {
                    const friend = friends[index - 1];
                    // 防守时是向后排队，所以不能超过身后友军的位置 + 宽度
                    const friendLimit = friend.pos + (dir * u.width);
                    limit = Math.max(limit, friendLimit);
                }

                if (nextPos < limit) nextPos = limit;
            } else {
                let limit = u.isDeployed ? finalLimit : myBaseCenter;
                if (index > 0) {
                    const friend = friends[index - 1];
                    const friendLimit = friend.pos + (dir * u.width);
                    limit = Math.min(limit, friendLimit);
                }
                if (nextPos > limit) nextPos = limit;
            }
        }

        u.pos = nextPos;
    }

    private createProjectile(u: Unit, target: Unit | "base", dir: number, color: string) {
        const w = this.game.worldWidth;
        const h = document.getElementById('gameCanvas')?.offsetHeight || 600;

        const startX = (u.pos / 100) * w;
        const startLaneOffset = CONSTANTS.LANE_CONFIG[u.lane] || 0;
        const startY = h / 2 + startLaneOffset;

        let endX = 0;
        let endY = 0;

        if (target === "base") {
            const enemyBasePos = dir === 1 ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
            endX = (enemyBasePos / 100) * w;
            endY = h / 2;
        } else {
            endX = (target.pos / 100) * w;
            const endLaneOffset = CONSTANTS.LANE_CONFIG[target.lane] || 0;
            endY = h / 2 + endLaneOffset;
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

        if (this.game.player.baseHp <= 0) this.game.endGame(false, '你的帝国陷落了。');
        else if (this.game.enemy.baseHp <= 0) this.game.endGame(true, '你征服了野蛮人！');
    }

    private processTurrets() {
        [this.game.player, this.game.enemy].forEach(f => {
            if (f.turretCooldown > 0) { f.turretCooldown--; return; }

            const enemies = f === this.game.player ? this.game.enemy.units : this.game.player.units;
            const turretPos = f === this.game.player ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;
            const range = 15;

            const targets = enemies.filter(e => Math.abs(e.pos - turretPos) <= range);
            if (targets.length > 0) {
                f.turretCooldown = 32;
                const shotCount = Math.min(targets.length, 2);
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
                    const endLaneOffset = CONSTANTS.LANE_CONFIG[t.lane] || 0;
                    const endY = h / 2 + endLaneOffset;

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

                    let color = '#ffffff';
                    if (actualDmg > 11) {
                        color = '#d946ef';
                    } else if (actualDmg >= 3) {
                        color = '#ef4444';
                    }

                    setTimeout(() => {
                        Helpers.spawnFloater(t.pos, `-${actualDmg.toFixed(1)}`, color);
                    }, this.ARROW_FLIGHT_TIME);
                }
            }
        });
    }
}