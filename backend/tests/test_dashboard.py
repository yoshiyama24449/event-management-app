import pytest
from datetime import datetime, timezone, timedelta


def test_get_dashboard_data_success(client, authorized_client):
    """① ダッシュボードデータの集約・集計（参加者名リスト・返信紐づけ含む）が正しく動作すること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)

    # --- 1. テストデータの仕込み ---
    # (A) 自分が作成するイベント (authorized_client はデフォルトで "test_user" として動く想定)
    event_data = {
        "title": "完全版ダッシュボードイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
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

    # 💡 dependency_overrides をいじるのではなく、
    # 認証を通すためのヘッダー（またはアプリのカスタム認証仕様）に合わせて別人で投稿します。
    # 既存の auth 依存関係が X-User-Name ヘッダーを見る仕様になっているため、通常の client を使います。
    client.post(
        f"/events/{event_id}/comments",
        json={"content": "それに対する返信です", "parent_id": comment_id},
        headers={"X-User-Name": "stranger_user"},  # 👈 ヘッダーでユーザーを切り替える
    )

    # --- 2. ダッシュボードAPIを叩く (元々の test_user として取得) ---
    response = authorized_client.get("/dashboard")
    assert response.status_code == 200

    data = response.json()

    # --- 3. 拡張された集計ロジックの厳密な検証 ---
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
