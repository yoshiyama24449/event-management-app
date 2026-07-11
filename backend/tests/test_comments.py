import pytest
from datetime import datetime, timezone, timedelta

def test_comment_and_reply_flow(authorized_client):
    """① コメント投稿と返信、および一覧取得の正常系テスト"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)
    
    # 1. テスト用のイベントを作成
    event_data = {
        "title": "コメント用イベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # 2. 通常のコメントを投稿する
    comment_data = {"content": "最初の質問です。"}
    res_comment = authorized_client.post(f"/events/{event_id}/comments", json=comment_data)
    assert res_comment.status_code == 201
    comment_id = res_comment.json()["id"]
    assert res_comment.json()["content"] == "最初の質問です。"
    assert res_comment.json()["parent_id"] is None

    # 3. 投稿したコメントに対して「返信」する (parent_id を指定)
    reply_data = {
        "content": "質問に対する返信です。",
        "parent_id": comment_id
    }
    res_reply = authorized_client.post(f"/events/{event_id}/comments", json=reply_data)
    assert res_reply.status_code == 201
    assert res_reply.json()["content"] == "質問に対する返信です。"
    assert res_reply.json()["parent_id"] == comment_id

    # 4. コメント一覧を取得して、両方正しく含まれているか確認する
    get_res = authorized_client.get(f"/events/{event_id}/comments")
    assert get_res.status_code == 200
    comments_list = get_res.json()
    assert len(comments_list) == 2
    assert comments_list[0]["content"] == "最初の質問です。"
    assert comments_list[1]["content"] == "質問に対する返信です。"


def test_comment_invalid_parent(authorized_client):
    """② 存在しないコメントIDへの返信(異常系)が弾かれること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)
    
    event_data = {
        "title": "エラーテストイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat()
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # 存在しない親ID(99999)を指定して返信を試みる ➔ 400エラー
    invalid_reply = {
        "content": "迷子の返信",
        "parent_id": 99999
    }
    res = authorized_client.post(f"/events/{event_id}/comments", json=invalid_reply)
    assert res.status_code == 400
    assert res.json()["detail"] == "返信対象のコメントが見つかりません。"


def test_comment_api_requires_login(client):
    """③ 【セキュリティテスト】未ログイン状態でのコメント操作が401エラーになること"""
    # ログインしていない client で適当なイベントIDに投稿を試みる
    response = client.post("/events/1/comments", json={"content": "未ログイン投稿"})
    assert response.status_code == 401