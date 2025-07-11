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
    elements.uploadBtn.addEventListener('click', handleReturnStep1);
    
    // 名前入力関連
    elements.nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleReturnStep3();
        }
    });
    elements.nameSubmitBtn.addEventListener('click', handleReturnStep3);
    
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

// ========== 返却システムのフロー ==========

// 返却ステップ1: 画像アップロード
async function handleReturnStep1() {
    if (!selectedFile) {
        alert('画像を選択してください');
        return;
    }
    
    addMessage('この書籍を返却したい', 'user');
    showLoading('画像を解析しています...');
    
    // アップロードセクションを隠す
    elements.uploadSection.style.display = 'none';
    
    const formData = new FormData();
    formData.append('bookImage', selectedFile);
    
    try {
        const response = await fetch('/api/return-step1', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            const buttons = [
                { text: '<i class="fas fa-check"></i> 返却する', action: () => handleReturnStep2('return') },
                { text: '<i class="fas fa-times"></i> キャンセル', action: () => handleReturnStep2('cancel'), class: 'btn-cancel' }
            ];
            
            addMessage(data.message, 'bot', buttons);
            currentStep = 'return_book_found';
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

// 返却ステップ2: 「返却する」ボタンを押した時の処理
async function handleReturnStep2(action) {
    if (action === 'cancel') {
        addMessage('キャンセル', 'user');
        addMessage('キャンセルしました。', 'bot');
        setTimeout(() => {
            resetToInitialState();
        }, 2000);
        return;
    }
    
    addMessage('返却する', 'user');
    showLoading();
    
    try {
        const response = await fetch('/api/return-step2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'return' }),
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            addMessage(data.message, 'bot');
            elements.nameSection.style.display = 'block';
            elements.nameInput.focus();
            currentStep = 'return_name_request';
        } else {
            addMessage(data.message, 'bot');
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。', 'bot');
    }
}

// 返却ステップ3: 名前入力
async function handleReturnStep3() {
    const name = elements.nameInput.value.trim();
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    addMessage(name, 'user');
    showLoading();
    elements.nameSection.style.display = 'none';
    
    try {
        const response = await fetch('/api/return-step3', {
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
                { text: '<i class="fas fa-check"></i> 確認', action: () => handleReturnStep4('confirm') },
                { text: '<i class="fas fa-times"></i> キャンセル', action: () => handleReturnStep4('cancel'), class: 'btn-cancel' }
            ];
            
            addMessage(data.message, 'bot', buttons);
            currentStep = 'return_check_deadline';
        } else {
            addMessage(data.message, 'bot');
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。', 'bot');
    }
}

// 返却ステップ4: 返却確認（最終処理）
async function handleReturnStep4(action) {
    if (action === 'cancel') {
        addMessage('キャンセル', 'user');
        addMessage('キャンセルしました。', 'bot');
        setTimeout(() => {
            resetToInitialState();
        }, 2000);
        return;
    }
    
    addMessage('確認', 'user');
    showLoading('返却処理を実行しています...');
    
    try {
        const response = await fetch('/api/return-step4', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'confirm' }),
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            addMessage(data.message, 'bot');
            currentStep = 'return_completed';
            
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