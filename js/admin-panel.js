// API URL
const API_URL = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}:3000/api`;
    }
    return `http://${hostname}:3000/api`;
})();

let currentProductId = null;

// ===== ТАБЫ ДЛЯ СЕКЦИЙ =====
const tabsConfig = {
    'kotly': [
        { value: 'elektro-kotly', label: 'Электрические котлы' },
        { value: 'poluavtomat-kotly', label: 'Полуавтоматические котлы' },
        { value: 'automat-kotly', label: 'Автоматические котлы' },
        { value: 'klassika-kotly', label: 'Классические котлы' },
        { value: 'sapog-kotly', label: 'Котлы Сапог' }
    ],
    'radiatory': [
        { value: 'aluminium-60', label: 'Алюминиевые 60см' },
        { value: 'aluminium-40', label: 'Алюминиевые 40см' },
        { value: 'aluminium-30', label: 'Алюминиевые 30см' },
        { value: 'bimetal-60', label: 'Биметаллические 60см' },
        { value: 'bimetal-40', label: 'Биметаллические 40см' },
        { value: 'bimetal-30', label: 'Биметаллические 30см' },
        { value: 'castiron', label: 'Чугунные' }
    ],
    'truby': [
        { value: 'metalplastic', label: 'Металлопластиковые трубы' },
        { value: 'steel', label: 'Стальные трубы' },
        { value: 'warmfloor', label: 'Для теплого пола' },
        { value: 'chimney-steel', label: 'Дымоход стальной' },
        { value: 'chimney-nerzh', label: 'Дымоход нержавейка' }
    ],
    'fitingi': [
        { value: 'connectors', label: 'Соединительные элементы' },
        { value: 'krany', label: 'Краны' },
        { value: 'other', label: 'Прочие комплектующие' }
    ],
    'kollektory': [
        { value: 'kollektory', label: 'Коллекторы' },
        { value: 'fitingi-tpl', label: 'Фитинги для теплого пола' }
    ],
    'truby_santeh': [
        { value: 'ppr', label: 'ППР трубы' },
        { value: 'pvc', label: 'ПВХ трубы' },
        { value: 'metalplastic-santeh', label: 'Металлопластиковые' },
        { value: 'kanalizacia', label: 'Канализация' }
    ],
    'fitingi_santeh': [
        { value: 'connectors-santeh', label: 'Соединительные элементы' },
        { value: 'krany-santeh', label: 'Краны' },
        { value: 'other-santeh', label: 'Прочие комплектующие' }
    ],
    'smesiteli': [
        { value: 'rakovina', label: 'Для раковины' },
        { value: 'kuhnya', label: 'Для кухни' },
        { value: 'vanna', label: 'Для ванной' },
        { value: 'dush', label: 'Для душа' }
    ],
    'nasosy': [
        { value: 'drenazhnye', label: 'Дренажные' },
        { value: 'povysitelnye', label: 'Повысительные' },
        { value: 'glubinnye', label: 'Глубинные' },
        { value: 'cirkulyacionnye', label: 'Циркуляционные' }
    ]
};

function updateTabs() {
    const section = document.getElementById('productSection').value;
    const tabSelect = document.getElementById('productTab');
    
    tabSelect.innerHTML = '<option value="">Выберите вкладку...</option>';
    
    if (section && tabsConfig[section]) {
        tabsConfig[section].forEach(tab => {
            tabSelect.innerHTML += `<option value="${tab.value}">${tab.label}</option>`;
        });
    }
}

// ===== ПРОВЕРКА АВТОРИЗАЦИИ =====
(function() {
    const s = localStorage.getItem('teplosilaAdmin');
    if (!s) { window.location.href = 'admin-login.html'; return; }
    try { 
        if (JSON.parse(s).expires < Date.now()) { 
            localStorage.removeItem('teplosilaAdmin'); 
            window.location.href = 'admin-login.html'; 
        } 
    } catch(e) { 
        window.location.href = 'admin-login.html'; 
    }
})();

// ===== НАВИГАЦИЯ =====
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (!section) return;
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');
        document.getElementById('pageTitle').textContent = item.textContent.trim();
        
        if (section === 'dashboard') loadDashboard();
        if (section === 'products') loadProducts();
        if (section === 'orders') loadOrders();
        if (section === 'callbacks') loadCallbacks();
    });
});

// ===== ВЫХОД =====
document.getElementById('logoutBtn').addEventListener('click', () => { 
    localStorage.removeItem('teplosilaAdmin'); 
    window.location.href = 'admin-login.html'; 
});

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadDashboard() {
    try {
        const statsRes = await fetch(`${API_URL}/admin/stats`);
        const stats = await statsRes.json();
        
        const ordersRes = await fetch(`${API_URL}/orders`);
        const orders = await ordersRes.json();
        
        const callbacksRes = await fetch(`${API_URL}/callbacks`);
        const callbacks = await callbacksRes.json();
        
        const newCallbacks = callbacks.filter(c => c.status === 'new').length;
        const newOrders = orders.filter(o => o.status === 'new').length;
        const processing = orders.filter(o => o.status === 'processing').length;
        const ready = orders.filter(o => o.status === 'ready').length;
        const delivered = orders.filter(o => o.status === 'delivered').length;
        
        document.getElementById('statsTable').innerHTML = `
            <tr><td>📦 Товаров</td><td><strong>${stats.products || 0}</strong></td></tr>
            <tr><td>📞 Новых заявок</td><td><strong>${newCallbacks}</strong></td></tr>
            <tr><td>🆕 Новых заказов</td><td><strong>${newOrders}</strong></td></tr>
            <tr><td>⚙️ В сборке</td><td><strong>${processing}</strong></td></tr>
            <tr><td>✅ Готовых к выдаче</td><td><strong>${ready}</strong></td></tr>
            <tr><td>📦 Выдано</td><td><strong>${delivered}</strong></td></tr>
            <tr><td>💰 Выручка</td><td><strong>${(stats.revenue || 0).toLocaleString()} сом</strong></td></tr>
        `;
    } catch(e) {
        console.error('Ошибка загрузки статистики:', e);
        document.getElementById('statsTable').innerHTML = `<tr><td colspan="2">❌ Ошибка загрузки: ${e.message}</td></tr>`;
    }
}

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const products = await res.json();
        
        const getStockClass = (stock) => {
            if (stock > 10) return 'stock-high';
            if (stock > 0) return 'stock-medium';
            return 'stock-low';
        };
        
        const getStockText = (stock) => {
            if (stock <= 0) return '❌ Нет';
            if (stock < 5) return `⚠️ ${stock} шт`;
            return `✅ ${stock} шт`;
        };
        
        document.getElementById('productsList').innerHTML = (products || []).map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${p.name || '-'}</td>
                <td>${p.page || '-'}</td>
                <td>${p.section || '-'}</td>
                <td>${p.tab || '-'}</td>
                <td>${p.price ? p.price.toLocaleString() + ' сом' : '-'}</td>
                <td><span class="stock-badge ${getStockClass(p.stock || 0)}">${getStockText(p.stock || 0)}</span></td>
                <td>
                    <button class="btn-warning" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="8">Нет товаров</td></tr>';
    } catch(e) {
        console.error('Ошибка загрузки товаров:', e);
        document.getElementById('productsList').innerHTML = `<tr><td colspan="8">❌ Ошибка: ${e.message}</td></tr>`;
    }
}

async function loadOrders() {
    try {
        const res = await fetch(`${API_URL}/orders`);
        const orders = await res.json();
        
        const statusLabels = {
            'new': '🆕 Новый',
            'processing': '⚙️ В сборке',
            'ready': '✅ Готов к выдаче',
            'delivered': '✅ Выдан',
            'cancelled': '❌ Отменён'
        };
        
        const statusClass = {
            'new': 'status-new',
            'processing': 'status-processing',
            'ready': 'status-ready',
            'delivered': 'status-delivered',
            'cancelled': 'status-cancelled'
        };
        
        document.getElementById('ordersList').innerHTML = (orders || []).map(o => `
            <tr>
                <td>${o.order_number}</td>
                <td>${o.customer_name}</td>
                <td>${o.customer_phone}</td>
                <td>${o.total.toLocaleString()} сом</td>
                <td><span class="status-badge ${statusClass[o.status] || 'status-new'}">${statusLabels[o.status] || o.status}</span></td>
                <td>
                    ${o.status === 'new' ? `<button class="btn-warning" onclick="updateStatus(${o.id}, 'processing')">⚙️ В сборку</button>` : ''}
                    ${o.status === 'processing' ? `<button class="btn-success" onclick="updateStatus(${o.id}, 'ready')">✅ Готов</button>` : ''}
                    ${o.status === 'ready' ? `<button class="btn-success" onclick="updateStatus(${o.id}, 'delivered')">📦 Выдать</button>` : ''}
                    ${o.status !== 'delivered' && o.status !== 'cancelled' ? `<button class="btn-danger" onclick="updateStatus(${o.id}, 'cancelled')">❌</button>` : ''}
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6">Нет заказов</td></tr>';
    } catch(e) {
        console.error('Ошибка загрузки заказов:', e);
    }
}

async function updateStatus(id, status) {
    if (confirm('Изменить статус заказа?')) {
        await fetch(`${API_URL}/orders/${id}/status`, { 
            method: 'PUT', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({status}) 
        });
        loadOrders();
        loadDashboard();
    }
}

// ===== ЗАГРУЗКА ЗАЯВОК =====
async function loadCallbacks() {
    try {
        const res = await fetch(`${API_URL}/callbacks`);
        const callbacks = await res.json();
        
        const getStatusClass = (status) => {
            return status === 'new' ? 'status-new' : 'status-done';
        };
        
        const getStatusText = (status) => {
            return status === 'new' ? '🆕 Новая' : '✅ Обработана';
        };
        
        document.getElementById('callbacksList').innerHTML = (callbacks || []).map(cb => `
            <tr>
                <td>${cb.id}</td>
                <td>${new Date(cb.created_at).toLocaleString('ru-RU')}</td>
                <td>${escapeHtml(cb.name)}</td>
                <td>${cb.phone}</td>
                <td class="callback-question">${escapeHtml(cb.question || '-')}</td>
                <td><span class="status-badge ${getStatusClass(cb.status)}">${getStatusText(cb.status)}</span></td>
                <td>
                    ${cb.status === 'new' ? `<button class="btn-success" onclick="markCallbackDone(${cb.id})"><i class="fas fa-check"></i> Отметить</button>` : ''}
                    <button class="btn-info" onclick="viewCallback(${cb.id}, '${escapeHtml(cb.name)}', '${cb.phone}', '${escapeHtml(cb.question || '-')}')"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7">Нет заявок</td></tr>';
    } catch(e) {
        console.error('Ошибка загрузки заявок:', e);
        document.getElementById('callbacksList').innerHTML = `<tr><td colspan="7">❌ Ошибка: ${e.message}</td></tr>`;
    }
}

async function markCallbackDone(id) {
    if (confirm('Отметить заявку как обработанную?')) {
        await fetch(`${API_URL}/callbacks/${id}/status`, { 
            method: 'PUT', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({status: 'done'}) 
        });
        loadCallbacks();
        loadDashboard();
        showToast('✅ Заявка отмечена как обработанная!');
    }
}

function viewCallback(id, name, phone, question) {
    alert(`📞 ЗАЯВКА #${id}\n\n👤 Имя: ${name}\n📞 Телефон: ${phone}\n💬 Вопрос: ${question}\n\n📅 ${new Date().toLocaleString()}`);
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

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10B981;color:white;padding:12px 20px;border-radius:8px;z-index:9999;font-size:14px;';
    toast.innerHTML = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===== ДОБАВЛЕНИЕ/РЕДАКТИРОВАНИЕ ТОВАРА =====
document.getElementById('addProductBtn')?.addEventListener('click', () => { 
    currentProductId = null; 
    document.getElementById('modalTitle').textContent = '➕ Добавить товар'; 
    document.getElementById('productForm').reset(); 
    document.getElementById('productStock').value = 0;
    document.getElementById('productInStock').checked = true;
    document.getElementById('productPage').required = true;
    document.getElementById('productModal').classList.add('active'); 
});

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const page = document.getElementById('productPage').value;
    if (!page) {
        alert('❌ Пожалуйста, выберите страницу отображения товара (Отопление или Сантехника)');
        return;
    }
    
    const product = {
        name: document.getElementById('productName').value,
        page: page,
        section: document.getElementById('productSection').value,
        tab: document.getElementById('productTab').value,
        price: parseFloat(document.getElementById('productPrice').value) || 0,
        unit: document.getElementById('productUnit').value,
        stock: parseInt(document.getElementById('productStock').value) || 0,
        description: document.getElementById('productDesc').value,
        image_url: document.getElementById('productImage').value,
        in_stock: document.getElementById('productInStock').checked ? 1 : 0,
        is_popular: document.getElementById('productPopular').checked ? 1 : 0,
        sort_order: parseInt(document.getElementById('productSortOrder').value) || 0
    };
    
    const url = currentProductId ? `${API_URL}/products/${currentProductId}` : `${API_URL}/products`;
    const method = currentProductId ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(product)
        });
        
        if (res.ok) {
            alert(currentProductId ? '✅ Товар обновлен!' : '✅ Товар добавлен!');
            closeProductModal();
            loadProducts();
            loadDashboard();
        } else {
            const errorText = await res.text();
            alert(`❌ Ошибка ${res.status}: ${errorText}`);
        }
    } catch(err) {
        alert(`❌ Ошибка соединения с сервером\n\n${err.message}`);
    }
});

window.editProduct = async (id) => {
    currentProductId = id;
    const res = await fetch(`${API_URL}/products/${id}`);
    const p = await res.json();
    
    document.getElementById('productName').value = p.name || '';
    document.getElementById('productPage').value = p.page || '';
    document.getElementById('productSection').value = p.section || '';
    updateTabs();
    document.getElementById('productTab').value = p.tab || '';
    document.getElementById('productPrice').value = p.price || '';
    document.getElementById('productUnit').value = p.unit || 'шт';
    document.getElementById('productStock').value = p.stock || 0;
    document.getElementById('productDesc').value = p.description || '';
    document.getElementById('productImage').value = p.image_url || '';
    document.getElementById('productInStock').checked = p.in_stock == 1;
    document.getElementById('productPopular').checked = p.is_popular == 1;
    document.getElementById('productSortOrder').value = p.sort_order || 0;
    
    document.getElementById('modalTitle').textContent = '✏️ Редактировать товар';
    document.getElementById('productModal').classList.add('active');
};

window.deleteProduct = async (id) => { 
    if (confirm('Удалить товар?')) { 
        await fetch(`${API_URL}/products/${id}`, {method:'DELETE'}); 
        loadProducts(); 
        loadDashboard();
    } 
};

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

document.getElementById('productModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeProductModal();
});

document.getElementById('refreshCallbacksBtn')?.addEventListener('click', () => {
    loadCallbacks();
    showToast('🔄 Заявки обновлены');
});

// ===== ЗАГРУЗКА ПРИ СТАРТЕ =====
loadDashboard();