// API URL
const API_URL = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return '/api';
})();

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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Загрузка популярных товаров
async function loadPopularProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (response.ok) {
            const allProducts = await response.json();
            const popular = allProducts.filter(p => p.is_popular == 1).slice(0, 4);
            
            const container = document.getElementById('popularProducts');
            if (container) {
                if (popular.length > 0) {
                    container.innerHTML = popular.map(p => `
                        <div class="product-card">
                            ${p.is_popular ? '<span class="product-badge popular">🔥 ХИТ</span>' : ''}
                            <img src="${p.image_url || 'img/default.jpg'}" alt="${escapeHtml(p.name)}" onerror="this.src='img/default.jpg';">
                            <h4>${escapeHtml(p.name)}</h4>
                            <p>${escapeHtml(p.description || '')}</p>
                            <div class="price">${(p.price || 0).toLocaleString()} сом</div>
                            <div class="quantity-control">
                                <button class="quantity-btn qty-minus">−</button>
                                <input class="quantity-input" value="1" min="1">
                                <span class="quantity-unit">${p.unit || 'шт'}</span>
                                <button class="quantity-btn qty-plus">+</button>
                            </div>
                            <button class="add-to-cart-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price || 0}" data-image="${p.image_url || 'img/default.jpg'}">
                                <i class="fas fa-shopping-cart"></i> В корзину
                            </button>
                        </div>
                    `).join('');
                    
                    if (typeof window.initQuantityControls === 'function') {
                        setTimeout(() => window.initQuantityControls(container), 100);
                    }
                } else {
                    container.innerHTML = `<div class="empty-products"><i class="fas fa-box-open"></i><p>Популярные товары скоро появятся</p></div>`;
                }
            }
        }
    } catch (err) {
        console.error('Ошибка:', err);
    }
}

// Обновление счётчика корзины
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('teplosilaCart') || '{"count":0}');
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = cart.count || 0);
}

// Инициализация кнопок количества
function initQuantityControls(container) {
    container.querySelectorAll('.qty-minus').forEach(btn => {
        btn.removeEventListener('click', handleQtyMinus);
        btn.addEventListener('click', handleQtyMinus);
    });
    container.querySelectorAll('.qty-plus').forEach(btn => {
        btn.removeEventListener('click', handleQtyPlus);
        btn.addEventListener('click', handleQtyPlus);
    });
}

function handleQtyMinus(e) {
    const btn = e.target.closest('.qty-minus');
    if (!btn) return;
    const control = btn.closest('.quantity-control');
    const input = control.querySelector('.quantity-input');
    let val = parseInt(input.value) || 1;
    if (val > 1) {
        input.value = val - 1;
    }
}

function handleQtyPlus(e) {
    const btn = e.target.closest('.qty-plus');
    if (!btn) return;
    const control = btn.closest('.quantity-control');
    const input = control.querySelector('.quantity-input');
    let val = parseInt(input.value) || 1;
    input.value = val + 1;
}

// Корзина
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

// Обработка формы обратной связи
async function handleCallbackForm(e) {
    e.preventDefault();
    
    const name = document.getElementById('callbackName').value;
    const phone = document.getElementById('callbackPhone').value;
    const question = document.getElementById('callbackQuestion').value;
    
    if (!name || !phone) {
        showNotification('❌ Заполните имя и телефон!', true);
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/callbacks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, question })
        });
        
        if (response.ok) {
            showNotification('✅ Заявка отправлена! Мы свяжемся с вами.');
            document.getElementById('callbackForm').reset();
        } else {
            showNotification('❌ Ошибка отправки. Попробуйте позже.', true);
        }
    } catch (err) {
        showNotification('❌ Ошибка соединения. Проверьте интернет.', true);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Обработка добавления в корзину
function initAddToCartButtons() {
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

// Поиск
function initSearch() {
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
            } catch(err) { 
                showNotification('Ошибка поиска', true);
            }
        };
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadPopularProducts();
    loadCart();
    updateCartCount();
    initAddToCartButtons();
    initSearch();
    
    // Форма обратной связи
    const callbackForm = document.getElementById('callbackForm');
    if (callbackForm) {
        callbackForm.addEventListener('submit', handleCallbackForm);
    }
    
    // Обновление счетчика при изменении localStorage
    window.addEventListener('storage', updateCartCount);
    
    // Интервал для обновления счетчика
    setInterval(updateCartCount, 1000);
    
    // Экспортируем функцию для глобального доступа
    window.initQuantityControls = initQuantityControls;
});
