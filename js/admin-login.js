// ===== API URL =====
const API_URL = (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    return '/api';
})();

// Принудительно очищаем поле пароля при загрузке
const passwordField = document.getElementById('adminPassword');
if (passwordField) {
    passwordField.value = '';
    setTimeout(() => {
        passwordField.value = '';
    }, 10);
}

// Проверка сессии при загрузке страницы
(function checkSession() {
    const session = localStorage.getItem('teplosilaAdmin');
    if (session) {
        try {
            const data = JSON.parse(session);
            if (data.expires && data.expires > Date.now()) {
                window.location.href = 'admin-panel.html';
                return;
            } else if (data.expires && data.expires <= Date.now()) {
                localStorage.removeItem('teplosilaAdmin');
            }
        } catch(e) {
            localStorage.removeItem('teplosilaAdmin');
        }
    }
})();

// Элементы DOM
const toggleBtn = document.getElementById('togglePasswordBtn');
const passwordInput = document.getElementById('adminPassword');
const loginForm = document.getElementById('loginForm');
const errorDiv = document.getElementById('errorMessage');
const errorTextSpan = document.getElementById('errorText');

// Toggle видимости пароля
if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '<i class="far fa-eye-slash"></i>' : '<i class="far fa-eye"></i>';
    });
}

// Функция показа ошибки
function showError(msg) {
    if (errorTextSpan) errorTextSpan.innerText = msg;
    if (errorDiv) errorDiv.style.display = 'flex';
    setTimeout(() => {
        if (errorDiv) errorDiv.style.display = 'none';
    }, 3200);
}

// Анимация тряски карточки
function shakeCard() {
    const card = document.querySelector('.login-card');
    if (card) {
        card.classList.add('shake-card');
        setTimeout(() => {
            card.classList.remove('shake-card');
        }, 500);
    }
}

// Успешный вход — создание сессии и редирект
function successRedirect() {
    localStorage.setItem('teplosilaAdmin', JSON.stringify({
        expires: Date.now() + 24 * 60 * 60 * 1000,
        loginTime: Date.now()
    }));
    
    const card = document.querySelector('.login-card');
    if (card) {
        card.style.transition = 'all 0.25s';
        card.style.transform = 'scale(0.98)';
        card.style.opacity = '0.9';
    }
    setTimeout(() => {
        window.location.href = 'admin-panel.html';
    }, 280);
}

// Обработка отправки формы
async function handleLogin(e) {
    e.preventDefault();
    
    if (errorDiv) errorDiv.style.display = 'none';
    
    const password = passwordInput.value.trim();
    
    if (!password) {
        showError('Введите пароль доступа');
        shakeCard();
        passwordInput.style.borderColor = '#dc2626';
        setTimeout(() => {
            passwordInput.style.borderColor = 'rgba(79, 158, 255, 0.5)';
        }, 800);
        return;
    }
    
    const submitBtn = document.querySelector('.login-btn');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Проверка...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: password }),
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            successRedirect();
        } else {
            const errorData = await response.json().catch(() => ({}));
            showError(errorData.message || 'Неверный пароль доступа');
            shakeCard();
            passwordInput.style.borderColor = '#dc2626';
            setTimeout(() => {
                passwordInput.style.borderColor = 'rgba(79, 158, 255, 0.5)';
            }, 800);
            passwordInput.value = '';
            passwordInput.focus();
        }
    } catch (networkError) {
        console.error('Ошибка соединения с сервером:', networkError);
        showError('Ошибка соединения с сервером. Пожалуйста, убедитесь, что сервер запущен.');
        shakeCard();
        passwordInput.style.borderColor = '#dc2626';
        setTimeout(() => {
            passwordInput.style.borderColor = 'rgba(79, 158, 255, 0.5)';
        }, 800);
        passwordInput.value = '';
        passwordInput.focus();
    } finally {
        submitBtn.innerHTML = originalBtnHtml;
        submitBtn.disabled = false;
    }
}

loginForm.addEventListener('submit', handleLogin);

// Дополнительная защита: очистка поля при фокусе, если была ошибка
passwordInput.addEventListener('focus', function() {
    if (passwordInput.style.borderColor === 'rgb(220, 38, 38)') {
        passwordInput.style.borderColor = 'rgba(79, 158, 255, 0.5)';
    }
});

// Консольное предупреждение для безопасности
console.log('%c🔒 Система безопасности активна. Пароль не хранится в коде страницы.', 'color: #00ff00; font-size: 12px;');
console.log('%c⚠️ Для входа необходимо подключение к серверу API', 'color: #ffaa00; font-size: 11px;');
console.log('%c📌 Поле пароля пустое — введите пароль вручную', 'color: #88ccff; font-size: 11px;');
