// public/demo.js - AUTH SİSTEMLİ FİNAL
const API_BASE_URL = window.location.origin;

// ==================== GLOBAL DEĞİŞKENLER ====================
let userApiKey = null;
let userEmail = null;

// ==================== 1. INPUT FORMATLAMA (KESİN ÇÖZÜM) ====================
function formatAmountInput(input) {
    let val = input.value;
    val = val.replace(/\./g, ',');
    val = val.replace(/[^0-9,]/g, '');
    const parts = val.split(',');
    let integerPart = parts[0];
    if (integerPart.length > 1 && integerPart.startsWith('0')) {
        integerPart = integerPart.substring(1);
    }
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (parts.length > 1) {
        let decimalPart = parts[1].substring(0, 2);
        input.value = `${integerPart},${decimalPart}`;
    } else if (val.indexOf(',') > -1) {
        input.value = `${integerPart},`;
    } else {
        input.value = integerPart;
    }
}

// ==================== 2. YARDIMCI FONKSİYONLAR ====================
function formatMoney(amount, currency) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency }).format(amount);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if(toast) {
        toast.innerText = message;
        toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
    }
}

function copyText(text) {
    navigator.clipboard.writeText(text);
    showToast(`Kopyalandı: ${text.substring(0, 15)}...`);
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if(el && el.value) copyText(el.value);
}

// ==================== 3. DİL & UI ====================
function changeLanguage(lang) { /* ... (Bu fonksiyon değişmedi, aynı kalabilir) ... */ }
function updateCardPreview(name) { /* ... (Bu fonksiyon değişmedi) ... */ }

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

// ==================== 4. AUTH (YENİ) ====================
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

function showAuthSuccess(message) {
    const successEl = document.getElementById('registerSuccess');
    successEl.innerText = message;
    successEl.style.display = 'block';
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
    addLog("Oturum açıldı, API Key yüklendi.", "success");
}

function handleLogout() {
    localStorage.removeItem('PAYMINT_API_KEY');
    localStorage.removeItem('PAYMINT_USER_EMAIL');
    userApiKey = null;
    userEmail = null;
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('dashboardContainer').style.display = 'none';
    showToast("Oturum kapatıldı.");
}

// ==================== 5. API İŞLEMLERİ (GÜNCELLENDİ) ====================

async function processPayment(event) {
    event.preventDefault();
    
    if (!userApiKey) {
        showToast("API Key bulunamadı. Lütfen tekrar giriş yapın.");
        return;
    }

    addLog('Ödeme isteği oluşturuluyor...', 'info');
    const formData = new FormData(event.target);
    
    let rawAmount = document.getElementById('amount').value;
    if (!rawAmount) { showToast("Lütfen tutar girin"); return; }
    rawAmount = rawAmount.replace(/\./g, '');
    rawAmount = rawAmount.replace(',', '.');
    const cleanAmount = parseFloat(rawAmount);

    if (isNaN(cleanAmount) || cleanAmount <= 0) {
        showToast("Geçersiz Tutar!"); return;
    }

    const paymentData = {
        amount: cleanAmount,
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
                'x-api-key': userApiKey // <--- API KEY BURADA GÖNDERİLİYOR
            },
            body: JSON.stringify(paymentData)
        });
        const result = await response.json();
        
        if (result.success) {
            addLog(`✅ Ödeme ID: ${result.data.paymentId}`, 'success');
            const pIdInput = document.getElementById('paymentId');
            if(pIdInput) pIdInput.value = result.data.paymentId;
            showToast("Link Oluşturuldu! Yönlendiriliyor...");
            setTimeout(() => { window.location.href = result.data.paymentUrl; }, 1500);
        } else {
            addLog(`❌ Hata: ${result.error.message}`, 'error');
            showToast(`Hata: ${result.error.message}`);
        }
    } catch (error) {
        addLog(`❌ Bağlantı Hatası: ${error.message}`, 'error');
    }
}

async function checkPaymentStatus() {
    const id = document.getElementById('paymentId').value;
    if (!id) { showToast("Lütfen Payment ID girin"); return; }
    if (!userApiKey) { showToast("API Key bulunamadı."); return; }

    addLog(`🔍 Sorgulanıyor: ${id}`, 'info');
    try {
        const res = await fetch(`${API_BASE_URL}/api/payments/${id}/status`, {
            headers: { 'x-api-key': userApiKey } // <--- API KEY GEREKLİ
        });
        const data = await res.json();
        if(data.success) {
            const formattedAmount = formatMoney(data.data.amount, data.data.currency);
            addLog(`📊 Durum: ${data.data.status.toUpperCase()} | Tutar: ${formattedAmount}`, 'success');
        } else {
            addLog('Kayıt bulunamadı.', 'error');
        }
    } catch(e) { addLog('Sorgulama hatası', 'error'); }
}

async function loadHistory() {
    if (!userApiKey) { showToast("API Key bulunamadı."); return; }
    
    const tbody = document.getElementById('historyList');
    tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#64748b;">Veriler yükleniyor...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/payments`, {
             headers: { 'x-api-key': userApiKey } // <--- API KEY GEREKLİ
        });
        const data = await res.json();

        if(data.success && data.data.length > 0) {
            tbody.innerHTML = '';
            data.data.forEach(pay => {
                const date = new Date(pay.createdAt).toLocaleDateString('tr-TR') + ' ' + new Date(pay.createdAt).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
                let statusColor = '#f59e0b'; let statusText = 'BEKLİYOR';
                if(pay.status === 'paid') { statusColor = '#10b981'; statusText = 'ÖDENDİ'; }
                if(pay.status === 'failed') { statusColor = '#ef4444'; statusText = 'HATA'; }
                const money = formatMoney(pay.amount, pay.currency);
                const shortId = pay.paymentId.length > 12 ? '...' + pay.paymentId.slice(-8) : pay.paymentId;
                const providerBadge = pay.provider === 'iyzico' ? '<span style="background:#e0f2fe; color:#0284c7; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:600;">IYZICO</span>' : (pay.provider === 'stripe' ? '<span style="background:#e0fdf4; color:#065f46; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:600;">STRIPE</span>' : '<span style="background:#f3e8ff; color:#9333ea; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:600;">MOCK</span>');
                const row = `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td><button onclick="copyText('${pay.paymentId}')" style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: #6366f1; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-family: monospace; font-size: 0.75rem;">${shortId} ❐</button></td>
                        <td style="font-weight:600; font-size:0.85rem;">${money}</td>
                        <td>${providerBadge}</td>
                        <td><span style="background:${statusColor}20; color:${statusColor}; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700;">${statusText}</span></td>
                        <td style="color:#94a3b8; font-size: 0.75rem;">${date}</td>
                    </tr>`;
                tbody.innerHTML += row;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#64748b;">Henüz işlem yok.</td></tr>';
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#ef4444;">Yükleme hatası!</td></tr>';
    }
}

// ==================== 6. BAŞLATMA (GÜNCELLENDİ) ====================
document.addEventListener('DOMContentLoaded', () => {
    
    // Auth Formları
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutButton = document.getElementById('logoutButton');

    if(loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            showDashboard(data.data.apiKey, data.data.email);
        } else {
            showAuthError('login', data.message);
        }
    });

    if(registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            showAuthSuccess('Kayıt başarılı! Lütfen giriş yapın.');
            toggleAuthTab('login');
        } else {
            showAuthError('register', data.message);
        }
    });
    
    if(logoutButton) logoutButton.addEventListener('click', handleLogout);

    // Dashboard Formları
    const paymentForm = document.getElementById('paymentForm');
    if(paymentForm) paymentForm.addEventListener('submit', processPayment);
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() { changeTab(this.getAttribute('data-tab')); });
    });
    
    // OTURUM KONTROLÜ
    const savedKey = localStorage.getItem('PAYMINT_API_KEY');
    const savedEmail = localStorage.getItem('PAYMINT_USER_EMAIL');
    if (savedKey && savedEmail) {
        showDashboard(savedKey, savedEmail);
    } else {
        document.getElementById('authContainer').style.display = 'block';
    }
    
    // Ödeme dönüşü kontrolü
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    if (status && savedKey) {
        showToast(status === 'success' ? 'Ödeme Başarılı!' : 'Ödeme Başarısız');
        addLog(status === 'success' ? '✅ Ödeme Tamamlandı' : '❌ Ödeme İptal', status === 'success' ? 'success' : 'error');
        window.history.replaceState({}, document.title, "/");
        changeTab('history');
        loadHistory();
    } else if (status) {
        // Ödeme dönüşü var ama login olmamış, ana sayfaya at
        window.history.replaceState({}, document.title, "/");
    }
});