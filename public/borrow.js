// アプリケーションの状態管理
let currentStep = 'initial';
let selectedFile = null;

// DOM要素の取得
const elements = {
    initialPrompt: document.getElementById('initialPrompt'),
    chatContainer: document.getElementById('chatContainer'),
    messages: document.getElementById('messages'),
    uploadSection: document.getElementById('uploadSection'),
    uploadArea: document.getElementById('uploadArea'),
    bookImage: document.getElementById('bookImage'),
    imagePreview: document.getElementById('imagePreview'),
    uploadBtn: document.getElementById('uploadBtn'),
    nameSection: document.getElementById('nameSection'),
    nameInput: document.getElementById('nameInput'),
    nameSubmitBtn: document.getElementById('nameSubmitBtn'),
    loading: document.getElementById('loading'),
    resetBtn: document.getElementById('resetBtn')
};

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    resetToInitialState();
}

function setupEventListeners() {
    // ファイルアップロード関連
    elements.uploadArea.addEventListener('click', () => elements.bookImage.click());
    elements.bookImage.addEventListener('change', handleFileSelect);
    elements.uploadBtn.addEventListener('click', handleBorrowStep1);
    
    // 名前入力関連
    elements.nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBorrowStep3();
        }
    });
    elements.nameSubmitBtn.addEventListener('click', handleBorrowStep3);
    
    // リセットボタン
    elements.resetBtn.addEventListener('click', resetSystem);
    
    // ドラッグ&ドロップ
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
}

function resetToInitialState() {
    currentStep = 'initial';
    selectedFile = null;
    
    // UI要素の表示/非表示
    elements.initialPrompt.style.display = 'block';
    elements.chatContainer.style.display = 'none';
    elements.uploadSection.style.display = 'block';
    elements.nameSection.style.display = 'none';
    elements.loading.style.display = 'none';
    
    // フォームのリセット
    elements.bookImage.value = '';
    elements.nameInput.value = '';
    elements.uploadBtn.disabled = true;
    elements.imagePreview.innerHTML = '';
    elements.messages.innerHTML = '';
}

function resetSystem() {
    fetch('/api/reset', {
        method: 'POST',
        credentials: 'include'
    });
    resetToInitialState();
}

// ファイル選択処理
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedFile = file;
        showImagePreview(file);
        elements.uploadBtn.disabled = false;
    }
}

function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        elements.imagePreview.innerHTML = `
            <img src="${e.target.result}" class="image-preview" alt="プレビュー">
        `;
    };
    reader.readAsDataURL(file);
}

// ドラッグ&ドロップ処理
function handleDragOver(event) {
    event.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            selectedFile = file;
            showImagePreview(file);
            elements.uploadBtn.disabled = false;
        }
    }
}

// メッセージ表示関数
function addMessage(content, type = 'bot', buttons = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    
    if (buttons) {
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'action-buttons';
        
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `btn btn-action ${button.class || ''}`;
            btn.innerHTML = button.text;
            btn.onclick = button.action;
            buttonsDiv.appendChild(btn);
        });
        
        messageDiv.appendChild(buttonsDiv);
    }
    
    elements.messages.appendChild(messageDiv);
    
    // チャットコンテナを表示
    elements.chatContainer.style.display = 'block';
    elements.initialPrompt.style.display = 'none';
    
    // スクロールを下に
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function showLoading(message = '処理中...') {
    elements.loading.style.display = 'block';
    elements.loading.querySelector('.text-muted').textContent = message;
}

function hideLoading() {
    elements.loading.style.display = 'none';
}

// ========== 貸出システムのフロー ==========

// ステップ1: 画像アップロード
async function handleBorrowStep1() {
    if (!selectedFile) {
        alert('画像を選択してください');
        return;
    }
    
    addMessage('この書籍を借りたい', 'user');
    showLoading('画像を解析しています...');
    
    // アップロードセクションを隠す
    elements.uploadSection.style.display = 'none';
    
    const formData = new FormData();
    formData.append('bookImage', selectedFile);
    
    try {
        const response = await fetch('/api/step1', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            const buttons = [
                { text: '<i class="fas fa-check"></i> 借りる', action: () => handleBorrowStep2('borrow') },
                { text: '<i class="fas fa-times"></i> キャンセル', action: () => handleBorrowStep2('cancel'), class: 'btn-cancel' }
            ];
            
            addMessage(data.message, 'bot', buttons);
            currentStep = 'book_found';
        } else {
            addMessage(data.message, 'bot');
            // エラーの場合は最初に戻る
            setTimeout(() => {
                resetToInitialState();
            }, 3000);
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。もう一度お試しください。', 'bot');
        setTimeout(() => {
            resetToInitialState();
        }, 3000);
    }
}

// ステップ2: 「借りる」ボタンを押した時の処理
async function handleBorrowStep2(action) {
    if (action === 'cancel') {
        addMessage('キャンセル', 'user');
        addMessage('キャンセルしました。', 'bot');
        setTimeout(() => {
            resetToInitialState();
        }, 2000);
        return;
    }
    
    addMessage('借りる', 'user');
    showLoading();
    
    try {
        const response = await fetch('/api/step2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'borrow' }),
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            addMessage(data.message, 'bot');
            elements.nameSection.style.display = 'block';
            elements.nameInput.focus();
            currentStep = 'name_request';
        } else {
            addMessage(data.message, 'bot');
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。', 'bot');
    }
}

// ステップ3: 名前入力
async function handleBorrowStep3() {
    const name = elements.nameInput.value.trim();
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    addMessage(name, 'user');
    showLoading();
    elements.nameSection.style.display = 'none';
    
    try {
        const response = await fetch('/api/step3', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name }),
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            const buttons = [
                { text: '<i class="fas fa-check"></i> 同意', action: () => handleBorrowStep4('agree') },
                { text: '<i class="fas fa-times"></i> キャンセル', action: () => handleBorrowStep4('cancel'), class: 'btn-cancel' }
            ];
            
            addMessage(data.message, 'bot', buttons);
            currentStep = 'confirm_period';
        } else {
            addMessage(data.message, 'bot');
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。', 'bot');
    }
}

// ステップ4: 貸出期間の同意
async function handleBorrowStep4(action) {
    if (action === 'cancel') {
        addMessage('キャンセル', 'user');
        addMessage('キャンセルしました。', 'bot');
        setTimeout(() => {
            resetToInitialState();
        }, 2000);
        return;
    }
    
    addMessage('同意', 'user');
    showLoading();
    
    try {
        const response = await fetch('/api/step4', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'agree' }),
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            const buttons = [
                { text: '<i class="fas fa-check"></i> 同意', action: () => handleBorrowStep5('agree') },
                { text: '<i class="fas fa-times"></i> キャンセル', action: () => handleBorrowStep5('cancel'), class: 'btn-cancel' }
            ];
            
            addMessage(data.message, 'bot', buttons);
            currentStep = 'show_rules';
        } else {
            addMessage(data.message, 'bot');
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。', 'bot');
    }
}

// ステップ5: 貸出ルールの同意（最終処理）
async function handleBorrowStep5(action) {
    if (action === 'cancel') {
        addMessage('キャンセル', 'user');
        addMessage('キャンセルしました。', 'bot');
        setTimeout(() => {
            resetToInitialState();
        }, 2000);
        return;
    }
    
    addMessage('同意', 'user');
    showLoading('貸出処理を実行しています...');
    
    try {
        const response = await fetch('/api/step5', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'agree' }),
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            addMessage(data.message, 'bot');
            currentStep = 'completed';
            
            // 完了後、3秒後にメインページに戻る
            setTimeout(() => {
                if (data.data && data.data.redirectToMain) {
                    window.location.href = '/';
                } else {
                    resetToInitialState();
                }
            }, 3000);
        } else {
            addMessage(data.message, 'bot');
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。', 'bot');
    }
} 