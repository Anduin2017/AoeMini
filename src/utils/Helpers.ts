export class Helpers {
    static spawnFloater(xPercent: number, text: string, color: string) {
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;

        const el = document.createElement('div');
        el.className = 'floater';

        // 计算像素位置 (保持原有逻辑)
        const rect = wrapper.getBoundingClientRect();
        el.style.left = (xPercent / 100 * rect.width) + 'px';
        el.style.top = (rect.height / 2 - 20) + 'px';
        el.style.color = color;
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
}