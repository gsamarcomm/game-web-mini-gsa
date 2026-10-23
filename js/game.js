/**
 * GSA INDONESIA - CORE GAME LOGIC & SIMULATION
 * Handles store economics, customer queue, orders, upgrades, restocks,
 * audio triggers, 3D scene events, and the 50 Juta victory condition.
 */

class StoreGame {
  constructor() {
    // Game Economics & Progress
    this.cash = 3000000; // Modal awal Rp 3.000.000 untuk kulakan/operasional
    this.totalRevenue = 0; // Target Rp 50.000.000
    this.customersServed = 0;
    this.gameWon = false;
    this.endlessMode = false;
    this.day = 1;
    this.startTime = Date.now();
    this.customerCardMinimized = false;

    // Stock Management
    this.stock = {
      acp: 30,
      wpc: 45,
      spc: 20,
      flexibel_stone: 25,
      sealant: 60
    };

    this.maxStock = {
      acp: 80,
      wpc: 100,
      spc: 50,
      flexibel_stone: 60,
      sealant: 150
    };

    // Upgrades
    this.upgrades = {
      vipLoyalty: {
        id: 'vipLoyalty',
        name: 'Program Kontraktor VIP',
        desc: 'Pelanggan proyek loyal memberikan bonus keuntungan tambahan +10% per level.',
        level: 0,
        maxLevel: 3,
        cost: 2500000,
        icon: '👑'
      },
      fastRestock: {
        id: 'fastRestock',
        name: 'Truk Ekspedisi Kilat',
        desc: 'Diskon biaya kulakan 15% & restok langsung tiba seketika.',
        level: 0,
        maxLevel: 3,
        cost: 1500000,
        icon: '🚚'
      },
      marketing: {
        id: 'marketing',
        name: 'Iklan & Banner Medsos',
        desc: 'Pelanggan datang 2x lebih cepat dan sering borong partai besar.',
        level: 0,
        maxLevel: 4,
        cost: 1000000,
        icon: '📢'
      },
      luxuryDecor: {
        id: 'luxuryDecor',
        name: 'Display Rak Mewah',
        desc: 'Pelanggan lebih sabar menunggu dan memberikan bonus tip hingga 25%.',
        level: 0,
        maxLevel: 3,
        cost: 2000000,
        icon: '✨'
      },
      warehouseExp: {
        id: 'warehouseExp',
        name: 'Gudang Kapasitas Jumbo',
        desc: 'Melipatgandakan kapasitas maksimal stok semua bahan baku.',
        level: 0,
        maxLevel: 3,
        cost: 1800000,
        icon: '🏭'
      }
    };

    // Customer queue & arrival scheduler
    this.activeCustomer = null;
    this.customerSpawnTimer = 0;
    this.nextCustomerTimeout = null;
    this.nextCustomerCountdownInterval = null;
    this.nextCustomerDelay = 0;
    this.nextCustomerTargetTime = 0;
    this.patienceInterval = null;
    this.victoryResetInterval = null;

    // 3D Scene Reference
    this.scene3d = null;

    // Load saved game if exists
    this.loadGame();
  }

  init(scene3d) {
    this.scene3d = scene3d;

    // Apply upgrade visual transformations immediately if any upgrade is leveled
    if (this.scene3d) {
      this.scene3d.updateUpgradesVisual(this.upgrades);
    }

    this.bindEvents();
    this.updateHUD();
    this.scheduleNextCustomer();
    this.startAutoSave();
  }

  // --- SAVE & LOAD (LOCAL STORAGE) ---
  saveGame() {
    try {
      const state = {
        cash: this.cash,
        totalRevenue: this.totalRevenue,
        customersServed: this.customersServed,
        stock: this.stock,
        maxStock: this.maxStock,
        upgrades: this.upgrades,
        gameWon: this.gameWon,
        endlessMode: this.endlessMode,
        timestamp: Date.now()
      };
      localStorage.setItem('GSA_INDONESIA_SAVE', JSON.stringify(state));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  loadGame() {
    try {
      const saved = localStorage.getItem('GSA_INDONESIA_SAVE');
      if (saved) {
        const state = JSON.parse(saved);
        this.cash = state.cash ?? this.cash;
        this.totalRevenue = state.totalRevenue ?? this.totalRevenue;
        this.customersServed = state.customersServed ?? this.customersServed;
        this.stock = { ...this.stock, ...(state.stock || {}) };
        this.maxStock = { ...this.maxStock, ...(state.maxStock || {}) };
        if (state.upgrades) {
          for (let k in state.upgrades) {
            if (this.upgrades[k]) {
              this.upgrades[k].level = state.upgrades[k].level;
              this.upgrades[k].cost = state.upgrades[k].cost;
            }
          }
        }
        this.gameWon = state.gameWon ?? false;
        this.endlessMode = state.endlessMode ?? false;
      }
    } catch (e) {
      console.warn('Load failed', e);
    }
  }

  startAutoSave() {
    setInterval(() => this.saveGame(), 5000);
  }

  // --- JEDA RANDOM 1-5 DETIK UNTUK SETIAP CUSTOMER YANG DATANG (BERJALAN DI BACKGROUND) ---
  scheduleNextCustomer() {
    if (this.gameWon || this.gameFinished) return;

    if (this.nextCustomerTimeout) {
      clearTimeout(this.nextCustomerTimeout);
      this.nextCustomerTimeout = null;
    }

    // Jeda random antara 1 sampai 5 detik (1.0s - 5.0s) berjalan hening di background
    const minSec = 1.0;
    const maxSec = 5.0;
    const delaySec = +(minSec + Math.random() * (maxSec - minSec)).toFixed(1);
    const delayMs = Math.round(delaySec * 1000);

    this.nextCustomerDelay = delaySec;

    // Perbarui UI antrean customer ke tampilan santai menunggu tanpa hitungan detik
    this.renderCustomerUI();

    this.nextCustomerTimeout = setTimeout(() => {
      this.spawnCustomer();
    }, delayMs);
  }

  spawnCustomer() {
    if (this.activeCustomer || this.gameWon || this.gameFinished) return;
    this.customerSpawnTimer = Date.now();

    // Pick random customer profile
    const profile = window.CUSTOMER_PROFILES[Math.floor(Math.random() * window.CUSTOMER_PROFILES.length)];
    const marketingBonus = this.upgrades.marketing.level * 0.10;
    const vipBonus = this.upgrades.vipLoyalty.level * 0.08;
    const isSultan = Math.random() < (0.20 + marketingBonus + vipBonus);

    // Generate random order of products
    const prodKeys = Object.keys(window.GAME_PRODUCTS);
    // 1 to 3 items for regular, 3 to 5 items for sultan
    const numItems = isSultan ? Math.min(5, Math.floor(Math.random() * 3) + 3) : Math.floor(Math.random() * 2) + 1;
    const shuffled = [...prodKeys].sort(() => 0.5 - Math.random());
    const selectedKeys = shuffled.slice(0, numItems);

    const order = {};
    let totalOrderPrice = 0;

    selectedKeys.forEach(key => {
      let qty = 1;
      if (key === 'sealant') {
        qty = isSultan ? Math.floor(Math.random() * 25) + 10 : Math.floor(Math.random() * 6) + 1;
      } else if (key === 'wpc') {
        qty = isSultan ? Math.floor(Math.random() * 20) + 8 : Math.floor(Math.random() * 6) + 1;
      } else if (key === 'acp') {
        qty = isSultan ? Math.floor(Math.random() * 15) + 6 : Math.floor(Math.random() * 4) + 1;
      } else if (key === 'spc') {
        qty = isSultan ? Math.floor(Math.random() * 12) + 4 : Math.floor(Math.random() * 3) + 1;
      } else if (key === 'flexibel_stone') {
        qty = isSultan ? Math.floor(Math.random() * 12) + 4 : Math.floor(Math.random() * 3) + 1;
      }
      order[key] = qty;
      totalOrderPrice += qty * window.GAME_PRODUCTS[key].price;
    });

    const maxPatience = 24 + (this.upgrades.luxuryDecor.level * 8); // seconds

    this.activeCustomer = {
      id: 'cust_' + Date.now(),
      name: isSultan ? `👑 ${profile.name} (Proyek Kontraktor)` : profile.name,
      role: isSultan ? 'Order Partai Besar Proyek' : profile.role,
      avatar: profile.avatar,
      order,
      totalPrice: totalOrderPrice,
      maxPatience,
      patience: maxPatience,
      isSultan
    };

    // Play entrance chime
    window.soundManager.playDoorChime();

    // Spawn in 3D Scene
    if (this.scene3d) {
      this.scene3d.spawnCustomer3D(this.activeCustomer);
    }

    // Start patience timer
    this.startPatienceCountdown();
    this.renderCustomerUI();
  }

  startPatienceCountdown() {
    if (this.patienceInterval) clearInterval(this.patienceInterval);

    this.patienceInterval = setInterval(() => {
      if (!this.activeCustomer) {
        clearInterval(this.patienceInterval);
        return;
      }

      this.activeCustomer.patience -= 0.2;
      this.updatePatienceBar();

      // Customer runs out of patience and leaves
      if (this.activeCustomer.patience <= 0) {
        clearInterval(this.patienceInterval);
        this.customerLeavesAngry();
      }
    }, 200);
  }

  customerLeavesAngry() {
    if (!this.activeCustomer) return;
    this.showToast(`😢 ${this.activeCustomer.name} kecewa karena terlalu lama menunggu!`);
    window.soundManager.playAngry();

    if (this.scene3d) {
      this.scene3d.removeCustomer3D(this.activeCustomer.id);
    }

    this.activeCustomer = null;
    this.renderCustomerUI();
    this.scheduleNextCustomer();
  }

  canFulfillOrder(order) {
    for (let k in order) {
      if ((this.stock[k] || 0) < order[k]) {
        return false;
      }
    }
    return true;
  }

  // --- SERVE & PACK ORDER ---
  serveCustomer(isAuto = false) {
    if (!this.activeCustomer) return;
    const cust = this.activeCustomer;

    if (!this.canFulfillOrder(cust.order)) {
      this.showToast('⚠️ Stok tidak mencukupi! Silakan restok produk dulu.');
      window.soundManager.playPop();
      return;
    }

    // Deduct stock
    for (let k in cust.order) {
      this.stock[k] -= cust.order[k];
    }

    // Calculate Tip based on patience & luxury decor
    const patienceRatio = cust.patience / cust.maxPatience;
    let tipPercent = 0;
    if (patienceRatio > 0.6) tipPercent = 0.10; // 10% fast service tip
    else if (patienceRatio > 0.3) tipPercent = 0.05;

    // Decor bonus
    tipPercent += this.upgrades.luxuryDecor.level * 0.05;

    // VIP Contractor profit bonus
    const vipProfitBonus = this.upgrades.vipLoyalty.level * 0.10;
    const bonusMargin = Math.floor(cust.totalPrice * vipProfitBonus);

    const tipAmount = Math.floor(cust.totalPrice * tipPercent);
    const finalEarned = cust.totalPrice + tipAmount + bonusMargin;

    this.cash += finalEarned;
    this.totalRevenue += finalEarned;
    this.customersServed++;

    // Sounds & 3D FX
    window.soundManager.playCashRegister();
    window.soundManager.playCoin();

    if (this.scene3d) {
      this.scene3d.spawnFloatingCash(finalEarned);
      this.scene3d.removeCustomer3D(cust.id);
    }

    // Notification toast
    const extraParts = [];
    if (tipAmount > 0) extraParts.push(`Tip ${window.formatRupiah(tipAmount)}`);
    if (bonusMargin > 0) extraParts.push(`VIP ${window.formatRupiah(bonusMargin)}`);
    const extraMsg = extraParts.length > 0 ? ` (+${extraParts.join(', ')})` : '';
    this.showToast(`✅ Terjual: ${cust.name} bayar ${window.formatRupiah(finalEarned)}${extraMsg}!`);

    // Reset active customer
    if (this.patienceInterval) clearInterval(this.patienceInterval);
    this.activeCustomer = null;

    this.updateHUD();
    this.renderCustomerUI();
    this.saveGame();

    // Check Win Condition: Reached Rp 500.000.000!
    if (this.totalRevenue >= window.WIN_TARGET_REVENUE && !this.gameWon) {
      this.triggerVictory();
    } else {
      this.scheduleNextCustomer();
    }
  }

  // --- RESTOCK SYSTEM ---
  restockProduct(productId) {
    const prod = window.GAME_PRODUCTS[productId];
    if (!prod) return;

    // Calculate restock cost (discounted if fastRestock upgrade is active)
    const discount = this.upgrades.fastRestock.level * 0.05;
    const unitCost = Math.floor(prod.cost * (1 - discount));
    const packQty = prod.restockPack;
    const totalCost = unitCost * packQty;

    const current = this.stock[productId] || 0;
    const max = this.maxStock[productId];

    if (current >= max) {
      this.showToast(`📦 Gudang ${prod.shortName} sudah penuh!`);
      return;
    }

    if (this.cash < totalCost) {
      this.showToast(`💸 Uang kas tidak cukup untuk restok ${prod.shortName} (${window.formatRupiah(totalCost)})!`);
      window.soundManager.playPop();
      return;
    }

    this.cash -= totalCost;
    const addQty = Math.min(packQty, max - current);
    this.stock[productId] += addQty;

    window.soundManager.playTruckHorn();
    if (this.scene3d) {
      this.scene3d.animateDeliveryArrival();
    }

    this.showToast(`🚚 Berhasil restok +${addQty} ${prod.unit} ${prod.shortName}!`);
    this.updateHUD();
    this.renderStockModalContent();
    this.renderCustomerUI();
    this.saveGame();
  }

  quickRestockMissing() {
    if (!this.activeCustomer) return;
    const order = this.activeCustomer.order;
    let restockedAny = false;

    for (let k in order) {
      const needed = order[k];
      const cur = this.stock[k] || 0;
      if (cur < needed) {
        this.restockProduct(k);
        restockedAny = true;
      }
    }

    if (!restockedAny) {
      this.showToast('Semua produk sudah tersedia di rak!');
    }
  }

  restockAllBatch() {
    let restockTotal = 0;
    for (let k in window.GAME_PRODUCTS) {
      const prod = window.GAME_PRODUCTS[k];
      if ((this.stock[k] || 0) < this.maxStock[k]) {
        const discount = this.upgrades.fastRestock.level * 0.05;
        const totalCost = Math.floor(prod.cost * (1 - discount)) * prod.restockPack;
        if (this.cash >= totalCost) {
          this.cash -= totalCost;
          this.stock[k] = Math.min(this.maxStock[k], this.stock[k] + prod.restockPack);
          restockTotal++;
        }
      }
    }

    if (restockTotal > 0) {
      window.soundManager.playTruckHorn();
      if (this.scene3d) this.scene3d.animateDeliveryArrival();
      this.showToast(`🚚 Truk GSA mengisi stok ${restockTotal} jenis produk!`);
      this.updateHUD();
      this.renderStockModalContent();
      this.renderCustomerUI();
      this.saveGame();
    } else {
      this.showToast('Semua rak sudah penuh atau uang kas belum cukup!');
    }
  }

  // --- UPGRADE STORE SYSTEM ---
  buyUpgrade(upgradeId) {
    const upg = this.upgrades[upgradeId];
    if (!upg) return;

    if (upg.level >= upg.maxLevel) {
      this.showToast(`Upgrade ${upg.name} sudah maksimal!`);
      return;
    }

    if (this.cash < upg.cost) {
      this.showToast(`💸 Uang kas tidak cukup (${window.formatRupiah(upg.cost)})!`);
      window.soundManager.playPop();
      return;
    }

    this.cash -= upg.cost;
    upg.level++;
    upg.cost = Math.floor(upg.cost * 1.8);

    // Apply specific upgrade bonus
    if (upgradeId === 'warehouseExp') {
      // Increase max stock capacity
      for (let k in this.maxStock) {
        this.maxStock[k] = Math.floor(this.maxStock[k] * 1.5);
      }
    }

    // Dynamic 3D upgrade visual transformation!
    if (this.scene3d) {
      this.scene3d.updateUpgradesVisual(this.upgrades);
    }

    window.soundManager.playVictory();
    this.showToast(`🎉 Berhasil upgrade ${upg.name} (Tingkat ${upg.level})! Tampilan 3D toko berubah!`);
    this.updateHUD();
    this.renderUpgradeModalContent();
    this.saveGame();
  }

  // --- VICTORY WIN TRIGGER (500 JUTA RUPIAH) ---
  triggerVictory() {
    this.gameWon = true;
    this.gameFinished = true;
    window.soundManager.playVictory();

    // Cancel customer scheduling
    if (this.nextCustomerTimeout) {
      clearTimeout(this.nextCustomerTimeout);
      this.nextCustomerTimeout = null;
    }
    if (this.nextCustomerCountdownInterval) {
      clearInterval(this.nextCustomerCountdownInterval);
      this.nextCustomerCountdownInterval = null;
    }
    if (this.patienceInterval) {
      clearInterval(this.patienceInterval);
      this.patienceInterval = null;
    }
    if (this.activeCustomer && this.scene3d) {
      this.scene3d.removeCustomer3D(this.activeCustomer.id);
      this.activeCustomer = null;
    }

    // Trigger Confetti fireworks!
    if (window.confetti) {
      const duration = 8 * 1000;
      const animationEnd = Date.now() + duration;
      const frame = () => {
        window.confetti({
          particleCount: 6,
          angle: 60,
          spread: 60,
          origin: { x: 0 }
        });
        window.confetti({
          particleCount: 6,
          angle: 120,
          spread: 60,
          origin: { x: 1 }
        });
        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }

    // Populate Victory Modal
    const modal = document.getElementById('victory-modal');
    if (modal) {
      document.getElementById('v-final-revenue').textContent = window.formatRupiah(this.totalRevenue);
      document.getElementById('v-total-customers').textContent = `${this.customersServed} Orang`;
      const timeMinutes = Math.floor((Date.now() - this.startTime) / 60000);
      document.getElementById('v-time-taken').textContent = `${Math.max(1, timeMinutes)} Menit`;
      modal.classList.add('active');

      // Modal kemenangan aktif - reset hanya dilakukan secara manual dengan menekan tombol 'Oke siap'
      if (this.victoryResetInterval) {
        clearInterval(this.victoryResetInterval);
        this.victoryResetInterval = null;
      }
    }
  }

  // --- GAME RESET SYSTEM ---
  resetGame() {
    if (this.victoryResetInterval) {
      clearInterval(this.victoryResetInterval);
      this.victoryResetInterval = null;
    }
    if (this.nextCustomerTimeout) {
      clearTimeout(this.nextCustomerTimeout);
      this.nextCustomerTimeout = null;
    }
    if (this.patienceInterval) {
      clearInterval(this.patienceInterval);
      this.patienceInterval = null;
    }

    // Clear local storage save
    try {
      localStorage.removeItem('GSA_INDONESIA_SAVE');
    } catch (e) {
      console.warn('Reset clear save failed', e);
    }

    // Reset economics
    this.cash = 3000000; // Modal awal Rp 3.000.000
    this.totalRevenue = 0;
    this.customersServed = 0;
    this.gameWon = false;
    this.gameFinished = false;
    this.startTime = Date.now();

    // Reset stock to initial default
    this.stock = {
      acp: 30,
      wpc: 45,
      spc: 20,
      flexibel_stone: 25,
      sealant: 60
    };

    // Reset max stock
    this.maxStock = {
      acp: 80,
      wpc: 100,
      spc: 50,
      flexibel_stone: 60,
      sealant: 150
    };

    // Reset upgrades
    this.upgrades.vipLoyalty.level = 0;
    this.upgrades.vipLoyalty.cost = 2500000;

    this.upgrades.fastRestock.level = 0;
    this.upgrades.fastRestock.cost = 1500000;

    this.upgrades.marketing.level = 0;
    this.upgrades.marketing.cost = 1000000;

    this.upgrades.luxuryDecor.level = 0;
    this.upgrades.luxuryDecor.cost = 2000000;

    this.upgrades.warehouseExp.level = 0;
    this.upgrades.warehouseExp.cost = 1800000;

    // Reset 3D visual transformations & clear customers
    if (this.scene3d) {
      this.scene3d.updateUpgradesVisual(this.upgrades);
      if (this.activeCustomer) {
        this.scene3d.removeCustomer3D(this.activeCustomer.id);
      }
    }
    this.activeCustomer = null;

    // Close all open modals
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

    // Audio & Toast
    window.soundManager.playPop();
    this.showToast('🔄 Toko GSA telah direset! Selamat memulai bisnis baru dari modal Rp3.000.000 menuju target Rp500.000.000!');

    // Update UI & save clean state
    this.updateHUD();
    this.saveGame();

    // Schedule next customer arrival with random 1-5 second delay
    this.scheduleNextCustomer();
  }

  // --- UI RENDERING & HUD ---
  updateHUD() {
    // Current Cash
    const cashEl = document.getElementById('hud-cash');
    if (cashEl) cashEl.textContent = window.formatRupiah(this.cash);

    // Revenue Progress Bar towards 500 Juta
    const target = window.WIN_TARGET_REVENUE;
    const percent = Math.min(100, Math.floor((this.totalRevenue / target) * 100));
    
    const fillEl = document.getElementById('progress-fill');
    if (fillEl) fillEl.style.width = `${percent}%`;

    const progText = document.getElementById('progress-text');
    if (progText) {
      if (window.innerWidth < 480) {
        progText.textContent = `${window.formatRupiah(this.totalRevenue)} (${percent}%)`;
      } else {
        progText.textContent = `${window.formatRupiah(this.totalRevenue)} / Rp500.000.000 (${percent}%)`;
      }
    }

    // Low stock alert badge on Stock Button
    let hasLowStock = false;
    for (let k in this.stock) {
      if (this.stock[k] < 10) {
        hasLowStock = true;
        break;
      }
    }
    const badge = document.getElementById('stock-alert-badge');
    if (badge) {
      badge.style.display = hasLowStock ? 'block' : 'none';
    }
  }

  updatePatienceBar() {
    if (!this.activeCustomer) return;
    const bar = document.getElementById('patience-bar');
    const emoji = document.getElementById('patience-emoji');
    if (!bar) return;

    const ratio = Math.max(0, this.activeCustomer.patience / this.activeCustomer.maxPatience);
    bar.style.width = `${ratio * 100}%`;

    bar.classList.remove('warning', 'danger');
    if (ratio < 0.25) {
      bar.classList.add('danger');
      if (emoji) emoji.textContent = '😡';
    } else if (ratio < 0.5) {
      bar.classList.add('warning');
      if (emoji) emoji.textContent = '😟';
    } else {
      if (emoji) emoji.textContent = '😊';
    }
  }

  renderCustomerUI() {
    const container = document.getElementById('customer-queue-container');
    if (!container) return;

    if (!this.activeCustomer) {
      container.innerHTML = `
        <div class="no-customer-card interactive">
          <span class="pulse-dot"></span>
          <span class="waiting-title">Menunggu pelanggan mampir ke toko...</span>
        </div>
      `;
      return;
    }

    const cust = this.activeCustomer;
    const canFulfill = this.canFulfillOrder(cust.order);
    const isMin = this.customerCardMinimized;

    // Build order chips with restock shortcuts
    let chipsHtml = '';
    for (let k in cust.order) {
      const prod = window.GAME_PRODUCTS[k];
      const reqQty = cust.order[k];
      const curStock = this.stock[k] || 0;
      const isStockOk = curStock >= reqQty;

      chipsHtml += `
        <div class="order-chip ${isStockOk ? 'in-stock' : 'out-of-stock'}">
          <span class="chip-icon">${prod.icon}</span>
          <span class="chip-name">${prod.shortName}</span>
          <span class="chip-qty">x${reqQty}</span>
          <span class="chip-stock-status">
            ${isStockOk ? `✓ Ready (${curStock})` : `⚠ Kurang (${curStock}/${reqQty})`}
          </span>
          ${!isStockOk ? `<button class="chip-quick-restock" data-prod="${k}" title="Restok +${prod.restockPack} ${prod.shortName}">+Restok</button>` : ''}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="customer-card interactive ${isMin ? 'is-minimized' : ''} ${cust.isSultan ? 'customer-sultan' : ''}">
        <div class="customer-header">
          <div class="customer-info">
            <div class="customer-avatar">${cust.avatar}</div>
            <div class="customer-name-box">
              <div class="customer-name-row">
                <span class="customer-name">${cust.name}</span>
                <span class="customer-tier-badge ${cust.isSultan ? 'sultan' : 'retail'}">
                  ${cust.isSultan ? '⭐ PROYEK BESAR' : '🏠 RETAIL'}
                </span>
              </div>
              <span class="customer-desc">${cust.role}</span>
            </div>
          </div>
          <div class="customer-controls-right">
            <div class="patience-timer" title="Kesabaran Pelanggan">
              <div id="patience-bar" class="patience-bar"></div>
            </div>
            <span id="patience-emoji" class="patience-emoji">😊</span>
            <button id="btn-toggle-card" class="btn-toggle-card" title="${isMin ? 'Buka Detail Pesanan' : 'Perkecil Tampilan'}">
              ${isMin ? '▲' : '▼'}
            </button>
          </div>
        </div>

        ${
          isMin
            ? `<div class="customer-minimized-row">
                 <div class="order-total-box">
                   <span class="order-total-label">Total Pesanan (${Object.keys(cust.order).length} Produk):</span>
                   <span class="order-total-price">${window.formatRupiah(cust.totalPrice)}</span>
                 </div>
                 ${canFulfill
                   ? `<button id="btn-serve-customer-min" class="serve-action-btn">
                        <span>🛍️</span> Kemas & Jual
                      </button>`
                   : `<button id="btn-quick-restock-min" class="serve-action-btn quick-restock-btn">
                        <span>🚚</span> Restok Cepat
                      </button>`
                 }
               </div>`
            : `<div class="customer-expanded-body">
                 <!-- Baris 1: Daftar Material Pesanan 100% Lebar Penuh -->
                 <div class="order-items-wrapper">
                   <div class="order-items-row">
                     ${chipsHtml}
                   </div>
                 </div>

                 <!-- Baris 2: Baris Aksi Bawah (Total Tagihan di Kiri & Tombol Aksi di Kanan) -->
                 <div class="customer-footer">
                   <div class="order-total-box">
                     <span class="order-total-label">Total Pesanan:</span>
                     <span class="order-total-price">${window.formatRupiah(cust.totalPrice)}</span>
                   </div>
                   ${canFulfill
                     ? `<button id="btn-serve-customer" class="serve-action-btn">
                          <span>🛍️</span> Kemas & Jual
                        </button>`
                     : `<button id="btn-quick-restock" class="serve-action-btn quick-restock-btn">
                          <span>🚚</span> Restok Cepat
                        </button>`
                   }
                 </div>
               </div>`
        }
      </div>
    `;

    this.updatePatienceBar();

    // Bind Serve / Restock Button
    const serveBtn = document.getElementById('btn-serve-customer') || document.getElementById('btn-serve-customer-min');
    if (serveBtn) {
      serveBtn.addEventListener('click', () => this.serveCustomer());
    }
    const quickRestockBtn = document.getElementById('btn-quick-restock') || document.getElementById('btn-quick-restock-min');
    if (quickRestockBtn) {
      quickRestockBtn.addEventListener('click', () => this.quickRestockMissing());
    }

    // Bind chip-quick-restock buttons
    container.querySelectorAll('.chip-quick-restock').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = e.currentTarget.getAttribute('data-prod');
        this.restockProduct(pId);
      });
    });

    // Bind Toggle Minimize / Expand Button
    const toggleBtn = document.getElementById('btn-toggle-card');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.customerCardMinimized = !this.customerCardMinimized;
        window.soundManager.playPop();
        this.renderCustomerUI();
      });
    }
  }

  // --- MODAL RENDERING ---
  openStockModal(focusProductId = null) {
    this.renderStockModalContent(focusProductId);
    const modal = document.getElementById('stock-modal');
    if (modal) modal.classList.add('active');
  }

  renderStockModalContent(focusProductId = null) {
    const listEl = document.getElementById('stock-modal-list');
    if (!listEl) return;

    let html = '';
    const discount = this.upgrades.fastRestock.level * 0.05;

    for (let k in window.GAME_PRODUCTS) {
      const prod = window.GAME_PRODUCTS[k];
      const cur = this.stock[k] || 0;
      const max = this.maxStock[k];
      const pct = Math.min(100, Math.floor((cur / max) * 100));
      const unitCost = Math.floor(prod.cost * (1 - discount));
      const batchCost = unitCost * prod.restockPack;
      const profitPerUnit = prod.price - unitCost;
      const isLow = pct < 25;

      let statusBadge = '<span class="stock-status-pill ok">✅ Stok Aman</span>';
      if (cur === 0) statusBadge = '<span class="stock-status-pill danger">❌ Habis</span>';
      else if (cur < 15) statusBadge = '<span class="stock-status-pill warn">⚠️ Menipis</span>';

      html += `
        <div class="product-stock-card" style="${focusProductId === k ? 'border-color: #ea580c; background: #ffedd5;' : ''}">
          <div class="prod-preview-icon" style="background: ${prod.color}20; color: ${prod.color}">
            ${prod.icon}
          </div>
          <div class="prod-details">
            <div class="prod-header-line">
              <span class="prod-name">${prod.name}</span>
              ${statusBadge}
            </div>
            <div class="prod-price-row">
              <span class="prod-price">Jual: <strong>${window.formatRupiah(prod.price)}</strong> / ${prod.unit}</span>
              <span class="prod-profit">Untung: +${window.formatRupiah(profitPerUnit)}</span>
            </div>
            <div class="prod-stock-meter">
              <div class="stock-meter-track">
                <div class="stock-meter-fill ${isLow ? 'low' : ''}" style="width: ${pct}%"></div>
              </div>
              <span class="stock-meter-text">${cur} / ${max} ${prod.unit}</span>
            </div>
          </div>
          <button class="restock-btn-sm" data-prod="${k}" title="Beli ${prod.restockPack} ${prod.unit}">
            +${prod.restockPack} ${prod.unit}<br><strong>${window.formatRupiah(batchCost)}</strong>
          </button>
        </div>
      `;
    }

    listEl.innerHTML = html;

    // Attach listeners
    listEl.querySelectorAll('.restock-btn-sm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pId = e.currentTarget.getAttribute('data-prod');
        this.restockProduct(pId);
      });
    });
  }

  openUpgradeModal() {
    this.renderUpgradeModalContent();
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.classList.add('active');
  }

  // --- UPGRADE VISUAL CLARITY HELPERS ---
  getUpgradeActiveEffectText(upgradeId, level) {
    if (upgradeId === 'vipLoyalty') return `+${level * 10}% Bonus Margin Keuntungan Kontraktor Proyek`;
    if (upgradeId === 'fastRestock') return `Diskon Kulakan ${level * 5}% & Truk Ekspedisi Kilat`;
    if (upgradeId === 'marketing') return `Tingkat Promo ${level} (+${level * 10}% Peluang Order Proyek Sultan)`;
    if (upgradeId === 'luxuryDecor') return `Showroom Mewah (+${level * 5}% Tip Tunai, Pelanggan +${level * 8}s Lebih Sabar)`;
    if (upgradeId === 'warehouseExp') return `Kapasitas Gudang x${Math.pow(1.5, level).toFixed(1)} Kapasitas Awal`;
    return 'Efek Aktif';
  }

  getUpgradeNextEffectText(upgradeId, nextLevel) {
    if (upgradeId === 'vipLoyalty') return `+${nextLevel * 10}% Bonus Margin Keuntungan`;
    if (upgradeId === 'fastRestock') return `Diskon Kulakan ${nextLevel * 5}%`;
    if (upgradeId === 'marketing') return `Peluang Kontraktor Sultan Bertambah`;
    if (upgradeId === 'luxuryDecor') return `Bonus Tip Bertambah +5%`;
    if (upgradeId === 'warehouseExp') return `Kapasitas Maksimal Stok +50%`;
    return 'Tingkatkan Fasilitas';
  }

  getUpgradeVisual3DText(upgradeId) {
    if (upgradeId === 'vipLoyalty') return 'Karpet Merah VIP, Plakat Emas & Mahkota Berputar di Kasir';
    if (upgradeId === 'fastRestock') return 'Truk Kontainer Cepat dengan Knalpot Krom, Spoiler & Headlight LED';
    if (upgradeId === 'marketing') return 'Spanduk Teardrop Promo Trotoar & Billboard Neon Marquee Atap Toko';
    if (upgradeId === 'luxuryDecor') return 'Lampu Sorot Showroom, Pembatas Emas & Underglow Neon Rak Material';
    if (upgradeId === 'warehouseExp') return 'Rak Rangka Baja Industri & Palet Material Ekstra di Gudang';
    return 'Tampilan 3D Toko';
  }

  renderUpgradeModalContent() {
    const listEl = document.getElementById('upgrade-modal-list');
    if (!listEl) return;

    let html = '';
    for (let k in this.upgrades) {
      const upg = this.upgrades[k];
      const isMax = upg.level >= upg.maxLevel;
      const isUpgraded = upg.level > 0;
      const visual3DText = this.getUpgradeVisual3DText(k);

      // Star display
      const starsFilled = '★'.repeat(upg.level);
      const starsEmpty = '☆'.repeat(upg.maxLevel - upg.level);
      const starRating = `<span class="upgrade-stars">${starsFilled}${starsEmpty}</span>`;

      let cardClass = 'upgrade-card';
      let badgeHtml = '';
      let detailsHtml = '';

      if (isMax) {
        cardClass += ' is-maxed';
        badgeHtml = `<span class="badge-upgrade-status badge-maxed">👑 TINGKAT MAKSIMAL (LEVEL MAX)</span>`;
        detailsHtml = `
          <div class="upgrade-3d-visual-tag">🎨 Visual 3D: <strong>${visual3DText} (Maksimal)</strong></div>
          <div class="upgrade-active-effect maxed">✨ ${this.getUpgradeActiveEffectText(k, upg.level)}</div>
        `;
      } else if (isUpgraded) {
        cardClass += ' is-upgraded';
        badgeHtml = `<span class="badge-upgrade-status badge-active">⭐ LEVEL ${upg.level} / ${upg.maxLevel} (AKTIF)</span>`;
        detailsHtml = `
          <div class="upgrade-3d-visual-tag">🎨 Visual 3D: <strong>${visual3DText}</strong></div>
          <div class="upgrade-active-effect">✅ Efek Aktif: <strong>${this.getUpgradeActiveEffectText(k, upg.level)}</strong></div>
          <div class="upgrade-next-effect">🔼 Tingkat Berikutnya: ${this.getUpgradeNextEffectText(k, upg.level + 1)}</div>
        `;
      } else {
        cardClass += ' level-zero';
        badgeHtml = `<span class="badge-upgrade-status badge-locked">⚪ Belum Diupgrade (Level 0/${upg.maxLevel})</span>`;
        detailsHtml = `
          <div class="upgrade-preview-effect">${upg.desc}</div>
          <div class="upgrade-visual-teaser">🎨 Mengubah tampilan visual 3D: ${visual3DText}</div>
        `;
      }

      html += `
        <div class="${cardClass}">
          <div class="upgrade-card-main">
            <div class="upgrade-icon-box">
              <span class="upgrade-icon">${upg.icon}</span>
              ${starRating}
            </div>
            <div class="upgrade-texts">
              <div class="upgrade-title-line">
                <span class="upgrade-title">${upg.name}</span>
                ${badgeHtml}
              </div>
              ${detailsHtml}
            </div>
          </div>
          <div class="upgrade-card-action">
            ${
              isMax
                ? `<button class="upgrade-buy-btn maxed" disabled>MAKSIMAL ✨</button>`
                : `<button class="upgrade-buy-btn" data-upgrade="${k}">
                     <span>Upgrade</span>
                     <strong>${window.formatRupiah(upg.cost)}</strong>
                   </button>`
            }
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;

    listEl.querySelectorAll('.upgrade-buy-btn:not(.maxed)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uId = e.currentTarget.getAttribute('data-upgrade');
        this.buyUpgrade(uId);
      });
    });
  }

  openCatalogModal() {
    const modal = document.getElementById('catalog-modal');
    if (modal) modal.classList.add('active');
  }

  openGuideModal() {
    const modal = document.getElementById('guide-modal');
    if (modal) modal.classList.add('active');
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>📢</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2700);
  }

  // --- EVENT BINDINGS ---
  bindEvents() {
    // Guide Modal Toggle
    const guideBtn = document.getElementById('btn-guide-toggle');
    if (guideBtn) {
      guideBtn.addEventListener('click', () => {
        this.openGuideModal();
        window.soundManager.playPop();
      });
    }

    // Manual Reset Button
    const resetBtn = document.getElementById('btn-manual-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Apakah kamu ingin mereset toko dari awal (Modal Rp3.000.000, Target Rp500.000.000)?')) {
          this.resetGame();
        }
      });
    }

    // Sound & BGM Toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const active = window.soundManager.toggleMuteAll();
        soundBtn.textContent = active ? '🔊' : '🔇';
        this.showToast(active ? 'Suara diaktifkan' : 'Suara dimatikan');
      });
    }

    const bgmBtn = document.getElementById('btn-bgm-toggle');
    if (bgmBtn) {
      bgmBtn.addEventListener('click', () => {
        const active = window.soundManager.toggleBGM();
        bgmBtn.textContent = active ? '🎵' : '🎼';
        this.showToast(active ? 'Musik GSA dinyalakan' : 'Musik dimatikan');
      });
    }

    // Camera Controls
    const btnCamFront = document.getElementById('btn-cam-front');
    if (btnCamFront && this.scene3d) {
      btnCamFront.addEventListener('click', () => {
        this.scene3d.setCameraPreset('front');
        window.soundManager.playPop();
      });
    }

    const btnCamCounter = document.getElementById('btn-cam-counter');
    if (btnCamCounter && this.scene3d) {
      btnCamCounter.addEventListener('click', () => {
        this.scene3d.setCameraPreset('counter');
        window.soundManager.playPop();
      });
    }

    const btnCamTop = document.getElementById('btn-cam-top');
    if (btnCamTop && this.scene3d) {
      btnCamTop.addEventListener('click', () => {
        this.scene3d.setCameraPreset('top');
        window.soundManager.playPop();
      });
    }

    const btnZoomIn = document.getElementById('btn-cam-zoomin');
    if (btnZoomIn && this.scene3d) {
      btnZoomIn.addEventListener('click', () => {
        this.scene3d.zoomIn();
        window.soundManager.playPop();
      });
    }

    const btnZoomOut = document.getElementById('btn-cam-zoomout');
    if (btnZoomOut && this.scene3d) {
      btnZoomOut.addEventListener('click', () => {
        this.scene3d.zoomOut();
        window.soundManager.playPop();
      });
    }

    // Bottom Dock Actions
    const dockStock = document.getElementById('dock-stock');
    if (dockStock) {
      dockStock.addEventListener('click', () => {
        this.openStockModal();
        window.soundManager.playPop();
      });
    }

    const dockUpgrade = document.getElementById('dock-upgrade');
    if (dockUpgrade) {
      dockUpgrade.addEventListener('click', () => {
        this.openUpgradeModal();
        window.soundManager.playPop();
      });
    }

    const dockRestockAll = document.getElementById('dock-restock-all');
    if (dockRestockAll) {
      dockRestockAll.addEventListener('click', () => {
        this.restockAllBatch();
      });
    }

    const dockCatalog = document.getElementById('dock-catalog');
    if (dockCatalog) {
      dockCatalog.addEventListener('click', () => {
        this.openCatalogModal();
        window.soundManager.playPop();
      });
    }

    // Restock all button in stock modal
    const modalRestockAll = document.getElementById('btn-modal-restock-all');
    if (modalRestockAll) {
      modalRestockAll.addEventListener('click', () => {
        this.restockAllBatch();
      });
    }

    // Close Modals
    document.querySelectorAll('.modal-close-btn, .modal-close-btn-footer, .modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('modal-close-btn-footer')) {
          document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
          window.soundManager.playPop();
        }
      });
    });

    // Victory Reset Button
    const btnVictoryReset = document.getElementById('btn-victory-reset');
    if (btnVictoryReset) {
      btnVictoryReset.addEventListener('click', () => {
        this.resetGame();
      });
    }

    // Keyboard Shortcuts (Desktop Accessibility)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (this.activeCustomer && this.canFulfillOrder(this.activeCustomer.order)) {
          this.serveCustomer();
        }
      } else if (e.code === 'Digit1') this.restockProduct('acp');
      else if (e.code === 'Digit2') this.restockProduct('wpc');
      else if (e.code === 'Digit3') this.restockProduct('spc');
      else if (e.code === 'Digit4') this.restockProduct('flexibel_stone');
      else if (e.code === 'Digit5') this.restockProduct('sealant');
      else if (e.code === 'KeyR') this.restockAllBatch();
    });
  }
}

window.StoreGame = StoreGame;
