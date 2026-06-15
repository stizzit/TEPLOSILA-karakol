// API URL
const API_URL = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return `http://${hostname}:3000/api`;
})();

// ===== КОРЗИНА =====
function loadCart() {
    const saved = localStorage.getItem('teplosilaCart');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch(e) {
            return { items: [], total: 0, count: 0 };
        }
    }
    return { items: [], total: 0, count: 0 };
}

function saveCart(cart) {
    localStorage.setItem('teplosilaCart', JSON.stringify(cart));
}

function recalcCart(cart) {
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    return cart;
}

function updateHeaderCount() {
    const cart = loadCart();
    document.querySelectorAll('.cart-count').forEach(el => {
        if (el) el.textContent = cart.count || 0;
    });
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast-message ${isError ? 'toast-error' : ''}`;
    toast.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function checkStock(items) {
    try {
        const response = await fetch(`${API_URL}/check-stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        const result = await response.json();
        return result;
    } catch (err) {
        console.error('Ошибка проверки остатков:', err);
        return { available: true };
    }
}

async function deductStock(items) {
    try {
        const response = await fetch(`${API_URL}/deduct-stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        return await response.json();
    } catch (err) {
        console.error('Ошибка списания:', err);
        return { success: false, error: err.message };
    }
}

function renderCart() {
    const container = document.getElementById('cartContent');
    let cart = loadCart();
    
    if (!cart.items || cart.items.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <h3>Корзина пуста</h3>
                <p>Добавьте товары из каталога</p>
                <a href="heating.html" class="continue-shopping"><i class="fas fa-arrow-left"></i> Продолжить покупки</a>
            </div>
        `;
        updateHeaderCount();
        return;
    }
    
    container.innerHTML = `
        <div class="cart-grid">
            <div class="cart-items">
                ${cart.items.map(item => `
                    <div class="cart-item" data-id="${item.id}">
                        <img src="${item.image || 'img/default.jpg'}" class="cart-item-image" onerror="this.src='img/default.jpg'">
                        <div class="cart-item-info">
                            <h4>${escapeHtml(item.name)}</h4>
                            <div class="cart-item-price">${item.price.toLocaleString()} сом${item.unit === 'метр' ? '/метр' : ''}</div>
                        </div>
                        <div class="cart-item-quantity">
                            <button class="qty-minus" data-id="${item.id}">-</button>
                            <input type="number" value="${item.quantity}" min="1" class="qty-input" data-id="${item.id}">
                            <button class="qty-plus" data-id="${item.id}">+</button>
                        </div>
                        <div class="cart-item-total">${(item.price * item.quantity).toLocaleString()} сом</div>
                        <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `).join('')}
            </div>
            <div class="cart-summary">
                <h3>Итого</h3>
                <div class="summary-row"><span>Товаров (${cart.count} шт.)</span><span>${cart.total.toLocaleString()} сом</span></div>
                <div class="summary-row summary-total"><span>К оплате</span><span>${cart.total.toLocaleString()} сом</span></div>
                <button class="checkout-btn" id="checkoutBtn"><i class="fas fa-check"></i> Оформить заказ</button>
            </div>
        </div>
    `;
    
    // События
    container.querySelectorAll('.qty-minus').forEach(btn => {
        btn.addEventListener('click', () => updateQuantity(btn.dataset.id, -1));
    });
    container.querySelectorAll('.qty-plus').forEach(btn => {
        btn.addEventListener('click', () => updateQuantity(btn.dataset.id, 1));
    });
    container.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const val = parseInt(e.target.value) || 1;
            setQuantity(id, Math.max(1, val));
        });
    });
    container.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', () => removeItem(btn.dataset.id));
    });
    document.getElementById('checkoutBtn').addEventListener('click', showOrderForm);
    updateHeaderCount();
}

async function updateQuantity(id, delta) {
    let cart = loadCart();
    const item = cart.items.find(i => i.id === id);
    if (item) {
        const newQuantity = Math.max(1, item.quantity + delta);
        
        const stockCheck = await checkStock([{ id: item.id, quantity: newQuantity }]);
        if (!stockCheck.available) {
            const outOfStock = stockCheck.outOfStock[0];
            showToast(`❌ Недостаточно товара "${item.name}". Доступно: ${outOfStock.available} ${item.unit}`, true);
            return;
        }
        
        item.quantity = newQuantity;
        cart = recalcCart(cart);
        saveCart(cart);
        renderCart();
    }
}

async function setQuantity(id, quantity) {
    let cart = loadCart();
    const item = cart.items.find(i => i.id === id);
    if (item) {
        const stockCheck = await checkStock([{ id: item.id, quantity: quantity }]);
        if (!stockCheck.available) {
            const outOfStock = stockCheck.outOfStock[0];
            showToast(`❌ Недостаточно товара "${item.name}". Доступно: ${outOfStock.available} ${item.unit}`, true);
            renderCart();
            return;
        }
        
        item.quantity = quantity;
        cart = recalcCart(cart);
        saveCart(cart);
        renderCart();
    }
}

function removeItem(id) {
    if (confirm('Удалить товар из корзины?')) {
        let cart = loadCart();
        cart.items = cart.items.filter(i => i.id !== id);
        cart = recalcCart(cart);
        saveCart(cart);
        renderCart();
    }
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

async function sendOrderToServer(orderData) {
    console.log('📤 Отправка заказа на сервер:', orderData);
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        if (response.ok) {
            const result = await response.json();
            return true;
        } else {
            const error = await response.text();
            console.error('❌ Ошибка сервера:', response.status, error);
            return false;
        }
    } catch (err) {
        console.error('❌ Ошибка отправки:', err);
        return false;
    }
}

async function showOrderForm() {
    const cart = loadCart();
    
    showToast('🔍 Проверка наличия товаров...');
    const stockCheck = await checkStock(cart.items);
    
    if (!stockCheck.available) {
        const outOfStockItems = stockCheck.outOfStock;
        let errorMessage = 'Нет в наличии:\n';
        outOfStockItems.forEach(item => {
            errorMessage += `• ${item.name} (нужно ${item.requested}, доступно ${item.available})\n`;
        });
        alert(errorMessage);
        renderCart();
        return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:30px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;">
            <h3 style="margin-bottom:20px;"><i class="fas fa-clipboard-list"></i> Оформление заказа</h3>
            <form id="orderForm">
                <div style="margin-bottom:15px;">
                    <label>Ваше имя *</label>
                    <input type="text" id="orderName" required style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-top:5px;">
                </div>
                <div style="margin-bottom:15px;">
                    <label>Телефон *</label>
                    <input type="tel" id="orderPhone" required style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-top:5px;">
                </div>
                <div style="margin-bottom:15px;">
                    <label>Email</label>
                    <input type="email" id="orderEmail" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-top:5px;">
                </div>
                <div style="margin-bottom:15px;">
                    <label>Адрес доставки</label>
                    <textarea id="orderAddress" rows="2" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-top:5px;"></textarea>
                </div>
                <div style="margin-bottom:15px;">
                    <label>Комментарий</label>
                    <textarea id="orderComment" rows="2" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-top:5px;"></textarea>
                </div>
                <div style="background:#f8fafc;padding:15px;border-radius:10px;margin-bottom:20px;">
                    <strong>Итого: ${cart.total.toLocaleString()} сом</strong>
                </div>
                <div style="display:flex;gap:10px;">
                    <button type="submit" style="flex:1;padding:14px;background:#10B981;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                        <i class="fas fa-check"></i> Отправить заказ
                    </button>
                    <button type="button" onclick="this.closest('div').parentElement.remove()" style="flex:1;padding:14px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                        Отмена
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#orderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('orderName').value;
        const phone = document.getElementById('orderPhone').value;
        
        if (!name || !phone) {
            showToast('Заполните имя и телефон!', true);
            return;
        }
        
        const orderData = {
            customer_name: name,
            customer_phone: phone,
            customer_email: document.getElementById('orderEmail').value || null,
            customer_address: document.getElementById('orderAddress').value || null,
            comment: document.getElementById('orderComment').value || null,
            items: cart.items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                unit: item.unit
            })),
            total: cart.total
        };
        
        const submitBtn = modal.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        submitBtn.disabled = true;
        
        const deductResult = await deductStock(orderData.items);
        
        if (!deductResult.success) {
            showToast(`❌ ${deductResult.error || 'Ошибка списания товаров'}`, true);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }
        
        const success = await sendOrderToServer(orderData);
        
        if (success) {
            showToast('✅ Заказ оформлен! Мы свяжемся с вами.');
            localStorage.setItem('teplosilaCart', JSON.stringify({ items: [], total: 0, count: 0 }));
            modal.remove();
            renderCart();
        } else {
            showToast('❌ Ошибка отправки. Попробуйте позже или позвоните нам.', true);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Запуск
renderCart();
window.addEventListener('storage', (e) => {
    if (e.key === 'teplosilaCart') renderCart();
});