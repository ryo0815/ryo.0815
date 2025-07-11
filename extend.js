// 延長申請システムのJavaScript

// DOM要素の取得
const elements = {
    chatContainer: document.getElementById('chatContainer'),
    nameSection: document.getElementById('nameSection'),
    nameInput: document.getElementById('nameInput'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loadingText')
};

// 現在のステップ
let currentStep = 'initial';
let currentStudent = null;
let currentLoans = [];

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('延長申請システムが初期化されました');
    
    // 名前入力セクションを表示
    elements.nameSection.style.display = 'block';
    elements.nameInput.focus();
    
    // エンターキーでの送信
    elements.nameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleNameSubmit();
        }
    });
});

// メッセージを追加する関数
function addMessage(text, type, buttons = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'bot') {
        messageDiv.innerHTML = `<strong>${text}</strong>`;
    } else {
        messageDiv.textContent = text;
    }
    
    elements.chatContainer.appendChild(messageDiv);
    
    // ボタンがある場合は追加
    if (buttons && buttons.length > 0) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';
        
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `action-btn ${button.class || ''}`;
            btn.innerHTML = button.text;
            btn.onclick = button.action;
            buttonsContainer.appendChild(btn);
        });
        
        messageDiv.appendChild(buttonsContainer);
    }
    
    // スクロールを最下部に移動
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// ローディング表示
function showLoading(text = '処理中...') {
    elements.loadingText.textContent = text;
    elements.loading.style.display = 'block';
}

// ローディング非表示
function hideLoading() {
    elements.loading.style.display = 'none';
}

// 名前入力の処理
async function handleNameSubmit() {
    const name = elements.nameInput.value.trim();
    if (!name) {
        alert('名前を入力してください');
        return;
    }
    
    addMessage(name, 'user');
    showLoading('貸出一覧を取得しています...');
    elements.nameSection.style.display = 'none';
    
    try {
        const response = await fetch('/api/extend-step1', {
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
            currentStudent = data.data.student;
            currentLoans = data.data.loans;
            
            if (currentLoans.length === 0) {
                addMessage('📚 現在借りている本がありません。', 'bot');
                setTimeout(() => {
                    window.location.href = '/';
                }, 3000);
            } else {
                addMessage(`📚 ${currentStudent.name}さんの貸出一覧を表示します`, 'bot');
                displayLoanList();
            }
        } else {
            addMessage(data.message, 'bot');
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。もう一度お試しください。', 'bot');
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    }
}

// 貸出一覧を表示する関数
function displayLoanList() {
    const loanListDiv = document.createElement('div');
    loanListDiv.className = 'loan-list';
    
    currentLoans.forEach((loan, index) => {
        const loanItem = document.createElement('div');
        loanItem.className = 'loan-item';
        
        const title = loan.title || '不明な書籍';
        const dueDate = loan.dueDate || '不明';
        const isOverdue = loan.isOverdue || false;
        const canExtend = loan.canExtend || false;
        const extendCount = loan.extendCount || 0;
        
        let statusText = '';
        if (isOverdue) {
            statusText = '<span style="color: red;">⚠️ 延滞中</span>';
        } else if (extendCount > 0) {
            statusText = `<span style="color: orange;">🔄 延長済み (${extendCount}回)</span>`;
        } else {
            statusText = '<span style="color: green;">✅ 正常</span>';
        }
        
        loanItem.innerHTML = `
            <h5>${title}</h5>
            <p>返却期限: ${dueDate}</p>
            <p>状態: ${statusText}</p>
            ${canExtend ? 
                `<button class="extend-btn" onclick="requestExtension(${index})">
                    <i class="fas fa-clock"></i> 延長申請 (+7日)
                </button>` : 
                `<button class="extend-btn" disabled>
                    <i class="fas fa-ban"></i> 延長不可
                </button>`
            }
        `;
        
        loanListDiv.appendChild(loanItem);
    });
    
    // チャットコンテナに追加
    elements.chatContainer.appendChild(loanListDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// 延長申請を送信する関数
async function requestExtension(loanIndex) {
    const loan = currentLoans[loanIndex];
    if (!loan) {
        alert('エラーが発生しました');
        return;
    }
    
    const confirmMessage = `「${loan.title}」の返却期限を7日間延長しますか？\n\n現在の期限: ${loan.dueDate}\n延長後の期限: ${loan.newDueDate}`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    addMessage(`「${loan.title}」の延長申請を送信しています...`, 'user');
    showLoading('延長処理を実行しています...');
    
    try {
        const response = await fetch('/api/extend-step2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                loanId: loan.id,
                studentName: currentStudent.name
            }),
            credentials: 'include'
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            addMessage(`✅ 延長申請が完了しました！\n\n新しい返却期限: ${data.data.newDueDate}`, 'bot');
            
            // 3秒後にメインページに戻る
            setTimeout(() => {
                if (data.data && data.data.redirectToMain) {
                    window.location.href = '/';
                } else {
                    window.location.href = '/';
                }
            }, 3000);
        } else {
            addMessage(data.message, 'bot');
        }
        
    } catch (error) {
        hideLoading();
        addMessage('エラーが発生しました。もう一度お試しください。', 'bot');
    }
}

// 初期状態にリセット
function resetToInitialState() {
    window.location.href = '/';
}

// エラーハンドリング
window.addEventListener('error', function(e) {
    console.error('JavaScript Error:', e.error);
    hideLoading();
});

// 未キャッチプロミス拒否のハンドリング
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled Promise Rejection:', e.reason);
    hideLoading();
});

console.log('延長申請システムのJavaScriptが読み込まれました'); 