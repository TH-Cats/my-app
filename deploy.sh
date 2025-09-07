#!/bin/bash

echo "🚀 Starting deployment process..."

# 現在のブランチを確認
BRANCH=$(git branch --show-current)
echo "📍 Current branch: $BRANCH"

# 変更をステージング
echo "📦 Staging changes..."
git add .

# コミットメッセージを入力
echo "📝 Enter commit message (or press Enter for default):"
read -r COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="update $(date +%Y-%m-%d_%H-%M-%S)"
fi

# コミット
echo "💾 Committing with message: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

# プッシュ
echo "⬆️  Pushing to GitHub..."
if git push; then
    echo "✅ Git push successful!"

    # Vercelデプロイ
    echo "🌐 Deploying to Vercel..."
    if npx vercel --prod --yes --regions=iad1; then
        echo "🎉 Deployment completed successfully!"
        echo "🌍 Check your site at: https://drc-trainer.vercel.app"
    else
        echo "❌ Vercel deployment failed"
        exit 1
    fi
else
    echo "❌ Git push failed"
    exit 1
fi

echo "✨ All done!"
