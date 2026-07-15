# tests/conftest.py
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlalchemy import event  # 💡 追記

# 1. 最初に環境変数をセット
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
        poolclass=StaticPool,
    )
    db_module.SessionLocal.configure(bind=db_module.engine)

    # =========================================================================
    # 💡 追記：SQLiteのコネクション確立時に外部キー制約を有効化する
    # =========================================================================
    @event.listens_for(db_module.engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """テスト実行前にテーブルを作成し、テスト終了後に完全クリーンにする"""
    # 毎回確実にテーブルを新規作成
    db_module.Base.metadata.create_all(bind=db_module.engine)

    # 💡 修正: 別名インポート(db_module)があるため、UserModelの再インポートを削除
    db = db_module.SessionLocal()
    if (
        not db.query(db_module.UserModel)
        .filter(db_module.UserModel.username == "test_user")
        .first()
    ):
        test_user = db_module.UserModel(
            username="test_user",
            email="test_user@example.com",
            hashed_password="dummy_hash_for_test",
            is_active=1,
        )
        db.add(test_user)
        db.commit()
    db.close()

    yield

    # 💡 修正: SQLite / PostgreSQL 共通で安全に一括削除できるため、条件分岐と長いループを削除
    db_module.Base.metadata.drop_all(bind=db_module.engine)


@pytest.fixture(scope="function")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def authorized_client(client):
    def _override_get_current_user_name():
        return "test_user"

    app.dependency_overrides[get_current_user_name] = _override_get_current_user_name
    yield client
    app.dependency_overrides.clear()
