// 計算數值、Cost 總和

class PanelSimulator {
    constructor(slotCount = 8, maxCost = 200) {
        this.slotCount = slotCount;
        this.maxCost = maxCost;
        this.memories = [];
        this.slotRules = {};
        // 陣列索引 0~7 對應 slotId 1~8
        this.slots = Array(slotCount).fill(null);
    }

    async loadData(memPath = './data/memories.json') {
        const res = await fetch(memPath);
        this.memories = await res.json();
    }

    setSlotRules(rules) {
        this.slotRules = rules;
    }

    equip(slotIndex, memoryId) {
        if (slotIndex < 0 || slotIndex >= this.slotCount) return;
        const mem = this.memories.find(m => m.id === memoryId);
        this.slots[slotIndex] = mem || null;
        this.updateHash();
    }

    // 驗證某個插槽是否符合發動條件
    checkSlotCondition(slotId, memory) {
        if (!memory) return { active: false, reason: '未裝備記憶體' };
        const rule = this.slotRules[slotId];
        if (!rule) return { active: true, reason: '' };

        if (rule.minCost && memory.cost < rule.minCost) {
            return { active: false, reason: `Cost 需 ≥ ${rule.minCost}` };
        }
        if (rule.tribe && memory.tribe !== rule.tribe) {
            return { active: false, reason: `需為 ${rule.tribe}` };
        }
        if (rule.maxAtkMagic && memory.effects['攻擊魔力'] > rule.maxAtkMagic) {
            return { active: false, reason: `攻擊魔力需 ≤ ${rule.maxAtkMagic}` };
        }

        return { active: true, reason: '發動中' };
    }

    calculate() {
        let totalCost = 0;
        const totalStats = {};
        const slotStatus = [];

        this.slots.forEach((mem, idx) => {
            const slotId = (idx + 1).toString();
            if (!mem) {
                slotStatus.push({ active: false, reason: '未裝備' });
                return;
            }

            totalCost += mem.cost;

            // 1. 記憶體自身的屬性加成
            for (const [stat, val] of Object.entries(mem.effects)) {
                totalStats[stat] = (totalStats[stat] || 0) + val;
            }

            // 2. 檢查插槽發動條件，若符合則追加面板自帶效果
            const cond = this.checkSlotCondition(slotId, mem);
            slotStatus.push(cond);

            if (cond.active && this.slotRules[slotId]) {
                const panelEffects = this.slotRules[slotId].effects || {};
                for (const [stat, val] of Object.entries(panelEffects)) {
                    totalStats[stat] = (totalStats[stat] || 0) + val;
                }
            }
        });

        return {
            totalCost,
            isCostOver: totalCost > this.maxCost,
            totalStats,
            slotStatus
        };
    }

// 安全的 UTF-8 Base64 編碼
    exportHash() {
        const ids = this.slots.map(s => s ? s.id : '_').join(',');
        // 透過 encodeURIComponent 轉換為百分比編碼，再轉成純 ASCII 給 btoa
        return btoa(encodeURIComponent(ids).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode('0x' + p1);
        }));
    }

    // 安全的 UTF-8 Base64 解碼
    importHash(hashStr) {
        try {
            // 先用 atob 還原成二進位字串，再轉回 URI 字串並解碼 UTF-8
            const raw = atob(hashStr);
            const uriComponent = Array.prototype.map.call(raw, c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('');
            const decodedIds = decodeURIComponent(uriComponent).split(',');

            decodedIds.forEach((id, idx) => {
                if (id !== '_' && idx < this.slotCount) {
                    this.slots[idx] = this.memories.find(m => m.id === id) || null;
                }
            });
        } catch (e) {
            console.warn("配置代碼解析失敗或版本不相容：", e);
        }
    }

    updateHash() {
        window.location.hash = this.exportHash();
    }
}
