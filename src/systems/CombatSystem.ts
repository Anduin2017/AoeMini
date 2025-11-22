import { Game } from "../core/Game";
import { Unit } from "../entities/units/Unit";
import { FactionType, UnitTag, UnitType } from "../core/Types";
import { CONSTANTS } from "../core/Constants";
import { Helpers } from "../utils/Helpers";
import { UNIT_CONFIG } from "../data/UnitConfig";

export class CombatSystem {
    private game: Game;

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
        
        if (stance === 'attack') {
            friends.sort((a, b) => dir === 1 ? b.pos - a.pos : a.pos - b.pos);
        } else {
            friends.sort((a, b) => dir === 1 ? a.pos - b.pos : b.pos - a.pos);
        }

        const enemies = [...enemyFaction.units]; 

        friends.forEach((u, i) => {
            const hasTarget = this.handleCombat(u, enemies, enemyFaction, dir);
            
            if (!(u.stopOnAttack && u.state === 'attack')) {
                const laneFriends = friends.filter(f => f.lane === u.lane);
                const laneIndex = laneFriends.findIndex(f => f.id === u.id);
                this.handleMovement(u, laneFriends, enemies, laneIndex, dir, stance);
            }
        });
    }

    private handleCombat(u: Unit, enemies: Unit[], enemyFaction: any, dir: number): boolean {
        if (u.attackAnimTimer > 0) u.attackAnimTimer--;
        if (u.attackCooldown > 0) u.attackCooldown--;

        const uConfig = UNIT_CONFIG[u.type];
        const attackType = uConfig.attackType || 'melee'; 
        const isMeleeUnit = attackType === 'melee';

        // === 核心修正：基地的物理边缘 ===
        // 敌方基地的中心
        const enemyBasePos = dir === 1 ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
        // 敌方基地的面向我方的一侧边缘
        // 敌人在右(96)，边缘 = 96 - 4 = 92
        // 敌人在左(4)，边缘 = 4 + 4 = 8
        const enemyBaseEdge = enemyBasePos - (dir * CONSTANTS.BASE_WIDTH / 2);

        let targets = enemies.filter(e => {
            if (Math.abs(u.pos - e.pos) > u.range) return false;
            if (isMeleeUnit) {
                // 视线阻挡：如果我在墙外，敌人在墙里，不能打
                // 简单判断：攻击者与目标之间是否隔着“大门”
                // 由于现在都在同一坐标系，直接用坐标比较即可
                // 但为了简化，只要距离够就能打（穿墙修正留给进阶物理）
                // 这里保留最基础的：如果还没摸到门，就不能打门里面的人
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
            // 攻击基地判断：距离 = |单位位置 - 基地边缘|
            // 注意：这里使用边缘计算更符合直觉
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

                if (target === "base") {
                    const baseDef = 2; 
                    const actualDmg = Math.max(1, dmg - baseDef);
                    enemyFaction.baseHp -= actualDmg;
                    // 飘字在基地边缘
                    Helpers.spawnFloater(enemyBaseEdge, `-${actualDmg}`, CONSTANTS.COLORS.TEXT_FLOAT_BASE);
                } else {
                    const defenseVal = (attackType === 'ranged') ? target.def_r : target.def_m;
                    const actualDmg = Math.max(1, dmg - defenseVal);
                    target.hp -= actualDmg;
                    Helpers.spawnFloater(target.pos, `-${actualDmg}`, CONSTANTS.COLORS.TEXT_FLOAT_DMG);
                }
            }
            return true;
        } else {
            u.state = 'move';
            return false;
        }
    }

    private handleMovement(u: Unit, friends: Unit[], enemies: Unit[], index: number, dir: number, stance: string) {
        // === 核心修正：出生/回防逻辑 ===
        const myBaseCenter = u.owner === FactionType.Player ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;
        const myBaseEdge = myBaseCenter + (dir * CONSTANTS.BASE_WIDTH / 2);

        // 部署逻辑：一旦完全走出基地大门
        if (!u.isDeployed) {
            if ((dir === 1 && u.pos > myBaseEdge + u.width/2) || 
                (dir === -1 && u.pos < myBaseEdge - u.width/2)) {
                u.isDeployed = true;
            }
        }

        let nextPos = u.pos;
        const speed = u.speed * dir;

        if (stance === 'attack') {
            nextPos += speed;
            
            if (index > 0) {
                const friend = friends[index - 1];
                const limit = friend.pos - (dir * u.width);
                if (dir === 1 ? nextPos > limit : nextPos < limit) nextPos = limit;
            }
            
            const enemiesInLane = enemies.filter(e => e.lane === u.lane);
            if (enemiesInLane.length > 0) {
                 const nearestEnemy = enemiesInLane.sort((a,b) => Math.abs(u.pos - a.pos) - Math.abs(u.pos - b.pos))[0];
                 const limit = nearestEnemy.pos - (dir * (u.width + 0.1)); 
                 if (dir === 1 ? nextPos > limit : nextPos < limit) nextPos = limit;
            }

            // === 进攻限制：敌方基地的边缘 ===
            const enemyBaseCenter = dir === 1 ? CONSTANTS.ENEMY_BASE_POS : CONSTANTS.PLAYER_BASE_POS;
            // 目标点 = 敌方中心 - (方向 * (基地半宽 + 单位半宽))
            // 这样单位会停在刚好碰到基地边缘的位置
            const attackLimit = enemyBaseCenter - (dir * (CONSTANTS.BASE_WIDTH/2 + u.width/2)); 
            
            if (dir === 1) {
                if (nextPos > attackLimit) nextPos = attackLimit;
            } else {
                if (nextPos < attackLimit) nextPos = attackLimit;
            }

        } else if (stance === 'defend') {
            nextPos -= speed;
            
            // === 防守限制：我方基地的边缘 ===
            // 回退极限 = 我方中心 + (方向 * (基地半宽 + 单位半宽))
            const wallLimit = myBaseCenter + (dir * (CONSTANTS.BASE_WIDTH/2 + u.width/2));

            if (dir === 1) { 
                // 如果已部署，最多退到门口；如果未部署，可以退回中心（出生点）
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

    // ... cleanupDead 和 processTurrets (略，保持逻辑但需更新坐标引用) ...
    // 为防万一，这里补全 processTurrets，确保使用新常量
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
            if (!f.hasTurret) return;
            if (f.turretCooldown > 0) { f.turretCooldown--; return; }
            
            const enemies = f === this.game.player ? this.game.enemy.units : this.game.player.units;
            // 炮台位置 = 基地中心
            const turretPos = f === this.game.player ? CONSTANTS.PLAYER_BASE_POS : CONSTANTS.ENEMY_BASE_POS;
            const range = CONSTANTS.BASE_RANGE * 2;

            const targets = enemies.filter(e => Math.abs(e.pos - turretPos) <= range);
            if (targets.length > 0) {
                f.turretCooldown = 8; 
                const shotCount = Math.min(targets.length, 3);
                for(let i=0; i<shotCount; i++) {
                    const t = targets[Math.floor(Math.random()*targets.length)];
                    const dmg = 12;
                    const actualDmg = Math.max(1, dmg - t.def_r);
                    t.hp -= actualDmg;
                    this.game.turretShots.push({
                        start: turretPos, end: t.pos, 
                        color: f === this.game.player ? '#60a5fa' : '#f87171'
                    });
                    Helpers.spawnFloater(t.pos, `-${actualDmg.toFixed(1)}`, '#f0f');
                }
            }
        });
    }
}