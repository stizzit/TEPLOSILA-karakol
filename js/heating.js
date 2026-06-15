// ===== API URL =====
const API_URL = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return '/api';
})();
// ===== КОРЗИНА =====
let cart = { items: [], total: 0, count: 0 };

function loadCart() {
    const saved = localStorage.getItem('teplosilaCart');
    if (saved) {
        try { cart = JSON.parse(saved); } catch(e) { cart = { items: [], total: 0, count: 0 }; }
    }
    updateCartDisplay();
}

function saveCart() {
    localStorage.setItem('teplosilaCart', JSON.stringify(cart));
    updateCartDisplay();
}

function updateCartDisplay() {
    document.querySelectorAll('.cart-count').forEach(el => {
        if (el) el.textContent = cart.count || 0;
    });
}

async function addToCart(product) {
    const existingItem = cart.items.find(item => String(item.id) === String(product.id));
    
    if (existingItem) {
        existingItem.quantity += product.quantity || 1;
    } else {
        cart.items.push({
            id: String(product.id),
            name: product.name,
            price: Number(product.price) || 0,
            image: product.image || 'img/default.jpg',
            quantity: product.quantity || 1,
            unit: product.unit || 'шт'
        });
    }
    
    cart.count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    saveCart();
    showNotification(`✅ "${product.name}" добавлен в корзину!`);
}

function showNotification(message, isError = false) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: ${isError ? '#EF4444' : '#10B981'}; color: white;
        padding: 12px 24px; border-radius: 50px; z-index: 10000;
        font-weight: 600; font-size: 14px; white-space: nowrap;
    `;
    notif.innerHTML = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

function initCartButtons() {
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-cart-btn');
        if (!btn) return;
        if (btn.disabled) return;
        
        e.preventDefault();
        
        const product = {
            id: btn.dataset.id,
            name: btn.dataset.name,
            price: parseFloat(btn.dataset.price) || 0,
            image: btn.dataset.image || 'img/default.jpg',
            quantity: 1,
            unit: 'шт'
        };
        
        const card = btn.closest('.product-card');
        if (card) {
            const qtyInput = card.querySelector('.quantity-input');
            if (qtyInput) product.quantity = parseInt(qtyInput.value) || 1;
            const unitSpan = card.querySelector('.quantity-unit');
            if (unitSpan && unitSpan.textContent.includes('метр')) product.unit = 'метр';
            else if (unitSpan && unitSpan.textContent.includes('секций')) product.unit = 'секций';
        }
        
        addToCart(product);
    });
}

// ===== ЗАГРУЗКА ТОВАРОВ =====
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function loadAllProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (response.ok) {
            const allProducts = await response.json();
            const products = allProducts.filter(p => p.page === 'heating.html' || !p.page);
            
            if (products.length > 0) {
                renderKotly(products.filter(p => p.section === 'kotly'));
                renderRadiators(products.filter(p => p.section === 'radiatory'));
                renderTruby(products.filter(p => p.section === 'truby'));
                renderFitingi(products.filter(p => p.section === 'fitingi'));
                renderKollektory(products.filter(p => p.section === 'kollektory'));
            }
        }
    } catch (err) {
        console.error('Ошибка:', err);
    }
}

function renderKotly(products) {
    renderProductGrid('kotly-elektro-products', products.filter(p => p.tab === 'elektro-kotly'), 'simple');
    renderProductGrid('kotly-poluavtomat-products', products.filter(p => p.tab === 'poluavtomat-kotly'), 'simple');
    renderProductGrid('kotly-automat-products', products.filter(p => p.tab === 'automat-kotly'), 'simple');
    renderProductGrid('kotly-klassika-products', products.filter(p => p.tab === 'klassika-kotly'), 'simple');
    renderProductGrid('kotly-sapog-products', products.filter(p => p.tab === 'sapog-kotly'), 'simple');
}

function renderRadiators(products) {
    const aluminium = products.filter(p => p.subcategory === 'aluminium');
    const bimetal = products.filter(p => p.subcategory === 'bimetal');
    const castiron = products.filter(p => p.subcategory === 'castiron');
    
    renderProductGrid('aluminium-60-products', aluminium.filter(p => p.tab === '60cm'), 'radiator');
    renderProductGrid('aluminium-40-products', aluminium.filter(p => p.tab === '40cm'), 'radiator');
    renderProductGrid('aluminium-30-products', aluminium.filter(p => p.tab === '30cm'), 'radiator');
    
    renderProductGrid('bimetal-60-products', bimetal.filter(p => p.tab === '60cm'), 'radiator');
    renderProductGrid('bimetal-40-products', bimetal.filter(p => p.tab === '40cm'), 'radiator');
    renderProductGrid('bimetal-30-products', bimetal.filter(p => p.tab === '30cm'), 'radiator');
    
    renderProductGrid('castiron-products', castiron, 'radiator');
}

function renderTruby(products) {
    renderProductGrid('metalplastic-products', products.filter(p => p.tab === 'metalplastic'), 'pipe');
    renderProductGrid('steel-products', products.filter(p => p.tab === 'steel'), 'pipe');
    renderProductGrid('warmfloor-products', products.filter(p => p.tab === 'warmfloor'), 'pipe');
    renderProductGrid('chimney-steel-products', products.filter(p => p.tab === 'chimney-steel'), 'pipe');
    renderProductGrid('chimney-nerzh-products', products.filter(p => p.tab === 'chimney-nerzh'), 'pipe');
}

function renderFitingi(products) {
    renderProductGrid('connectors-products', products.filter(p => p.tab === 'connectors'), 'simple');
    renderProductGrid('krany-products', products.filter(p => p.tab === 'krany'), 'simple');
    renderProductGrid('other-products', products.filter(p => p.tab === 'other'), 'simple');
}

function renderKollektory(products) {
    renderProductGrid('kollektory-products', products.filter(p => p.tab === 'kollektory'), 'simple');
    renderProductGrid('kollektory-fitingi-products', products.filter(p => p.tab === 'fitingi-tpl'), 'simple');
}

function renderProductGrid(containerId, products, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = `<div class="empty-products"><i class="fas fa-box-open"></i><p>Товары скоро появятся</p></div>`;
        return;
    }
    
    container.innerHTML = products.map(p => {
        let defaultQty = 1;
        let unitText = p.unit || 'шт';
        
        if (type === 'radiator') {
            defaultQty = 10;
            unitText = 'секций';
        } else if (type === 'pipe') {
            unitText = 'метр';
        } else if (p.unit === 'метр') {
            unitText = 'метр';
        }
        
        return `
            <div class="product-card">
                ${p.is_popular ? '<span class="product-badge popular">🔥 ХИТ</span>' : ''}
                <img src="${p.image_url || 'img/default.jpg'}" alt="${escapeHtml(p.name)}" onerror="this.src='img/default.jpg';">
                <h4>${escapeHtml(p.name)}</h4>
                <p>${escapeHtml(p.description || '')}</p>
                <div class="price">${(p.price || 0).toLocaleString()} сом</div>
                ${type === 'radiator' ? '<div class="section-price">Цена за 1 секцию</div>' : ''}
                <div class="quantity-control">
                    <button class="quantity-btn qty-minus">−</button>
                    <input class="quantity-input" value="${defaultQty}" min="1">
                    <span class="quantity-unit">${unitText}</span>
                    <button class="quantity-btn qty-plus">+</button>
                </div>
                <button class="add-to-cart-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price || 0}" data-image="${p.image_url || 'img/default.jpg'}">
                    <i class="fas fa-shopping-cart"></i> В корзину
                </button>
            </div>
        `;
    }).join('');
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
    // Мобильное меню
    const menuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuClose = document.getElementById('mobileMenuClose');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        const closeMenu = () => {
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        };
        if (menuClose) menuClose.addEventListener('click', closeMenu);
        mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
        mobileMenu.addEventListener('click', (e) => { if (e.target === mobileMenu) closeMenu(); });
    }
    
    // Поиск
    const searchInput = document.getElementById('globalSearchInput');
    const searchBtn = document.getElementById('globalSearchBtn');
    if (searchInput && searchBtn) {
        const performSearch = async () => {
            const query = searchInput.value.trim().toLowerCase();
            if (!query) return;
            try {
                const res = await fetch(`${API_URL}/products`);
                const allProducts = await res.json();
                const foundProducts = allProducts.filter(p => {
                    const searchText = [p.name || '', p.description || '', String(p.price || '')].join(' ').toLowerCase();
                    return searchText.includes(query);
                });
                sessionStorage.setItem('searchQuery', query);
                sessionStorage.setItem('searchResults', JSON.stringify(foundProducts));
                window.location.href = 'search.html';
            } catch(err) { alert('Ошибка поиска'); }
        };
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    }
    
    // Вкладки
    const mainTabs = document.querySelectorAll('.main-category-tab');
    mainTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const category = this.dataset.category;
            mainTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.category-section').forEach(s => s.classList.remove('active'));
            document.getElementById(category).classList.add('active');
        });
    });
    
    document.querySelectorAll('.subcategory-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const parent = this.closest('.category-section');
            const subcategory = this.dataset.subcategory;
            const chimney = this.dataset.chimney;
            
            if (chimney) {
                const chimneyParent = this.closest('.subcategory-section');
                chimneyParent.querySelectorAll('[data-chimney]').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                chimneyParent.querySelectorAll('.height-section').forEach(s => s.classList.remove('active'));
                document.getElementById('chimney-' + chimney).classList.add('active');
                return;
            }
            
            parent.querySelectorAll('.subcategory-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            if (subcategory) {
                parent.querySelectorAll('.subcategory-section').forEach(s => s.classList.remove('active'));
                const targetId = parent.id + '-' + subcategory;
                const target = document.getElementById(targetId);
                if (target) target.classList.add('active');
            }
        });
    });
    
    document.querySelectorAll('.height-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const parent = this.closest('.subcategory-section');
            const height = this.dataset.height;
            parent.querySelectorAll('.height-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            parent.querySelectorAll('.height-section').forEach(s => s.classList.remove('active'));
            const subcatId = parent.id;
            let prefix = '';
            if (subcatId.includes('aluminium')) prefix = 'aluminium';
            else if (subcatId.includes('bimetal')) prefix = 'bimetal';
            const targetId = prefix + '-' + height;
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        });
    });
    
    // Загрузка товаров
    loadAllProducts();
    
    // Корзина
    loadCart();
    initCartButtons();
    
    // Обновление счетчика
    function updateCartCount() {
        const cartData = JSON.parse(localStorage.getItem('teplosilaCart') || '{"count":0}');
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = cartData.count || 0);
    }
    updateCartCount();
    setInterval(updateCartCount, 1000);
    window.addEventListener('storage', updateCartCount);
    
    // Кнопки количества
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.qty-minus, .qty-plus');
        if (!btn) return;
        e.preventDefault();
        const control = btn.closest('.quantity-control');
        const input = control.querySelector('.quantity-input');
        let val = parseInt(input.value) || 1;
        if (btn.classList.contains('qty-minus')) val = Math.max(1, val - 1);
        else val = val + 1;
        input.value = val;
    });
});
