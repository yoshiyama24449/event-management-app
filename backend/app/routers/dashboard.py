from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import (
    get_db,
    EventModel,
    UserModel,
    EventRegistrationModel,
    CommentModel,
)
from ..schemas import (
    DashboardResponse,
    DashboardCreatedEvent,
    DashboardCalendarEvent,
    MyCommentActivity,
)
from ..utils import get_current_user_name

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard_data(
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_user_name),
):
    user = db.query(UserModel).filter(UserModel.username == current_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="ユーザー情報が見つかりません。")

    # 1. 自分が作成したイベント一覧
    my_created_events = (
        db.query(EventModel).filter(EventModel.creator_id == user.id).all()
    )

    created_events_summary = []
    for event in my_created_events:
        # 💡 参加者一覧（ユーザー名）をしっかり取得する
        registrations = (
            db.query(EventRegistrationModel)
            .filter(
                EventRegistrationModel.event_id == event.id,
                EventRegistrationModel.status == "attending",
            )
            .all()
        )

        attendees = []
        for reg in registrations:
            u = db.query(UserModel).filter(UserModel.id == reg.user_id).first()
            if u:
                attendees.append(u.username)

        comment_count = (
            db.query(CommentModel).filter(CommentModel.event_id == event.id).count()
        )

        created_events_summary.append(
            DashboardCreatedEvent(
                id=event.id,
                title=event.title,
                capacity=event.capacity,
                attendee_count=len(attendees),
                attendees=attendees,  # ⭕️ 参加者一覧を格納！
                comment_count=comment_count,
            )
        )

    # 2. カレンダー用データ（変更なし）
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

    # 3. 💡 新設：自分が投稿したコメントとそれに対する返信一覧
    my_raw_comments = (
        db.query(CommentModel)
        .filter(CommentModel.user_id == user.id, CommentModel.parent_id == None)
        .all()
    )
    my_comments_summary = []

    for c in my_raw_comments:
        evt = db.query(EventModel).filter(EventModel.id == c.event_id).first()
        evt_title = evt.title if evt else "不明なイベント"

        # このコメントに対する他者からの返信を取得
        replies = db.query(CommentModel).filter(CommentModel.parent_id == c.id).all()
        reply_contents = [r.content for r in replies]

        my_comments_summary.append(
            MyCommentActivity(
                comment_id=c.id,
                event_id=c.event_id,
                event_title=evt_title,
                my_content=c.content,
                replies=reply_contents,
            )
        )

    return DashboardResponse(
        created_events=created_events_summary,
        calendar_events=calendar_events,
        my_comments=my_comments_summary,  # ⭕️ コメント履歴を格納！
    )
