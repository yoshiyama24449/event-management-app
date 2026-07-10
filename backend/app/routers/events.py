# app/routers/events.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

# 各自のファイルから必要な部品をインポート（相対インポート）
from ..database import get_db, EventModel
from ..schemas import EventCreate, EventUpdate, EventResponse
from ..utils import get_current_user_name

# イベント専用のルーターを作成
router = APIRouter(
    prefix="/events",  # 💡 このルーター内のすべてのURLの先頭に「/events」を自動付与します
    tags=["Events"]    # 💡 Swagger UI（APIドキュメント）でグループ分けされる見出し名
)

# =========================================================================
# API エンドポイントの実装
# =========================================================================

# --- ① イベント登録（POST /events） ---
@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event: EventCreate, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name) # 📍 これでトークン必須ガード完了！
):
    """ログインしているユーザーだけがイベントを登録できる窓口"""
    
    # 💡 ここで current_username を使って「誰が作ったか」を特定できるようになりました！
    # 今はシンプルにイベントを作るだけの元のロジックを動かします
    db_event = EventModel(
        title=event.title,
        description=event.description,
        location=event.location,
        capacity=event.capacity,        # ⭕️ SQLのNotNullエラーを解消！
        creator_id=None,                # 💡 本来はここで username から user.id を引いて入れる
        start_time=event.start_time,
        end_time=event.end_time
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


# --- ② イベント一覧取得（GET /events） ---
@router.get("", response_model=List[EventResponse])
def get_events(db: Session = Depends(get_db)):
    return db.query(EventModel).order_by(EventModel.start_time.asc()).all()


# --- ③ イベント詳細取得（GET /events/{event_id}） ---
@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    db_event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if db_event is None:
        raise HTTPException(status_code=404, detail="指定されたイベントが見つかりません。")
    return db_event


# --- ④ イベント情報更新（PUT /events/{event_id}） ---
@router.put("/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event: EventUpdate, db: Session = Depends(get_db), current_username: str = Depends(get_current_user_name)):
    db_event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if db_event is None:
        raise HTTPException(status_code=404, detail="指定されたイベントが見つかりません。")
    
    db_event.title = event.title
    db_event.description = event.description
    db_event.location = event.location
    db_event.capacity = event.capacity
    db_event.start_time = event.start_time
    db_event.end_time = event.end_time

    db.commit()
    db.refresh(db_event)
    return db_event


# --- ⑤ イベント削除（DELETE /events/{event_id}） ---
@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), current_username: str = Depends(get_current_user_name)):
    db_event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if db_event is None:
        raise HTTPException(status_code=404, detail="指定されたイベントが見つかりません。")
    
    db.delete(db_event)
    db.commit()
    return {"status": "success", "message": f"Event {event_id} has been deleted."}