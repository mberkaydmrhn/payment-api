// public/demo.js - SADE VE SAĞLAM VERSİYON

const API_BASE_URL = window.location.origin;

// ==================== 1. INPUT FORMATLAMA (KESİN ÇÖZÜM) ====================

function formatAmountInput(input) {
    // 1. Mevcut değeri al
    let val = input.value;

    // 2. Önce içerideki BİNLİK AYRACI olan noktaları temizle.
    // Böylece elimizde saf "15000" veya "15000,50" kalsın.
    val = val.replace(/\./g, '');

    // 3. Şimdi eğer kullanıcı YENİ bir nokta (.) girdiyse onu virgüle çevir.
    // (Numpad kullananlar için)
    val = val.replace(/\./g, ',');

    // 4. Rakam ve Virgül harici her şeyi yok et (Harf vs giremesin)
    val = val.replace(/[^0-9,]/g, '');

    // 5. Virgülle ikiye böl: [Tam Sayı, Küsürat]
    const parts = val.split(',');
    let integerPart = parts[0];
    let decimalPart = parts.length > 1 ? parts[1] : null;

    // 6. Tam sayı kısmındaki baştaki sıfırları sil (0500 -> 500)
    if (integerPart.length > 1 && integerPart.startsWith('0')) {
        integerPart = integerPart.substring(1);
    }

    // 7. Tam sayı kısmını tekrar binlik noktalarla süsle
    // Regex: 3 basamakta bir nokta koy
    let formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    // 8. Sonucu birleştir ve yaz
    if (decimalPart !== null) {
        // Küsürat varsa (veya kullanıcı virgül bastıysa)
        // Küsüratı 2 hane ile sınırla
        input.value = `${formattedInteger},${decimalPart.substring(0, 2)}`;
    } else {
        // Küsürat yoksa sadece tam sayıyı yaz
        input.value = formattedInteger;
    }
}

// ==================== DİĞER FONKSİYONLAR (AYNI KALDI) ====================

function formatMoney(amount, currency) {
    return new Intl.NumberFormat('tr-TR', { 
        style: 'currency', 
        currency: currency 
    }).format(amount);
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

function changeLanguage(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-lang') === lang) btn.classList.add('active');
    });

    document.querySelectorAll('[data-tr]').forEach(element => {
        const text = lang === 'tr' ? element.getAttribute('data-tr') : element.getAttribute('data-en');
        if (text) element.innerText = text;
    });
    
    const inputs = {
        amount: { tr: '150,00', en: '150,00' },
        description: { tr: 'Premium Üyelik', en: 'Premium Membership' },
        customerName: { tr: 'Ahmet Yılmaz', en: 'John Doe' }
    };
    for (const [id, placeholders] of Object.entries(inputs)) {
        const el = document.getElementById(id);
        if(el) el.placeholder = placeholders[lang];
    }
    localStorage.setItem('preferred-language', lang);
}

function updateCardPreview(name) {
    const display = document.getElementById('cardHolderDisplay');
    if(display) display.textContent = name.toUpperCase() || 'AD SOYAD';
}

function addLog(message, type = 'info') {
    const logContainer = document.getElementById('apiResponse');
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

// ==================== API İŞLEMLERİ ====================

async function processPayment(event) {
    event.preventDefault();
    addLog('Ödeme isteği oluşturuluyor...', 'info');
    
    const formData = new FormData(event.target);
    
    // === TUTAR PARSE (TR FORMATINDAN JS FORMATINA) ===
    let rawAmount = document.getElementById('amount').value;
    
    if (!rawAmount) {
        showToast("Lütfen tutar girin");
        return;
    }

    // 1. Görsel noktaları sil: "10.000,50" -> "10000,50"
    rawAmount = rawAmount.replace(/\./g, '');
    
    // 2. Virgülü noktaya çevir: "10000,50" -> "10000.50"
    rawAmount = rawAmount.replace(',', '.');
    
    const cleanAmount = parseFloat(rawAmount);

    // Validasyon
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
        showToast("Geçersiz Tutar!");
        addLog("Hata: Tutar geçersiz", "error");
        return;
    }

    const paymentData = {
        amount: cleanAmount,
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
            
            const pIdInput = document.getElementById('paymentId');
            if(pIdInput) pIdInput.value = result.data.paymentId;

            showToast("Link Oluşturuldu! Yönlendiriliyor...");
            
            setTimeout(() => {
                if(confirm("Ödeme Sayfasına Git? (Müşteri Deneyimi)")) {
                    window.location.href = result.data.paymentUrl;
                } else {
                    changeTab('status');
                }
            }, 1000);
        } else {
            addLog(`❌ Hata: ${result.error.message}`, 'error');
            showToast("Hata oluştu!");
        }
    } catch (error) {
        addLog(`❌ Bağlantı Hatası: ${error.message}`, 'error');
    }
}

async function checkPaymentStatus() {
    const id = document.getElementById('paymentId').value;
    if(!id) {
        showToast("Lütfen Payment ID girin");
        return;
    }
    addLog(`🔍 Sorgulanıyor: ${id}`, 'info');
    try {
        const res = await fetch(`${API_BASE_URL}/api/payments/${id}/status`);
        const data = await res.json();
        if(data.success) {
            const status = data.data.status.toUpperCase();
            const formattedAmount = formatMoney(data.data.amount, data.data.currency);
            addLog(`📊 Durum: ${status} | Tutar: ${formattedAmount}`, 'success');
        } else {
            addLog('Kayıt bulunamadı.', 'error');
        }
    } catch(e) { addLog('Sorgulama hatası', 'error'); }
}

async function loadHistory() {
    const tbody = document.getElementById('historyList');
    tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; text-align:center; color:#64748b;">Veriler yükleniyor...</td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/payments`);
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

                const row = `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td>
                            <button onclick="copyText('${pay.paymentId}')" 
                                    style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: #6366f1; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-family: monospace; font-size: 0.75rem;">
                                ${shortId} ❐
                            </button>
                        </td>
                        <td style="font-weight:600; font-size:0.85rem;">${money}</td>
                        <td><span style="background:${statusColor}20; color:${statusColor}; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700;">${statusText}</span></td>
                        <td style="color:#94a3b8; font-size: 0.75rem;">${date}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:#64748b;">Henüz işlem yok.</td></tr>';
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:#ef4444;">Yükleme hatası!</td></tr>';
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
    
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    if (status) {
        showToast(status === 'success' ? 'Ödeme Başarılı!' : 'Ödeme Başarısız');
        addLog(status === 'success' ? '✅ Ödeme Tamamlandı' : '❌ Ödeme İptal', status === 'success' ? 'success' : 'error');
        window.history.replaceState({}, document.title, "/demo");
        changeTab('history');
        loadHistory();
    }
});