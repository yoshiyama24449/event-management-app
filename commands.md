# 🚀 開発コマンド備忘録

```bash
# フロントエンドの起動
cd /workspaces/event-management-app/frontend
npm run dev

# pytest
pytest /workspaces/event-management-app/backend/
TEST_DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/event_db pytest /workspaces/event-management-app/backend/

# psqlにログインして直接確認する
docker compose exec db psql -U postgres -d event_db

# event_dbでinit.sqlを実行
docker compose exec -T db psql -U postgres -d event_db <  /workspaces/event-management-app/init.sql

# root権限のフォルダを消したい場合に使用
cd /workspaces/event-management-app # プロジェクトルートに移動
sudo rm -rf /workspaces/event-management-app/frontend/.next/ /workspaces/event-management-app/frontend/node_modules/ /workspaces/event-management-app/frontend/next-env.d.ts
mkdir /workspaces/event-management-app/frontend/node_modules