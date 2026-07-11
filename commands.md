# 🚀 開発コマンド備忘録

```bash
# pytest
pytest /workspaces/event-management-app/backend/
TEST_DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/event_db pytest /workspaces/event-management-app/backend/

# psqlにログインして直接確認する
docker compose exec db psql -U postgres -d event_db

# event_dbでinit.sqlを実行
docker compose exec -T db psql -U postgres -d event_db <  /workspaces/event-management-app/init.sql

# エディタの警告を消すためにroot権限のnode_modulesフォルダを直したい場合
cd /workspaces/event-management-app/frontend/
sudo rm -rf node_modules/ next-env.d.ts
mkdir node_modules
npm ci