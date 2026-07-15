import pytest
from datetime import datetime, timezone, timedelta

from app.database import get_jst_now


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
        "end_time": end.isoformat(),
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # 2. 通常のコメントを投稿する
    comment_data = {"content": "最初の質問です。"}
    res_comment = authorized_client.post(
        f"/events/{event_id}/comments", json=comment_data
    )
    assert res_comment.status_code == 201
    comment_id = res_comment.json()["id"]
    assert res_comment.json()["content"] == "最初の質問です。"
    assert res_comment.json()["parent_id"] is None

    # 3. 投稿したコメントに対して「返信」する (parent_id を指定)
    reply_data = {"content": "質問に対する返信です。", "parent_id": comment_id}
    res_reply = authorized_client.post(f"/events/{event_id}/comments", json=reply_data)
    assert res_reply.status_code == 201
    assert res_reply.json()["content"] == "質問に対する返信です。"
    assert res_reply.json()["parent_id"] == comment_id

    # 4. コメント一覧を取得して、両方正しく含まれているか確認する
    get_res = authorized_client.get(f"/events/{event_id}/comments")
    assert get_res.status_code == 200
    comments_list = get_res.json()
    assert len(comments_list) == 2

    # 💡 追記：username が 'test_user' として正しく結合されて返ってきているか検証
    assert comments_list[0]["content"] == "最初の質問です。"
    assert comments_list[0]["username"] == "test_user"  # 👈 これを検証！

    assert comments_list[1]["content"] == "質問に対する返信です。"
    assert comments_list[1]["username"] == "test_user"  # 👈 これを検証！


def test_comment_invalid_parent(authorized_client):
    """② 存在しないコメントIDへの返信(異常系)が弾かれること"""
    jst = timezone(timedelta(hours=9))
    start = datetime.now(jst) + timedelta(days=1)
    end = start + timedelta(hours=2)

    event_data = {
        "title": "エラーテストイベント",
        "capacity": 10,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # 存在しない親ID(99999)を指定して返信を試みる ➔ 400エラー
    invalid_reply = {"content": "迷子の返信", "parent_id": 99999}
    res = authorized_client.post(f"/events/{event_id}/comments", json=invalid_reply)
    assert res.status_code == 400
    assert res.json()["detail"] == "返信対象のコメントが見つかりません。"


def test_comment_api_requires_login(client):
    """③ 【セキュリティテスト】未ログイン状態でのコメント操作が401エラーになること"""
    # ログインしていない client で適当なイベントIDに投稿を試みる
    response = client.post("/events/1/comments", json={"content": "未ログイン投稿"})
    assert response.status_code == 401


def test_comment_cannot_reply_to_reply(authorized_client):
    """【追加】返信コメント（すでにparent_idを持つコメント）に対して、さらに返信することは禁止する"""
    start = (get_jst_now() + timedelta(days=1)).isoformat()
    end = (get_jst_now() + timedelta(days=1, hours=2)).isoformat()

    event_data = {
        "title": "コメントネストテスト",
        "capacity": 10,
        "start_time": start,
        "end_time": end,
    }
    create_res = authorized_client.post("/events", json=event_data)
    event_id = create_res.json()["id"]

    # 1. 親コメントを投稿 (階層1)
    res_parent = authorized_client.post(
        f"/events/{event_id}/comments", json={"content": "親コメント"}
    )
    parent_id = res_parent.json()["id"]

    # 2. 返信を投稿 (階層2)
    res_reply = authorized_client.post(
        f"/events/{event_id}/comments",
        json={"content": "返信です", "parent_id": parent_id},
    )
    reply_id = res_reply.json()["id"]

    # 3. 返信（階層2）に対して、さらに返信を試みる (階層3 ➔ 弾かれるべき)
    res_grandchild = authorized_client.post(
        f"/events/{event_id}/comments",
        json={"content": "孫コメント（返信への返信）", "parent_id": reply_id},
    )

    # 💡 400 Bad Request を期待する
    assert res_grandchild.status_code == 400
    assert (
        "返信に対してさらに返信することはできません" in res_grandchild.json()["detail"]
    )
