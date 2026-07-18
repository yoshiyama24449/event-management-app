# 🚀 開発コマンド備忘録

```bash
# pytest
pytest --tb=no
TEST_DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/event_db pytest --tb=no

# backendにログインして確認する
docker compose exec -it backend bash 

# psqlにログインして直接確認する
docker compose exec db psql -U postgres -d event_db

# event_dbでinit.sqlを実行
cmd /c "docker compose exec -T db psql -U postgres -d event_db < .\init.sql"