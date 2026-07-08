from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import List

# database.py から必要な機能をインポート
from database import engine, Base, get_db, EventModel

# アプリ起動時にデータベースにテーブルを自動作成（まだ存在しない場合のみ実行される）
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Event Management API")

# フロントエンド（Next.js）からの通信を許可する設定（CORS設定）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発用なので一旦すべて許可（本番環境では制限します）
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydanticモデル（リクエスト・レスポンスのデータ型定義） ---
class EventCreate(BaseModel):
    title: str
    description: str | None = None

class EventResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True  # SQLAlchemyのオブジェクトをPydanticに変換可能にする設定

# --- API エンドポイント ---

# 1. 疎通確認用トップ画面
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Welcome to Event Management API"}

# 2. イベント登録（POST /events）
@app.post("/events", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    db_event = EventModel(title=event.title, description=event.description)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)  # 自動生成されたIDや作成日時を反映
    return db_event

# 3. イベント一覧取得（GET /events）
@app.get("/events", response_model=List[EventResponse])
def get_events(db: Session = Depends(get_db)):
    events = db.query(EventModel).order_by(EventModel.created_at.desc()).all()
    return events