from datetime import datetime, timezone, timedelta


def test_create_and_get_event(authorized_client):
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
        "end_time": end.isoformat(),
    }

    # 2. 認証モックが必要な場合はヘッダーを付与（現在は簡易的にダミーユーザー名を指定）
    headers = {"X-User-Name": "test_user"}

    # 3. イベント登録 API (POST /events) を叩く
    response = authorized_client.post("/events", json=event_data, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "テスト用モブプロ"
    assert data["capacity"] == 10
    assert "id" in data

    # 4. イベント一覧 API (GET /events) を叩いて、今作ったものが含まれているか確認
    get_response = authorized_client.get("/events")
    assert get_response.status_code == 200
    events_list = get_response.json()

    assert len(events_list) > 0
    assert events_list[0]["title"] == "テスト用モブプロ"


def test_create_event_invalid_capacity(authorized_client):
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
        "end_time": end.isoformat(),
    }

    response = authorized_client.post(
        "/events", json=invalid_data, headers={"X-User-Name": "test_user"}
    )
    assert response.status_code == 422


def test_create_event_invalid_date_order(authorized_client):
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
        "end_time": end.isoformat(),
    }

    response = authorized_client.post(
        "/events", json=invalid_data, headers={"X-User-Name": "test_user"}
    )
    assert response.status_code == 422


def test_get_event_not_found(authorized_client):
    """不足追加③: 存在しないイベントIDを取得しようとしたら404になること"""
    response = authorized_client.get("/events/99999")  # 👈 存在しないあり得ないID
    assert response.status_code == 404
    assert response.json()["detail"] == "指定されたイベントが見つかりません。"


def test_events_api_requires_login(client):
    """【セキュリティテスト】ログインしていない場合は 401 認証エラーになること"""
    # 未ログイン状態(client)で一覧取得を試みる
    response = client.get("/events")
    # 本来の認証ロジックが動いていれば、FastAPIは自動的に 401（または実装に応じた認証エラー）を返します
    # ※現在お使いの get_current_user_name の未ログイン時挙動に合わせて status_code を確認してください（通常は 401 💡）
    assert response.status_code == 401


def test_update_event(authorized_client):
    """不足追加④: イベント情報の更新(PUT)が正しく動作すること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)

    # 1. 最初にテスト用のイベントを登録
    event_data = {
        "title": "更新前のタイトル",
        "description": "古い説明",
        "location": "会議室A",
        "capacity": 5,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }
    headers = {"X-User-Name": "test_user"}
    create_res = authorized_client.post("/events", json=event_data, headers=headers)
    event_id = create_res.json()["id"]

    # 2. 更新用データを用意して PUT リクエストを送信
    updated_data = event_data.copy()
    updated_data["title"] = "更新後のタイトル変更！"
    updated_data["capacity"] = 20

    update_res = authorized_client.put(
        f"/events/{event_id}", json=updated_data, headers=headers
    )
    assert update_res.status_code == 200

    # 3. 値が書き換わっているか確認
    data = update_res.json()
    assert data["title"] == "更新後のタイトル変更！"
    assert data["capacity"] == 20


def test_delete_event(authorized_client):
    """不足追加⑤: イベントの削除(DELETE)が正しく動作すること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)

    # 1. テスト用のイベントを登録
    event_data = {
        "title": "削除されるイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }
    headers = {"X-User-Name": "test_user"}
    create_res = authorized_client.post("/events", json=event_data, headers=headers)
    event_id = create_res.json()["id"]

    # 2. DELETE APIを叩いて削除
    delete_res = authorized_client.delete(f"/events/{event_id}", headers=headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["status"] == "success"

    # 3. 本当に消えたか詳細GET APIで確認 (404になるはず)
    get_res = authorized_client.get(f"/events/{event_id}")
    assert get_res.status_code == 404


def test_get_events_pagination(authorized_client):
    """不足追加⑥: 一覧取得(GET)のページネーションが正しく動作すること"""
    jst = timezone(timedelta(hours=9))
    headers = {"X-User-Name": "test_user"}

    # 1. 異なる開始時間でイベントを計3つ登録する
    for i in range(3):
        start = datetime.now(jst) + timedelta(days=i + 1)
        end = start + timedelta(hours=1)
        event_data = {
            "title": f"イベント {i}",
            "capacity": 10,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        }
        authorized_client.post("/events", json=event_data, headers=headers)

    # 2. 1ページあたり「2件」制限で取得してみる
    response = authorized_client.get("/events?page=1&per_page=2")
    assert response.status_code == 200
    data = response.json()

    # 指定通り最大2件だけ返ってきていることを検証
    assert len(data) == 2
    # 開始日時の昇順なので「イベント 0」と「イベント 1」の順になっているはず
    assert data[0]["title"] == "イベント 0"
    assert data[1]["title"] == "イベント 1"


def test_cannot_update_or_delete_other_user_event(client, authorized_client):
    """【セキュリティテスト】他人が作ったイベントの変更・削除は403エラーになること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)

    # 1. ユーザー「test_user」としてイベントを作成する
    event_data = {
        "title": "元々のイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }
    create_res = authorized_client.post(
        "/events", json=event_data, headers={"X-User-Name": "test_user"}
    )
    event_id = create_res.json()["id"]

    # 2. 別のユーザー「stranger_user」として認証クライアントのモックを上書きする、
    #    または通常の client にカスタムヘッダーを付けて別人でPUTリクエストを送る
    #    (今回の依存関係オーバーライドの仕様上、明示的にヘッダーを変えるか、別のモックを用意します)
    #    ここでは get_current_user_name を別名に変更するため dependency_overrides を一時的に上書き
    from app.utils import get_current_user_name
    from app.main import app

    def _override_stranger():
        return "stranger_user"  # 👈 別人

    app.dependency_overrides[get_current_user_name] = _override_stranger

    # 3. 他人のイベントに対して編集(PUT)を試みる ➔ 403になるはず！
    updated_data = event_data.copy()
    updated_data["title"] = "ハッキングタイトル"
    update_res = client.put(f"/events/{event_id}", json=updated_data)
    assert update_res.status_code == 403
    assert update_res.json()["detail"] == "自分が作成したイベント以外は編集できません。"

    # 4. 他人のイベントに対して削除(DELETE)を試みる ➔ 403になるはず！
    delete_res = client.delete(f"/events/{event_id}")
    assert delete_res.status_code == 403
    assert delete_res.json()["detail"] == "自分が作成したイベント以外は削除できません。"

    # テストが終わったら dependency_overrides をクリアして戻す
    app.dependency_overrides.clear()
