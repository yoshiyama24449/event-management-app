# tests/conftest.py
import os
import pytest
from fastapi.testclient import TestClient

# 1. 💡 最初に環境変数をセット。これだけで app.database 側が自動的にSQLite/PostgreSQLを切り替えます[cite: 4, 6]
TEST_DB_FILE = "test_temp.db"
if "TEST_DATABASE_URL" not in os.environ:
    os.environ["TEST_DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"
current_db_url = os.environ["TEST_DATABASE_URL"]

# 2. アプリの構成部品をインポート
import app.database as db_module
from app.main import app
from app.utils import get_current_user_name

@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """テスト実行前にテーブルを作成し、テスト終了後に完全クリーンにする"""
    # 💡 開始時はテーブルを作るだけでOK！余計なDROPは排除します
    db_module.Base.metadata.create_all(bind=db_module.engine)
    
    yield
    
    # 💡 終了時のクリーンアップ。
    # SQLAlchemyの「組み込みソート機能」を有効化して、PostgreSQLの外部キー依存エラーを回避します
    db_module.Base.metadata.reflect(bind=db_module.engine)
    db_module.Base.metadata.drop_all(bind=db_module.engine)
    
    # SQLiteモードのときだけ、作成された残骸ファイルを消す
    if current_db_url.startswith("sqlite") and os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

@pytest.fixture(scope="function")
def client():
    """テスト用のAPIクライアント（認証のみモック化）"""
    def _override_get_current_user_name():
        return "test_user"

    app.dependency_overrides[get_current_user_name] = _override_get_current_user_name
    
    with TestClient(app) as test_client:
        yield test_client
        
    app.dependency_overrides.clear()