// script.js - ТЕПЛОСИЛА (ПОЛНАЯ ВЕРСИЯ)

// ===== API URL (скрыт) =====
const API_URL = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return `http://${hostname}:3000/api`;
})();

// ===== КОРЗИНА =====
let cart = {
    items: [],
    total: 0,
    count: 0
};

function loadCart() {
    const saved = localStorage.getItem('teplosilaCart');
    if (saved) {
        try {
            cart = JSON.parse(saved);
        } catch(e) {
            cart = { items: [], total: 0, count: 0 };
        }
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

// Функция проверки остатка на сервере
async function checkProductStock(productId, requestedQuantity) {
    try {
        const response = await fetch(`${API_URL}/check-stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: productId, quantity: requestedQuantity }] })
        });
        const result = await response.json();
        return result;
    } catch (err) {
        console.error('Ошибка проверки остатка:', err);
        return { available: true };
    }
}

async function addToCart(product) {
    // Проверяем остаток перед добавлением
    const stockCheck = await checkProductStock(product.id, product.quantity || 1);
    
    if (!stockCheck.available) {
        const outOfStock = stockCheck.outOfStock?.[0];
        if (outOfStock) {
            showNotification(`❌ Недостаточно товара "${product.name}". Доступно: ${outOfStock.available} ${product.unit || 'шт'}`, true);
        } else {
            showNotification(`❌ Товар "${product.name}" закончился!`, true);
        }
        return;
    }
    
    const existingItem = cart.items.find(item => String(item.id) === String(product.id));
    
    if (existingItem) {
        const newQuantity = existingItem.quantity + (product.quantity || 1);
        const finalCheck = await checkProductStock(product.id, newQuantity);
        if (!finalCheck.available) {
            const outOfStock = finalCheck.outOfStock?.[0];
            showNotification(`❌ Нельзя добавить больше ${outOfStock?.available || 0} шт.`, true);
            return;
        }
        existingItem.quantity = newQuantity;
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

function removeFromCart(productId) {
    cart.items = cart.items.filter(item => String(item.id) !== String(productId));
    cart.count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    saveCart();
    showNotification(`🗑 Товар удален из корзины`);
}

function updateCartItemQuantity(productId, quantity) {
    const item = cart.items.find(item => String(item.id) === String(productId));
    if (item) {
        item.quantity = Math.max(1, quantity);
        cart.count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        saveCart();
    }
}

function clearCart() {
    cart = { items: [], total: 0, count: 0 };
    saveCart();
}

function showNotification(message, isError = false) {
    const existingNotif = document.querySelector('.custom-notification');
    if (existingNotif) existingNotif.remove();
    
    const notif = document.createElement('div');
    notif.className = 'custom-notification';
    notif.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${isError ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)'};
        color: white;
        padding: 14px 28px;
        border-radius: 50px;
        z-index: 10000;
        box-shadow: 0 10px 40px ${isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'};
        font-weight: 600;
        font-size: 14px;
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    notif.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-check-circle'}" style="font-size: 18px;"></i> ${message}`;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// Добавляем стили для анимации уведомлений
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyle);

function initQuantityControls(container = document.body) {
    const controls = container.querySelectorAll('.quantity-control');
    
    controls.forEach(control => {
        if (control.dataset.initialized === 'true') return;
        control.dataset.initialized = 'true';
        
        const minusBtn = control.querySelector('.qty-minus, .quantity-minus');
        const plusBtn = control.querySelector('.qty-plus, .quantity-plus');
        const input = control.querySelector('.quantity-input');
        
        if (!minusBtn || !plusBtn || !input) return;
        
        const updateValue = (newValue) => {
            let val = Math.max(1, parseInt(newValue) || 1);
            input.value = val;
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
        };
        
        minusBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentVal = parseInt(input.value) || 1;
            updateValue(currentVal - 1);
        });
        
        plusBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentVal = parseInt(input.value) || 1;
            updateValue(currentVal + 1);
        });
        
        input.addEventListener('change', (e) => {
            let val = parseInt(e.target.value) || 1;
            val = Math.max(1, val);
            e.target.value = val;
        });
        
        input.addEventListener('input', (e) => {
            let val = parseInt(e.target.value) || 1;
            if (val < 1) {
                e.target.value = 1;
            }
        });
    });
}

// ===== ГЛОБАЛЬНЫЙ ОБРАБОТЧИК КОРЗИНЫ =====
function initCartButtons() {
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('.add-to-cart-btn');
        if (!btn) return;
        
        if (btn.disabled) return;
        if (btn.dataset.processing === 'true') return;
        btn.dataset.processing = 'true';
        
        let productId = btn.dataset.id;
        let productName = btn.dataset.name;
        let productPrice = parseFloat(btn.dataset.price) || 0;
        let productImage = btn.dataset.image || 'img/default.jpg';
        
        if (!productName) {
            const card = btn.closest('.product-card');
            if (card) {
                productName = card.querySelector('h4')?.textContent || 'Товар';
                const priceEl = card.querySelector('.price');
                if (priceEl) {
                    const priceText = priceEl.textContent.replace(/[^\d]/g, '');
                    productPrice = parseInt(priceText) || 0;
                }
                const img = card.querySelector('img');
                if (img) productImage = img.src;
            }
        }
        
        let quantity = 1;
        const card = btn.closest('.product-card');
        if (card) {
            const qtyInput = card.querySelector('.quantity-input');
            if (qtyInput && !qtyInput.disabled) {
                quantity = parseInt(qtyInput.value) || 1;
            }
        }
        
        let unit = 'шт';
        const unitSpan = card?.querySelector('.quantity-unit');
        if (unitSpan && unitSpan.textContent.includes('метр')) {
            unit = 'метр';
        } else if (unitSpan && unitSpan.textContent.includes('секций')) {
            unit = 'секций';
        }
        
        await addToCart({
            id: productId,
            name: productName,
            price: productPrice,
            image: productImage,
            quantity: quantity,
            unit: unit
        });
        
        setTimeout(() => {
            delete btn.dataset.processing;
        }, 500);
    });
}

// ===== МОБИЛЬНОЕ МЕНЮ =====
function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const menu = document.getElementById('mobileMenu');
    const close = document.getElementById('mobileMenuClose');
    
    if (!toggle || !menu) return;
    
    toggle.addEventListener('click', () => {
        menu.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    const closeMenu = () => {
        menu.classList.remove('active');
        document.body.style.overflow = '';
    };
    
    if (close) close.addEventListener('click', closeMenu);
    
    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });
    
    menu.addEventListener('click', (e) => {
        if (e.target === menu) closeMenu();
    });
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
                const searchText = [
                    p.name || '',
                    p.description || '',
                    String(p.price || ''),
                    p.section || '',
                    p.tab || '',
                    p.unit || ''
                ].join(' ').toLowerCase();
                
                const queryWords = query.split(/\s+/);
                return queryWords.some(word => searchText.includes(word));
            });
            
            sessionStorage.setItem('searchQuery', query);
            sessionStorage.setItem('searchResults', JSON.stringify(foundProducts));
            window.location.href = 'search.html';
            
        } catch (err) {
            console.error('Ошибка поиска:', err);
            alert('🔍 Поиск временно недоступен. Попробуйте позже.');
        }
    };
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

// ===== ФОРМА ОБРАТНОЙ СВЯЗИ В TELEGRAM =====
function initCallbackForm() {
    const callbackForm = document.getElementById('callbackForm');
    if (!callbackForm) return;
    
    callbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('callbackName')?.value || '';
        const phone = document.getElementById('callbackPhone')?.value || '';
        const question = document.getElementById('callbackQuestion')?.value || '';
        
        if (!name || !phone) {
            showNotification('❌ Заполните имя и телефон!', true);
            return;
        }
        
        const submitBtn = callbackForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        submitBtn.disabled = true;
        
        try {
            
            const response = await fetch(`${API_URL}/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, question })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                showNotification('✅ Заявка отправлена! Мы свяжемся с вами.');
                callbackForm.reset();
            } else {
                console.error('❌ Ошибка сервера:', result);
                showNotification('❌ Ошибка отправки. Попробуйте позже.', true);
            }
        } catch (err) {
            console.error('❌ Ошибка:', err);
            showNotification('❌ Ошибка отправки. Попробуйте позже.', true);
        }
        
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

// ===== НАБЛЮДАТЕЛЬ ЗА НОВЫМИ ЭЛЕМЕНТАМИ =====
function initMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        let shouldInit = false;
        
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.classList?.contains('products-grid') ||
                            node.classList?.contains('product-card') ||
                            node.querySelector?.('.quantity-control')) {
                            shouldInit = true;
                        }
                    }
                });
            }
        });
        
        if (shouldInit) {
            setTimeout(() => {
                initQuantityControls();
            }, 100);
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

// ===== ЗАГРУЗКА ПРИ СТАРТЕ =====
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    initCartButtons();
    initMobileMenu();
    initSearch();
    initCallbackForm();
    initQuantityControls();
    initMutationObserver();
    
    
});

// ===== ЭКСПОРТ =====
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.clearCart = clearCart;
window.cart = cart;
window.updateCartDisplay = updateCartDisplay;
window.initQuantityControls = initQuantityControls;