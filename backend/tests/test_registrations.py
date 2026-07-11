import pytest
from datetime import datetime, timezone, timedelta

def test_registration_flow_success(authorized_client):
    """① 参加登録・更新・キャンセルの正常系一連フロー"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)
    
    # 1. テスト用のイベントを作成（定員5名）
    event_data = {
        "title": "登録テストイベント",
        "capacity": 5,
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # 2. まずはブックマークしてみる
    reg_data_bm = {"status": "bookmark"}
    res_bm = authorized_client.post(f"/events/{event_id}/register", json=reg_data_bm)
    assert res_bm.status_code == 201
    assert res_bm.json()["status"] == "bookmark"

    # 3. ブックマークから参加（attending）へ切り替える
    reg_data_at = {"status": "attending"}
    res_at = authorized_client.post(f"/events/{event_id}/register", json=reg_data_at)
    assert res_at.status_code == 201
    assert res_at.json()["status"] == "attending"

    # 4. キャンセル（DELETE）する
    del_res = authorized_client.delete(f"/events/{event_id}/register")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"


def test_registration_capacity_limit(client, authorized_client):
    """② 定員エラーの異常系テスト"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)
    
    # 1. 定員「1名」のイベントを作成する
    event_data = {
        "title": "即満員イベント",
        "capacity": 1,
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # 2. 最初の一人（test_user）が参加登録をする（枠が埋まる）
    res_user1 = authorized_client.post(f"/events/{event_id}/register", json={"status": "attending"})
    assert res_user1.status_code == 201

    # 3. 別のユーザー（stranger_user）になりすまして参加登録を試みる
    from app.utils import get_current_user_name
    from app.main import app
    from app.database import UserModel, SessionLocal
    
    # stranger_user をDBにあらかじめ用意
    db = SessionLocal()
    if not db.query(UserModel).filter(UserModel.username == "stranger_user").first():
        stranger = UserModel(
            username="stranger_user",
            email="stranger@example.com",
            hashed_password="dummy_hash",
            is_active=1
        )
        db.add(stranger)
        db.commit()
    db.close()

    # モックを stranger_user に書き換える
    app.dependency_overrides[get_current_user_name] = lambda: "stranger_user"

    # 4. 別人が参加（attending）を試みる ➔ 定員エラー(400)になること
    res_user2_attend = client.post(f"/events/{event_id}/register", json={"status": "attending"})
    assert res_user2_attend.status_code == 400
    assert res_user2_attend.json()["detail"] == "定員に達しているため、このイベントには参加登録できません。"

    # 5. 別人がブックマーク（bookmark）を試みる ➔ 定員関係なく成功すること(仕様通り)
    res_user2_bookmark = client.post(f"/events/{event_id}/register", json={"status": "bookmark"})
    assert res_user2_bookmark.status_code == 201
    assert res_user2_bookmark.json()["status"] == "bookmark"

    # 依存関係の上書きをリセット
    app.dependency_overrides.clear()