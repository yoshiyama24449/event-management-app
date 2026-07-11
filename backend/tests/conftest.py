# tests/conftest.py
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.pool import StaticPool

# 1. 💡 最初に環境変数をセット。これだけで app.database 側が自動的にSQLite/PostgreSQLを切り替えます
if "TEST_DATABASE_URL" not in os.environ:
    os.environ["TEST_DATABASE_URL"] = "sqlite:///:memory:"
current_db_url = os.environ["TEST_DATABASE_URL"]

# 2. アプリの構成部品をインポート
import app.database as db_module
from app.main import app
from app.utils import get_current_user_name

# 💡 SQLiteのインメモリDBの時だけ、接続プールを固定してテーブル消滅を防ぐ
if current_db_url.startswith("sqlite"):
    db_module.engine = db_module.create_engine(
        current_db_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # 👈 同一スレッド・同一接続を強制キープする設定
    )
    db_module.SessionLocal.configure(bind=db_module.engine)


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """テスト実行前にテーブルを作成し、テスト終了後に完全クリーンにする"""
    # 💡 毎回確実にテーブルをリセットして作成
    db_module.Base.metadata.create_all(bind=db_module.engine)

    # 💡 追記: テスト用のユーザー「test_user」をあらかじめDBに入れておく
    # これにより creator_id のリレーションや特定ロジックが正常に動きます
    from app.database import UserModel

    db = db_module.SessionLocal()
    if not db.query(UserModel).filter(UserModel.username == "test_user").first():
        test_user = UserModel(
            username="test_user",
            email="test_user@example.com",
            hashed_password="dummy_hash_for_test",
            is_active=1,
        )
        db.add(test_user)
        db.commit()
    db.close()

    yield

    # 💡 終了時のクリーンアップ。
    if db_module.engine.url.drivername.startswith("postgresql"):
        with db_module.engine.connect() as conn:
            with conn.begin():
                db_module.Base.metadata.reflect(bind=db_module.engine)
                for table in reversed(db_module.Base.metadata.sorted_tables):
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table.name}" CASCADE;'))
    else:
        # SQLite（インメモリ）の場合は、一度すべてのデータをクリアする
        db_module.Base.metadata.drop_all(bind=db_module.engine)


@pytest.fixture(scope="function")
def client():
    """① 通常のAPIクライアント（余計なモックは一切なし・未ログイン状態のテスト用）"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def authorized_client(client):
    """② 認証済みAPIクライアント（イベント操作など、ログイン必須のテスト用）"""

    def _override_get_current_user_name():
        return "test_user"

    # このフィクスチャが呼ばれた時だけモックを注入する
    app.dependency_overrides[get_current_user_name] = _override_get_current_user_name

    yield client

    # テストが終わったら確実にクリーンアップする
    app.dependency_overrides.clear()
