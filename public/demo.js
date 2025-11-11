// public/demo.js - TAMAMEN GÜNCEL

const API_BASE_URL = window.location.origin;

// ==================== DİL SİSTEMİ ====================
function changeLanguage(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-lang') === lang) btn.classList.add('active');
    });

    document.querySelectorAll('[data-tr]').forEach(element => {
        const text = lang === 'tr' ? element.getAttribute('data-tr') : element.getAttribute('data-en');
        if (text) element.innerText = text;
    });

    // Input placeholderları
    const inputs = {
        amount: { tr: '150.00', en: '150.00' },
        description: { tr: 'Premium Üyelik', en: 'Premium Membership' },
        customerName: { tr: 'Ahmet Yılmaz', en: 'John Doe' }
    };
    
    for (const [id, placeholders] of Object.entries(inputs)) {
        const el = document.getElementById(id);
        if(el) el.placeholder = placeholders[lang];
    }

    localStorage.setItem('preferred-language', lang);
}

// ==================== UI FONKSİYONLARI ====================

// Kopyala Butonu
function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    if(el && el.value) {
        navigator.clipboard.writeText(el.value);
        const btn = el.parentElement.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = "Kopyalandı!";
        setTimeout(() => btn.innerText = originalText, 2000);
    }
}

// Kart Önizleme
function updateCardPreview(name) {
    const display = document.getElementById('cardHolderDisplay');
    if(display) display.textContent = name.toUpperCase() || 'AD SOYAD';
}

// Log Sistemi
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('apiResponse');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString();
    const colorClass = type === 'success' ? 'log-success' : (type === 'error' ? 'log-error' : '');
    
    entry.innerHTML = `
        <span class="log-label">[${time}] ${type.toUpperCase()}</span>
        <div class="${colorClass}">${message}</div>
    `;
    
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

// ==================== API İŞLEMLERİ ====================

// Ödeme Oluştur
async function processPayment(event) {
    event.preventDefault();
    addLog('Ödeme isteği oluşturuluyor...', 'info');
    
    const formData = new FormData(event.target);
    const paymentData = {
        amount: parseFloat(formData.get('amount')),
        description: formData.get('description'),
        webhookUrl: formData.get('webhookUrl'),
        returnUrl: window.location.href,
        customerInfo: {
            name: formData.get('customerName'),
            email: formData.get('customerEmail')
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();
        
        if (result.success) {
            addLog(`✅ Ödeme ID: ${result.data.paymentId}`, 'success');
            addLog(`🔗 Redirect URL: ${result.data.paymentUrl}`, 'info');
            
            // ID'yi kaydet
            const pIdInput = document.getElementById('paymentId');
            if(pIdInput) pIdInput.value = result.data.paymentId;

            setTimeout(() => {
                if(confirm("Bubble uygulamasında kullanıcı ödeme sayfasına yönlendirilir. Simüle etmek ister misiniz?")) {
                    window.location.href = result.data.paymentUrl;
                } else {
                    changeTab('status');
                }
            }, 1000);
        } else {
            addLog(`❌ Hata: ${result.error.message}`, 'error');
        }
    } catch (error) {
        addLog(`❌ Bağlantı Hatası: ${error.message}`, 'error');
    }
}

// Durum Sorgula
async function checkPaymentStatus() {
    const id = document.getElementById('paymentId').value;
    if(!id) return addLog('Lütfen bir Payment ID girin', 'error');
    
    addLog(`🔍 Sorgulanıyor: ${id}`, 'info');
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/payments/${id}/status`);
        const data = await res.json();
        
        if(data.success) {
            const status = data.data.status.toUpperCase();
            addLog(`📊 Durum: ${status} | Tutar: ${data.data.amount} ${data.data.currency}`, 'success');
        } else {
            addLog('Kayıt bulunamadı.', 'error');
        }
    } catch(e) {
        addLog('Sorgulama hatası', 'error');
    }
}

// İşlem Geçmişi Yükle
async function loadHistory() {
    const tbody = document.getElementById('historyList');
    // Yükleniyor animasyonu
    tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; text-align:center; color:#64748b;">Veriler getiriliyor...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/payments`);
        const data = await res.json();

        if(data.success && data.data.length > 0) {
            tbody.innerHTML = ''; // Temizle
            
            data.data.forEach(pay => {
                const date = new Date(pay.createdAt).toLocaleDateString('tr-TR') + ' ' + new Date(pay.createdAt).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
                
                // Durum Renkleri
                let statusColor = '#f59e0b'; // Sarı (Pending)
                let statusText = 'BEKLİYOR';
                
                if(pay.status === 'paid') { statusColor = '#10b981'; statusText = 'ÖDENDİ'; }
                if(pay.status === 'failed') { statusColor = '#ef4444'; statusText = 'HATA'; }

                // ID Kısaltma Mantığı (pay_123...abc -> pay_...abc)
                const shortId = pay.paymentId.length > 12 
                    ? '...' + pay.paymentId.slice(-8) 
                    : pay.paymentId;

                const row = `
                    <tr style="border-bottom: 1px solid #1e293b; transition: background 0.2s;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 14px 8px;">
                            <button onclick="navigator.clipboard.writeText('${pay.paymentId}'); alert('ID Kopyalandı: ${pay.paymentId}')" 
                                    style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: #818cf8; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-family: monospace; font-size: 0.75rem;">
                                ${shortId} ❐
                            </button>
                        </td>
                        <td style="padding: 14px 8px; font-weight:600; color: #e2e8f0;">${pay.amount} ${pay.currency}</td>
                        <td style="padding: 14px 8px;">
                            <span style="background:${statusColor}20; color:${statusColor}; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; letter-spacing:0.5px;">
                                ${statusText}
                            </span>
                        </td>
                        <td style="padding: 14px 8px; color:#94a3b8; font-size: 0.75rem;">${date}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:#64748b;">Henüz işlem geçmişi yok.</td></tr>';
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:#ef4444;">Veri alınamadı.</td></tr>';
    }
}

// ==================== BAŞLATMA ====================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('paymentForm');
    if(form) form.addEventListener('submit', processPayment);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() { changeTab(this.getAttribute('data-tab')); });
    });
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', function() { changeLanguage(this.getAttribute('data-lang')); });
    });
    
    // URL Kontrol
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    if (status) {
        addLog(status === 'success' ? '✅ Ödeme Başarıyla Tamamlandı!' : '❌ Ödeme Başarısız Oldu.', status === 'success' ? 'success' : 'error');
        window.history.replaceState({}, document.title, "/demo");
        
        // Başarılı dönüşte direkt geçmişi aç
        changeTab('history');
        loadHistory();
    }
});