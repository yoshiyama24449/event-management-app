# app/routers/events.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

# 各自のファイルから必要な部品をインポート（相対インポート）
from ..database import get_db, EventModel, UserModel
from ..schemas import EventCreate, EventUpdate, EventResponse
from ..utils import get_current_user_name

# イベント専用のルーターを作成
router = APIRouter(
    prefix="/events",  # 💡 このルーター内のすべてのURLの先頭に「/events」を自動付与します
    tags=["Events"],  # 💡 Swagger UI（APIドキュメント）でグループ分けされる見出し名
)

# =========================================================================
# API エンドポイントの実装
# =========================================================================


# --- ① イベント登録（POST /events） ---
@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_username: str = Depends(
        get_current_user_name
    ),  # 📍 これでトークン必須ガード完了！
):
    """ログインしているユーザーだけがイベントを登録できる窓口"""
    # 💡 ユーザー名からユーザーIDを特定する
    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="ユーザー情報が見つかりません。")

    # 💡 ここで current_username を使って「誰が作ったか」を特定できるようになりました！
    # 今はシンプルにイベントを作るだけの元のロジックを動かします
    db_event = EventModel(
        title=event.title,
        description=event.description,
        location=event.location,
        capacity=event.capacity,
        creator_id=user.id,
        start_time=event.start_time,
        end_time=event.end_time,
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


# --- ② イベント一覧取得（GET /events） ---
@router.get("", response_model=List[EventResponse])
def get_events(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="取得するページ番号（1始まり）"),
    per_page: int = Query(
        10, ge=1, le=100, description="1ページあたりの取得件数（最大100件）"
    ),
    current_username: str = Depends(get_current_user_name),
):
    """イベント一覧をページネーション付きで取得する（開始日時の昇順）"""
    # 💡 ページ番号と件数から、スキップする件数（offset）を計算する
    # 例：page=2, per_page=10 の場合、(2-1)*10 = 10件スキップして11件目から取得
    offset = (page - 1) * per_page

    return (
        db.query(EventModel)
        .order_by(EventModel.start_time.asc())
        .offset(offset)  # 👈 何件目から取得するか
        .limit(per_page)  # 👈 最大何件取得するか
        .all()
    )


# --- ③ イベント詳細取得（GET /events/{event_id}） ---
@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    db_event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if db_event is None:
        raise HTTPException(
            status_code=404, detail="指定されたイベントが見つかりません。"
        )
    return db_event


# --- ④ イベント情報更新（PUT /events/{event_id}） ---
@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event: EventUpdate,
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    db_event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if db_event is None:
        raise HTTPException(
            status_code=404, detail="指定されたイベントが見つかりません。"
        )

    # 💡 権限チェック：ログイン中のユーザーIDを取得
    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    # 作成者ではない場合は 403 エラーではじく
    if not user or db_event.creator_id != user.id:
        raise HTTPException(
            status_code=403, detail="自分が作成したイベント以外は編集できません。"
        )

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
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    db_event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if db_event is None:
        raise HTTPException(
            status_code=404, detail="指定されたイベントが見つかりません。"
        )

    # 💡 権限チェック：ログイン中のユーザーIDを取得
    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    # 作成者ではない場合は 403 エラーではじく
    if not user or db_event.creator_id != user.id:
        raise HTTPException(
            status_code=403, detail="自分が作成したイベント以外は削除できません。"
        )

    db.delete(db_event)
    db.commit()
    return {"status": "success", "message": f"Event {event_id} has been deleted."}
