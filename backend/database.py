from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta
import os

# docker-compose（環境変数）から接続URLを取得
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres_password@db:5432/event_db")

# 1. データベースエンジンの作成
engine = create_engine(DATABASE_URL)

# 2. セッションの作成（データベース操作の窓口）
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. モデルを作るためのベースクラス
Base = declarative_base()

# JST（日本時間）のタイムゾーン定義
JST = timezone(timedelta(hours=9))

def get_jst_now():
    """現在時刻を日本時間(JST)で取得するヘルパー関数"""
    return datetime.now(JST)

# 4. イベント管理用のテーブル定義
class EventModel(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    # タイムゾーン付きのTIMESTAMP型を定義（初期値に日本時間の現在時刻を設定）
    created_at = Column(DateTime(timezone=True), default=get_jst_now, nullable=False)

# データベースセッションを安全に管理するための関数（FastAPIのDependsで使用）
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()