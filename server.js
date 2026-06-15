const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== НАСТРОЙКИ =====
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = '1219777106';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function getLocalIp() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// Создаем папки если их нет
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('img')) fs.mkdirSync('img');

// Создаем default.jpg если его нет
const defaultImagePath = path.join(__dirname, 'img', 'default.jpg');
if (!fs.existsSync(defaultImagePath)) {
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#E2E8F0"/>
        <text x="100" y="105" font-family="Arial" font-size="14" fill="#94A3B8" text-anchor="middle">📦</text>
        <text x="100" y="125" font-family="Arial" font-size="12" fill="#94A3B8" text-anchor="middle">Нет фото</text>
    </svg>`;
    fs.writeFileSync(defaultImagePath, defaultSvg);
    console.log('✅ Создан default.jpg');
}

const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// CORS и middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));
app.use('/img', express.static('img'));

// Обработка отсутствующих изображений
app.get('/img/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'img', filename);
    
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.sendFile(defaultImagePath);
    }
});

// ===== БАЗА ДАННЫХ =====
const db = new sqlite3.Database('./teplosila.db');
db.run("PRAGMA journal_mode=WAL");

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        parent_id INTEGER,
        sort_order INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category_id INTEGER,
        subcategory TEXT,
        price REAL DEFAULT 0,
        old_price REAL,
        unit TEXT DEFAULT 'шт',
        description TEXT,
        image_url TEXT,
        in_stock INTEGER DEFAULT 1,
        stock INTEGER DEFAULT 0,
        is_popular INTEGER DEFAULT 0,
        page TEXT,
        section TEXT,
        tab TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        customer_address TEXT,
        comment TEXT,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'new',
        assigned_to TEXT,
        confirmed_at DATETIME,
        ready_at DATETIME,
        delivered_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS telegram_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT DEFAULT 'staff',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS callbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        question TEXT,
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get("SELECT id FROM telegram_users WHERE chat_id = ?", [ADMIN_CHAT_ID], (err, row) => {
        if (!row) {
            db.run("INSERT INTO telegram_users (chat_id, username, first_name, role, is_active) VALUES (?, 'admin', 'Администратор', 'admin', 1)", [ADMIN_CHAT_ID]);
            console.log('✅ Администратор добавлен');
        }
    });

    db.get("SELECT COUNT(*) as count FROM products", [], (err, row) => {
        if (row && row.count === 0) {
            const products = [
                { name: 'Электрический котел 4.5 кВт', section: 'kotly', tab: 'elektro-kotly', page: 'heating.html', price: 12500, unit: 'шт', stock: 5, description: 'Компактный электрический котел', image_url: 'img/default.jpg', is_popular: 1 },
                { name: 'Электрический котел 6 кВт', section: 'kotly', tab: 'elektro-kotly', page: 'heating.html', price: 15800, unit: 'шт', stock: 3, description: 'Мощный электрический котел', image_url: 'img/default.jpg', is_popular: 1 },
                { name: 'Электрический котел 9 кВт', section: 'kotly', tab: 'elektro-kotly', page: 'heating.html', price: 18500, unit: 'шт', stock: 2, description: 'Для дома до 90м²', image_url: 'img/default.jpg', is_popular: 1 },
                { name: 'Радиатор алюминиевый 60см 10 секций', section: 'radiatory', tab: '60cm', subcategory: 'aluminium', page: 'heating.html', price: 4300, unit: 'комплект', stock: 10, description: 'Алюминиевый радиатор', image_url: 'img/default.jpg', is_popular: 1 },
                { name: 'ППР труба 20 мм', section: 'truby_santeh', tab: 'ppr', page: 'plumbing.html', price: 95, unit: 'метр', stock: 50, description: 'Для холодной воды', image_url: 'img/default.jpg' },
                { name: 'Смеситель для раковины', section: 'smesiteli', tab: 'rakovina', page: 'plumbing.html', price: 1850, unit: 'шт', stock: 8, description: 'Однорычажный смеситель', image_url: 'img/default.jpg', is_popular: 1 }
            ];
            const stmt = db.prepare("INSERT INTO products (name, section, tab, subcategory, page, price, unit, stock, description, image_url, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            products.forEach(p => stmt.run(p.name, p.section, p.tab, p.subcategory || null, p.page, p.price, p.unit, p.stock, p.description, p.image_url, p.is_popular || 0));
            stmt.finalize();
            console.log('✅ Тестовые товары добавлены');
        }
    });
});

// ===== TELEGRAM БОТ =====
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.deleteWebHook().then(() => {
    console.log('✅ Telegram бот запущен (polling mode)');
}).catch(err => console.log('⚠️ Ошибка:', err.message));

bot.getMe().then((botInfo) => {
    console.log('🤖 Бот активен:', botInfo.username);
}).catch((err) => {
    console.error('❌ Ошибка бота:', err.message);
});

async function sendToTelegram(chatId, message, options = {}) {
    try {
        const result = await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...options });
        return result;
    } catch (error) {
        try {
            const plainMessage = message.replace(/\*/g, '').replace(/_/g, '');
            const result = await bot.sendMessage(chatId, plainMessage, options);
            return result;
        } catch (err2) {
            return null;
        }
    }
}

function getUser(chatId) {
    return new Promise((resolve) => {
        db.get("SELECT * FROM telegram_users WHERE chat_id = ? AND is_active = 1", [String(chatId)], (err, user) => {
            resolve(user || null);
        });
    });
}

function registerUser(chatId, username, firstName, lastName) {
    return new Promise((resolve) => {
        db.get("SELECT id FROM telegram_users WHERE chat_id = ?", [String(chatId)], (err, existing) => {
            if (existing) {
                db.run("UPDATE telegram_users SET username = ?, first_name = ?, last_name = ?, is_active = 1 WHERE chat_id = ?", [username || '', firstName || '', lastName || '', String(chatId)], () => resolve());
            } else {
                db.run("INSERT INTO telegram_users (chat_id, username, first_name, last_name, is_active) VALUES (?, ?, ?, ?, 1)", [String(chatId), username || '', firstName || '', lastName || ''], () => resolve());
            }
        });
    });
}

function getOrderById(orderId) {
    return new Promise((resolve) => {
        db.get("SELECT * FROM orders WHERE id = ?", [orderId], (err, order) => resolve(order || null));
    });
}

function formatOrderMessage(order) {
    let items = [];
    try { items = JSON.parse(order.items); } catch(e) {}
    
    let message = `📦 ЗАКАЗ #${order.order_number}\n\n`;
    message += `👤 Клиент: ${order.customer_name}\n`;
    message += `📞 Телефон: ${order.customer_phone}\n`;
    if (order.customer_address) message += `📍 Адрес: ${order.customer_address}\n`;
    if (order.comment) message += `💬 Комментарий: ${order.comment}\n`;
    message += `📅 Создан: ${new Date(order.created_at).toLocaleString('ru-RU')}\n\n`;
    
    const statusMap = { 'new': '🆕 НОВЫЙ', 'processing': '⚙️ В СБОРКЕ', 'ready': '✅ ГОТОВ', 'delivered': '✅ ВЫДАН', 'cancelled': '❌ ОТМЕНЁН' };
    message += `📊 Статус: ${statusMap[order.status] || order.status}\n\n`;
    
    message += `📋 ТОВАРЫ:\n`;
    items.forEach((item, i) => {
        message += `${i+1}. ${item.name}\n   ${item.quantity} × ${item.price} = ${item.quantity * item.price} сом\n`;
    });
    message += `\n💰 ИТОГО: ${order.total.toLocaleString()} сом`;
    
    return message;
}

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📱 /start от ${chatId}`);
    
    await registerUser(chatId, msg.chat.username, msg.chat.first_name, msg.chat.last_name);
    const user = await getUser(chatId);
    
    if (!user) {
        return sendToTelegram(chatId, `⛔ Нет доступа\nВаш ID: ${chatId}\nПередайте ID администратору.`);
    }
    
    const isAdmin = user.role === 'admin';
    const name = user.first_name || 'пользователь';
    
    const keyboard = isAdmin ? [
        [{ text: '📋 ВСЕ ЗАКАЗЫ' }],
        [{ text: '✅ ГОТОВЫ К ВЫДАЧЕ' }],
        [{ text: '📊 СТАТИСТИКА' }, { text: '👥 СОТРУДНИКИ' }],
        [{ text: '📋 ЗАЯВКИ' }]
    ] : [
        [{ text: '📋 ДОСТУПНЫЕ ЗАКАЗЫ' }],
        [{ text: '👤 МОИ ЗАКАЗЫ' }]
    ];
    
    sendToTelegram(chatId, `👋 Добро пожаловать, ${name}!`, {
        reply_markup: { keyboard, resize_keyboard: true }
    });
});

bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text) return;
    
    const user = await getUser(chatId);
    if (!user) return;
    
    const isAdmin = user.role === 'admin';
    
    if (text === '📋 ДОСТУПНЫЕ ЗАКАЗЫ' && !isAdmin) {
        db.all("SELECT * FROM orders WHERE status IN ('new', 'processing') AND (assigned_to IS NULL OR assigned_to = ?) ORDER BY created_at DESC LIMIT 10", [String(chatId)], async (err, orders) => {
            if (!orders || orders.length === 0) return sendToTelegram(chatId, '📭 Нет доступных заказов');
            sendToTelegram(chatId, `📋 ДОСТУПНЫЕ ЗАКАЗЫ (${orders.length})`);
            for (const order of orders) {
                const message = formatOrderMessage(order);
                const buttons = [];
                if (order.status === 'new' && !order.assigned_to) buttons.push([{ text: '👤 ВЗЯТЬ', callback_data: `take_${order.id}` }]);
                else if (order.status === 'new' && order.assigned_to === String(chatId)) buttons.push([{ text: '✅ ПОДТВЕРДИТЬ', callback_data: `confirm_${order.id}` }]);
                else if (order.status === 'processing' && order.assigned_to === String(chatId)) buttons.push([{ text: '📦 ГОТОВ', callback_data: `ready_${order.id}` }]);
                await sendToTelegram(chatId, message, buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {});
            }
        });
    }
    else if (text === '👤 МОИ ЗАКАЗЫ' && !isAdmin) {
        db.all("SELECT * FROM orders WHERE assigned_to = ? AND status IN ('new', 'processing', 'ready') ORDER BY created_at DESC", [String(chatId)], async (err, orders) => {
            if (!orders || orders.length === 0) return sendToTelegram(chatId, '📭 У вас нет активных заказов');
            sendToTelegram(chatId, `👤 ВАШИ ЗАКАЗЫ (${orders.length})`);
            for (const order of orders) {
                const message = formatOrderMessage(order);
                const buttons = [];
                if (order.status === 'new') buttons.push([{ text: '✅ ПОДТВЕРДИТЬ', callback_data: `confirm_${order.id}` }]);
                else if (order.status === 'processing') buttons.push([{ text: '📦 ГОТОВ', callback_data: `ready_${order.id}` }]);
                await sendToTelegram(chatId, message, buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {});
            }
        });
    }
    else if (text === '📋 ВСЕ ЗАКАЗЫ' && isAdmin) {
        db.all("SELECT * FROM orders WHERE status IN ('new', 'processing', 'ready') ORDER BY created_at DESC LIMIT 20", async (err, orders) => {
            if (!orders || orders.length === 0) return sendToTelegram(chatId, '📭 Нет активных заказов');
            sendToTelegram(chatId, `📋 ВСЕ АКТИВНЫЕ ЗАКАЗЫ (${orders.length})`);
            for (const order of orders) {
                const message = formatOrderMessage(order);
                const buttons = [];
                if (order.status === 'ready') buttons.push([{ text: '✅ ВЫДАТЬ', callback_data: `deliver_${order.id}` }]);
                if (order.status !== 'delivered' && order.status !== 'cancelled') buttons.push([{ text: '❌ ОТМЕНИТЬ', callback_data: `cancel_${order.id}` }]);
                await sendToTelegram(chatId, message, buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {});
            }
        });
    }
    else if (text === '✅ ГОТОВЫ К ВЫДАЧЕ' && isAdmin) {
        db.all("SELECT * FROM orders WHERE status = 'ready' ORDER BY ready_at ASC", async (err, orders) => {
            if (!orders || orders.length === 0) return sendToTelegram(chatId, '✅ Нет готовых заказов');
            sendToTelegram(chatId, `✅ ГОТОВЫ К ВЫДАЧЕ (${orders.length})`);
            for (const order of orders) {
                const message = formatOrderMessage(order);
                const buttons = [[{ text: '✅ ВЫДАТЬ', callback_data: `deliver_${order.id}` }], [{ text: '❌ ОТМЕНИТЬ', callback_data: `cancel_${order.id}` }]];
                await sendToTelegram(chatId, message, { reply_markup: { inline_keyboard: buttons } });
            }
        });
    }
    else if (text === '📊 СТАТИСТИКА' && isAdmin) {
        db.get("SELECT COUNT(*) as products FROM products", (err, p) => {
            db.get("SELECT COUNT(*) as new FROM orders WHERE status='new'", (err, n) => {
                db.get("SELECT COUNT(*) as proc FROM orders WHERE status='processing'", (err, pr) => {
                    db.get("SELECT COUNT(*) as ready FROM orders WHERE status='ready'", (err, r) => {
                        db.get("SELECT COUNT(*) as delivered FROM orders WHERE status='delivered'", (err, d) => {
                            db.get("SELECT COALESCE(SUM(total),0) as rev FROM orders WHERE status='delivered'", (err, rev) => {
                                let message = `📊 СТАТИСТИКА\n\n📦 Товаров: ${p?.products || 0}\n🆕 Новых: ${n?.new || 0}\n⚙️ В сборке: ${pr?.proc || 0}\n✅ Готовых: ${r?.ready || 0}\n📦 Выдано: ${d?.delivered || 0}\n💰 Выручка: ${(rev?.rev || 0).toLocaleString()} сом`;
                                sendToTelegram(chatId, message);
                            });
                        });
                    });
                });
            });
        });
    }
    else if (text === '👥 СОТРУДНИКИ' && isAdmin) {
        db.all("SELECT * FROM telegram_users ORDER BY role DESC, is_active DESC", (err, users) => {
            let message = '👥 СОТРУДНИКИ\n\n';
            for (const u of users) {
                const status = u.is_active ? '✅' : '❌';
                const role = u.role === 'admin' ? '👑 Админ' : '👤 Сборщик';
                const name = u.first_name || u.username || 'Без имени';
                message += `${status} ${role}: ${name}\n🆔 ${u.chat_id}\n\n`;
            }
            message += `/adduser ID - добавить\n/removeuser ID - удалить`;
            sendToTelegram(chatId, message);
        });
    }
    else if (text === '📋 ЗАЯВКИ' && isAdmin) {
        db.all("SELECT * FROM callbacks ORDER BY created_at DESC LIMIT 20", async (err, callbacks) => {
            if (!callbacks || callbacks.length === 0) {
                return sendToTelegram(chatId, '📭 Нет заявок');
            }
            
            for (const cb of callbacks) {
                const statusIcon = cb.status === 'new' ? '🆕' : '✅';
                let message = `${statusIcon} ЗАЯВКА #${cb.id}\n`;
                message += `👤 Имя: ${cb.name}\n`;
                message += `📞 Телефон: ${cb.phone}\n`;
                if (cb.question) message += `💬 Вопрос: ${cb.question}\n`;
                message += `📅 ${new Date(cb.created_at).toLocaleString('ru-RU')}\n`;
                message += `📊 Статус: ${cb.status === 'new' ? 'НОВАЯ' : 'ОБРАБОТАНА'}`;
                
                const buttons = [];
                if (cb.status === 'new') {
                    buttons.push([{ text: '✅ ОТМЕТИТЬ ОБРАБОТАННОЙ', callback_data: `callback_done_${cb.id}` }]);
                }
                
                await sendToTelegram(chatId, message, buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {});
            }
        });
    }
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    const user = await getUser(chatId);
    if (!user) return bot.answerCallbackQuery(query.id, { text: '⛔ Нет доступа', show_alert: true });
    
    const isAdmin = user.role === 'admin';
    const parts = data.split('_');
    const action = parts[0];
    
    if (action === 'callback_done') {
        if (!isAdmin) return bot.answerCallbackQuery(query.id, { text: '⛔ Только админ', show_alert: true });
        const callbackId = parseInt(parts[2]);
        
        db.run("UPDATE callbacks SET status = 'done' WHERE id = ?", [callbackId], async (err) => {
            if (err) return bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
            await bot.answerCallbackQuery(query.id, { text: '✅ Заявка отмечена как обработанная!' });
            
            const newText = query.message.text.replace('🆕', '✅').replace('НОВАЯ', 'ОБРАБОТАНА');
            await bot.editMessageText(newText, { 
                chat_id: chatId, 
                message_id: query.message.message_id,
                reply_markup: { inline_keyboard: [] }
            }).catch(() => {});
        });
        return;
    }
    
    const orderId = parseInt(parts[1]);
    const order = await getOrderById(orderId);
    if (!order) return bot.answerCallbackQuery(query.id, { text: '❌ Заказ не найден' });
    
    if (action === 'take') {
        if (order.assigned_to && order.assigned_to !== String(chatId)) {
            return bot.answerCallbackQuery(query.id, { text: '⚠️ Занят другим', show_alert: true });
        }
        db.run("UPDATE orders SET assigned_to = ? WHERE id = ?", [String(chatId), orderId], async (err) => {
            if (err) return bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
            await bot.answerCallbackQuery(query.id, { text: '✅ Заказ взят!' });
            const updatedOrder = await getOrderById(orderId);
            const newMessage = formatOrderMessage(updatedOrder);
            const buttons = [[{ text: '✅ ПОДТВЕРДИТЬ', callback_data: `confirm_${orderId}` }]];
            await bot.editMessageText(newMessage, { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: buttons } }).catch(() => {});
            sendToTelegram(ADMIN_CHAT_ID, `👤 Сотрудник взял заказ #${order.order_number}\n👤 ${order.customer_name}\n💰 ${order.total.toLocaleString()} сом`);
        });
    }
    else if (action === 'confirm') {
        if (order.assigned_to !== String(chatId)) return bot.answerCallbackQuery(query.id, { text: '⛔ Не ваш заказ', show_alert: true });
        const now = new Date().toISOString();
        db.run("UPDATE orders SET status = 'processing', confirmed_at = ? WHERE id = ?", [now, orderId], async (err) => {
            if (err) return bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
            await bot.answerCallbackQuery(query.id, { text: '⚙️ В сборке!' });
            const updatedOrder = await getOrderById(orderId);
            const newMessage = formatOrderMessage(updatedOrder);
            const buttons = [[{ text: '📦 ГОТОВ', callback_data: `ready_${orderId}` }]];
            await bot.editMessageText(newMessage, { chat_id: chatId, message_id: query.message.message_id, reply_markup: { inline_keyboard: buttons } }).catch(() => {});
            sendToTelegram(ADMIN_CHAT_ID, `⚙️ Заказ #${order.order_number} в сборке\n👤 ${order.customer_name}`);
        });
    }
    else if (action === 'ready') {
        if (order.assigned_to !== String(chatId)) return bot.answerCallbackQuery(query.id, { text: '⛔ Не ваш заказ', show_alert: true });
        const now = new Date().toISOString();
        db.run("UPDATE orders SET status = 'ready', ready_at = ? WHERE id = ?", [now, orderId], async (err) => {
            if (err) return bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
            await bot.answerCallbackQuery(query.id, { text: '✅ Заказ готов!' });
            const updatedOrder = await getOrderById(orderId);
            const newMessage = formatOrderMessage(updatedOrder);
            await bot.editMessageText(newMessage, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
            sendToTelegram(ADMIN_CHAT_ID, `✅ ЗАКАЗ ГОТОВ!\n📦 #${order.order_number}\n👤 ${order.customer_name}\n📞 ${order.customer_phone}\n💰 ${order.total.toLocaleString()} сом`);
        });
    }
    else if (action === 'deliver') {
        if (!isAdmin) return bot.answerCallbackQuery(query.id, { text: '⛔ Только админ', show_alert: true });
        const now = new Date().toISOString();
        db.run("UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ?", [now, orderId], async (err) => {
            if (err) return bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
            await bot.answerCallbackQuery(query.id, { text: '✅ Заказ выдан!' });
            const updatedOrder = await getOrderById(orderId);
            const newMessage = formatOrderMessage(updatedOrder);
            await bot.editMessageText(newMessage + '\n\n✅ ЗАКАЗ ВЫДАН', { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
            if (order.assigned_to) sendToTelegram(order.assigned_to, `🎉 Заказ #${order.order_number} ВЫДАН!`);
        });
    }
    else if (action === 'cancel') {
        if (!isAdmin) return bot.answerCallbackQuery(query.id, { text: '⛔ Только админ', show_alert: true });
        db.run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId], async (err) => {
            if (err) return bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
            await bot.answerCallbackQuery(query.id, { text: '❌ Заказ отменён' });
            const updatedOrder = await getOrderById(orderId);
            const newMessage = formatOrderMessage(updatedOrder);
            await bot.editMessageText(newMessage + '\n\n❌ ЗАКАЗ ОТМЕНЁН', { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
            if (order.assigned_to) sendToTelegram(order.assigned_to, `❌ Заказ #${order.order_number} отменён`);
        });
    }
    
    bot.answerCallbackQuery(query.id);
});

bot.onText(/\/adduser (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (!user || user.role !== 'admin') return sendToTelegram(chatId, '⛔ Только администратор');
    
    const newChatId = match[1].trim();
    db.get("SELECT id FROM telegram_users WHERE chat_id = ?", [newChatId], (err, existing) => {
        if (existing) {
            db.run("UPDATE telegram_users SET is_active = 1, role = 'staff' WHERE chat_id = ?", [newChatId], () => {
                sendToTelegram(chatId, '✅ Сотрудник активирован!');
                sendToTelegram(newChatId, '🎉 Вас добавили в ТЕПЛОСИЛА!\nНажмите /start');
            });
        } else {
            db.run("INSERT INTO telegram_users (chat_id, role, is_active, first_name) VALUES (?, 'staff', 1, 'Сотрудник')", [newChatId], () => {
                sendToTelegram(chatId, '✅ Сотрудник добавлен!');
                sendToTelegram(newChatId, '🎉 Вас добавили в ТЕПЛОСИЛА!\nНажмите /start');
            });
        }
    });
});

bot.onText(/\/removeuser (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (!user || user.role !== 'admin') return sendToTelegram(chatId, '⛔ Только администратор');
    
    const removeChatId = match[1].trim();
    db.run("UPDATE telegram_users SET is_active = 0 WHERE chat_id = ?", [removeChatId], function(err) {
        if (err || this.changes === 0) return sendToTelegram(chatId, '❌ Сотрудник не найден');
        sendToTelegram(chatId, '✅ Сотрудник удалён');
        sendToTelegram(removeChatId, '❌ Ваш доступ отозван');
    });
});

// ===== API РОУТЫ =====
app.get('/api/products', (req, res) => {
    let query = "SELECT * FROM products WHERE 1=1";
    const params = [];
    if (req.query.page) { query += " AND page = ?"; params.push(req.query.page); }
    if (req.query.section) { query += " AND section = ?"; params.push(req.query.section); }
    if (req.query.tab) { query += " AND tab = ?"; params.push(req.query.tab); }
    query += " ORDER BY sort_order, created_at DESC";
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Ошибка GET products:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

app.get('/api/products/:id', (req, res) => {
    db.get("SELECT * FROM products WHERE id = ?", req.params.id, (err, row) => {
        if (err) {
            console.error('Ошибка GET product:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(row || {});
    });
});

app.post('/api/products', upload.single('image'), (req, res) => {
    try {
        const p = req.body;
        if (req.file) p.image_url = '/uploads/' + req.file.filename;
        
        const name = p.name || 'Новый товар';
        const price = parseFloat(p.price) || 0;
        const stock = parseInt(p.stock) || 0;
        const sort_order = parseInt(p.sort_order) || 0;
        const in_stock = (p.in_stock === '1' || p.in_stock === 1 || p.in_stock === true) ? 1 : 0;
        const is_popular = (p.is_popular === '1' || p.is_popular === 1 || p.is_popular === true) ? 1 : 0;
        
        console.log('📦 Добавление товара:', { name, price, stock, section: p.section, tab: p.tab, page: p.page });
        
        db.run(`INSERT INTO products (name, category_id, subcategory, price, old_price, unit, description, image_url, in_stock, stock, is_popular, page, section, tab, sort_order) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, p.category_id || null, p.subcategory || null, price, p.old_price || null, p.unit || 'шт', 
             p.description || '', p.image_url || null, in_stock, stock, is_popular, 
             p.page || null, p.section || null, p.tab || null, sort_order],
            function(err) { 
                if (err) {
                    console.error('❌ Ошибка INSERT:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                console.log('✅ Товар добавлен, ID:', this.lastID);
                res.json({ id: this.lastID, success: true });
            });
    } catch(err) {
        console.error('❌ Ошибка:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', upload.single('image'), (req, res) => {
    try {
        const p = req.body;
        if (req.file) p.image_url = '/uploads/' + req.file.filename;
        
        const name = p.name || 'Товар';
        const price = parseFloat(p.price) || 0;
        const stock = parseInt(p.stock) || 0;
        const sort_order = parseInt(p.sort_order) || 0;
        const in_stock = (p.in_stock === '1' || p.in_stock === 1 || p.in_stock === true) ? 1 : 0;
        const is_popular = (p.is_popular === '1' || p.is_popular === 1 || p.is_popular === true) ? 1 : 0;
        
        console.log('✏️ Редактирование товара ID:', req.params.id);
        
        db.get("SELECT image_url FROM products WHERE id = ?", [req.params.id], (err, existing) => {
            const imageUrl = p.image_url || (existing ? existing.image_url : null);
            db.run(`UPDATE products SET 
                name=?, category_id=?, subcategory=?, price=?, old_price=?, unit=?, description=?, 
                image_url=?, in_stock=?, stock=?, is_popular=?, page=?, section=?, tab=?, sort_order=? 
                WHERE id=?`,
                [name, p.category_id || null, p.subcategory || null, price, p.old_price || null, 
                 p.unit || 'шт', p.description || '', imageUrl, in_stock, stock, is_popular, 
                 p.page || null, p.section || null, p.tab || null, sort_order, req.params.id],
                (err) => { 
                    if (err) {
                        console.error('❌ Ошибка UPDATE:', err.message);
                        return res.status(500).json({ error: err.message });
                    }
                    console.log('✅ Товар обновлен');
                    res.json({ success: true });
                });
        });
    } catch(err) {
        console.error('❌ Ошибка:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', (req, res) => {
    console.log('🗑️ Удаление товара ID:', req.params.id);
    db.run("DELETE FROM products WHERE id = ?", req.params.id, (err) => {
        if (err) {
            console.error('❌ Ошибка DELETE:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log('✅ Товар удален');
        res.json({ success: true });
    });
});

app.post('/api/check-stock', (req, res) => {
    const { items } = req.body;
    if (!items || !items.length) {
        return res.json({ available: true });
    }
    
    const productIds = items.map(item => item.id);
    const placeholders = productIds.map(() => '?').join(',');
    
    db.all(`SELECT id, name, stock FROM products WHERE id IN (${placeholders})`, productIds, (err, products) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка проверки остатков' });
        }
        
        const stockMap = {};
        products.forEach(p => {
            stockMap[p.id] = { name: p.name, stock: p.stock };
        });
        
        const outOfStock = [];
        for (const item of items) {
            const product = stockMap[item.id];
            if (!product) {
                outOfStock.push({ id: item.id, name: item.name, available: 0, requested: item.quantity });
            } else if (product.stock < item.quantity) {
                outOfStock.push({ id: item.id, name: product.name, available: product.stock, requested: item.quantity });
            }
        }
        
        if (outOfStock.length > 0) {
            res.json({ available: false, outOfStock });
        } else {
            res.json({ available: true });
        }
    });
});

app.post('/api/deduct-stock', (req, res) => {
    const { items } = req.body;
    if (!items || !items.length) {
        return res.json({ success: true });
    }
    
    const queries = items.map(item => {
        return new Promise((resolve, reject) => {
            db.run(`UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`, 
                [item.quantity, item.id, item.quantity], 
                function(err) {
                    if (err) reject(err);
                    else if (this.changes === 0) reject(new Error(`Недостаточно товара`));
                    else resolve();
                });
        });
    });
    
    Promise.all(queries)
        .then(() => res.json({ success: true }))
        .catch(err => res.status(400).json({ error: err.message }));
});

app.post('/api/orders', (req, res) => {
    const { customer_name, customer_phone, customer_email, customer_address, comment, items, total } = req.body;
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    console.log('\n' + '='.repeat(50));
    console.log('🛒 НОВЫЙ ЗАКАЗ!');
    console.log('='.repeat(50));
    console.log(`📦 Номер: ${orderNumber}`);
    console.log(`👤 Клиент: ${customer_name}`);
    console.log(`📞 Телефон: ${customer_phone}`);
    console.log(`📍 Адрес: ${customer_address || 'не указан'}`);
    console.log(`💰 Сумма: ${total} сом`);
    console.log('='.repeat(50));
    
    db.run(`INSERT INTO orders (order_number, customer_name, customer_phone, customer_email, customer_address, comment, items, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
        [orderNumber, customer_name, customer_phone, customer_email || null, customer_address || null, comment || null, JSON.stringify(items), total],
        async function(err) {
            if (err) {
                console.error('❌ Ошибка БД:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log('✅ Заказ сохранён, ID:', this.lastID);
            
            let itemsText = '';
            items.forEach((item, i) => {
                itemsText += `${i+1}. ${item.name} - ${item.quantity} × ${item.price} = ${item.quantity * item.price} сом\n`;
            });
            
            const message = `🛒 НОВЫЙ ЗАКАЗ!\n\n📦 #${orderNumber}\n👤 ${customer_name}\n📞 ${customer_phone}\n${customer_address ? `📍 ${customer_address}\n` : ''}${comment ? `💬 ${comment}\n` : ''}\n📋 Товары:\n${itemsText}\n💰 ИТОГО: ${total.toLocaleString()} сом\n\n🕐 ${new Date().toLocaleString('ru-RU')}`;
            
            await sendToTelegram(ADMIN_CHAT_ID, message);
            
            db.all("SELECT chat_id FROM telegram_users WHERE is_active = 1 AND role = 'staff'", (err, users) => {
                if (users && users.length > 0) {
                    const staffMsg = `🛒 НОВЫЙ ЗАКАЗ #${orderNumber}\n👤 ${customer_name}\n📞 ${customer_phone}\n💰 ${total.toLocaleString()} сом`;
                    users.forEach(user => {
                        sendToTelegram(user.chat_id, staffMsg);
                    });
                }
            });
            
            res.json({ success: true, order_number: orderNumber });
        });
});

app.get('/api/orders', (req, res) => {
    db.all("SELECT * FROM orders ORDER BY created_at DESC", (err, rows) => {
        const orders = (rows || []).map(o => {
            try { return { ...o, items: JSON.parse(o.items) }; }
            catch(e) { return { ...o, items: [] }; }
        });
        res.json(orders);
    });
});

app.put('/api/orders/:id/status', (req, res) => {
    const { status } = req.body;
    const now = new Date().toISOString();
    let query = "UPDATE orders SET status = ?";
    const params = [status];
    if (status === 'processing') { query += ", confirmed_at = ?"; params.push(now); }
    else if (status === 'ready') { query += ", ready_at = ?"; params.push(now); }
    else if (status === 'delivered') { query += ", delivered_at = ?"; params.push(now); }
    query += " WHERE id = ?";
    params.push(req.params.id);
    db.run(query, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: 'Неверный пароль' });
});

app.get('/api/admin/stats', (req, res) => {
    db.get("SELECT COUNT(*) as products FROM products", (err, p) => {
        db.get("SELECT COUNT(*) as orders FROM orders WHERE status != 'delivered' AND status != 'cancelled'", (err, o) => {
            db.get("SELECT COALESCE(SUM(total),0) as rev FROM orders WHERE status = 'delivered'", (err, r) => {
                res.json({ products: p?.products || 0, orders: o?.orders || 0, revenue: r?.rev || 0 });
            });
        });
    });
});

// ===== API ДЛЯ ЗАЯВОК =====
app.get('/api/callbacks', (req, res) => {
    db.all("SELECT * FROM callbacks ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.put('/api/callbacks/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE callbacks SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/callback', async (req, res) => {
    const { name, phone, question } = req.body;
    
    console.log('\n' + '='.repeat(50));
    console.log('📞 НОВАЯ ЗАЯВКА!');
    console.log('='.repeat(50));
    console.log(`👤 Имя: ${name}`);
    console.log(`📞 Телефон: ${phone}`);
    console.log(`💬 Вопрос: ${question || 'не указан'}`);
    console.log('='.repeat(50));
    
    db.run(`INSERT INTO callbacks (name, phone, question, status) VALUES (?, ?, ?, 'new')`,
        [name, phone, question || null],
        async function(err) {
            if (err) {
                console.error('❌ Ошибка сохранения заявки:', err);
                return res.status(500).json({ error: err.message });
            }
            
            console.log('✅ Заявка сохранена, ID:', this.lastID);
            
            let message = `📞 НОВАЯ ЗАЯВКА #${this.lastID}!\n\n`;
            message += `👤 Имя: ${name}\n`;
            message += `📞 Телефон: ${phone}\n`;
            if (question) message += `💬 Вопрос: ${question}\n`;
            message += `\n🕐 ${new Date().toLocaleString('ru-RU')}`;
            
            await sendToTelegram(ADMIN_CHAT_ID, message);
            res.json({ success: true, id: this.lastID });
        });
});

// ===== ЗАПУСК =====
const localIp = getLocalIp();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 СЕРВЕР ЗАПУЩЕН!`);
    console.log(`${'='.repeat(50)}`);
    console.log(`💻 На ПК: http://localhost:${PORT}`);
    console.log(`📱 На телефоне: http://${localIp}:${PORT}`);
    console.log(`🔑 Админка: http://localhost:${PORT}/admin-login.html`);
    console.log(`💾 База: teplosila.db`);
    console.log(`${'='.repeat(50)}`);
});

setTimeout(async () => {
    await sendToTelegram(ADMIN_CHAT_ID, '✅ Сервер запущен! Бот готов к работе.');
}, 3000);
