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
    assert "test_user" in my_event_summary["attendees"]
    assert my_event_summary["comment_count"] == 2

    assert len(data["calendar_events"]) == 1
    assert data["calendar_events"][0]["status"] == "attending"

    assert len(data["my_comments"]) == 1
    my_comment_activity = data["my_comments"][0]
    assert my_comment_activity["my_content"] == "私のメイン質問"
    assert len(my_comment_activity["replies"]) == 1
    assert my_comment_activity["replies"][0] == "それに対する返信です"


def test_dashboard_api_requires_login(client):
    """② 【セキュリティテスト】未ログイン状態でのダッシュボードアクセスが401エラーになること"""
    response = client.get("/dashboard")
    assert response.status_code == 401
