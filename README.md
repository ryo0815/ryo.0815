# 📚 図書貸出ウェブアプリケーション

Google Cloud Vision APIを使って画像から書名を抽出し、Airtableと照合して図書の貸出処理を行うモダンなウェブアプリケーションです。

## ✨ 機能

- 📸 **画像OCR処理**: Google Cloud Vision APIで書籍画像からテキストを抽出
- 🖱️ **ドラッグ&ドロップ**: 直感的な画像アップロード
- 📚 **書籍検索**: Airtableの書籍マスタから自動検索
- 👤 **生徒管理**: 生徒IDによる貸出者識別
- 📝 **自動貸出処理**: レコード作成とステータス更新
- 💻 **レスポンシブデザイン**: モバイル対応のモダンUI
- 🔄 **リアルタイム処理**: 即座に結果を表示

## 🛠️ 技術スタック

### バックエンド
- **Node.js** - サーバー環境
- **Express** - ウェブフレームワーク
- **Multer** - ファイルアップロード処理
- **Axios** - HTTP通信

### フロントエンド
- **HTML5/CSS3** - マークアップとスタイリング
- **Bootstrap 5** - UIコンポーネント
- **JavaScript (ES6+)** - インタラクティブ機能
- **Font Awesome** - アイコンライブラリ

### API連携
- **Google Cloud Vision API** - 画像認識
- **Airtable API** - データベース操作

## 🚀 セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env` ファイルは既に作成済みです。以下の内容が設定されています：

```env
# Google Cloud Vision API設定
GOOGLE_CLOUD_API_KEY=AIzaSyC1Jdj2Z8qY7dvE6qdl5oD10XPagTS042o

# Airtable設定
AIRTABLE_API_KEY=patRewfzvma59WpfS.cdb72f848460991185fd923e1fa25e3141aa9b879c52167cf50c38ba41de12ae
AIRTABLE_BASE_ID=appYrvQJhzPWP7rf6

# テーブル名
BOOKS_TABLE=BookM
STUDENTS_TABLE=StudentsM
LOANS_TABLE=Loans

# テスト用データ
TEST_STUDENT_ID=STU001
```

### 3. サーバー起動

```bash
npm start
```

または

```bash
node server.js
```

### 4. アクセス

ブラウザで **http://localhost:3000** にアクセスしてください。

## 📋 Airtableテーブル構成

### 1. BookM テーブル (書籍マスタ)
| フィールド名 | 型 | 説明 |
|---|---|---|
| Title | Single line text | 書籍タイトル |
| Status | Single select | 貸出状態（「貸出可」「貸出中」） |
| ISBN | Single line text | ISBN番号 |

### 2. StudentsM テーブル (生徒マスタ)
| フィールド名 | 型 | 説明 |
|---|---|---|
| Name | Single line text | 生徒名 |
| StudentID | Single line text | 生徒ID |

### 3. Loans テーブル (貸出履歴)
| フィールド名 | 型 | 説明 |
|---|---|---|
| BookID | Link to another record | 書籍ID（BookMテーブルへのリンク） |
| StudentID | Link to another record | 生徒ID（StudentsMテーブルへのリンク） |
| StartDate | Date | 貸出日 |
| DueDate | Date | 返却期限 |

## 🖥️ 使用方法

### 1. システム状態確認
- アプリ起動時に自動でAPI接続状況を確認
- 緑：正常、赤：エラー

### 2. 画像アップロード
- **ドラッグ&ドロップ**: 画像ファイルを画面にドラッグ
- **クリック選択**: アップロードエリアをクリックしてファイル選択
- 対応形式: JPG、PNG、GIF、WEBP

### 3. 生徒ID入力
- 貸出対象の生徒IDを入力
- StudentssMテーブルに存在するIDである必要があります

### 4. 処理実行
- 「図書を貸し出す」ボタンをクリック
- 自動的に以下の処理が実行されます：
  1. 画像からテキスト抽出
  2. 書籍検索
  3. 貸出可能状態の確認
  4. 生徒情報の取得
  5. 貸出レコードの作成
  6. 書籍ステータスの更新

### 5. 結果確認
- 成功時：貸出詳細情報を表示
- エラー時：原因と詳細情報を表示

## 🔧 API仕様

### GET /api/health
システム状態を取得

**レスポンス例:**
```json
{
  "status": "OK",
  "timestamp": "2024-07-10T07:36:00.000Z",
  "config": {
    "hasGoogleCloudKey": true,
    "hasAirtableKey": true,
    "hasAirtableBase": true
  }
}
```

### POST /api/lend-book
図書貸出処理を実行

**リクエスト:** (multipart/form-data)
- `bookImage`: 画像ファイル
- `studentId`: 生徒ID

**レスポンス例 (成功):**
```json
{
  "success": true,
  "message": "図書貸出処理が完了しました！",
  "data": {
    "book": { "title": "サンプル書籍", "id": "rec123" },
    "student": { "name": "田中太郎", "id": "STU001" },
    "loan": { "startDate": "2024-07-10", "dueDate": "2024-07-24" },
    "extractedText": "抽出されたテキスト..."
  }
}
```

## 🎨 UI機能

### デザイン特徴
- **グラデーション背景**: モダンな視覚効果
- **グラスモーフィズム**: 透明感のあるカードデザイン
- **アニメーション**: スムーズなフェードイン効果
- **レスポンシブ**: スマートフォン・タブレット対応

### インタラクション
- **ホバー効果**: ボタンやエリアの視覚フィードバック
- **ドラッグ状態表示**: ファイルドラッグ時の視覚的変化
- **ローディング表示**: 処理中のスピナーと進捗メッセージ
- **画像プレビュー**: アップロード前の画像確認

## 🔍 トラブルシューティング

### よくある問題

**1. API接続エラー**
- 環境変数が正しく設定されているか確認
- APIキーの有効性を確認

**2. 画像認識精度の問題**
- 書籍タイトルが明確に写っている画像を使用
- 照明条件を改善
- 画像の解像度を確認

**3. 書籍が見つからない**
- Airtableの書籍タイトルと画像のテキストが一致しているか確認
- 部分一致検索のため、主要なキーワードが含まれている必要があります

**4. 生徒が見つからない**
- StudentsMテーブルに該当する生徒IDが存在するか確認

## 📝 開発情報

### ファイル構成
```
book-lending-vision/
├── server.js              # Expressサーバー
├── package.json           # プロジェクト設定
├── .env                   # 環境変数
├── public/
│   ├── index.html         # メインHTML
│   └── app.js            # フロントエンドJS
└── README.md             # このファイル
```

### 拡張機能案
- 📊 貸出統計ダッシュボード
- 📧 返却期限通知機能
- 📱 PWA対応
- 🔍 書籍検索機能
- 👥 複数書籍同時貸出

## 📄 ライセンス

ISC

## 👥 作成者

図書貸出ウェブアプリ開発チーム

---

**🌟 使用開始するには、ブラウザで http://localhost:3000 にアクセスしてください！** 