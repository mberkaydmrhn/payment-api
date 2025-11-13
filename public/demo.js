const API_BASE_URL = window.location.origin;
let userApiKey = null;
let userEmail = null;
let currentLang = localStorage.getItem('PAYMINT_LANG') || 'tr';

// --- LANGUAGE DICTIONARY ---
const translations = {
    tr: { amountError: "Lütfen tutar girin", invalidAmount: "Geçersiz Tutar!", apiKeyMissing: "API Key bulunamadı.", processing: "İşleniyor...", success: "Başarılı! Yönlendiriliyor...", copy: "Kopyalandı!", logout: "Oturum kapatıldı.", welcome: "Oturum açıldı." },
    en: { amountError: "Please enter an amount", invalidAmount: "Invalid Amount!", apiKeyMissing: "API Key missing.", processing: "Processing...", success: "Success! Redirecting...", copy: "Copied!", logout: "Logged out.", welcome: "Logged in." }
};

// --- LANGUAGE HANDLER ---
function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('PAYMINT_LANG', lang);
    
    // Update Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.dataset.lang === lang) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Update Text Elements
    document.querySelectorAll('[data-tr]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            if (el.tagName === 'INPUT') el.placeholder = text;
            else if(el.childNodes.length > 1 && el.tagName === 'BUTTON') {
                // Iconlu butonlar için sadece text node'u güncellemek gerekebilir
                // Basit çözüm: innerHTML'i bozmamak için span varsa ona, yoksa direkt elemana yaz
                const span = el.querySelector('span');
                if(span) span.innerText = text;
                else el.innerText = text; // İkon yoksa
            }
            else el.innerText = text;
        }
    });
}

// --- 3D TILT EFFECT ---
const card = document.getElementById('tiltCard');
const tiltCardInner = document.querySelector('.tilt-card');

if (card) {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -15; 
        const rotateY = ((x - centerX) / centerX) * 15;
        tiltCardInner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    card.addEventListener('mouseleave', () => {
        tiltCardInner.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    });
}

function updateCardName(val) {
    document.getElementById('cardNameDisplay').innerText = val.toUpperCase() || 'YOUR NAME';
}

// --- PROVIDER SELECTION ---
function selectProvider(val, el) {
    document.getElementById('selectedProvider').value = val;
    document.querySelectorAll('.provider-option').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
}

// --- HELPERS ---
function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.className = 'show';
    setTimeout(() => t.className = t.className.replace('show', ''), 3000);
}

function addLog(msg, type='info') {
    const con = document.getElementById('consoleLogs');
    const time = new Date().toLocaleTimeString();
    let color = '#94a3b8';
    if(type==='success') color='#34d399';
    if(type==='error') color='#f87171';
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `<span style="color:#64748b;">[${time}]</span> <span style="color:${color};">${msg}</span>`;
    con.prepend(div);
}

function copyToClipboard(id) {
    // Element input ise value, text ise innerText
    const el = document.getElementById(id);
    const val = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.value : el.innerText;
    navigator.clipboard.writeText(val);
    showToast(translations[currentLang].copy);
}

// Text kopyalama (History tablosu için)
function copyText(text) {
    navigator.clipboard.writeText(text);
    showToast(translations[currentLang].copy);
}

// --- TUTAR FORMATLAMA (DÜZELTİLMİŞ VERSİYON) ---
function formatAmountInput(input) {
    let val = input.value;
    if (!val) return;

    // Noktaları sil (5.555 -> 5555)
    let cleanVal = val.replace(/\./g, ''); 

    // Fazla virgülleri temizle
    if ((cleanVal.match(/,/g) || []).length > 1) {
        cleanVal = cleanVal.substring(0, cleanVal.lastIndexOf(','));
    }

    let parts = cleanVal.split(',');
    let integerPart = parts[0].replace(/[^0-9]/g, ''); 

    // Binlik ayracı ekle
    let formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    if (parts.length > 1) {
        let decimalPart = parts[1].replace(/[^0-9]/g, '').substring(0, 2);
        input.value = `${formattedInteger},${decimalPart}`;
    } else {
        if (val.indexOf(',') > -1) input.value = `${formattedInteger},`;
        else input.value = formattedInteger;
    }
}

// --- TABS & AUTH ---
function changeTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`button[data-tab="${tab}"]`).classList.add('active');
}

function toggleAuthTab(tab) {
    document.getElementById('loginForm').style.display = tab==='login'?'block':'none';
    document.getElementById('registerForm').style.display = tab==='register'?'block':'none';
    document.getElementById('authTabLogin').classList.toggle('active', tab==='login');
    document.getElementById('authTabRegister').classList.toggle('active', tab==='register');
}

function showDash(key, email) {
    userApiKey = key;
    localStorage.setItem('PAYMINT_API_KEY', key);
    localStorage.setItem('PAYMINT_USER_EMAIL', email);
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'grid';
    document.getElementById('apiKeyDisplay').innerText = key;
    
    changeLanguage(currentLang); // Apply language
    addLog(translations[currentLang].welcome, 'success');
}

// --- API CALLS ---
async function processPayment(e) {
    e.preventDefault();
    const btn = document.getElementById('payBtn');
    btn.disabled = true; btn.innerHTML = `<i class="ri-loader-4-line pulse"></i> ${translations[currentLang].processing}`;
    
    const formData = new FormData(e.target);
    const rawAmount = document.getElementById('amount').value.replace(/\./g, '').replace(',', '.');
    
    const data = {
        amount: parseFloat(rawAmount),
        currency: formData.get('currency'),
        provider: formData.get('provider'),
        description: formData.get('description'),
        webhookUrl: formData.get('webhookUrl'),
        customerInfo: { name: formData.get('customerName'), email: formData.get('customerEmail') }
    };

    try {
        const res = await fetch(`${API_BASE_URL}/api/payments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': userApiKey },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if(json.success) {
            addLog(`Created: ${json.data.paymentId}`, 'success');
            showToast(translations[currentLang].success);
            setTimeout(() => window.location.href = json.data.paymentUrl, 1000);
        } else {
            addLog(`Error: ${json.error.message}`, 'error');
            showToast(json.error.message);
            btn.disabled=false; btn.innerHTML = `Ödeme Linki Oluştur <i class="ri-link"></i>`;
        }
    } catch(err) {
        addLog('Network Error', 'error');
        btn.disabled=false; btn.innerHTML = `Ödeme Linki Oluştur <i class="ri-link"></i>`;
    }
}

async function loadHistory() {
    const tbody = document.getElementById('historyList');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Yükleniyor...</td></tr>';
    try {
        const res = await fetch(`${API_BASE_URL}/api/payments`, { headers: {'x-api-key': userApiKey} });
        const json = await res.json();
        if(json.success && json.data.length > 0) {
            tbody.innerHTML = '';
            json.data.forEach(p => {
                let badge = 'badge-success';
                if(p.status === 'pending') badge = 'style="color:#fbbf24; background:rgba(251,191,36,0.1)"';
                if(p.status === 'failed') badge = 'style="color:#f87171; background:rgba(248,113,113,0.1)"';
                
                // ID'yi Kısalt
                const shortId = p.paymentId.length > 12 ? p.paymentId.substring(0, 10) + '...' : p.paymentId;

                const row = `<tr>
                    <td>
                        <div class="id-wrapper">
                            <span class="id-text" title="${p.paymentId}">${shortId}</span>
                            <button class="copy-id-btn" onclick="copyText('${p.paymentId}')"><i class="ri-file-copy-line"></i></button>
                        </div>
                    </td>
                    <td style="font-weight:600;">${p.amount} ${p.currency}</td>
                    <td>${p.provider.toUpperCase()}</td>
                    <td><span class="badge ${p.status === 'paid' ? 'badge-success' : ''}" ${badge}>${p.status.toUpperCase()}</span></td>
                </tr>`;
                tbody.innerHTML += row;
            });
        } else tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">İşlem yok</td></tr>';
    } catch(e) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Hata</td></tr>'; }
}

async function checkStatus() {
    const id = document.getElementById('queryId').value;
    if(!id) return showToast('ID giriniz');
    try {
        const res = await fetch(`${API_BASE_URL}/api/payments/${id}/status`);
        const json = await res.json();
        if(json.success) addLog(`${json.data.status.toUpperCase()} | ${json.data.amount} ${json.data.currency}`, 'success');
        else addLog('Bulunamadı', 'error');
    } catch(e) { addLog('Hata', 'error'); }
}

function handleLogout() {
    localStorage.clear();
    location.reload();
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const payForm = document.getElementById('paymentForm');

    if(loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({email:document.getElementById('loginEmail').value, password:document.getElementById('loginPassword').value})
        });
        const json = await res.json();
        if(json.success) showDash(json.data.apiKey, json.data.email);
        else document.getElementById('loginError').innerText = json.message;
    });

    if(registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({email:document.getElementById('registerEmail').value, password:document.getElementById('registerPassword').value})
        });
        const json = await res.json();
        if(json.success) { showToast('Kayıt Başarılı'); toggleAuthTab('login'); }
        else document.getElementById('registerError').innerText = json.message;
    });

    if(payForm) payForm.addEventListener('submit', processPayment);

    const k = localStorage.getItem('PAYMINT_API_KEY');
    const e = localStorage.getItem('PAYMINT_USER_EMAIL');
    if(k && e) showDash(k, e);
    else document.getElementById('authContainer').style.display = 'block';
});