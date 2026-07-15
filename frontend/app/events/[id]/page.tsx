'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface EventDetail {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  capacity: number;
  start_time: string;
  end_time: string;
  creator_id: number;
  creator_name: string; // 💡 追記
  attendee_count: number; // 💡 追記：現在の参加者数
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
  const eventId = params.id;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [myStatus, setMyStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [commentContent, setCommentContent] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  const getUserIdFromToken = (token: string): number | null => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      return payload.user_id ? Number(payload.user_id) : null;
    } catch (e) {
      return null;
    }
  };

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    const uid = getUserIdFromToken(token);
    setCurrentUserId(uid);

    try {
      const eventRes = await fetch(`/api/auth?path=/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!eventRes.ok) throw new Error('イベント情報の取得に失敗しました。');
      const eventData = await eventRes.json();
      setEvent(eventData);

      const commentsRes = await fetch(`/api/auth?path=/events/${eventId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData);
      }

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

  const handleDeleteEvent = async () => {
    if (!confirm('本当にこのイベントを削除しますか？')) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`/api/auth?path=/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'イベントの削除に失敗しました。');
      }

      alert('イベントを削除しました。');
      router.push('/events');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (statusType: 'attending' | 'bookmark' | 'none') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const isDelete = statusType === 'none';
      const method = isDelete ? 'DELETE' : 'POST';
      const res = await fetch(`/api/auth?path=/events/${eventId}/register`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: isDelete ? undefined : JSON.stringify({ status: statusType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'ステータスの更新に失敗しました。');
      }

      setMyStatus(statusType);
      alert(statusType === 'none' ? '登録を解除しました。' : 'ステータスを更新しました！');
      fetchData();
    } catch (err: any) {
      alert(err.message || '通信エラーが発生しました。');
    }
  };

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
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  const isCreator = currentUserId !== null && currentUserId === event.creator_id;
  const finished = new Date(event.end_time).getTime() < new Date().getTime();
  const isFull = event.attendee_count >= event.capacity;
  const parentComments = comments.filter(c => c.parent_id === null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900 tracking-tight cursor-pointer" onClick={() => router.push('/dashboard')}>
            📅 EventHub
          </span>
          <div className="flex items-center space-x-6">
            <button onClick={() => router.push('/dashboard')} className="cursor-pointer text-sm text-gray-600 hover:text-indigo-600 font-medium">
              ダッシュボード
            </button>
            <button onClick={() => router.push('/events')} className="cursor-pointer text-sm text-gray-600 hover:text-indigo-600 font-medium">
              イベント一覧
            </button>
            <button onClick={handleLogout} className="cursor-pointer text-sm text-gray-500 hover:text-red-600 font-medium transition-colors">
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* メインレイアウト */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* 💡 劇的改修：タイトルとアクションボタンを行分け（縦並び）にした詳細ヘッダーカード */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col space-y-4">
            
            {/* 1行目：ステータスバッジ */}
            <div className="flex items-center">
              {finished ? (
                <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-md">
                  終了しました
                </span>
              ) : isFull ? (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-md animate-pulse">
                  満員御礼
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md">
                  参加受付中
                </span>
              )}
            </div>

            {/* 2行目：イベントタイトル（ここだけで独立させて1行を贅沢に使用） */}
            <div>
              <h1 className={`text-xl md:text-3xl font-extrabold tracking-tight leading-snug ${
                finished ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}>
                {event.title}
              </h1>
            </div>

            {/* 3行目：詳細日時・場所・リアル参加状況の表示 */}
            <div className="text-xs md:text-sm text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p>👤 <strong>企画者・作成者:</strong> <span className="text-gray-800 font-bold">{event.creator_name}</span> {isCreator && <span className="text-indigo-600 font-semibold">(あなた)</span>}</p>
              <p>📍 <strong>開催場所:</strong> <span className="text-gray-800 font-medium">{event.location || '未設定'}</span></p>
              <p>🕒 <strong>開催期間:</strong> <span className="text-gray-800 font-medium">
                {new Date(event.start_time).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 
                &nbsp;〜&nbsp;
                {new Date(event.end_time).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span></p>
              <p>👥 <strong>参加状況:</strong> <span className={`font-bold ${isFull && !finished ? 'text-amber-600' : 'text-indigo-600'}`}>{event.attendee_count} / {event.capacity} 人</span></p>
              {event.description && (
                <div className="pt-2 border-t border-gray-200 mt-2 text-gray-700 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </div>
              )}
            </div>

            {/* 4行目：アクションボタンエリア（行を完全に分離） */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100 w-full">
              
              {/* 💡 一般参加者用アクション：イベントが終了していない場合のみ操作可能 */}
              {!finished ? (
                <>
                  <button
                    onClick={() => handleStatusChange(myStatus === 'attending' ? 'none' : 'attending')}
                    disabled={isFull && myStatus !== 'attending'}
                    className={`px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ${
                      myStatus === 'attending'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : isFull
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {myStatus === 'attending' ? '✓ 参加登録済み' : isFull ? '🚫 満員（受付停止）' : '🙋 このイベントに参加する'}
                  </button>

                  <button
                    onClick={() => handleStatusChange(myStatus === 'bookmark' ? 'none' : 'bookmark')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      myStatus === 'bookmark'
                        ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {myStatus === 'bookmark' ? '★ ブックマーク中' : '☆ ブックマークに追加'}
                  </button>

                  {myStatus !== 'none' && (
                    <button
                      onClick={() => handleStatusChange('none')}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      登録をキャンセル
                    </button>
                  )}
                </>
              ) : (
                /* 💡 終了ガード：終了している場合はメッセージを表示 */
                <p className="text-xs font-medium text-gray-400 py-1">
                  ※このイベントは既に終了しているため、参加登録やブックマークの変更はできません。
                </p>
              )}

              {/* 💡 主催者用アクション：自分が作ったイベントなら右端に綺麗に寄せる */}
              {isCreator && (
                <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto justify-end pt-2 sm:pt-0">
                  <button
                    onClick={() => router.push(`/events/${event.id}/edit`)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    📝 編集する
                  </button>
                  <button
                    onClick={handleDeleteEvent}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    🗑️ 削除する
                  </button>
                </div>
              )}
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
            <button type="submit" className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm">
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
                        className="cursor-pointer text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-1 transition-colors"
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
                        <button type="submit" className="cursor-pointer bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors">
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