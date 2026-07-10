# 🚀 開発コマンド備忘録

```bash
# キャッシュを無視してクリーンビルドしてバックグラウンド起動する場合
docker compose up --build -d db backend

# ログをリアルタイムで確認しながら起動する場合
docker compose up db backend


# フロントエンドのディレクトリへ移動
cd /workspaces/event-management-app/frontend

# 初回、またはパッケージ追加時のみ実行（依存ライブラリのインストール）
npm ci

# 開発サーバーの起動（ホットリロード有効）
npm run dev


# コンテナを停止して削除（データボリュームは保持されます）
docker compose down

# すべてのコンテナを一括起動する場合（フロントもDocker内で動かす場合）
docker compose up


# プロジェクトルートに移動
cd /workspaces/event-management-app

# frontend内のファイル権限（rootになっていないか）を確認
ls -la frontend/

# root権限のフォルダを消したい場合に使用
sudo rm -rf frontend/.next/ frontend/node_modules/ frontend/next-env.d.ts
mkdir frontend/node_modules