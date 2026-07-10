# 🚀 開発コマンド備忘録

```bash
# キャッシュを無視してクリーンビルドしてバックグラウンド起動する場合
docker compose up --build -d db backend

# ログをリアルタイムで確認しながら起動する場合
docker compose up db backend

# フロントエンドの起動
cd /workspaces/event-management-app/frontend
npm run dev

# テストの接続先をローカルのPostgresコンテナ（5432ポート）に向けて実行
cd /workspaces/event-management-app/backend
TEST_DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/event_db pytest

# root権限のフォルダを消したい場合に使用
cd /workspaces/event-management-app # プロジェクトルートに移動
sudo rm -rf frontend/.next/ frontend/node_modules/ frontend/next-env.d.ts
mkdir frontend/node_modules