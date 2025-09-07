# DRC Trainer

AI搭載のランニングトレーニング管理アプリ

## 🚀 デプロイ方法

### 方法1: 自動デプロイスクリプト（推奨）
```bash
./deploy.sh
```
コミットメッセージを入力するか、自動で日時が付与されます。

### 方法2: npmスクリプト
```bash
# 変更をコミットしてデプロイ
npm run push:deploy

# コミットのみ
npm run push

# デプロイのみ
npm run deploy

# ビルドチェック付きデプロイ
npm run deploy:safe
```

### 方法3: 手動実行
```bash
# 変更をステージング
git add .

# コミット
git commit -m "更新内容"

# プッシュ
git push

# Vercelデプロイ
npx vercel --prod --yes --regions=iad1
```

## 📋 主な機能

- ✅ Stravaデータ自動連携（過去2年分）
- ✅ AIによるトレーニング分析（Gemini）
- ✅ インタラクティブなダッシュボード
- ✅ 月次トレンドグラフ（前年比較）
- ✅ アクティビティ管理（学習除外機能）
- ✅ レスポンシブデザイン

## 🌐 本番環境

https://drc-trainer.vercel.app

## 🛠️ 開発環境

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start
```

## 📁 プロジェクト構造

```
my-app/
├── app/
│   ├── api/           # APIエンドポイント
│   ├── dashboard/     # ダッシュボード
│   ├── activities/    # アクティビティ管理
│   └── page.tsx       # ホームページ
├── public/            # 静的ファイル
├── prisma/            # データベーススキーマ
└── deploy.sh          # デプロイスクリプト
```

## 🔧 環境変数

必要な環境変数を設定してください：
- `DATABASE_URL`: PostgreSQL接続URL
- `GOOGLE_AI_API_KEY`: Gemini APIキー
- `STRAVA_CLIENT_ID`: StravaアプリID
- `STRAVA_CLIENT_SECRET`: Stravaアプリシークレット

## 📝 デプロイ時の注意点

- 初回デプロイ時は `./deploy.sh` を使用
- Vercelの自動デプロイが機能しない場合は手動デプロイを実行
- ブラウザキャッシュをクリアして確認してください