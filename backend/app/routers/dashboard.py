from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import (
    get_db,
    EventModel,
    UserModel,
    EventRegistrationModel,
    CommentModel,
)
from ..schemas import DashboardResponse, DashboardCreatedEvent, DashboardCalendarEvent
from ..utils import get_current_user_name

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard_data(
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    """ダッシュボードに必要な集計データを一括で取得するAPI"""

    # 1. ログイン中のユーザー情報を取得
    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="ユーザー情報が見つかりません。")

    # 2. 【要件1】自分が作成したイベントの一覧と、それぞれの「参加人数」「コメント数」を集計
    my_created_events = (
        db.query(EventModel).filter(EventModel.creator_id == user.id).all()
    )

    created_events_summary = []
    for event in my_created_events:
        # 参加人数 (attending) をカウント
        attendee_count = (
            db.query(EventRegistrationModel)
            .filter(
                EventRegistrationModel.event_id == event.id,
                EventRegistrationModel.status == "attending",
            )
            .count()
        )

        # コメント数をカウント
        comment_count = (
            db.query(CommentModel).filter(CommentModel.event_id == event.id).count()
        )

        created_events_summary.append(
            DashboardCreatedEvent(
                id=event.id,
                title=event.title,
                capacity=event.capacity,
                attendee_count=attendee_count,
                comment_count=comment_count,
            )
        )

    # 3. 【要件3】カレンダー用：自分が参加登録(attending)またはブックマーク(bookmark)しているイベント
    my_registrations = (
        db.query(EventRegistrationModel)
        .filter(EventRegistrationModel.user_id == user.id)
        .all()
    )

    calendar_events = []
    for reg in my_registrations:
        event = db.query(EventModel).filter(EventModel.id == reg.event_id).first()
        if event:
            calendar_events.append(
                DashboardCalendarEvent(
                    id=event.id,
                    title=event.title,
                    start_time=event.start_time,
                    end_time=event.end_time,
                    status=reg.status,
                )
            )

    return DashboardResponse(
        created_events=created_events_summary, calendar_events=calendar_events
    )
