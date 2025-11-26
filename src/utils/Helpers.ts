export class Helpers {
    static spawnFloater(xPercent: number, text: string, color: string) {
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;

        const el = document.createElement('div');
        el.className = 'floater';

        // 计算像素位置
        const rect = wrapper.getBoundingClientRect();
        el.style.left = (xPercent / 100 * rect.width) + 'px';

        // 添加随机垂直偏移 (-30 到 +30 像素)
        const randomOffset = Math.random() * 60 - 30;
        el.style.top = (rect.height / 2 - 20 + randomOffset) + 'px';

        el.style.color = color;

        // 根据伤害值调整字体大小
        // 从文本中提取数字（例如 "-120.5" -> 120.5）
        const damageMatch = text.match(/[\d.]+/);
        if (damageMatch) {
            const damage = parseFloat(damageMatch[0]);
            // 伤害越大，字体越大：12px 到 24px
            // 小于10: 12px, 大于100: 24px, 线性插值
            const fontSize = Math.min(24, Math.max(12, 12 + damage / 10));
            el.style.fontSize = fontSize + 'px';
        }

        el.innerText = text;

        wrapper.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    }

    static showToast(msg: string, color: string = '#ef4444') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'toast text-white px-4 py-2 rounded shadow-lg font-bold';
        el.style.background = color;
        el.innerText = msg;

        container.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }

    private static TAG_MAP: Record<string, string> = {
        'INFANTRY': '步兵',
        'CAVALRY': '骑兵',
        'ARCHER': '射手',
        'SIEGE': '攻城',
        'MELEE': '近战',
        'RANGED': '远程',
        'LIGHT': '轻装',
        'HEAVY': '重装',
        'WORKER': '工人'
    };

    static translateTag(tag: string): string {
        return this.TAG_MAP[tag] || tag;
    }

    static getDamageColor(damage: number): string {
        // 颜色插值：1=白，20=红，40=紫
        if (damage <= 1) {
            return '#ffffff'; // 白色
        } else if (damage <= 20) {
            // 白色(255,255,255) 到 红色(239,68,68) 插值
            const t = (damage - 1) / (20 - 1); // 0 到 1
            const r = Math.round(255 - (255 - 239) * t);
            const g = Math.round(255 - (255 - 68) * t);
            const b = Math.round(255 - (255 - 68) * t);
            return `rgb(${r}, ${g}, ${b})`;
        } else if (damage <= 40) {
            // 红色(239,68,68) 到 紫色(217,70,239) 插值
            const t = (damage - 20) / (40 - 20); // 0 到 1
            const r = Math.round(239 - (239 - 217) * t);
            const g = Math.round(68 + (70 - 68) * t);
            const b = Math.round(68 + (239 - 68) * t);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            return '#d946ef'; // 紫色（超过40）
        }
    }
}