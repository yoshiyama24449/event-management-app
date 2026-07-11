'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface EventDetail {
  id: number;
  title: string;
  capacity: number;
  start_time: string;
  end_time: string;
  creator_id: number;
}

interface CommentItem {
  id: number;
  event_id: number;
  user_id: number;
  username: string;
  content: string;
  parent_id: number | null;
  created_at: string;
}

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id; // URLからイベントIDを取得

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [myStatus, setMyStatus] = useState<string>('none'); // 'attending', 'bookmark', 'none'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // コメント・返信入力用の状態
  const [commentContent, setCommentContent] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null); // 返信対象の親コメントID
  const [replyContent, setReplyContent] = useState('');

  // 1. イベント詳細・コメント・登録ステータスのデータ一括取得
  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    try {
      // 💡 すべて万能中継API経由に変更
      // (A) イベント詳細の取得
      const eventRes = await fetch(`/api/auth?path=/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!eventRes.ok) throw new Error('イベント情報の取得に失敗しました。');
      const eventData = await eventRes.json();
      setEvent(eventData);

      // (B) コメント一覧の取得
      const commentsRes = await fetch(`/api/auth?path=/events/${eventId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData);
      }

      // (C) 登録ステータスの初期チェック
      const dashRes = await fetch('/api/auth?path=/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        const currentReg = dashData.calendar_events.find((cal: any) => cal.id === Number(eventId));
        setMyStatus(currentReg ? currentReg.status : 'none');
      }

    } catch (err: any) {
      setError(err.message || 'データの取得中にエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchData();
    }
  }, [eventId]);

  // 2. 参加登録・ブックマークのステータス変更処理
  const handleStatusChange = async (statusType: 'attending' | 'bookmark' | 'none') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // 💡 ステータスが 'none'（解除）なら DELETE、それ以外（参加/ブックマーク）なら POST にする
      const isDelete = statusType === 'none';
      const method = isDelete ? 'DELETE' : 'POST';
      const res = await fetch(`/api/auth?path=/events/${eventId}/register`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        // 💡 DELETE のときはボディ（データ）を送らない
        body: isDelete ? undefined : JSON.stringify({ status: statusType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'ステータスの更新に失敗しました。');
      }

      setMyStatus(statusType);
      alert(statusType === 'none' ? '登録を解除しました。' : 'ステータスを更新しました！');
      fetchData(); // 参加者一覧データなどが変わる可能性があるため再取得
    } catch (err: any) {
      alert(err.message || '通信エラーが発生しました。');
    }
  };

  // 3. 親コメントの新規投稿
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/auth?path=/events/${eventId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: commentContent }),
      });

      if (!res.ok) throw new Error('コメントの投稿に失敗しました。');
      
      setCommentContent('');
      fetchData(); // リロードして一覧を更新
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 4. コメントへの「返信」投稿
  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || replyTargetId === null) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/auth?path=/events/${eventId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: replyContent,
          parent_id: replyTargetId,
        }),
      });

      if (!res.ok) throw new Error('返信の投稿に失敗しました。');

      setReplyContent('');
      setReplyTargetId(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium animate-pulse">イベント詳細をロード中...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500 font-medium">イベントが見つかりませんでした。</p>
      </div>
    );
  }

  // 親コメントだけを抽出
  const parentComments = comments.filter(c => c.parent_id === null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900 tracking-tight cursor-pointer" onClick={() => router.push('/dashboard')}>
            📅 EventHub
          </span>
          <div className="flex space-x-4">
            <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-600 hover:text-indigo-600 font-medium">
              ダッシュボード
            </button>
            <button onClick={() => router.push('/events')} className="text-sm text-gray-600 hover:text-indigo-600 font-medium">
              イベント一覧
            </button>
          </div>
        </div>
      </nav>

      {/* メインレイアウト */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* イベント詳細カード */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 mb-4 gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">イベント詳細</span>
              <h1 className="text-2xl font-extrabold text-gray-900 mt-2">{event.title}</h1>
              <p className="text-xs text-gray-400 mt-1">🕒 開催期間: {new Date(event.start_time).toLocaleString('ja-JP')} 〜 {new Date(event.end_time).toLocaleString('ja-JP')}</p>
              <p className="text-xs text-gray-500">👥 定員枠: 最大 {event.capacity} 名</p>
            </div>

            {/* アクションボタン（参加・ブックマーク） */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStatusChange(myStatus === 'attending' ? 'none' : 'attending')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  myStatus === 'attending'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-gray-100 hover:bg-green-50 text-gray-700 hover:text-green-700'
                }`}
              >
                {myStatus === 'attending' ? '✓ 参加予定' : '🙋 参加する'}
              </button>

              <button
                onClick={() => handleStatusChange(myStatus === 'bookmark' ? 'none' : 'bookmark')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  myStatus === 'bookmark'
                    ? 'bg-yellow-500 text-white shadow-sm'
                    : 'bg-gray-100 hover:bg-yellow-50 text-gray-700 hover:text-yellow-600'
                }`}
              >
                {myStatus === 'bookmark' ? '★ ブックマーク中' : '⭐ ブックマーク'}
              </button>
            </div>
          </div>
        </div>

        {/* コメントセクション */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-900">💬 質問・コメントスレッド ({comments.length})</h2>

          {/* コメント新規投稿フォーム */}
          <form onSubmit={handlePostComment} className="flex gap-2">
            <input
              type="text"
              required
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="イベントに関する質問を投稿..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm">
              投稿
            </button>
          </form>

          {/* スレッド表示部分 */}
          <div className="space-y-4 pt-4 border-t">
            {parentComments.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">まだコメントはありません。最初の質問をしてみましょう！</p>
            ) : (
              parentComments.map((parent) => {
                // この親コメントに紐づく返信を抽出
                const childReplies = comments.filter(c => c.parent_id === parent.id);

                return (
                  <div key={parent.id} className="border border-gray-100 bg-gray-50/40 rounded-xl p-4 space-y-3">
                    {/* 親コメント本体 */}
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-bold text-gray-800">{parent.username || `User #${parent.user_id}`}</span>
                        <span className="text-[10px] text-gray-400">{new Date(parent.created_at).toLocaleString('ja-JP')}</span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium">{parent.content}</p>
                      
                      {/* 返信ボタンのトグル */}
                      <button
                        onClick={() => setReplyTargetId(replyTargetId === parent.id ? null : parent.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-1 transition-colors"
                      >
                        {replyTargetId === parent.id ? 'キャンセル' : '↳ 返信を書く'}
                      </button>
                    </div>

                    {/* 子返信たちのループ */}
                    {childReplies.length > 0 && (
                      <div className="pl-6 space-y-2 border-l-2 border-indigo-100 mt-2">
                        {childReplies.map((reply) => (
                          <div key={reply.id} className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                            <div className="flex items-center space-x-2 mb-0.5">
                              <span className="text-xs font-bold text-gray-700">{reply.username || `User #${reply.user_id}`}</span>
                              <span className="text-[9px] text-gray-400">{new Date(reply.created_at).toLocaleString('ja-JP')}</span>
                            </div>
                            <p className="text-xs text-gray-800">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* この親コメントに対する返信入力欄 */}
                    {replyTargetId === parent.id && (
                      <form onSubmit={handlePostReply} className="pl-6 flex gap-2 mt-2 animate-fadeIn">
                        <input
                          type="text"
                          required
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder={`${parent.username || `User #${parent.user_id}`} さんへの返信を入力...`}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 text-gray-900"
                        />
                        <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors">
                          返信
                        </button>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}