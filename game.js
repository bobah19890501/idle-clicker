const GAME_CONFIG = {
    BASE_CLICK_POWER: 1,
    AUTO_SAVE_INTERVAL: 30000,
    UPGRADE_MULTIPLIER: 1.15,
    WORKER_MULTIPLIER: 1.2,
};

const UPGRADES = {
    clickPower: {
        name: 'Щипцы',
        description: '+1 урон',
        icon: '✂️',
        baseCost: 10,
        level: 0,
        count: 0,
        effect: 'clickPower',
    },
    efficiency: {
        name: 'Эффективность',
        description: '+10% урона',
        icon: '⚡',
        baseCost: 100,
        level: 0,
        count: 0,
        effect: 'multiplier',
    },
    magnetism: {
        name: 'Магнетизм',
        description: '+5 монет',
        icon: '🧲',
        baseCost: 500,
        level: 0,
        count: 0,
        effect: 'magnet',
    },
};

const WORKERS = {
    ant: {
        name: 'Муравей',
        description: '1 DPS',
        icon: '🐜',
        baseCost: 15,
        baseDPS: 1,
        level: 0,
        count: 0,
    },
    bee: {
        name: 'Пчела',
        description: '5 DPS',
        icon: '🐝',
        baseCost: 100,
        baseDPS: 5,
        level: 0,
        count: 0,
    },
    spider: {
        name: 'Паук',
        description: '25 DPS',
        icon: '🕷️',
        baseCost: 1000,
        baseDPS: 25,
        level: 0,
        count: 0,
    },
    dragon: {
        name: 'Дракон',
        description: '250 DPS',
        icon: '🐉',
        baseCost: 50000,
        baseDPS: 250,
        level: 0,
        count: 0,
    },
};

const SHOP_ITEMS = {
    premiumPack1: {
        name: 'Стартовый пакет',
        description: '+100 ⭐',
        icon: '⭐',
        cost: 99,
        premium: 100,
        realMoney: true,
    },
    premiumPack2: {
        name: 'Золотой пакет',
        description: '+1000 ⭐',
        icon: '👑',
        cost: 499,
        premium: 1000,
        realMoney: true,
    },
    premiumPack3: {
        name: 'Платиновый пакет',
        description: '+5000 ⭐',
        icon: '💎',
        cost: 1999,
        premium: 5000,
        realMoney: true,
    },
};

class GameState {
    constructor() {
        this.money = 0;
        this.premium = 0;
        this.clickPower = GAME_CONFIG.BASE_CLICK_POWER;
        this.totalClicks = 0;
        this.totalDPS = 0;
        this.lastSave = Date.now();
        this.upgrades = JSON.parse(JSON.stringify(UPGRADES));
        this.workers = JSON.parse(JSON.stringify(WORKERS));
        this.settings = {
            sound: true,
            vibration: true,
            notifications: true,
            autoSave: true,
        };
    }

    toJSON() {
        return {
            money: this.money,
            premium: this.premium,
            clickPower: this.clickPower,
            totalClicks: this.totalClicks,
            totalDPS: this.totalDPS,
            upgrades: this.upgrades,
            workers: this.workers,
            settings: this.settings,
        };
    }

    fromJSON(data) {
        if (!data) return;
        this.money = data.money || 0;
        this.premium = data.premium || 0;
        this.clickPower = data.clickPower || GAME_CONFIG.BASE_CLICK_POWER;
        this.totalClicks = data.totalClicks || 0;
        this.totalDPS = data.totalDPS || 0;
        this.upgrades = data.upgrades || JSON.parse(JSON.stringify(UPGRADES));
        this.workers = data.workers || JSON.parse(JSON.stringify(WORKERS));
        this.settings = { ...this.settings, ...data.settings };
    }
}

class IdleClicker {
    constructor() {
        this.state = new GameState();
        this.lastClickTime = 0;
        this.dpsInterval = null;
        this.autoSaveInterval = null;
        this.yandexSDK = null;
        this.notificationTimeout = null;

        this.initYandexSDK();
        this.init();
    }

    async initYandexSDK() {
        try {
            if (typeof YaGames !== 'undefined') {
                this.yandexSDK = await YaGames.init({ dispatcherProxy: false });
                console.log('Yandex SDK initialized');
                this.setupAnalytics();
            }
        } catch (e) {
            console.log('Yandex SDK not available (dev mode)');
        }
    }

    setupAnalytics() {
        if (!this.yandexSDK) return;
        this.logEvent('game_start');
    }

    logEvent(eventName, params = {}) {
        if (this.yandexSDK?.getMetrica) {
            try {
                this.yandexSDK.getMetrica().then(metrica => {
                    metrica.reachGoal(eventName, params);
                });
            } catch (e) {
                console.log('Analytics error:', e);
            }
        }
    }

    init() {
        this.loadGame();
        this.setupEventListeners();
        this.startDPS();
        this.startAutoSave();
        this.render();
    }

    setupEventListeners() {
        document.getElementById('clickButton').addEventListener('click', (e) => this.handleClick(e));
        document.getElementById('menuBtn').addEventListener('click', () => this.toggleModal('menuModal'));
        document.getElementById('closeMenuBtn').addEventListener('click', () => this.closeModal('menuModal'));
        document.getElementById('saveBtn').addEventListener('click', () => this.saveGame());
        document.getElementById('loadBtn').addEventListener('click', () => this.loadGame());
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('Вы уверены? Это удалит все сохранения!')) {
                this.resetGame();
            }
        });
        document.getElementById('settingsBtn').addEventListener('click', () => this.toggleModal('settingsModal'));
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeModal('settingsModal'));
        
        document.getElementById('soundToggle').addEventListener('change', (e) => {
            this.state.settings.sound = e.target.checked;
        });
        document.getElementById('vibrationToggle').addEventListener('change', (e) => {
            this.state.settings.vibration = e.target.checked;
        });
        document.getElementById('notificationsToggle').addEventListener('change', (e) => {
            this.state.settings.notifications = e.target.checked;
        });
        document.getElementById('autoSaveToggle').addEventListener('change', (e) => {
            this.state.settings.autoSave = e.target.checked;
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    handleClick(e) {
        const clickButton = document.getElementById('clickButton');
        const rect = clickButton.getBoundingClientRect();
        const x = e.clientX || e.touches?.[0]?.clientX || rect.left + rect.width / 2;
        const y = e.clientY || e.touches?.[0]?.clientY || rect.top + rect.height / 2;

        this.state.money += this.state.clickPower;
        this.state.totalClicks++;

        this.playSound('click');
        this.triggerVibration(10);
        clickButton.classList.add('pulse');
        setTimeout(() => clickButton.classList.remove('pulse'), 300);

        this.showFloatingNumber(x, y, `+${this.state.clickPower}`);
        this.render();

        this.logEvent('click', { power: this.state.clickPower });
    }

    startDPS() {
        if (this.dpsInterval) clearInterval(this.dpsInterval);
        this.dpsInterval = setInterval(() => this.updateDPS(), 100);
    }

    updateDPS() {
        let totalDPS = 0;
        for (const workerId in this.state.workers) {
            const worker = this.state.workers[workerId];
            totalDPS += worker.baseDPS * worker.count;
        }

        this.state.totalDPS = totalDPS;
        const moneyPerFrame = totalDPS / 10;
        if (moneyPerFrame > 0) {
            this.state.money += moneyPerFrame;
        }

        this.render();
    }

    getUpgradeCost(upgradeId) {
        const upgrade = this.state.upgrades[upgradeId];
        return Math.floor(upgrade.baseCost * Math.pow(GAME_CONFIG.UPGRADE_MULTIPLIER, upgrade.level));
    }

    buyUpgrade(upgradeId) {
        const upgrade = this.state.upgrades[upgradeId];
        const cost = this.getUpgradeCost(upgradeId);

        if (this.state.money < cost) {
            this.showNotification('❌ Недостаточно монет!', 'error');
            this.triggerVibration(50);
            return;
        }

        this.state.money -= cost;
        upgrade.level++;
        upgrade.count++;

        this.applyUpgradeEffect(upgradeId);
        this.render();
        this.showNotification(`✅ ${upgrade.name} куплен!`, 'success');
        this.triggerVibration(20);
        this.logEvent('upgrade_bought', { upgrade: upgradeId, level: upgrade.level });
    }

    applyUpgradeEffect(upgradeId) {
        const upgrade = this.state.upgrades[upgradeId];

        switch (upgrade.effect) {
            case 'clickPower':
                this.state.clickPower += 1;
                break;
            case 'multiplier':
                this.state.clickPower *= 1.1;
                break;
            case 'magnet':
                this.state.money += 5;
                break;
        }
    }

    getWorkerCost(workerId) {
        const worker = this.state.workers[workerId];
        return Math.floor(worker.baseCost * Math.pow(GAME_CONFIG.WORKER_MULTIPLIER, worker.count));
    }

    buyWorker(workerId) {
        const worker = this.state.workers[workerId];
        const cost = this.getWorkerCost(workerId);

        if (this.state.money < cost) {
            this.showNotification('❌ Недостаточно монет!', 'error');
            this.triggerVibration(50);
            return;
        }

        this.state.money -= cost;
        worker.count++;
        this.render();
        this.showNotification(`✅ Нанят ${worker.name}!`, 'success');
        this.triggerVibration(20);
        this.logEvent('worker_bought', { worker: workerId });
    }

    buyPremium(packId) {
        const pack = SHOP_ITEMS[packId];
        if (!pack) return;

        this.state.premium += pack.premium;
        this.showNotification(`✨ +${pack.premium} ⭐ премиум!`, 'success');
        this.render();
        this.logEvent('premium_bought', { pack: packId });
    }

    toggleModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.toggle('active');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('active');
    }

    render() {
        this.updateUI();
        this.renderUpgrades();
        this.renderWorkers();
    }

    updateUI() {
        document.getElementById('moneyDisplay').textContent = this.formatNumber(this.state.money);
        document.getElementById('premiumDisplay').textContent = this.formatNumber(this.state.premium);
        document.getElementById('dpsDisplay').textContent = this.formatNumber(this.state.totalDPS) + '/сек';
        document.getElementById('clickPowerDisplay').textContent = this.formatNumber(this.state.clickPower);
        document.getElementById('clickValue').textContent = `+${this.formatNumber(this.state.clickPower)}`;
    }

    renderUpgrades() {
        const container = document.getElementById('upgradesContainer');
        container.innerHTML = '';

        for (const upgradeId in this.state.upgrades) {
            const upgrade = this.state.upgrades[upgradeId];
            const cost = this.getUpgradeCost(upgradeId);
            const canBuy = this.state.money >= cost;

            const card = document.createElement('div');
            card.className = `upgrade-card ${!canBuy ? 'disabled' : ''}`;
            card.innerHTML = `
                <div class="card-icon">${upgrade.icon}</div>
                <div class="card-name">${upgrade.name}</div>
                <div class="card-description">${upgrade.description}</div>
                <div class="card-level">Уровень: ${upgrade.level}</div>
                <div class="card-price">💰 ${this.formatNumber(cost)}</div>
                <div class="card-count">×${upgrade.count}</div>
            `;
            card.addEventListener('click', () => this.buyUpgrade(upgradeId));
            container.appendChild(card);
        }
    }

    renderWorkers() {
        const container = document.getElementById('workersContainer');
        container.innerHTML = '';

        for (const workerId in this.state.workers) {
            const worker = this.state.workers[workerId];
            const cost = this.getWorkerCost(workerId);
            const canBuy = this.state.money >= cost;
            const dps = worker.baseDPS * worker.count;

            const card = document.createElement('div');
            card.className = `worker-card ${!canBuy ? 'disabled' : ''}`;
            card.innerHTML = `
                <div class="card-icon">${worker.icon}</div>
                <div class="card-name">${worker.name}</div>
                <div class="card-description">${worker.baseDPS} DPS</div>
                <div class="card-level">×${worker.count}</div>
                <div class="card-price">💰 ${this.formatNumber(cost)}</div>
                ${dps > 0 ? `<div class="card-count">⚙️ ${this.formatNumber(dps)}</div>` : ''}
            `;
            card.addEventListener('click', () => this.buyWorker(workerId));
            container.appendChild(card);
        }
    }

    formatNumber(num) {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return Math.floor(num).toString();
    }

    showFloatingNumber(x, y, text) {
        const container = document.getElementById('floatingNumbers');
        const span = document.createElement('div');
        span.className = 'floating-number';
        span.textContent = text;
        span.style.left = x + 'px';
        span.style.top = y + 'px';
        container.appendChild(span);
        setTimeout(() => span.remove(), 1000);
    }

    showNotification(message, type = 'info') {
        if (!this.state.settings.notifications) return;

        // Удаляем предыдущее уведомление если оно есть
        const existingNotif = document.getElementById('notification');
        if (existingNotif) {
            existingNotif.remove();
            clearTimeout(this.notificationTimeout);
        }

        // Создаем новое уведомление
        const notif = document.createElement('div');
        notif.id = 'notification';
        notif.className = `notification notification-${type} show`;
        notif.textContent = message;
        document.body.appendChild(notif);

        // Удаляем через 3 секунды
        this.notificationTimeout = setTimeout(() => {
            notif.classList.remove('show');
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    playSound(type) {
        if (!this.state.settings.sound) return;
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (type === 'click') {
                oscillator.frequency.value = 400;
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            }
        } catch (e) {
            // Audio not available
        }
    }

    triggerVibration(duration) {
        if (!this.state.settings.vibration) return;
        if (navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }

    saveGame() {
        try {
            const data = JSON.stringify(this.state.toJSON());
            localStorage.setItem('idleClickerSave', data);
            this.showSaveIndicator();
            this.showNotification('💾 Игра сохранена!', 'save');
            this.logEvent('game_saved');
        } catch (e) {
            console.error('Save error:', e);
            this.showNotification('❌ Ошибка сохранения!', 'error');
        }
    }

    showSaveIndicator() {
        // Создаем иконку сохранения
        const saveIcon = document.createElement('div');
        saveIcon.className = 'save-indicator';
        saveIcon.textContent = '💾';
        document.body.appendChild(saveIcon);

        // Удаляем через 1 секунду
        setTimeout(() => {
            saveIcon.classList.add('hide');
            setTimeout(() => saveIcon.remove(), 300);
        }, 1000);
    }

    loadGame() {
        try {
            const data = localStorage.getItem('idleClickerSave');
            if (data) {
                this.state.fromJSON(JSON.parse(data));
                this.render();
                this.showNotification('📂 Игра загружена!', 'info');
                this.logEvent('game_loaded');
            } else {
                this.showNotification('⚠️ Сохранений не найдено', 'warning');
            }
        } catch (e) {
            console.error('Load error:', e);
            this.showNotification('❌ Ошибка загрузки!', 'error');
        }
    }

    resetGame() {
        localStorage.removeItem('idleClickerSave');
        this.state = new GameState();
        this.render();
        this.showNotification('🔄 Игра сброшена!', 'info');
        this.logEvent('game_reset');
        this.closeModal('menuModal');
    }

    startAutoSave() {
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = setInterval(() => {
            if (this.state.settings.autoSave) {
                this.saveGame();
            }
        }, GAME_CONFIG.AUTO_SAVE_INTERVAL);
    }

    destroy() {
        if (this.dpsInterval) clearInterval(this.dpsInterval);
        if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
        if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
        this.saveGame();
    }
}

let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new IdleClicker();
});

window.addEventListener('beforeunload', () => {
    if (game) game.destroy();
});
