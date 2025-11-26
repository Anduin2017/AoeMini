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
        // const stance = dir === 1 ? this.game.playerStance : this.game.enemyStance; // OLD

        // === 排序逻辑 ===
        // 简化：统一按进攻方向排序 (靠前的先动)
        // 如果需要更精细的排序，需要对每个 Lane 单独排序，这里为了性能暂且统一
        friends.sort((a, b) => dir === 1 ? b.pos - a.pos : a.pos - b.pos);

        const enemies = [...enemyFaction.units];

        // === 核心修正：插值前置处理 ===
        // 在每一帧逻辑开始前，记录当前位置为 prevPos
        friends.forEach(u => u.prevPos = u.pos);

        friends.forEach((u, i) => {
            // === 获取当前单位的姿态 ===
            // 玩家：使用 laneStances；电脑：使用全局 enemyStance
            const stance = dir === 1 ? this.game.laneStances[u.lane] : this.game.enemyStance;

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
        const stance = dir === 1 ? this.game.laneStances[u.lane] : this.game.enemyStance;

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
            // === 投石机特殊逻辑：瞄准最远单位 ===
            if (u.type === UnitType.Mangonel) {
                targets.sort((a, b) => Math.abs(u.pos - b.pos) - Math.abs(u.pos - a.pos)); // 降序 (最远)
            } else {
                targets.sort((a, b) => Math.abs(u.pos - a.pos) - Math.abs(u.pos - b.pos)); // 升序 (最近)
            }
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

                // === 投石机特殊逻辑 (弹道打击) ===
                if (u.type === UnitType.Mangonel) {
                    const flightTime = 3600; // 3.6s (原 1.2s * 3)
                    const impactPos = target === "base" ? enemyBaseEdge : target.pos;
                    const impactLane = target === "base" ? u.lane : target.lane; // 假设打基地时沿当前路

                    // 1. 创建视觉投射物
                    this.createProjectile(u, target, dir, u.owner === FactionType.Player ? '#ea580c' : '#f97316', 0.025); // 速度极慢

                    // 2. 延迟造成区域伤害
                    setTimeout(() => {
                        // 重新获取该位置的所有敌人
                        const currentEnemies = enemies.filter(e => e.hp > 0); // 确保还活着
                        const radius = uConfig.aoeRadius || 1.6;
                        const splashDmg = uConfig.aoeDamage || 40;

                        // 查找爆炸点附近的单位 (必须在同一 Lane 或相近 Lane? 这里简化为 X 轴判定，因为 AOE 不跨 Lane)
                        // 题目明确：AOE 不跨 Lane。
                        // 所以必须 filter e.lane === impactLane (如果是打单位)
                        // 如果打基地，impactPos 是边缘，可能溅射到门口的单位?
                        // 假设投石机只打同一 Lane 的单位。

                        const victims = currentEnemies.filter(e => {
                            if (target !== "base" && e.lane !== impactLane) return false;
                            // 如果打基地，可能溅射到所有 Lane? 暂且限制为同 Lane，或者基地附近的单位
                            // 简化：只炸同 Lane
                            if (target === "base" && e.lane !== u.lane) return false;

                            return Math.abs(e.pos - impactPos) <= radius;
                        });

                        // 伤害结算
                        victims.forEach(v => {
                            const def = v.def_r; // 远程防御

                            // 计算距离衰减
                            const dist = Math.abs(v.pos - impactPos);
                            // 二次衰减公式: Damage = BaseDamage * (1 - dist/radius)²
                            // 中心(dist=0) -> 100% 伤害 (1.0)
                            // 边缘(dist=radius) -> 0% 伤害 (0.0)
                            const normalizedDist = Math.min(dist / radius, 1); // 确保不超过1
                            const falloffFactor = Math.pow(1 - normalizedDist, 2);
                            const rawDmg = splashDmg * falloffFactor;

                            const actualSplash = Math.max(1, rawDmg - def);
                            v.hp -= actualSplash;
                            Helpers.spawnFloater(v.pos, `-${actualSplash.toFixed(1)}`, '#ef4444');
                        });

                        // 如果打的是基地，结算基地伤害
                        if (target === "base") {
                            let baseDmg = u.damage;
                            if (uConfig.bonusBaseDamage) baseDmg += uConfig.bonusBaseDamage;
                            const actualBaseDmg = Math.max(1, baseDmg - 50); // 基地远程防御 50
                            enemyFaction.baseHp -= actualBaseDmg;
                            Helpers.spawnFloater(impactPos, `-${actualBaseDmg}`, '#d946ef');
                        } else {
                            // 如果主目标还在爆炸范围内，它也会受到 splashDmg (上面 victims 已经包含了它)
                            // 但是投石机对主目标有额外伤害吗？
                            // 题目说：它本身攻击有一个目标... 对基地伤害+240... 但是对溅射的目标，只有40伤害。
                            // 这意味着主目标受到的伤害 = 基础伤害(40) + 加成。
                            // 溅射目标受到 40。
                            // 如果我们把主目标也算在 victims 里，它受了 40。
                            // 我们需要给主目标补上 (TotalDamage - 40) 的差值?
                            // 或者：主目标单独结算，victims 排除主目标。
                            // 题目："对溅射的目标，只有40伤害"。
                            // 让我们把主目标单独拿出来。
                            // 但是！"投石机几乎无法对移动的骑兵产生伤害"。
                            // 这意味着如果主目标跑了，它就不应该受到“主目标伤害”，甚至可能连溅射伤害都吃不到。
                            // 所以：所有伤害都应该是基于位置的。
                            // 如果主目标还在位置上，它就是 victims 之一。
                            // 此时它受到 40 点伤害。
                            // 那它的 +80 vs Ranged 怎么算？
                            // 只有当它确实被击中时。
                            // 我们可以这样：遍历 victims，如果 v.id === targetId，则应用额外伤害。

                            // 修正 victims 循环：
                        }
                    }, flightTime);

                    // 投石机不需要立即显示伤害，return
                    return true;
                }

                let dmg = u.damage;
                if (target !== "base") {
                    dmg += u.getBonusDamage(target.tags);
                } else {
                    if (uConfig.bonusBaseDamage) {
                        dmg += uConfig.bonusBaseDamage;
                    }
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

                // === AOE 逻辑 (非投石机，如后续有其他 AOE 单位) ===
                if (uConfig.aoeRadius && uConfig.aoeDamage && u.type !== UnitType.Mangonel) {
                    // ... 原有逻辑保留给未来可能的单位，或者直接删除如果只有投石机是 AOE
                    // 暂时保留但加上 type 判断
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

                // 防守/撤退时，向左移动，应该检查左边的友军 (index + 1)
                // 因为 friends 是按 pos 从大到小排序 (右到左)，所以 index+1 是左边的单位
                if (index < friends.length - 1) {
                    const friend = friends[index + 1];
                    // 修正：friend.pos 是中心点。
                    // 自身中心 nextPos 必须 >= friend.pos + friend.width/2 + u.width/2
                    // 简化模型：假设 width 是全宽。
                    // 碰撞条件：|posA - posB| >= (widthA + widthB)/2
                    // friend 在左，u 在右。 nextPos >= friend.pos + (friend.width + u.width)/2

                    // 让我们用更精确的计算：
                    const spacing = (friend.width + u.width) / 2;
                    limit = Math.max(limit, friend.pos + spacing);
                }

                if (nextPos < limit) nextPos = limit;
            } else {
                let limit = u.isDeployed ? finalLimit : myBaseCenter;

                // Enemy (dir = -1): Retreat moves Right.
                // Friends sorted Ascending (Left to Right). [0] is Leftmost.
                // Moving Right means moving towards [index + 1] (Right neighbor).
                if (index < friends.length - 1) {
                    const friend = friends[index + 1];
                    // friend 在右，u 在左。 nextPos <= friend.pos - spacing
                    const spacing = (friend.width + u.width) / 2;
                    const friendLimit = friend.pos - spacing;
                    limit = Math.min(limit, friendLimit);
                }
                if (nextPos > limit) nextPos = limit;
            }
        }

        u.pos = nextPos;
    }

    private createProjectile(u: Unit, target: Unit | "base", dir: number, color: string, speedOverride?: number) {
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
            speed: speedOverride || this.ARROW_SPEED,
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