# 📚 Book Lending Vision

Google Cloud Vision APIを使って画像から書名を抽出し、Airtableと照合して図書の貸出処理を行うウェブアプリケーション

## 🌐 デモ

- **完全機能版**: https://book-lending-vision.vercel.app/
- **静的デモ版**: https://ryo0815.github.io/ryo.0815/ (API機能は動作しません)

## 🚀 機能

### 📖 貸出機能
- 書籍の表紙を撮影
- Google Cloud Vision APIで自動書名認識
- Airtableデータベースとの照合
- 生徒名入力による貸出処理
- 4冊までの貸出制限

### 🔄 返却機能
- 返却書籍の撮影・認識
- 返却期限チェック
- 遅延情報の表示
- 自動返却処理

### ⏰ 延長申請機能
- 返却期限2日前から申請可能
- 7日間の延長処理
- 最大1回までの延長制限
- 現在の貸出状況確認

## 💻 技術スタック

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, Bootstrap 5
- **Database**: Airtable
- **API**: Google Cloud Vision API
- **Deployment**: Vercel
- **CI/CD**: GitHub Actions

## 🔧 ローカル環境での起動

### 必要な環境変数

`.env`ファイルを作成して以下の環境変数を設定してください：

```bash
# Google Cloud Vision API
GOOGLE_VISION_API_KEY=your_google_vision_api_key

# Airtable
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_TABLE_BOOKS=Books
AIRTABLE_TABLE_STUDENTS=Students
AIRTABLE_TABLE_LOANS=Loans
```

### インストール・実行

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev

# または本番環境での起動
npm start
```

アプリケーションは `http://localhost:3000` でアクセス可能です。

## 🚀 Vercelでのデプロイ

### 1. Vercelプロジェクトの作成

1. [Vercel](https://vercel.com/)にログイン
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. 自動的にビルド・デプロイが開始

### 2. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：

```bash
GOOGLE_VISION_API_KEY
AIRTABLE_API_KEY
AIRTABLE_BASE_ID
AIRTABLE_TABLE_BOOKS
AIRTABLE_TABLE_STUDENTS
AIRTABLE_TABLE_LOANS
```

### 3. GitHub Actions用のSecrets設定

GitHubリポジトリの Settings > Secrets で以下を設定：

```bash
VERCEL_TOKEN         # Vercelの個人アクセストークン
VERCEL_ORG_ID        # Vercelの組織ID
VERCEL_PROJECT_ID    # VercelのプロジェクトID
```

## 📊 データベース構造

### Books テーブル
- `書名`: 書籍タイトル
- `著者`: 著者名
- `貸出状況`: 「貸出可」「貸出中」

### Students テーブル
- `生徒名`: 生徒の名前
- `学年`: 学年情報

### Loans テーブル
- `生徒`: 貸出者（Students テーブルとのリンク）
- `書籍`: 貸出書籍（Books テーブルとのリンク）
- `貸出日`: 貸出日時
- `返却予定日`: 返却期限
- `返却日`: 実際の返却日時
- `返却状況`: 「貸出中」「返却済」
- `延長済み`: 延長処理の有無

## 🎯 使用方法

1. **書籍の貸出**
   - 「貸出」をクリック
   - 書籍の表紙を撮影
   - 認識された書名を確認
   - 生徒名を入力
   - 貸出完了

2. **書籍の返却**
   - 「返却」をクリック
   - 返却書籍を撮影
   - 認識された書名を確認
   - 返却処理完了

3. **延長申請**
   - 「延長申請」をクリック
   - 生徒名を入力
   - 貸出中の書籍一覧を確認
   - 延長したい書籍を選択
   - 延長処理完了

## 🔒 セキュリティ

- 環境変数による機密情報の管理
- セッションベースの処理状態管理
- API キーの適切な保護

## 🐛 トラブルシューティング

### よくある問題

1. **画像認識がうまくいかない**
   - 明るい場所で撮影
   - 書籍の表紙全体が写るように撮影
   - 文字がはっきり見えるように撮影

2. **デプロイエラー**
   - 環境変数が正しく設定されているか確認
   - Vercelのビルドログを確認
   - node_modules を削除して再インストール

3. **データベース接続エラー**
   - Airtable API キーが正しいか確認
   - ベースIDとテーブル名が正しいか確認

## 📄 ライセンス

ISC License

## 🤝 貢献

プルリクエストや Issue は歓迎します！ 