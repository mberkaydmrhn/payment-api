const API_BASE_URL = window.location.origin;

// Global State
let userApiKey = null;
let userEmail = null;
let currentLang = localStorage.getItem('PAYMINT_LANG') || 'tr'; // Varsayılan dil

// ==================== 1. DİL YÖNETİMİ (UI FIX) ====================

const translations = {
    tr: {
        amountError: "Lütfen tutar girin",
        invalidAmount: "Geçersiz Tutar!",
        apiKeyMissing: "API Key bulunamadı. Lütfen giriş yapın.",
        processing: "İşleniyor...",
        success: "Başarılı! Yönlendiriliyor...",
        copy: "Kopyalandı!",
        logout: "Oturum kapatıldı.",
        welcome: "Oturum açıldı."
    },
    en: {
        amountError: "Please enter an amount",
        invalidAmount: "Invalid Amount!",
        apiKeyMissing: "API Key missing. Please login.",
        processing: "Processing...",
        success: "Success! Redirecting...",
        copy: "Copied!",
        logout: "Logged out.",
        welcome: "Logged in."
    }
};

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('PAYMINT_LANG', lang);

    // 1. Butonların aktiflik durumunu güncelle
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.dataset.lang === lang) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // 2. Sayfadaki metinleri güncelle (data-tr / data-en)
    document.querySelectorAll('[data-tr]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            if (el.tagName === 'INPUT') {
                // Input ise placeholder'ı değiştir
                el.placeholder = text;
            } else {
                // Normal text
                el.innerText = text;
            }
        }
    });
    
    // Log'a bilgi düş (Opsiyonel)
    // addLog(`Language switched to ${lang.toUpperCase()}`);
}

// ==================== 2. YARDIMCI FONKSİYONLAR ====================

function formatAmountInput(input) {
    let val = input.value.replace(/\./g, ',').replace(/[^0-9,]/g, '');
    const parts = val.split(',');
    let integerPart = parts[0];
    if (integerPart.length > 1 && integerPart.startsWith('0')) integerPart = integerPart.substring(1);
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (parts.length > 1) input.value = `${integerPart},${parts[1].substring(0, 2)}`;
    else input.value = val.indexOf(',') > -1 ? `${integerPart},` : integerPart;
}

function formatMoney(amount, currency) {
    // Para birimine göre formatlama
    try {
        return new Intl.NumberFormat(currentLang === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: currency }).format(amount);
    } catch (e) {
        return amount + ' ' + currency;
    }
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if(toast) {
        toast.innerText = message;
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
    }
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if(el && el.value) {
        navigator.clipboard.writeText(el.value);
        showToast(translations[currentLang].copy);
    }
}

function updateCardPreview(name) {
    const display = document.getElementById('cardHolderDisplay');
    if(display) display.innerText = name.toUpperCase() || 'AD SOYAD';
}

function addLog(message, type = 'info') {
    const logContainer = document.getElementById('apiResponse');
    if (!logContainer) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    const colorClass = type === 'success' ? 'log-success' : (type === 'error' ? 'log-error' : '');
    entry.innerHTML = `<span class="log-label">[${time}] ${type.toUpperCase()}</span><div class="${colorClass}">${message}</div>`;
    logContainer.insertBefore(entry, logContainer.firstChild);
}

function changeTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const content = document.getElementById(tabName + 'Tab');
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if(content) content.classList.add('active');
    if(btn) btn.classList.add('active');
}

// ==================== 3. AUTH SİSTEMİ ====================

function toggleAuthTab(tabName) {
    if (tabName === 'login') {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('authTabLogin').classList.add('active');
        document.getElementById('authTabRegister').classList.remove('active');
    } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('authTabLogin').classList.remove('active');
        document.getElementById('authTabRegister').classList.add('active');
    }
}

function showAuthError(form, message) {
    const errorEl = document.getElementById(form === 'login' ? 'loginError' : 'registerError');
    errorEl.innerText = message;
    errorEl.style.display = 'block';
}

function showDashboard(key, email) {
    userApiKey = key;
    userEmail = email;
    localStorage.setItem('PAYMINT_API_KEY', key);
    localStorage.setItem('PAYMINT_USER_EMAIL', email);

    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'grid';
    document.getElementById('apiKeyDisplay').value = key;
    document.getElementById('userEmailDisplay').innerText = email;
    
    addLog(translations[currentLang].welcome, "success");
    
    // Sayfa yüklendiğinde dili uygula
    changeLanguage(currentLang);
}

function handleLogout() {
    localStorage.removeItem('PAYMINT_API_KEY');
    localStorage.removeItem('PAYMINT_USER_EMAIL');
    userApiKey = null;
    userEmail = null;
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('dashboardContainer').style.display = 'none';
    showToast(translations[currentLang].logout);
}

// ==================== 4. API ETKİLEŞİMLERİ ====================

async function processPayment(event) {
    event.preventDefault();
    if (!userApiKey) { showToast(translations[currentLang].apiKeyMissing); return; }

    addLog(currentLang === 'tr' ? 'Ödeme isteği gönderiliyor...' : 'Sending payment request...', 'info');
    const formData = new FormData(event.target);
    
    let rawAmount = document.getElementById('amount').value;
    if (!rawAmount) { showToast(translations[currentLang].amountError); return; }
    
    // Tutarı temizle (1.500,50 -> 1500.50)
    rawAmount = rawAmount.replace(/\./g, '').replace(',', '.');
    const cleanAmount = parseFloat(rawAmount);

    if (isNaN(cleanAmount) || cleanAmount <= 0) {
        showToast(translations[currentLang].invalidAmount); return;
    }

    const paymentData = {
        amount: cleanAmount,
        currency: formData.get('currency'),
        description: formData.get('description'),
        webhookUrl: formData.get('webhookUrl'),
        returnUrl: window.location.href,
        provider: formData.get('provider'),
        customerInfo: {
            name: formData.get('customerName'),
            email: formData.get('customerEmail')
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': userApiKey
            },
            body: JSON.stringify(paymentData)
        });
        const result = await response.json();
        
        if (result.success) {
            addLog(`✅ ID: ${result.data.paymentId}`, 'success');
            document.getElementById('paymentId').value = result.data.paymentId;
            showToast(translations[currentLang].success);
            // Yönlendir
            setTimeout(() => { window.location.href = result.data.paymentUrl; }, 1500);
        } else {
            addLog(`❌ Error: ${result.error.message}`, 'error');
            showToast(result.error.message);
        }
    } catch (error) {
        addLog(`❌ Network Error: ${error.message}`, 'error');
    }
}

async function checkPaymentStatus() {
    const id = document.getElementById('paymentId').value;
    if (!id) { showToast("ID required"); return; }

    try {
        const res = await fetch(`${API_BASE_URL}/api/payments/${id}/status`);
        const data = await res.json();
        if(data.success) {
            const formattedAmount = formatMoney(data.data.amount, data.data.currency);
            addLog(`📊 ${data.data.status.toUpperCase()} | ${formattedAmount}`, 'success');
        } else {
            addLog('Not Found', 'error');
        }
    } catch(e) { addLog('Error checking status', 'error'); }
}

async function loadHistory() {
    if (!userApiKey) return;
    
    const tbody = document.getElementById('historyList');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Loading...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/payments`, {
             headers: { 'x-api-key': userApiKey }
        });
        const data = await res.json();

        if(data.success && data.data.length > 0) {
            tbody.innerHTML = '';
            data.data.forEach(pay => {
                const date = new Date(pay.createdAt).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
                let color = pay.status === 'paid' ? '#10b981' : (pay.status === 'failed' ? '#ef4444' : '#f59e0b');
                const money = formatMoney(pay.amount, pay.currency);
                
                const row = `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td><button onclick="copyToClipboard('pid_${pay.paymentId}')" style="cursor:pointer; border:none; background:none; color:#6366f1; font-family:monospace;">${pay.paymentId.slice(-6)}..</button><input type="hidden" id="pid_${pay.paymentId}" value="${pay.paymentId}"></td>
                        <td style="font-weight:600;">${money}</td>
                        <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:0.8rem;">${pay.provider.toUpperCase()}</span></td>
                        <td><span style="color:${color}; font-weight:700;">${pay.status.toUpperCase()}</span></td>
                        <td style="font-size:0.75rem; color:#94a3b8;">${date}</td>
                    </tr>`;
                tbody.innerHTML += row;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No transactions found.</td></tr>';
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading history.</td></tr>';
    }
}

// ==================== 5. BAŞLATMA ====================

document.addEventListener('DOMContentLoaded', () => {
    // Form Listener'ları
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutButton = document.getElementById('logoutButton');
    const paymentForm = document.getElementById('paymentForm');

    if(loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, { 
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password}) 
        });
        const data = await res.json();
        if (data.success) showDashboard(data.data.apiKey, data.data.email);
        else showAuthError('login', data.message);
    });

    if(registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, { 
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email, password}) 
        });
        const data = await res.json();
        if (data.success) { 
            showToast(currentLang === 'tr' ? 'Kayıt Başarılı' : 'Registration Successful'); 
            toggleAuthTab('login'); 
        }
        else showAuthError('register', data.message);
    });
    
    if(logoutButton) logoutButton.addEventListener('click', handleLogout);
    if(paymentForm) paymentForm.addEventListener('submit', processPayment);
    
    // Tab Geçişleri
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() { changeTab(this.getAttribute('data-tab')); });
    });
    
    // Oturum Kontrolü
    const savedKey = localStorage.getItem('PAYMINT_API_KEY');
    const savedEmail = localStorage.getItem('PAYMINT_USER_EMAIL');
    
    // Dili Yükle
    changeLanguage(currentLang);

    if (savedKey && savedEmail) {
        showDashboard(savedKey, savedEmail);
    } else {
        document.getElementById('authContainer').style.display = 'block';
    }
    
    // URL Durum Kontrolü (Ödeme Dönüşü)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('status') && savedKey) {
        const isSuccess = urlParams.get('status') === 'success';
        showToast(isSuccess ? (currentLang === 'tr' ? 'Ödeme Başarılı!' : 'Payment Successful!') : (currentLang === 'tr' ? 'Ödeme Başarısız' : 'Payment Failed'));
        
        // URL'i temizle
        window.history.replaceState({}, document.title, "/");
        
        // Geçmişe git ve yenile
        changeTab('history');
        loadHistory();
    }
});