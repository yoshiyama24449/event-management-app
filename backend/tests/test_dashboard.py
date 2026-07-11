import pytest
from datetime import datetime, timezone, timedelta

def test_get_dashboard_data_success(authorized_client):
    """① ダッシュボードデータの集約・集計が正しく動作すること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)
    
    # --- 1. テストデータの仕込み ---
    # (A) 自分が作成するイベント
    event_data = {
        "title": "ダッシュボードテストイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # (B) そのイベントに自分自身が参加登録する
    authorized_client.post(f"/events/{event_id}/register", json={"status": "attending"})

    # (C) そのイベントにコメントを1件残す
    authorized_client.post(f"/events/{event_id}/comments", json={"content": "テストコメント"})

    # --- 2. ダッシュボードAPIを叩く ---
    response = authorized_client.get("/dashboard")
    assert response.status_code == 200
    
    data = response.json()
    
    # --- 3. 集計ロジックの検証 ---
    # 要件1: 自分が作成したイベントの集計チェック
    assert len(data["created_events"]) == 1
    my_event_summary = data["created_events"][0]
    assert my_event_summary["id"] == event_id
    assert my_event_summary["attendee_count"] == 1  # 自分の参加が正しくカウントされていること
    assert my_event_summary["comment_count"] == 1   # 自分のコメントが正しくカウントされていること

    # 要件3: カレンダー表示用のチェック
    assert len(data["calendar_events"]) == 1
    cal_event = data["calendar_events"][0]
    assert cal_event["id"] == event_id
    assert cal_event["status"] == "attending"


def test_dashboard_api_requires_login(client):
    """② 【セキュリティテスト】未ログイン状態でのダッシュボードアクセスが401エラーになること"""
    response = client.get("/dashboard")
    assert response.status_code == 401