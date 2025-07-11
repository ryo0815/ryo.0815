const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// セッション設定
app.use(session({
  secret: 'book-lending-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24時間
}));

// 環境変数の設定
const config = {
  googleCloud: {
    apiKey: process.env.GOOGLE_CLOUD_API_KEY,
    apiUrl: 'https://vision.googleapis.com/v1/images:annotate'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY,
    baseId: process.env.AIRTABLE_BASE_ID,
    baseUrl: 'https://api.airtable.com/v0',
    tables: {
      books: process.env.BOOKS_TABLE || 'Books',
      students: process.env.STUDENTS_TABLE || 'Students',
      loans: process.env.LOANS_TABLE || 'Loans'
    }
  }
};

// 貸出ステップの定義
const LENDING_STEPS = {
  INITIAL: 'initial',
  BOOK_FOUND: 'book_found',
  NAME_REQUEST: 'name_request',
  CONFIRM_PERIOD: 'confirm_period',
  SHOW_RULES: 'show_rules',
  COMPLETED: 'completed'
};

// ミドルウェア設定
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// リクエストログ
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.static('public'));

// Multer設定（メモリストレージ）
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB制限
});

// 日付フォーマット関数
function formatDate(date) {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${month}月${day}日（${weekday}）`;
}

/**
 * Google Cloud Vision APIを使って画像からテキストを抽出
 */
async function extractTextFromImage(base64Image) {
  try {
    console.log('📸 画像からテキストを抽出中...');
    
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 50
            }
          ]
        }
      ]
    };

    const response = await axios.post(
      `${config.googleCloud.apiUrl}?key=${config.googleCloud.apiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.responses && response.data.responses[0].textAnnotations) {
      const extractedText = response.data.responses[0].textAnnotations[0].description;
      console.log('✅ テキスト抽出成功:', extractedText);
      return extractedText;
    } else {
      console.log('⚠️  テキストが検出されませんでした');
      return '';
    }
  } catch (error) {
    console.error('❌ Google Cloud Vision API エラー:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Airtableから書籍を検索
 */
async function searchBookInAirtable(title) {
  try {
    console.log('📚 書籍を検索中:', title);
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.books}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`
      },
      params: {
        filterByFormula: `SEARCH("${title.toLowerCase()}", LOWER({タイトル})) > 0`
      }
    });

    if (response.data.records && response.data.records.length > 0) {
      const book = response.data.records[0];
      console.log('✅ 書籍が見つかりました:', book.fields.タイトル || book.fields.Title);
      return book;
    } else {
      console.log('⚠️  書籍が見つかりませんでした');
      return null;
    }
  } catch (error) {
    console.error('❌ Airtable書籍検索エラー:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 生徒情報を取得
 */
async function getStudentInfo(nameOrId) {
  try {
    console.log('👤 生徒情報を取得中:', nameOrId);
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.students}`;
    
    // 名前または生徒IDで検索
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`
      },
      params: {
        filterByFormula: `OR({生徒ID} = "${nameOrId}", {名前} = "${nameOrId}")`
      }
    });

    if (response.data.records && response.data.records.length > 0) {
      const student = response.data.records[0];
      console.log('✅ 生徒情報を取得しました:', student.fields.名前 || student.fields.Name);
      return student;
    } else {
      console.log('⚠️  生徒が見つかりませんでした');
      return null;
    }
  } catch (error) {
    console.error('❌ 生徒情報取得エラー:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 貸出レコードを作成
 */
async function createLoanRecord(book, student) {
  try {
    console.log('📝 貸出レコードを作成中...');
    
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 14); // 14日後
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.loans}`;
    
    const requestBody = {
      records: [
        {
          fields: {
            本: [book.id],
            生徒: [student.id],
            貸出日: today.toISOString().split('T')[0],
            返却期限: dueDate.toISOString().split('T')[0],
            返却状況: '貸出中'
          }
        }
      ]
    };

    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const loanRecord = response.data.records[0];
    console.log('✅ 貸出レコードを作成しました:', loanRecord.id);
    
    return loanRecord;
  } catch (error) {
    console.error('❌ 貸出レコード作成エラー:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 書籍のステータスを「貸出中」に更新
 */
async function updateBookStatus(book) {
  try {
    console.log('📚 書籍ステータスを更新中...');
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.books}/${book.id}`;
    
    const requestBody = {
      fields: {
        status: '貸出中'
      }
    };

    const response = await axios.patch(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ 書籍ステータスを「貸出中」に更新しました');
    
    // 更新後に少し待機してAirtableの反映を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return response.data;
  } catch (error) {
    console.error('❌ 書籍ステータス更新エラー:', error.response?.data || error.message);
    console.log('⚠️  書籍ステータス更新に失敗しましたが、貸出記録は作成されているため処理を続行します');
    // 書籍ステータス更新に失敗してもエラーを投げずに続行
    return null;
  }
}

/**
 * 書籍のステータスを「貸出可」に戻す
 */
async function returnBookStatus(book) {
  try {
    console.log('📚 書籍ステータスを「貸出可」に戻しています...');
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.books}/${book.id}`;
    
    const requestBody = {
      fields: {
        status: '貸出可'
      }
    };

    const response = await axios.patch(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ 書籍ステータスを「貸出可」に戻しました');
    
    // 更新後に少し待機してAirtableの反映を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return response.data;
  } catch (error) {
    console.error('❌ 書籍ステータス復元エラー:', error.response?.data || error.message);
    console.log('⚠️  書籍ステータス更新に失敗しましたが、返却記録は更新されているため処理を続行します');
    // 書籍ステータス更新に失敗してもエラーを投げずに続行
    return null;
  }
}

/**
 * 貸出記録を検索
 */
async function findLoanRecord(book, student) {
  try {
    console.log('🔍 貸出記録を検索中...');
    console.log('📖 検索する書籍ID:', book.id);
    console.log('👤 検索する生徒ID:', student.id);
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.loans}`;
    
    // 全ての貸出中レコードを取得してJavaScriptでフィルタリング
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`
      },
      params: {
        filterByFormula: `{返却状況} = "貸出中"`
      }
    });

    console.log('📊 貸出中レコード数:', response.data.records?.length || 0);
    
    if (response.data.records && response.data.records.length > 0) {
      // JavaScriptでフィルタリング
      const matchingRecord = response.data.records.find(record => {
        const bookIds = record.fields.本 || [];
        const studentIds = record.fields.生徒 || [];
        
        console.log('🔍 チェック中のレコード:', record.id);
        console.log('📖 レコードの書籍ID:', bookIds);
        console.log('👤 レコードの生徒ID:', studentIds);
        
        const bookMatch = bookIds.includes(book.id);
        const studentMatch = studentIds.includes(student.id);
        
        console.log('📖 書籍一致:', bookMatch);
        console.log('👤 生徒一致:', studentMatch);
        
        return bookMatch && studentMatch;
      });
      
      if (matchingRecord) {
        console.log('✅ 貸出記録が見つかりました:', matchingRecord.id);
        console.log('📋 レコードの詳細:', JSON.stringify(matchingRecord.fields, null, 2));
        return matchingRecord;
      } else {
        console.log('⚠️  該当する貸出記録が見つかりませんでした');
        
        // デバッグ用：全ての貸出記録を表示
        console.log('🔍 全ての貸出中記録:');
        response.data.records.forEach((record, index) => {
          console.log(`記録${index + 1}:`, JSON.stringify(record.fields, null, 2));
        });
        
        return null;
      }
    } else {
      console.log('⚠️  貸出中の記録が一件もありません');
      return null;
    }
  } catch (error) {
    console.error('❌ 貸出記録検索エラー:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 返却処理を実行
 */
async function processReturn(loanRecord) {
  const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.loans}/${loanRecord.id}`;
  
  // requestBodyを関数の先頭で定義
  let requestBody = null;
  
  try {
    console.log('📝 返却処理を実行中...');
    console.log('🔍 既存のレコード情報:', JSON.stringify(loanRecord.fields, null, 2));
    
    const today = new Date();
    
    // 実際の返却日フィールドが存在するかチェック
    const hasReturnDateField = '実際の返却日' in loanRecord.fields || '返却日' in loanRecord.fields || 'Returned Date' in loanRecord.fields;
    
    // 現在の返却状況フィールドの値を確認
    const currentStatus = loanRecord.fields.返却状況;
    console.log('🔍 現在の返却状況:', currentStatus);
    
    requestBody = {
      fields: {
        返却状況: '貸出可'  // 返却時は「貸出中」から「貸出可」に変更
      }
    };
    
    // 返却日フィールドが存在する場合のみ追加
    if (hasReturnDateField) {
      if ('実際の返却日' in loanRecord.fields) {
        requestBody.fields['実際の返却日'] = today.toISOString().split('T')[0];
      } else if ('返却日' in loanRecord.fields) {
        requestBody.fields['返却日'] = today.toISOString().split('T')[0];
      } else if ('Returned Date' in loanRecord.fields) {
        requestBody.fields['Returned Date'] = today.toISOString().split('T')[0];
      }
    }
    
    console.log('📤 送信するデータ:', JSON.stringify(requestBody, null, 2));

    const response = await axios.patch(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ 返却処理が完了しました:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ 返却処理エラー:', error.response?.data || error.message);
    console.error('❌ エラーの詳細:', JSON.stringify(error.response?.data, null, 2));
    
    // 422エラーの場合、詳細なエラー情報を出力
    if (error.response?.status === 422) {
      console.error('🔍 422エラーの詳細分析:');
      console.error('   - エラーメッセージ:', error.response?.data?.error?.message);
      console.error('   - エラータイプ:', error.response?.data?.error?.type);
      console.error('   - 送信データ:', JSON.stringify(requestBody, null, 2));
      console.error('   - 対象レコードID:', loanRecord.id);
      console.error('   - 現在のフィールド:', JSON.stringify(loanRecord.fields, null, 2));
      
      console.log('🔄 異なる返却状況値で再試行...');
      // 返却時は「貸出可」に変更（共通ステータス）
      const retryValues = ['貸出可', '利用可能', 'Available'];
      
      for (const value of retryValues) {
        try {
          const simpleRequestBody = {
            fields: {
              返却状況: value
            }
          };
          
          console.log(`🔄 "${value}" で再試行中...`);
          const retryResponse = await axios.patch(url, simpleRequestBody, {
            headers: {
              'Authorization': `Bearer ${config.airtable.apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`✅ 再試行で返却処理が完了しました (${value}):`, retryResponse.data.id);
          return retryResponse.data;
        } catch (retryError) {
          console.log(`❌ "${value}" でも失敗:`, retryError.response?.data?.error?.message || retryError.message);
          continue;
        }
      }
      
      console.error('❌ 全ての再試行が失敗しました');
      console.error('❌ 最後のエラー:', error.response?.data?.error?.message || error.message);
      
      // より詳細なエラーオブジェクトを作成
      const detailedError = new Error(`返却処理に失敗しました: ${error.response?.data?.error?.message || error.message}`);
      detailedError.originalError = error;
      detailedError.statusCode = 422;
      throw detailedError;
    }
    
    throw error;
  }
}

/**
 * 書籍の利用可能性をチェック（貸出記録から判定）
 */
async function checkBookAvailability(bookId) {
  try {
    console.log('📚 書籍の利用可能性をチェック中...');
    console.log('📖 書籍ID:', bookId);
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.loans}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`
      },
      params: {
        filterByFormula: `{返却状況} = "貸出中"`,
        maxRecords: 100
      }
    });

    const currentLoans = response.data.records || [];
    
    // この書籍の貸出中記録をすべて取得
    const bookLoans = currentLoans.filter(loan => {
      const bookIds = loan.fields.本 || [];
      return bookIds.includes(bookId);
    });
    
    console.log(`📊 この書籍の貸出中記録数: ${bookLoans.length}`);
    
    if (bookLoans.length > 0) {
      // 最新の貸出記録を取得（貸出日で降順ソート）
      const latestLoan = bookLoans.sort((a, b) => {
        const dateA = new Date(a.fields.貸出日 || '1900-01-01');
        const dateB = new Date(b.fields.貸出日 || '1900-01-01');
        return dateB - dateA; // 降順（新しい順）
      })[0];
      
      console.log('📋 最新の貸出記録:', JSON.stringify(latestLoan.fields, null, 2));
      console.log('❌ この書籍は現在貸出中です');
      return false; // 貸出中のため利用不可
    } else {
      console.log('✅ この書籍は利用可能です');
      return true; // 利用可能
    }
  } catch (error) {
    console.error('❌ 書籍利用可能性チェックエラー:', error.response?.data || error.message);
    // エラーの場合は安全側に倒して利用不可とする
    return false;
  }
}

/**
 * 生徒の現在の貸出冊数をチェック
 */
async function checkStudentLoanCount(student) {
  try {
    console.log('📊 生徒の貸出冊数をチェック中...');
    console.log('👤 生徒ID:', student.id);
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.loans}`;
    
    // フィルター条件を修正：ARRAYJOINの代わりに直接配列検索を使用
    const filterFormula = `AND({生徒} = "${student.id}", {返却状況} = "貸出中")`;
    console.log('🔍 検索条件:', filterFormula);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`
      },
      params: {
        filterByFormula: filterFormula,
        maxRecords: 10 // 最大10件まで（デバッグのため増加）
      }
    });
    
    // フィルターが機能しない場合の代替案：全レコードを取得してJavaScriptでフィルタリング
    if (response.data.records && response.data.records.length === 0) {
      console.log('⚠️  フィルター検索で結果なし。全レコードを取得してJavaScriptでフィルタリングします...');
      
      const allResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${config.airtable.apiKey}`
        },
        params: {
          maxRecords: 50
        }
      });
      
      const allRecords = allResponse.data.records || [];
      console.log(`📊 全レコード数: ${allRecords.length}`);
      
      // JavaScriptでフィルタリング
      const filteredRecords = allRecords.filter(record => {
        const studentIds = record.fields.生徒 || [];
        const returnStatus = record.fields.返却状況;
        const studentMatch = studentIds.includes(student.id);
        const statusMatch = returnStatus === '貸出中';
        
        console.log(`レコード${record.id}: 生徒一致=${studentMatch}, ステータス一致=${statusMatch}, ステータス="${returnStatus}"`);
        
        return studentMatch && statusMatch;
      });
      
      console.log(`🔍 フィルタリング結果: ${filteredRecords.length}件`);
      
      // レスポンスを上書き
      response.data.records = filteredRecords;
    }

    const currentLoans = response.data.records || [];
    const loanCount = currentLoans.length;
    
    console.log(`📚 現在の貸出冊数: ${loanCount}/4冊`);
    console.log(`📊 取得されたレコード数: ${currentLoans.length}`);
    
    // 詳細情報をログに出力
    if (loanCount > 0) {
      console.log('📋 貸出中の書籍:');
      currentLoans.forEach((loan, index) => {
        const title = loan.fields['タイトル (from 本)'] || loan.fields['Title (from 本)'] || '不明';
        const dueDate = loan.fields['返却期限'] || '不明';
        console.log(`  ${index + 1}. ${title} (期限: ${dueDate})`);
        console.log(`     レコードID: ${loan.id}`);
        console.log(`     返却状況: ${loan.fields.返却状況}`);
        console.log(`     生徒ID: ${loan.fields.生徒}`);
      });
    }
    
    return {
      count: loanCount,
      isAtLimit: loanCount >= 4,
      currentLoans: currentLoans
    };
  } catch (error) {
    console.error('❌ 貸出冊数チェックエラー:', error.response?.data || error.message);
    // エラーが発生した場合は安全側に倒して制限なしとする
    return {
      count: 0,
      isAtLimit: false,
      currentLoans: []
    };
  }
}

/**
 * 返却期限をチェック
 */
function checkReturnDeadline(dueDate) {
  const today = new Date();
  const deadline = new Date(dueDate);
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    daysRemaining: diffDays,
    isEarly: diffDays >= 2, // 2日以上前
    isOverdue: diffDays < 0
  };
}

// ルート設定
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// favicon対応（404エラーを防ぐ）
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// ステップ1: 書籍画像をアップロードして検索
app.post('/api/step1', upload.single('bookImage'), async (req, res) => {
  try {
    const imageFile = req.file;

    console.log('🚀 ステップ1: 書籍検索を開始します');
    console.log('📸 画像ファイル:', imageFile ? imageFile.originalname : 'なし');

    if (!imageFile) {
      return res.status(400).json({ 
        success: false, 
        message: '画像ファイルが必要です' 
      });
    }

    // 画像をbase64エンコード
    const base64Image = imageFile.buffer.toString('base64');
    
    // 画像からテキストを抽出
    const extractedText = await extractTextFromImage(base64Image);
    if (!extractedText) {
      return res.status(400).json({ 
        success: false, 
        message: '画像からテキストを抽出できませんでした' 
      });
    }

    // 抽出されたテキストから書籍を検索
    const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
    let bookFound = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 3) {
        bookFound = await searchBookInAirtable(trimmedLine);
        if (bookFound) {
          break;
        }
      }
    }

    if (!bookFound) {
      return res.status(404).json({ 
        success: false, 
        message: '申し訳ございませんが、この書籍は見つかりませんでした。' 
      });
    }

    // 書籍の利用可能性を貸出記録から直接チェック
    console.log('📊 書籍フィールド一覧:', Object.keys(bookFound.fields));
    console.log('📊 書籍の全フィールド:', JSON.stringify(bookFound.fields, null, 2));
    
    const bookStatus = bookFound.fields.status || bookFound.fields.Status || bookFound.fields.ステータス;
    console.log('📊 書籍ステータス:', bookStatus);
    
    // 貸出記録から実際の利用可能性を確認
    console.log('🔍 この書籍の実際の貸出状況を確認中...');
    const isBookAvailable = await checkBookAvailability(bookFound.id);
    
    if (!isBookAvailable) {
      return res.status(400).json({ 
        success: false, 
        message: `申し訳ございませんが、この書籍は現在貸出中です。`,
        book: bookFound.fields
      });
    }

    // セッションに書籍情報を保存
    req.session.book = bookFound;
    req.session.step = LENDING_STEPS.BOOK_FOUND;

    res.json({
      success: true,
      message: '🙆‍♀️この本は貸出可能です',
      data: {
        book: {
          id: bookFound.id,
          title: bookFound.fields.タイトル || bookFound.fields.Title,
          author: bookFound.fields.著者 || bookFound.fields.Author
        },
        step: LENDING_STEPS.BOOK_FOUND,
        nextAction: 'borrow_or_cancel'
      }
    });

  } catch (error) {
    console.error('❌ ステップ1エラー:', error);
    res.status(500).json({
        success: false, 
      message: 'エラーが発生しました。もう一度お試しください。'
    });
  }
});

// ステップ2: 「借りる」ボタンを押した時の処理
app.post('/api/step2', (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'cancel') {
      req.session.destroy();
      return res.json({
        success: true,
        message: 'キャンセルしました。',
        data: { step: LENDING_STEPS.INITIAL }
      });
    }

    if (action === 'borrow' && req.session.book) {
      req.session.step = LENDING_STEPS.NAME_REQUEST;
      
      res.json({
        success: true,
        message: '📝名前を入力してください',
        data: {
          step: LENDING_STEPS.NAME_REQUEST,
          nextAction: 'enter_name'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'セッションが無効です。最初からやり直してください。'
      });
    }

  } catch (error) {
    console.error('❌ ステップ2エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。'
    });
  }
});

// ステップ3: 名前を入力した時の処理
app.post('/api/step3', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !req.session.book) {
      return res.status(400).json({
        success: false,
        message: '名前を入力してください。'
      });
    }

    // 名前で生徒を検索（生徒IDフィールドで検索）
    const student = await getStudentInfo(name);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: '申し訳ございませんが、その名前の生徒が見つかりませんでした。'
      });
    }

    // 生徒の現在の貸出冊数をチェック
    const loanCheck = await checkStudentLoanCount(student);
    if (loanCheck.isAtLimit) {
      return res.status(400).json({
        success: false,
        message: `申し訳ございませんが、${student.fields.名前 || student.fields.Name}さんは既に4冊借りているため、これ以上借りることができません。まず返却をお願いします。`
      });
    }

    // セッションに生徒情報を保存
    req.session.student = student;
    req.session.step = LENDING_STEPS.CONFIRM_PERIOD;

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 14);

    res.json({
      success: true,
      message: `⏳貸出期間は本日から2週間後の【${formatDate(dueDate)}】までです`,
      data: {
        student: {
          name: student.fields.名前 || student.fields.Name,
          studentId: student.fields.生徒ID || student.fields.StudentID
        },
        dueDate: formatDate(dueDate),
        step: LENDING_STEPS.CONFIRM_PERIOD,
        nextAction: 'agree_or_cancel'
      }
    });

  } catch (error) {
    console.error('❌ ステップ3エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。'
    });
  }
});

// ステップ4: 貸出期間に同意した時の処理
app.post('/api/step4', (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'cancel') {
      req.session.destroy();
      return res.json({
        success: true,
        message: 'キャンセルしました。',
        data: { step: LENDING_STEPS.INITIAL }
      });
    }

    if (action === 'agree' && req.session.book && req.session.student) {
      req.session.step = LENDING_STEPS.SHOW_RULES;
      
      const rules = `📚 貸出ルール
貸出期間は2週間、最大4冊まで
返却期限は必ず守ること（延長希望は事前申請）
書き込み・落書き・マーカーの使用は禁止
汚損・破損・紛失した場合は原則弁償
長期未返却やルール違反が続いた場合、貸出停止の可能性あり`;

      res.json({
        success: true,
        message: rules,
        data: {
          step: LENDING_STEPS.SHOW_RULES,
          nextAction: 'agree_or_cancel'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'セッションが無効です。最初からやり直してください。'
      });
    }

  } catch (error) {
    console.error('❌ ステップ4エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。'
    });
  }
});

// ステップ5: 貸出ルールに同意した時の処理（最終処理）
app.post('/api/step5', async (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'cancel') {
      req.session.destroy();
      return res.json({
        success: true,
        message: 'キャンセルしました。',
        data: { step: LENDING_STEPS.INITIAL }
      });
    }

    if (action === 'agree' && req.session.book && req.session.student) {
      // 貸出レコードを作成
      const loanRecord = await createLoanRecord(req.session.book, req.session.student);
      
      // 書籍ステータスを更新
      await updateBookStatus(req.session.book);

      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + 14);

      const finalMessage = `🫡ご利用ありがとうございます。返却期限は【${formatDate(dueDate)}】です`;

      // セッションをクリア
      req.session.destroy();

      res.json({
        success: true,
        message: finalMessage,
        data: {
          step: LENDING_STEPS.COMPLETED,
          loan: {
            id: loanRecord.id,
            dueDate: formatDate(dueDate)
          },
          redirectToMain: true
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'セッションが無効です。最初からやり直してください。'
      });
    }

  } catch (error) {
    console.error('❌ ステップ5エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。'
    });
  }
});

// セッションリセット
app.post('/api/reset', (req, res) => {
  req.session.destroy();
  res.json({
    success: true,
    message: 'セッションをリセットしました。',
    data: { step: LENDING_STEPS.INITIAL }
  });
});

// ========== 延長申請システムのAPIエンドポイント ==========

// 延長ステップ1: 生徒の貸出一覧を取得
app.post('/api/extend-step1', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: '名前を入力してください。'
      });
    }

    console.log('🔄 延長申請ステップ1: 生徒の貸出一覧を取得');
    console.log('👤 生徒名:', name);

    // 名前で生徒を検索
    const student = await getStudentInfo(name);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: '申し訳ございませんが、その名前の生徒が見つかりませんでした。'
      });
    }

    // 生徒の現在の貸出一覧を取得
    const loanCheck = await checkStudentLoanCount(student);
    
    if (loanCheck.count === 0) {
      return res.status(200).json({
        success: true,
        message: '現在借りている本がありません。',
        data: {
          student: {
            name: student.fields.名前 || student.fields.Name,
            id: student.id
          },
          loans: []
        }
      });
    }

    // 貸出一覧を延長申請用に整形
    const loans = loanCheck.currentLoans.map(loan => {
      const dueDate = new Date(loan.fields.返却期限);
      const today = new Date();
      const isOverdue = dueDate < today;
      const extendCount = loan.fields.延長回数 || 0;
      
      // 延長申請の条件を緩和：
      // 1. 延滞していても延長可能
      // 2. 2日前から延長申請可能
      // 3. 延長回数が1回未満
      const twoDaysBeforeDue = new Date(dueDate);
      twoDaysBeforeDue.setDate(twoDaysBeforeDue.getDate() - 2);
      
      const canExtendByDate = today >= twoDaysBeforeDue; // 2日前から申請可能
      const canExtend = canExtendByDate && extendCount < 1; // 2日前から、かつ延長回数が1回未満
      
      // 延長後の期限を計算
      const newDueDate = new Date(dueDate);
      newDueDate.setDate(newDueDate.getDate() + 7);
      
      return {
        id: loan.id,
        title: loan.fields['タイトル (from 本)']?.[0] || '不明な書籍',
        dueDate: formatDate(dueDate),
        newDueDate: formatDate(newDueDate),
        isOverdue: isOverdue,
        canExtend: canExtend,
        extendCount: extendCount,
        canExtendByDate: canExtendByDate
      };
    });

    console.log(`📚 ${student.fields.名前 || student.fields.Name}さんの貸出一覧: ${loans.length}冊`);

    res.json({
      success: true,
      data: {
        student: {
          name: student.fields.名前 || student.fields.Name,
          id: student.id
        },
        loans: loans
      }
    });

  } catch (error) {
    console.error('❌ 延長申請ステップ1エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。もう一度お試しください。'
    });
  }
});

// 延長ステップ2: 延長処理を実行
app.post('/api/extend-step2', async (req, res) => {
  try {
    const { loanId, studentName } = req.body;

    if (!loanId || !studentName) {
      return res.status(400).json({
        success: false,
        message: '必要な情報が不足しています。'
      });
    }

    console.log('🔄 延長申請ステップ2: 延長処理を実行');
    console.log('📖 貸出ID:', loanId);
    console.log('👤 生徒名:', studentName);

    // 貸出記録を取得
    const loanUrl = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.loans}/${loanId}`;
    const loanResponse = await axios.get(loanUrl, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`
      }
    });

    const loanRecord = loanResponse.data;
    
    // 延長可能かチェック
    const dueDate = new Date(loanRecord.fields.返却期限);
    const today = new Date();
    const isOverdue = dueDate < today;
    const extendCount = loanRecord.fields.延長回数 || 0;
    
    // 延長申請の条件を緩和：延滞していても延長可能
    // 延長回数のチェックのみ実施
    if (extendCount >= 1) {
      return res.status(400).json({
        success: false,
        message: 'この書籍は既に延長済みです。これ以上延長できません。'
      });
    }
    
    // 2日前から延長申請可能かチェック
    const twoDaysBeforeDue = new Date(dueDate);
    twoDaysBeforeDue.setDate(twoDaysBeforeDue.getDate() - 2);
    
    if (today < twoDaysBeforeDue) {
      return res.status(400).json({
        success: false,
        message: `延長申請は返却期限の2日前（${formatDate(twoDaysBeforeDue)}）から可能です。`
      });
    }

    // 延長処理を実行
    const newDueDate = new Date(dueDate);
    newDueDate.setDate(newDueDate.getDate() + 7);
    
    const requestBody = {
      fields: {
        返却期限: newDueDate.toISOString().split('T')[0]
      }
    };

    // 延長回数フィールドが存在する場合のみ追加
    if ('延長回数' in loanRecord.fields || extendCount > 0) {
      requestBody.fields.延長回数 = extendCount + 1;
    }

    console.log('📤 延長処理データ:', JSON.stringify(requestBody, null, 2));

    const response = await axios.patch(loanUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const bookTitle = loanRecord.fields['タイトル (from 本)']?.[0] || '不明な書籍';
    console.log(`✅ 延長処理が完了しました: ${bookTitle}`);
    console.log(`📅 新しい返却期限: ${formatDate(newDueDate)}`);

    res.json({
      success: true,
      message: `延長申請が完了しました！\n\n書籍: ${bookTitle}\n新しい返却期限: ${formatDate(newDueDate)}`,
      data: {
        loanId: loanId,
        bookTitle: bookTitle,
        newDueDate: formatDate(newDueDate),
        redirectToMain: true
      }
    });

  } catch (error) {
    console.error('❌ 延長申請ステップ2エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。もう一度お試しください。'
    });
  }
});

// ========== 返却システムのAPIエンドポイント ==========

// 返却ステップ1: 書籍画像をアップロードして検索
app.post('/api/return-step1', upload.single('bookImage'), async (req, res) => {
  try {
    const imageFile = req.file;

    console.log('🚀 返却ステップ1: 書籍検索を開始します');
    console.log('📸 画像ファイル:', imageFile ? imageFile.originalname : 'なし');

    if (!imageFile) {
      return res.status(400).json({ 
        success: false, 
        message: '画像ファイルが必要です' 
      });
    }

    // 画像をbase64エンコード
    const base64Image = imageFile.buffer.toString('base64');

    // 画像からテキストを抽出
    const extractedText = await extractTextFromImage(base64Image);
    if (!extractedText) {
      return res.status(400).json({ 
        success: false, 
        message: '画像からテキストを抽出できませんでした' 
      });
    }

    // 抽出されたテキストから書籍を検索
    const lines = extractedText.split('\n').filter(line => line.trim().length > 0);
    let bookFound = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 3) {
        bookFound = await searchBookInAirtable(trimmedLine);
        if (bookFound) {
          break;
        }
      }
    }

    if (!bookFound) {
      return res.status(404).json({ 
        success: false, 
        message: '申し訳ございませんが、この書籍は見つかりませんでした。' 
      });
    }

    // 書籍のステータスを確認（貸出中である必要がある）
    const bookStatus = bookFound.fields.status || bookFound.fields.Status;
    if (bookStatus !== '貸出中') {
      return res.status(400).json({ 
        success: false, 
        message: `この書籍は現在貸出中ではありません。（現在のステータス: ${bookStatus}）`
      });
    }

    // セッションに書籍情報を保存
    req.session.returnBook = bookFound;
    req.session.returnStep = 'book_found';

    res.json({
      success: true,
      message: '📚この本の返却処理を行います',
      data: {
        book: {
          id: bookFound.id,
          title: bookFound.fields.タイトル || bookFound.fields.Title,
          author: bookFound.fields.著者 || bookFound.fields.Author
        },
        step: 'return_book_found',
        nextAction: 'return_or_cancel'
      }
    });

  } catch (error) {
    console.error('❌ 返却ステップ1エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。もう一度お試しください。'
    });
  }
});

// 返却ステップ2: 「返却する」ボタンを押した時の処理
app.post('/api/return-step2', (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'cancel') {
      req.session.destroy();
      return res.json({
        success: true,
        message: 'キャンセルしました。',
        data: { step: 'initial' }
      });
    }

    if (action === 'return' && req.session.returnBook) {
      req.session.returnStep = 'name_request';
      
      res.json({
        success: true,
        message: '📝名前を入力してください',
        data: {
          step: 'return_name_request',
          nextAction: 'enter_name'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'セッションが無効です。最初からやり直してください。'
      });
    }

  } catch (error) {
    console.error('❌ 返却ステップ2エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。'
    });
  }
});

// 返却ステップ3: 名前を入力した時の処理
app.post('/api/return-step3', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !req.session.returnBook) {
      return res.status(400).json({
        success: false,
        message: '名前を入力してください。'
      });
    }

    // 名前で生徒を検索
    const student = await getStudentInfo(name);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: '申し訳ございませんが、その名前の生徒が見つかりませんでした。'
      });
    }

    // 貸出記録を検索
    const loanRecord = await findLoanRecord(req.session.returnBook, student);
    if (!loanRecord) {
      return res.status(404).json({
        success: false,
        message: 'この書籍の貸出記録が見つかりませんでした。別の方が借りているか、既に返却済みの可能性があります。'
      });
    }

    // セッションに生徒情報と貸出記録を保存
    req.session.returnStudent = student;
    req.session.loanRecord = loanRecord;
    req.session.returnStep = 'check_deadline';

    // 返却期限をチェック
    const dueDate = loanRecord.fields.返却期限;
    const deadlineCheck = checkReturnDeadline(dueDate);
    
    let message = '';
    if (deadlineCheck.isOverdue) {
      message = `⚠️返却期限を${Math.abs(deadlineCheck.daysRemaining)}日過ぎています。至急返却してください。`;
    } else if (deadlineCheck.isEarly) {
      message = `⏰まだ${deadlineCheck.daysRemaining}日残っていますが返却しますか？`;
    } else {
      message = `📅返却期限は${formatDate(new Date(dueDate))}です。返却処理を続行しますか？`;
    }

    res.json({
      success: true,
      message: message,
      data: {
        student: {
          name: student.fields.名前 || student.fields.Name,
          studentId: student.fields.生徒ID || student.fields.StudentID
        },
        dueDate: formatDate(new Date(dueDate)),
        daysRemaining: deadlineCheck.daysRemaining,
        isOverdue: deadlineCheck.isOverdue,
        step: 'return_check_deadline',
        nextAction: 'confirm_or_cancel'
      }
    });

  } catch (error) {
    console.error('❌ 返却ステップ3エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。'
    });
  }
});

// 返却ステップ4: 返却確認
app.post('/api/return-step4', async (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'cancel') {
      req.session.destroy();
      return res.json({
        success: true,
        message: 'キャンセルしました。',
        data: { step: 'initial' }
      });
    }

    if (action === 'confirm' && req.session.returnBook && req.session.returnStudent && req.session.loanRecord) {
      try {
        // 返却処理を実行
        await processReturn(req.session.loanRecord);
        
        // 書籍ステータスを「貸出可」に戻す
        await returnBookStatus(req.session.returnBook);

        const finalMessage = `✅返却処理が完了しました。ありがとうございました。`;

        // セッションをクリア
        req.session.destroy();

        res.json({
          success: true,
          message: finalMessage,
          data: {
            step: 'return_completed',
            redirectToMain: true
          }
        });
      } catch (returnError) {
        console.error('❌ 返却処理中にエラーが発生しました:', returnError);
        console.error('   - エラーメッセージ:', returnError.message);
        console.error('   - エラータイプ:', returnError.constructor.name);
        
        // セッションをクリア
        req.session.destroy();
        
        // 422エラーの場合は詳細なメッセージを返す
        if (returnError.statusCode === 422) {
          res.status(422).json({
            success: false,
            message: `返却処理に失敗しました: ${returnError.message}`,
            error: {
              type: 'airtable_update_error',
              details: returnError.originalError?.response?.data?.error
            }
          });
        } else {
          res.status(500).json({
            success: false,
            message: '返却処理中にエラーが発生しました。システム管理者にお問い合わせください。',
            error: {
              type: 'internal_server_error',
              message: returnError.message
            }
          });
        }
      }
    } else {
      res.status(400).json({
      success: false,
        message: 'セッションが無効です。最初からやり直してください。'
      });
    }

  } catch (error) {
    console.error('❌ 返却ステップ4エラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました。'
    });
  }
});

// デバッグ用: 特定の書籍の全貸出記録を確認
app.get('/api/debug/book/:bookId/loans', async (req, res) => {
  try {
    const { bookId } = req.params;
    console.log(`🔍 デバッグ: 書籍${bookId}の全貸出記録を取得`);
    
    const url = `${config.airtable.baseUrl}/${config.airtable.baseId}/${config.airtable.tables.loans}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.airtable.apiKey}`
      }
    });

    const allLoans = response.data.records || [];
    
    // この書籍に関連する全ての貸出記録を取得
    const bookLoans = allLoans.filter(loan => {
      const bookIds = loan.fields.本 || [];
      return bookIds.includes(bookId);
    });
    
    console.log(`📊 書籍${bookId}の貸出記録数: ${bookLoans.length}`);
    
    res.json({
      success: true,
      data: {
        bookId: bookId,
        totalRecords: bookLoans.length,
        loans: bookLoans.map(loan => ({
          id: loan.id,
          fields: loan.fields,
          createdTime: loan.createdTime
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ 貸出記録デバッグエラー:', error);
    res.status(500).json({
      success: false,
      message: 'エラーが発生しました'
    });
  }
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    config: {
      hasGoogleCloudKey: !!config.googleCloud.apiKey,
      hasAirtableKey: !!config.airtable.apiKey,
      hasAirtableBase: !!config.airtable.baseId
    }
  });
});

// 404ハンドラー（全ての未定義ルート）
app.use('*', (req, res) => {
  console.log(`404 - リソースが見つかりません: ${req.method} ${req.originalUrl}`);
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      message: 'APIエンドポイントが見つかりません',
      path: req.originalUrl
    });
  } else {
    res.status(404).end();
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 サーバーがポート ${PORT} で起動しました`);
  console.log(`🌐 ブラウザで http://localhost:${PORT} にアクセスしてください`);
}); 