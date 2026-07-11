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

def test_create_event_invalid_capacity(client):
    """不足追加①: 定員が0以下の場合はバリデーションエラー(422)になること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)

    invalid_data = {
        "title": "定員エラーテスト",
        "description": "定員が0なので弾かれるはずです",
        "location": "オンライン",
        "capacity": 0,  # 👈 1以上でなければならない
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    
    response = client.post("/events", json=invalid_data, headers={"X-User-Name": "test_user"})
    assert response.status_code == 422


def test_create_event_invalid_date_order(client):
    """不足追加②: 終了日時が開始日時より前の場合はバリデーションエラー(422)になること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start - timedelta(hours=2)  # 👈 開始より2時間前の過去に設定

    invalid_data = {
        "title": "日時逆転テスト",
        "description": "日時が逆なので弾かれるはずです",
        "location": "オンライン",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    
    response = client.post("/events", json=invalid_data, headers={"X-User-Name": "test_user"})
    assert response.status_code == 422


def test_get_event_not_found(client):
    """不足追加③: 存在しないイベントIDを取得しようとしたら404になること"""
    response = client.get("/events/99999")  # 👈 存在しないあり得ないID
    assert response.status_code == 404
    assert response.json()["detail"] == "指定されたイベントが見つかりません。"