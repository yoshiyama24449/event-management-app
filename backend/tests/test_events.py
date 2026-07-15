# tests/test_events.py
import pytest
from datetime import datetime, timezone, timedelta
from app.database import get_jst_now  # 💡 日本時間取得ヘルパーを使用


def test_create_and_get_event(authorized_client):
    """イベントの作成と一覧取得の連携テスト（タグ対応版）"""

    # 1. テスト用のイベントデータ（Pydanticの仕様に合わせる）
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    event_data = {
        "title": "テスト用モブプロ",
        "description": "テストコードから作成されたイベントです",
        "location": "オンライン",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": ["Python", "FastAPI"],  # 💡 タグ付きで作成テスト
    }

    headers = {"X-User-Name": "test_user"}

    # 3. イベント登録 API (POST /events) を叩く
    response = authorized_client.post("/events", json=event_data, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "テスト用モブプロ"
    assert data["capacity"] == 10
    assert (
        "Python" in data["tag_names"]
    )  # 💡 タグが正常に返却されているかチェック[cite: 6]
    assert "id" in data

    # 4. イベント一覧 API (GET /events) を叩いて、今作ったものが含まれているか確認
    get_response = authorized_client.get("/events")
    assert get_response.status_code == 200
    events_list = get_response.json()

    assert len(events_list) > 0
    assert events_list[0]["title"] == "テスト用モブプロ"


def test_get_events_with_filters(authorized_client):
    """💡 修正: キーワード、タグ、日時範囲による高度なフィルタリングテスト"""
    # 💡 ミリ秒を切り捨て、確実に未来であることが保証される「JST Aware」な時間を生成[cite: 13]
    # 💡 標準的なフォーマット（例: 2026-07-20T10:00:00+09:00）で統一して文字列化します[cite: 6]
    base_time = get_jst_now().replace(microsecond=0)

    start1 = base_time + timedelta(days=2)
    end1 = start1 + timedelta(hours=2)

    start2 = base_time + timedelta(days=4)
    end2 = start2 + timedelta(hours=2)

    headers = {"X-User-Name": "test_user"}

    # 1. イベントA (Python) の登録
    res_a = authorized_client.post(
        "/events",
        json={
            "title": "Python勉強会",
            "description": "Python初学者向け",
            "location": "渋谷",
            "capacity": 5,
            "start_time": start1.isoformat(),  # 例: "2026-07-16T21:15:13+09:00"
            "end_time": end1.isoformat(),
            "tags": ["Python"],
        },
        headers=headers,
    )
    assert res_a.status_code == 201

    # 2. イベントB (Rust) の登録
    res_b = authorized_client.post(
        "/events",
        json={
            "title": "Rustもくもく会",
            "description": "Rustで開発する会",
            "location": "新宿",
            "capacity": 10,
            "start_time": start2.isoformat(),
            "end_time": end2.isoformat(),
            "tags": ["Rust"],
        },
        headers=headers,
    )
    assert res_b.status_code == 201

    # (検証1) キーワード検索
    res_q = authorized_client.get("/events?q=Python&hide_finished=false")
    assert res_q.status_code == 200
    data_q = res_q.json()
    assert len(data_q) == 1
    assert data_q[0]["title"] == "Python勉強会"

    # (検証2) タグ検索
    res_tag = authorized_client.get("/events?tag=Rust&hide_finished=false")
    assert res_tag.status_code == 200
    data_tag = res_tag.json()
    assert len(data_tag) == 1
    assert data_tag[0]["title"] == "Rustもくもく会"

    # (検証3) 日付範囲検索（1日後〜3日後を範囲とし、4日後のRustを除外する）
    # 💡 URLクエリパラメータに載せる日付文字列は、URLエンコードの不整合を避けるため
    #    特殊文字（+ や 空白）が噛み合わないのを防ぐために、あえてシンプルな Naive 文字列でリクエストを投げます。
    target_end_range = (get_jst_now() + timedelta(days=3)).replace(
        microsecond=0, tzinfo=None
    )
    res_date = authorized_client.get(
        f"/events?end_date={target_end_range.isoformat()}&hide_finished=false"
    )
    assert res_date.status_code == 200
    data_date = res_date.json()
    assert len(data_date) == 1
    assert data_date[0]["title"] == "Python勉強会"


def test_create_event_invalid_capacity(authorized_client):
    """不足追加①: 定員が0以下の場合はバリデーションエラー(422)になること"""
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    invalid_data = {
        "title": "定員エラーテスト",
        "description": "定員が0なので弾かれるはずです",
        "location": "オンライン",
        "capacity": 0,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": [],
    }

    response = authorized_client.post(
        "/events", json=invalid_data, headers={"X-User-Name": "test_user"}
    )
    assert response.status_code == 422


def test_create_event_invalid_date_order(authorized_client):
    """不足追加②: 終了日時が開始日時より前の場合はバリデーションエラー(422)になること"""
    start = get_jst_now() + timedelta(days=1)
    end = start - timedelta(hours=2)

    invalid_data = {
        "title": "日時逆転テスト",
        "description": "日時が逆なので弾かれるはずです",
        "location": "オンライン",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": [],
    }

    response = authorized_client.post(
        "/events", json=invalid_data, headers={"X-User-Name": "test_user"}
    )
    assert response.status_code == 422


def test_get_event_not_found(authorized_client):
    """不足追加③: 存在しないイベントIDを取得しようとしたら404になること"""
    response = authorized_client.get("/events/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "指定されたイベントが見つかりません。"


def test_events_api_requires_login(client):
    """【セキュリティテスト】ログインしていない場合は 401 認証エラーになること"""
    response = client.get("/events")
    assert response.status_code == 401


def test_update_event(authorized_client):
    """不足追加④: イベント情報の更新(PUT)が正しく動作すること"""
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    event_data = {
        "title": "更新前のタイトル",
        "description": "古い説明",
        "location": "会議室A",
        "capacity": 5,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": ["Legacy"],
    }
    headers = {"X-User-Name": "test_user"}
    create_res = authorized_client.post("/events", json=event_data, headers=headers)
    event_id = create_res.json()["id"]

    updated_data = event_data.copy()
    updated_data["title"] = "更新後のタイトル変更！"
    updated_data["capacity"] = 20
    updated_data["tags"] = ["New", "Updated"]

    update_res = authorized_client.put(
        f"/events/{event_id}", json=updated_data, headers=headers
    )
    assert update_res.status_code == 200

    data = update_res.json()
    assert data["title"] == "更新後のタイトル変更！"
    assert data["capacity"] == 20
    assert "New" in data["tag_names"]


def test_delete_event(authorized_client):
    """不足追加⑤: イベントの削除(DELETE)が正しく動作すること"""
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    event_data = {
        "title": "削除されるイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": [],
    }
    headers = {"X-User-Name": "test_user"}
    create_res = authorized_client.post("/events", json=event_data, headers=headers)
    event_id = create_res.json()["id"]

    delete_res = authorized_client.delete(f"/events/{event_id}", headers=headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["status"] == "success"

    get_res = authorized_client.get(f"/events/{event_id}")
    assert get_res.status_code == 404


def test_get_events_pagination(authorized_client):
    """不足追加⑥: 一覧取得(GET)のページネーションが正しく動作すること"""
    headers = {"X-User-Name": "test_user"}

    for i in range(3):
        start = get_jst_now() + timedelta(days=i + 1)
        end = start + timedelta(hours=1)
        event_data = {
            "title": f"イベント {i}",
            "capacity": 10,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "tags": [],
        }
        authorized_client.post("/events", json=event_data, headers=headers)

    response = authorized_client.get("/events?page=1&per_page=2")
    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    assert data[0]["title"] == "イベント 0"
    assert data[1]["title"] == "イベント 1"


def test_cannot_update_or_delete_other_user_event(client, authorized_client):
    """【セキュリティテスト】他人が作ったイベントの変更・削除は403エラーになること"""
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    event_data = {
        "title": "元々のイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": [],
    }
    create_res = authorized_client.post(
        "/events", json=event_data, headers={"X-User-Name": "test_user"}
    )
    event_id = create_res.json()["id"]

    from app.utils import get_current_user_name
    from app.main import app

    def _override_stranger():
        return "stranger_user"

    app.dependency_overrides[get_current_user_name] = _override_stranger

    updated_data = event_data.copy()
    updated_data["title"] = "ハッキングタイトル"
    update_res = client.put(f"/events/{event_id}", json=updated_data)
    assert update_res.status_code == 403
    assert update_res.json()["detail"] == "自分が作成したイベント以外は編集できません。"

    delete_res = client.delete(f"/events/{event_id}")
    assert delete_res.status_code == 403
    assert delete_res.json()["detail"] == "自分が作成したイベント以外は削除できません。"

    app.dependency_overrides.clear()
