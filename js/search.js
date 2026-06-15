// API URL
const API_URL = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return '/api';
})();
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

// Функция для подсветки совпадений
function highlightText(text, query) {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
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

// Функция поиска
async function performSearch(query) {
    if (!query) return;
    
    query = query.trim().toLowerCase();
    const searchResultsDiv = document.getElementById('searchResults');
    const countEl = document.getElementById('searchCount');
    
    searchResultsDiv.innerHTML = '<div class="no-results" style="grid-column: 1/-1;"><i class="fas fa-spinner fa-spin"></i><h3>Поиск...</h3></div>';
    
    try {
        const res = await fetch(`${API_URL}/products`);
        const allProducts = await res.json();
        
        const foundProducts = allProducts.filter(p => {
            const searchableText = [
                p.name || '',
                p.description || '',
                String(p.price || ''),
                p.section || '',
                p.tab || '',
                p.unit || '',
                p.page || ''
            ].join(' ').toLowerCase();
            
            const queryWords = query.split(/\s+/);
            return queryWords.some(word => searchableText.includes(word));
        });
        
        displayResults(foundProducts, query);
        
        sessionStorage.setItem('searchQuery', query);
        sessionStorage.setItem('searchResults', JSON.stringify(foundProducts));
        
    } catch (err) {
        console.error('Ошибка поиска:', err);
        searchResultsDiv.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1;">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка поиска</h3>
                <p>Не удалось выполнить поиск. Проверьте соединение с сервером.</p>
                <p style="font-size: 12px; margin-top: 10px;">Убедитесь, что сервер запущен: node server.js</p>
            </div>
        `;
    }
}

// Отображение результатов
function displayResults(products, query) {
    const container = document.getElementById('searchResults');
    const countEl = document.getElementById('searchCount');
    
    if (!products || products.length === 0) {
        countEl.innerHTML = `По запросу "<span class="search-query">${query}</span>" ничего не найдено`;
        container.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1;">
                <i class="fas fa-search"></i>
                <h3>Ничего не найдено</h3>
                <p>Попробуйте изменить запрос или посмотрите товары в каталоге</p>
                <a href="heating.html" class="back-link"><i class="fas fa-fire"></i> Отопление</a>
                <a href="plumbing.html" class="back-link" style="margin-left: 10px;"><i class="fas fa-faucet"></i> Сантехника</a>
            </div>
        `;
        return;
    }
    
    countEl.innerHTML = `Найдено товаров: <strong>${products.length}</strong> по запросу "<span class="search-query">${query}</span>"`;
    
    container.innerHTML = products.map(p => {
        const highlightedName = highlightText(p.name, query);
        const highlightedDesc = highlightText(p.description || '', query);
        
        return `
            <div class="product-card">
                ${p.is_popular ? '<span class="product-badge popular">ХИТ</span>' : ''}
                <img src="${p.image_url || 'img/default.jpg'}" alt="${escapeHtml(p.name)}" onerror="this.src='img/default.jpg';">
                <h4>${highlightedName}</h4>
                <p>${highlightedDesc}</p>
                <div class="price">${p.price ? p.price.toLocaleString() + ' сом' : 'По запросу'} <small>/${p.unit || 'шт'}</small></div>
                <button class="add-to-cart-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${p.price || 0}" data-image="${p.image_url || 'img/default.jpg'}">
                    <i class="fas fa-shopping-cart"></i> В корзину
                </button>
            </div>
        `;
    }).join('');
    
    initAddToCartButtons();
}

// Инициализация кнопок добавления в корзину
function initAddToCartButtons() {
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        if (btn.dataset.listenerAdded) return;
        btn.dataset.listenerAdded = 'true';
        
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            
            const product = {
                id: btn.dataset.id,
                name: btn.dataset.name,
                price: parseFloat(btn.dataset.price) || 0,
                image: btn.dataset.image || 'img/default.jpg',
                quantity: 1,
                unit: 'шт'
            };
            
            await addToCart(product);
        });
    });
}

// Мобильное меню
function initMobileMenu() {
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
        
        if (menuClose) {
            menuClose.addEventListener('click', closeMenu);
        }
        
        mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
        mobileMenu.addEventListener('click', (e) => { if (e.target === mobileMenu) closeMenu(); });
    }
}

// Поиск в шапке
function initHeaderSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const searchBtn = document.getElementById('globalSearchBtn');
    
    if (searchInput && searchBtn) {
        const performHeaderSearch = async () => {
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
        
        searchBtn.addEventListener('click', performHeaderSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performHeaderSearch(); });
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initHeaderSearch();
    loadCart();
    
    // Поиск на странице результатов
    const searchInputLarge = document.getElementById('searchInputLarge');
    const searchBtnLarge = document.getElementById('searchBtnLarge');
    
    const doSearch = () => {
        const query = searchInputLarge.value.trim();
        if (query) {
            performSearch(query);
            const globalInput = document.getElementById('globalSearchInput');
            if (globalInput) globalInput.value = query;
        }
    };
    
    if (searchBtnLarge) searchBtnLarge.addEventListener('click', doSearch);
    if (searchInputLarge) searchInputLarge.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSearch();
    });
    
    // Проверяем, есть ли сохранённые результаты
    const savedQuery = sessionStorage.getItem('searchQuery');
    const savedResults = sessionStorage.getItem('searchResults');
    
    if (savedQuery && savedResults) {
        const products = JSON.parse(savedResults);
        const input = document.getElementById('searchInputLarge');
        if (input) input.value = savedQuery;
        displayResults(products, savedQuery);
    } else {
        document.getElementById('searchResults').innerHTML = `
            <div class="no-results" style="grid-column: 1/-1;">
                <i class="fas fa-search"></i>
                <h3>Введите поисковый запрос</h3>
                <p>Найдите нужный товар по названию, цене или категории</p>
            </div>
        `;
    }
    
    // Обновление счетчика корзины
    function updateCartCount() {
        const cartData = JSON.parse(localStorage.getItem('teplosilaCart') || '{"count":0}');
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = cartData.count || 0);
    }
    updateCartCount();
    setInterval(updateCartCount, 1000);
    window.addEventListener('storage', updateCartCount);
});
