# tests/test_registrations.py
import pytest
from datetime import timedelta
from app.database import get_jst_now  # 💡 統一した時間取得関数を使用


def test_registration_flow_success(authorized_client):
    """① 参加登録・更新・キャンセルの正常系一連フロー"""
    # 💡 get_jst_now() を使うことで、確実にタイムゾーン Aware (JST) になります
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    event_data = {
        "title": "登録テストイベント",
        "capacity": 5,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": [],
    }
    create_res = authorized_client.post("/events", json=event_data)
    assert create_res.status_code == 201
    event_id = create_res.json()["id"]

    reg_data_bm = {"status": "bookmark"}
    res_bm = authorized_client.post(f"/events/{event_id}/register", json=reg_data_bm)
    assert res_bm.status_code == 201
    assert res_bm.json()["status"] == "bookmark"

    reg_data_at = {"status": "attending"}
    res_at = authorized_client.post(f"/events/{event_id}/register", json=reg_data_at)
    assert res_at.status_code == 201
    assert res_at.json()["status"] == "attending"

    del_res = authorized_client.delete(f"/events/{event_id}/register")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"


def test_registration_capacity_limit(client, authorized_client):
    """② 定員エラーの異常系テスト"""
    start = get_jst_now() + timedelta(days=1)
    end = start + timedelta(hours=2)

    event_data = {
        "title": "即満員イベント",
        "capacity": 1,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "tags": [],
    }
    create_res = authorized_client.post("/events", json=event_data)
    assert create_res.status_code == 201
    event_id = create_res.json()["id"]

    res_user1 = authorized_client.post(
        f"/events/{event_id}/register", json={"status": "attending"}
    )
    assert res_user1.status_code == 201

    from app.utils import get_current_user_name
    from app.main import app
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

    app.dependency_overrides[get_current_user_name] = lambda: "stranger_user"

    res_user2_attend = client.post(
        f"/events/{event_id}/register", json={"status": "attending"}
    )
    assert res_user2_attend.status_code == 400
    assert (
        res_user2_attend.json()["detail"]
        == "定員に達しているため、このイベントには参加登録できません。"
    )

    res_user2_bookmark = client.post(
        f"/events/{event_id}/register", json={"status": "bookmark"}
    )
    assert res_user2_bookmark.status_code == 201
    assert res_user2_bookmark.json()["status"] == "bookmark"

    app.dependency_overrides.clear()


def test_registration_finished_event_forbidden(authorized_client):
    """③ 既に終了したイベントに参加/ブックマークを試みると400エラーになること"""
    from app.database import EventModel, SessionLocal

    db = SessionLocal()
    past_event = EventModel(
        title="終了した過去のイベント",
        description="もう終了しています",
        location="過去",
        capacity=10,
        creator_id=1,
        # 💡 DB保存時にタイムゾーンを持った状態で過去時間を設定
        start_time=get_jst_now() - timedelta(hours=5),
        end_time=get_jst_now() - timedelta(hours=3),
    )
    db.add(past_event)
    db.commit()
    db.refresh(past_event)
    past_event_id = past_event.id
    db.close()

    res = authorized_client.post(
        f"/events/{past_event_id}/register", json={"status": "attending"}
    )
    assert res.status_code == 400
    assert "このイベントは既に終了しているため" in res.json()["detail"]
