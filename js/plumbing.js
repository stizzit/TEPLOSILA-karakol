// ===== API URL =====
const API_URL = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000/api';
    return '/api';
})();

// ===== КОРЗИНА =====
let cart = { items: [], total: 0, count: 0 };

function loadCart() {
    const saved = localStorage.getItem('teplosilaCart');
    if (saved) try { cart = JSON.parse(saved); } catch(e) { cart = { items: [], total: 0, count: 0 }; }
    updateCartDisplay();
}

function saveCart() {
    localStorage.setItem('teplosilaCart', JSON.stringify(cart));
    updateCartDisplay();
}

function updateCartDisplay() {
    document.querySelectorAll('.cart-count').forEach(el => { if (el) el.textContent = cart.count || 0; });
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
    notif.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:${isError ? '#EF4444' : '#10B981'};color:white;padding:12px 24px;border-radius:50px;z-index:10000;font-weight:600;font-size:14px;white-space:nowrap;`;
    notif.innerHTML = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ===== ОТОБРАЖЕНИЕ ТОВАРОВ =====
function renderProductGrid(containerId, products, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!products || products.length === 0) {
        container.innerHTML = `<div class="empty-products"><i class="fas fa-box-open"></i><p>Товары скоро появятся</p></div>`;
        return;
    }
    
    container.innerHTML = products.map(p => {
        const isOutOfStock = (p.stock || 0) <= 0;
        let unitText = p.unit || 'шт';
        if (type === 'pipe') unitText = 'метр';
        else if (p.unit === 'метр') unitText = 'метр';
        
        return `
            <div class="product-card">
                ${p.is_popular ? '<span class="product-badge popular">🔥 ХИТ</span>' : ''}
                ${isOutOfStock ? '<span class="product-badge out-of-stock">❌ Нет в наличии</span>' : ''}
                <img src="${p.image_url || 'img/default.jpg'}" alt="${escapeHtml(p.name)}" onerror="this.src='img/default.jpg';">
                <h4>${escapeHtml(p.name)}</h4>
                <p>${escapeHtml(p.description || '')}</p>
                <div class="price ${isOutOfStock ? 'out-of-stock-price' : ''}">${(p.price || 0).toLocaleString()} сом</div>
                <div class="quantity-control">
                    <button class="quantity-btn qty-minus" data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>−</button>
                    <input class="quantity-input" value="1" min="1" ${isOutOfStock ? 'disabled' : ''}>
                    <span class="quantity-unit">${unitText}</span>
                    <button class="quantity-btn qty-plus" data-id="${p.id}" ${isOutOfStock ? 'disabled' : ''}>+</button>
                </div>
                <button class="add-to-cart-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price || 0}" data-image="${p.image_url || 'img/default.jpg'}" data-unit="${unitText}" ${isOutOfStock ? 'disabled' : ''}>
                    <i class="fas fa-shopping-cart"></i> ${isOutOfStock ? 'Нет в наличии' : 'В корзину'}
                </button>
            </div>
        `;
    }).join('');
}

// ===== ЗАГРУЗКА ТОВАРОВ =====
async function loadAllProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (response.ok) {
            const allProducts = await response.json();
            const products = allProducts.filter(p => p.page === 'plumbing.html' || !p.page || p.page === null);
            
            // Трубы
            renderProductGrid('ppr-products', products.filter(p => p.tab === 'ppr'), 'pipe');
            renderProductGrid('pvc-products', products.filter(p => p.tab === 'pvc'), 'pipe');
            renderProductGrid('metalplastic-products', products.filter(p => p.tab === 'metalplastic-santeh'), 'pipe');
            renderProductGrid('kanalizacia-products', products.filter(p => p.tab === 'kanalizacia'), 'pipe');
            
            // Фитинги
            renderProductGrid('connectors-products', products.filter(p => p.tab === 'connectors-santeh'), 'simple');
            renderProductGrid('krany-products', products.filter(p => p.tab === 'krany-santeh'), 'simple');
            renderProductGrid('other-products', products.filter(p => p.tab === 'other-santeh'), 'simple');
            
            // Смесители
            renderProductGrid('rakovina-products', products.filter(p => p.tab === 'rakovina'), 'simple');
            renderProductGrid('kuhnya-products', products.filter(p => p.tab === 'kuhnya'), 'simple');
            renderProductGrid('vanna-products', products.filter(p => p.tab === 'vanna'), 'simple');
            renderProductGrid('dush-products', products.filter(p => p.tab === 'dush'), 'simple');
            
            // Насосы
            renderProductGrid('drenazhnye-products', products.filter(p => p.tab === 'drenazhnye'), 'simple');
            renderProductGrid('povysitelnye-products', products.filter(p => p.tab === 'povysitelnye'), 'simple');
            renderProductGrid('glubinnye-products', products.filter(p => p.tab === 'glubinnye'), 'simple');
            renderProductGrid('cirkulyacionnye-products', products.filter(p => p.tab === 'cirkulyacionnye'), 'simple');
        }
    } catch (err) {
        console.error('Ошибка загрузки товаров:', err);
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ КНОПОК =====
function initAddToCartButtons() {
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        if (btn.dataset.listenerAdded) return;
        btn.dataset.listenerAdded = 'true';
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            
            const card = btn.closest('.product-card');
            let quantity = 1;
            if (card) {
                const qtyInput = card.querySelector('.quantity-input');
                if (qtyInput) quantity = parseInt(qtyInput.value) || 1;
            }
            
            await addToCart({
                id: btn.dataset.id,
                name: btn.dataset.name,
                price: parseFloat(btn.dataset.price) || 0,
                image: btn.dataset.image || 'img/default.jpg',
                quantity: quantity,
                unit: btn.dataset.unit || 'шт'
            });
        });
    });
}

function initQuantityButtons() {
    document.querySelectorAll('.quantity-control').forEach(control => {
        if (control.dataset.initialized) return;
        control.dataset.initialized = 'true';
        
        const minusBtn = control.querySelector('.qty-minus');
        const plusBtn = control.querySelector('.qty-plus');
        const input = control.querySelector('.quantity-input');
        
        if (minusBtn) {
            minusBtn.addEventListener('click', () => {
                let val = parseInt(input.value) || 1;
                if (val > 1) input.value = val - 1;
            });
        }
        if (plusBtn) {
            plusBtn.addEventListener('click', () => {
                let val = parseInt(input.value) || 1;
                input.value = val + 1;
            });
        }
        if (input) {
            input.addEventListener('change', () => {
                let val = parseInt(input.value) || 1;
                if (val < 1) input.value = 1;
            });
        }
    });
}

// ===== ПЕРЕКЛЮЧЕНИЕ КАТЕГОРИЙ =====
function initCategoryTabs() {
    // Главные категории
    document.querySelectorAll('.main-category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const categoryId = this.dataset.category;
            document.querySelectorAll('.main-category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.category-section').forEach(s => s.classList.remove('active'));
            document.getElementById(categoryId).classList.add('active');
        });
    });
    
    // Подкатегории
    document.querySelectorAll('.subcategory-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const categoryId = this.dataset.category;
            const subcategoryId = this.dataset.subcategory;
            
            const parent = this.closest('.category-section');
            parent.querySelectorAll('.subcategory-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            parent.querySelectorAll('.subcategory-section').forEach(s => s.classList.remove('active'));
            const targetId = categoryId + '-' + subcategoryId;
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        });
    });
}

// ===== МОБИЛЬНОЕ МЕНЮ =====
function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const menu = document.getElementById('mobileMenu');
    const close = document.getElementById('mobileMenuClose');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => { menu.classList.add('active'); document.body.style.overflow = 'hidden'; });
    const closeMenu = () => { menu.classList.remove('active'); document.body.style.overflow = ''; };
    if (close) close.addEventListener('click', closeMenu);
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    menu.addEventListener('click', (e) => { if (e.target === menu) closeMenu(); });
}

// ===== ПОИСК =====
function initSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const searchBtn = document.getElementById('globalSearchBtn');
    if (!searchInput || !searchBtn) return;
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

// ===== ЗАПУСК =====
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initSearch();
    loadCart();
    loadAllProducts();
    initCategoryTabs();
    
    setTimeout(() => {
        initAddToCartButtons();
        initQuantityButtons();
    }, 500);
    
    setInterval(() => {
        initAddToCartButtons();
        initQuantityButtons();
    }, 1000);
});
