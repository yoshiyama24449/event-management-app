# app/routers/events.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

# 各自のファイルから必要な部品をインポート（相対インポート）
from ..database import get_db, EventModel, UserModel, TagModel, EventRegistrationModel, get_jst_now
from ..schemas import EventCreate, EventUpdate, EventResponse
from ..utils import get_current_user_name

# イベント専用のルーターを作成
router = APIRouter(
    prefix="/events",  # 💡 このルーター内のすべてのURLの先頭に「/events」を自動付与します
    tags=["Events"],  # 💡 Swagger UI（APIドキュメント）でグループ分けされる見出し名
)

# 💡 タグをDBから探す、無ければ新規作成して紐付けるヘルパー関数
def get_or_create_tags(db: Session, tag_names: List[str]) -> List[TagModel]:
    tags = []
    for name in tag_names:
        clean_name = name.strip()
        if not clean_name:
            continue
        # 既存タグの検索
        tag = db.query(TagModel).filter(TagModel.name == clean_name).first()
        if not tag:
            # なければDBに新規作成
            tag = TagModel(name=clean_name)
            db.add(tag)
            db.flush()  # IDを確定させる
        tags.append(tag)
    return tags

# =========================================================================
# API エンドポイントの実装
# =========================================================================

@router.get("/tags", response_model=List[str])
def get_all_tags(db: Session = Depends(get_db)):
    tags = db.query(TagModel).order_by(TagModel.name.asc()).all()
    return [tag.name for tag in tags if tag.name is not None]

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

    # 💡 タグの紐付け
    if event.tags:
        db_event.tags = get_or_create_tags(db, event.tags)
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


# --- ② イベント一覧取得（GET /events） ---
@router.get("", response_model=List[EventResponse])
def get_events(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="取得するページ番号（1始まり）"),
    per_page: int = Query(10, ge=1, le=100, description="1ページあたりの取得件数"),
    q: Optional[str] = Query(None, description="タイトル、または場所のキーワード部分一致検索"),
    tag: Optional[str] = Query(None, description="タグ名による完全一致検索"),
    start_date: Optional[datetime] = Query(None, description="イベント開始日時の範囲指定（下限）"),
    end_date: Optional[datetime] = Query(None, description="イベント開始日時の範囲指定（上限）"),
    hide_finished: bool = Query(True, description="終了済みのイベントを非表示にする（デフォルトTrue）"),
    current_username: str = Depends(get_current_user_name),
):
    """イベント一覧をフィルタリング・ページネーション付きで取得する（開始日時の昇順）"""
    query = db.query(EventModel)

    # 1. 終了済みのイベントを非表示にする処理
    if hide_finished:
        now = get_jst_now()
        # 💡 SQLiteでも問題なく動くように、タイムゾーン情報を持たない形で比較
        if now.tzinfo is not None:
            now = now.replace(tzinfo=None)
        
        # SQLAの比較時にDB側がNaiveとして保存されている場合に備え
        # 開始・終了時刻データにタイムゾーン情報がない状態（SQLiteの特性）を想定
        query = query.filter(EventModel.end_time >= now)

    # 2. キーワード検索（タイトル、または開催場所に含まれているか）
    if q:
        query = query.filter(
            EventModel.title.contains(q) | EventModel.location.contains(q)
        )

    # 3. タグによる検索
    if tag:
        query = query.filter(EventModel.tags.any(TagModel.name == tag))

    # 4. 日付の範囲指定（start_time が start_date と end_date の間にあるか）
    if start_date:
        if start_date.tzinfo is not None:
            start_date = start_date.replace(tzinfo=None)
        query = query.filter(EventModel.start_time >= start_date)
        
    if end_date:
        if end_date.tzinfo is not None:
            end_date = end_date.replace(tzinfo=None)
        query = query.filter(EventModel.start_time <= end_date)

    # 5. 並び順とページネーション
    offset = (page - 1) * per_page
    db_events = (
        query.order_by(EventModel.start_time.asc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    # 💡 追記：各イベントに紐づく実際の参加者数を集計してセットする
    for event in db_events:
        attend_count = (
            db.query(EventRegistrationModel)
            .filter(
                EventRegistrationModel.event_id == event.id,
                EventRegistrationModel.status == "attending"
            )
            .count()
        )
        # Pydanticレスポンス時に反映されるよう、動的に属性にセット
        event.attendee_count = attend_count

    return db_events

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
        raise HTTPException(status_code=404, detail="指定されたイベントが見つかりません。")

    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    if not user or db_event.creator_id != user.id:
        raise HTTPException(status_code=403, detail="自分が作成したイベント以外は編集できません。")

    db_event.title = event.title
    db_event.description = event.description
    db_event.location = event.location
    db_event.capacity = event.capacity
    db_event.start_time = event.start_time
    db_event.end_time = event.end_time

    # 💡 タグの更新処理
    db_event.tags = get_or_create_tags(db, event.tags)

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

