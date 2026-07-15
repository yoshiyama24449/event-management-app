# tests/test_dashboard.py
import pytest
from datetime import datetime, timezone, timedelta
from app.database import get_jst_now


def test_get_dashboard_data_success(client, authorized_client):
    """① ダッシュボードデータの集約・集計が正しく動作すること"""
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    # (A) 自分が作成するイベント (Pydantic定義に沿って tags を追加[cite: 6])
    event_data = {
        "title": "完全版ダッシュボードイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": ["DashboardTest"],  # 💡 必須になったタグを指定[cite: 6]
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # (B) 自分自身がイベント参加登録する
    authorized_client.post(f"/events/{event_id}/register", json={"status": "attending"})

    # (C) 自分がメインコメントを残す
    comment_res = authorized_client.post(
        f"/events/{event_id}/comments", json={"content": "私のメイン質問"}
    )
    comment_id = comment_res.json()["id"]

    # (D) 別のユーザー「stranger_user」を作成し、そのイベントに返信をつけさせる
    from app.database import UserModel, SessionLocal

    db = SessionLocal()
    if not db.query(UserModel).filter(UserModel.username == "stranger_user").first():
        stranger = UserModel(
            username="stranger_user",
            email="stranger@example.com",
            hashed_password="dummy_hash",
            is_active=1,
        )
        db.add(stranger)
        db.commit()
    db.close()

    client.post(
        f"/events/{event_id}/comments",
        json={"content": "それに対する返信です", "parent_id": comment_id},
        headers={"X-User-Name": "stranger_user"},
    )

    # 2. ダッシュボードAPIを叩く
    response = authorized_client.get("/dashboard")
    assert response.status_code == 200

    data = response.json()

    # 3. 拡張された集計ロジックの厳密な検証
    assert len(data["created_events"]) == 1
    my_event_summary = data["created_events"][0]
    assert my_event_summary["id"] == event_id
    assert my_event_summary["attendee_count"] == 1

    # 💡 修正: test_user が含まれているか、より安全に検証
    assert len(my_event_summary["attendees"]) == 1
    assert "test_user" in my_event_summary["attendees"]
    assert my_event_summary["comment_count"] == 2

    # 💡 追記: カレンダーイベントの作成者名やステータスが正しく解決できているかもここで追加検証
    assert len(data["calendar_events"]) == 1
    assert data["calendar_events"][0]["status"] == "attending"
    assert data["calendar_events"][0]["title"] == "完全版ダッシュボードイベント"

    assert len(data["my_comments"]) == 1
    my_comment_activity = data["my_comments"][0]
    assert my_comment_activity["my_content"] == "私のメイン質問"
    assert len(my_comment_activity["replies"]) == 1
    assert my_comment_activity["replies"][0] == "それに対する返信です"


def test_dashboard_api_requires_login(client):
    """② 【セキュリティテスト】未ログイン状態でのダッシュボードアクセスが401エラーになること"""
    response = client.get("/dashboard")
    assert response.status_code == 401


def test_dashboard_data_when_event_creator_deleted(client, authorized_client):
    """イベントの作成者（他ユーザー）が削除されても、自分のダッシュボードが正しく動作すること"""
    from app.database import UserModel, EventModel, SessionLocal
    from datetime import timedelta

    start = get_jst_now() + timedelta(days=2)
    end = start + timedelta(hours=2)

    # 1. 別のユーザー「creator_user」をデータベースに作成
    db = SessionLocal()
    creator_user = UserModel(
        username="creator_user",
        email="creator@example.com",
        hashed_password="dummy_hash",
        is_active=1,
    )
    db.add(creator_user)
    db.commit()
    db.refresh(creator_user)
    creator_user_id = creator_user.id

    # 2. そのユーザーを主催者として、イベントを手動作成
    other_event = EventModel(
        title="他人が作ったイベント",
        capacity=10,
        start_time=start,
        end_time=end,
        creator_id=creator_user_id,
    )
    db.add(other_event)
    db.commit()
    db.refresh(other_event)
    event_id = other_event.id
    db.close()

    # 3. ログインユーザー（test_user）が、その他人のイベントに参加登録する
    authorized_client.post(f"/events/{event_id}/register", json={"status": "attending"})

    # 4. 主催者ユーザー「creator_user」をデータベースから強制削除
    db = SessionLocal()
    try:
        user_to_delete = (
            db.query(UserModel).filter(UserModel.id == creator_user_id).first()
        )
        if user_to_delete:
            db.delete(user_to_delete)
            db.commit()
    finally:
        db.close()

    # 5. ダッシュボードAPIを叩き、500エラー等にならずに情報が引けるか検証
    response = authorized_client.get("/dashboard")
    assert response.status_code == 200
    data = response.json()

    # カレンダーの参加イベント一覧に、作成者が消えたイベントが正しく含まれていること
    assert len(data["calendar_events"]) >= 1
    target_cal_event = next(
        (e for e in data["calendar_events"] if e["id"] == event_id), None
    )
    assert target_cal_event is not None
    assert target_cal_event["title"] == "他人が作ったイベント"
