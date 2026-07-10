from datetime import datetime, timezone, timedelta

def test_create_and_get_event(client):
    """イベントの作成と一覧取得の連携テスト"""
    
    # 1. テスト用のイベントデータ（Pydanticの仕様に合わせる）
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)
    
    event_data = {
        "title": "テスト用モブプロ",
        "description": "テストコードから作成されたイベントです",
        "location": "オンライン",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    
    # 2. 認証モックが必要な場合はヘッダーを付与（現在は簡易的にダミーユーザー名を指定）
    headers = {"X-User-Name": "test_user"} 
    
    # 3. イベント登録 API (POST /events) を叩く
    response = client.post("/events", json=event_data, headers=headers)
    assert response.status_code == 201
    
    data = response.json()
    assert data["title"] == "テスト用モブプロ"
    assert data["capacity"] == 10
    assert "id" in data
    
    # 4. イベント一覧 API (GET /events) を叩いて、今作ったものが含まれているか確認
    get_response = client.get("/events")
    assert get_response.status_code == 200
    events_list = get_response.json()
    
    assert len(events_list) > 0
    assert events_list[0]["title"] == "テスト用モブプロ"