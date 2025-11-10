// public/demo.js - TAM ÇALIŞAN VERSİYON

// API Base URL - Render üzerindeki API'miz
const API_BASE_URL = 'https://payment-api-9g10.onrender.com';

// ==================== DİL SİSTEMİ ====================

function changeLanguage(lang) {
    console.log(`🌐 Dil değiştiriliyor: ${lang}`);
    
    // Dil butonlarını güncelle
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-lang') === lang) {
            btn.classList.add('active');
        }
    });

    // Tüm çok dilli elementleri güncelle
    document.querySelectorAll('[data-tr]').forEach(element => {
        const turkishText = element.getAttribute('data-tr');
        const englishText = element.getAttribute('data-en');
        
        if (lang === 'tr' && turkishText) {
            element.textContent = turkishText;
        } else if (lang === 'en' && englishText) {
            element.textContent = englishText;
        }
    });

    // Input placeholder'larını güncelle
    updateInputPlaceholders(lang);

    // Sayfa başlığını güncelle
    document.title = lang === 'en' 
        ? 'PaymentAPI - Bubble Payment Solution' 
        : 'PaymentAPI - Bubble için Ödeme Çözümü';

    // Seçilen dili kaydet
    localStorage.setItem('preferred-language', lang);
}

function updateInputPlaceholders(lang) {
    const placeholders = {
        tr: {
            amount: '150.00',
            description: 'Üyelik ödemesi',
            customerName: 'Ahmet Yılmaz',
            customerEmail: 'ahmet@example.com',
            paymentId: 'pay_123456789'
        },
        en: {
            amount: '150.00',
            description: 'Membership payment',
            customerName: 'John Doe',
            customerEmail: 'john@example.com',
            paymentId: 'pay_123456789'
        }
    };
    
    const ph = placeholders[lang];
    if (!ph) return;
    
    const amountInput = document.getElementById('amount');
    const descriptionInput = document.getElementById('description');
    const customerNameInput = document.getElementById('customerName');
    const customerEmailInput = document.getElementById('customerEmail');
    const paymentIdInput = document.getElementById('paymentId');
    
    if (amountInput) amountInput.placeholder = ph.amount;
    if (descriptionInput) descriptionInput.placeholder = ph.description;
    if (customerNameInput) customerNameInput.placeholder = ph.customerName;
    if (customerEmailInput) customerEmailInput.placeholder = ph.customerEmail;
    if (paymentIdInput) paymentIdInput.placeholder = ph.paymentId;
}

// ==================== TAB SİSTEMİ ====================

function changeTab(tabName) {
    console.log(`📑 Tab değiştiriliyor: ${tabName}`);
    
    // Tüm tab içeriklerini gizle
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Tüm tab butonlarını pasif yap
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Seçilen tab'ı aktif yap
    const tabElement = document.getElementById(tabName + 'Tab');
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabElement) tabElement.classList.add('active');
    if (tabButton) tabButton.classList.add('active');
}

// ==================== ÖDEME SİSTEMİ ====================

function updateCardPreview(customerName) {
    const cardName = document.getElementById('cardHolderName');
    if (cardName) {
        cardName.textContent = customerName ? customerName.toUpperCase() : 'AHMET YILMAZ';
    }
}

async function processPayment(event) {
    event.preventDefault();
    console.log('💳 Ödeme işleniyor...');
    
    const formData = new FormData(event.target);
    const paymentData = {
        amount: parseFloat(formData.get('amount')),
        description: formData.get('description'),
        customerInfo: {
            name: formData.get('customerName'),
            email: formData.get('customerEmail')
        }
    };

    // Kart önizlemesini güncelle
    updateCardPreview(paymentData.customerInfo.name);

    const responseElement = document.getElementById('apiResponse');
    showLoading(responseElement, 'Ödeme işleniyor...');

    try {
        console.log('📤 API isteği gönderiliyor:', paymentData);
        
        const response = await fetch(`${API_BASE_URL}/api/payments/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();
        console.log('📥 API yanıtı:', result);
        
        if (result.success) {
            showSuccess(responseElement, '✅ Ödeme başarıyla oluşturuldu!', result);
            
            // Payment ID'yi status sorgulama alanına otomatik doldur
            document.getElementById('paymentId').value = result.data.paymentId;
            
            // Başarı durumunda status tab'ına geç
            setTimeout(() => changeTab('status'), 1500);
        } else {
            showError(responseElement, '❌ Ödeme oluşturulamadı', result);
        }
    } catch (error) {
        console.error('❌ Fetch hatası:', error);
        showError(responseElement, '❌ Bağlantı hatası', error.message);
    }
}

async function checkPaymentStatus() {
    const paymentId = document.getElementById('paymentId').value.trim();
    const responseElement = document.getElementById('statusResponse');
    
    if (!paymentId) {
        showError(responseElement, '❌ Lütfen bir Payment ID girin');
        return;
    }

    showLoading(responseElement, '⏳ Durum sorgulanıyor...');

    try {
        console.log(`🔍 Ödeme durumu sorgulanıyor: ${paymentId}`);
        
        const response = await fetch(`${API_BASE_URL}/api/payments/${paymentId}/status`);
        const result = await response.json();
        
        if (result.success) {
            showSuccess(responseElement, '✅ Ödeme durumu:', result);
        } else {
            showError(responseElement, '❌ Durum sorgulanamadı', result);
        }
    } catch (error) {
        console.error('❌ Durum sorgulama hatası:', error);
        showError(responseElement, '❌ Bağlantı hatası', error.message);
    }
}

// ==================== UI YARDIMCI FONKSİYONLAR ====================

function showLoading(element, message) {
    if (!element) return;
    element.innerHTML = `<span style="color: #6c757d;">${message}</span>`;
    element.className = 'api-response';
}

function showSuccess(element, message, data) {
    if (!element) return;
    let content = `<span style="color: #28a745; font-weight: bold;">${message}</span>`;
    
    if (data) {
        content += `\n\n${JSON.stringify(data, null, 2)}`;
    }
    
    element.innerHTML = content;
    element.className = 'api-response response-success';
}

function showError(element, message, error) {
    if (!element) return;
    let content = `<span style="color: #dc3545; font-weight: bold;">${message}</span>`;
    
    if (error) {
        content += `\n\n${typeof error === 'object' ? JSON.stringify(error, null, 2) : error}`;
    }
    
    element.innerHTML = content;
    element.className = 'api-response response-error';
}

// ==================== OLAYLARI BAĞLAMA ====================

function initializeEventListeners() {
    console.log('🔧 Event listenerlar başlatılıyor...');
    
    // Form submit event'i
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', processPayment);
    }

    // Tab click event'leri
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            changeTab(this.getAttribute('data-tab'));
        });
    });

    // Dil butonları
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            changeLanguage(this.getAttribute('data-lang'));
        });
    });

    // Status sorgulama butonu - event delegation kullan
    document.addEventListener('click', function(e) {
        if (e.target && e.target.onclick && e.target.onclick.name === 'checkPaymentStatus') {
            checkPaymentStatus();
        }
    });

    // Enter tuşu ile status sorgulama
    const paymentIdInput = document.getElementById('paymentId');
    if (paymentIdInput) {
        paymentIdInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                checkPaymentStatus();
            }
        });
    }
}

// ==================== UYGULAMA BAŞLATMA ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 PaymentAPI Demo başlatılıyor...');
    
    // Varsayılan değerleri ayarla
    const amountInput = document.getElementById('amount');
    if (amountInput) amountInput.value = '150.00';
    
    // Dil tercihini yükle
    const savedLang = localStorage.getItem('preferred-language') || 'tr';
    changeLanguage(savedLang);
    
    // Event listener'ları başlat
    initializeEventListeners();
    
    console.log('✅ PaymentAPI Demo hazır!');
});

// Global function - butonlar için
window.checkPaymentStatus = checkPaymentStatus;