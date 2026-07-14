'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface EventDetail {
  id: number;
  title: string;
  capacity: number;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  creator_id: number;
}

export default function EventEditPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  // フォームの状態管理
  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startHour, setStartHour] = useState('08');
  const [startMinute, setStartMinute] = useState('00');
  const [endDate, setEndDate] = useState('');
  const [endHour, setEndHour] = useState('17');
  const [endMinute, setEndMinute] = useState('00');

  // トークンから user_id をデコードするヘルパー
  const getUserIdFromToken = (token: string): number | null => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return payload.user_id ? Number(payload.user_id) : null;
    } catch (e) {
      return null;
    }
  };

  // 既存のイベントデータを読み込んでフォームにセットする
  useEffect(() => {
    const fetchEventData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const currentUserId = getUserIdFromToken(token);

      try {
        const res = await fetch(`/api/auth?path=/events/${eventId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('イベント情報の取得に失敗しました。');
        
        const data: EventDetail = await res.json();

        // 💡 UIガード：ログイン中のユーザーが作成者でない場合は編集不可にする
        if (currentUserId === null || currentUserId !== data.creator_id) {
          setError('自分が作成したイベント以外は編集できません。');
          setLoading(false);
          return;
        }

        // フォームの初期値をセット
        setTitle(data.title);
        setCapacity(data.capacity);
        setDescription(data.description || '');
        setLocation(data.location || '');

        // ISO日時文字列から「日付」「時」「分」を切り出してローカルのセレクトボックス等に適合させる
        const start = new Date(data.start_time);
        setStartDate(start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0'));
        setStartHour(String(start.getHours()).padStart(2, '0'));
        setStartMinute(String(start.getMinutes()).padStart(2, '0'));

        const end = new Date(data.end_time);
        setEndDate(end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-' + String(end.getDate()).padStart(2, '0'));
        setEndHour(String(end.getHours()).padStart(2, '0'));
        setEndMinute(String(end.getMinutes()).padStart(2, '0'));

      } catch (err: any) {
        setError(err.message || 'データの取得中にエラーが発生しました。');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEventData();
    }
  }, [eventId, router]);

  // 更新送信処理
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError('');
    setUpdateLoading(true);

    const token = localStorage.getItem('token');
    if (!token) return;

    if (!startDate || !endDate) {
      setUpdateError('日付を選択してください。');
      setUpdateLoading(false);
      return;
    }

    //日時の組み立て（ISO形式に変換して送る）
    const startTarget = new Date(startDate);
    startTarget.setHours(Number(startHour), Number(startMinute), 0, 0);
    const startIso = startTarget.toISOString();

    const endTarget = new Date(endDate);
    endTarget.setHours(Number(endHour), Number(endMinute), 0, 0);
    const endIso = endTarget.toISOString();

    try {
      // 💡 万能中継API経由で PUT リクエストを送信
      const res = await fetch(`/api/auth?path=/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          capacity: Number(capacity),
          description,
          location,
          start_time: startIso,
          end_time: endIso,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray(data.detail)) {
          const errorMessages = data.detail.map((err: any) => err.msg).join(' / ');
          throw new Error(errorMessages);
        }
        throw new Error(data.detail || 'イベントの更新に失敗しました。');
      }

      alert('イベントの情報を更新しました！');
      router.push(`/events/${eventId}`); // 詳細画面に戻る
    } catch (err: any) {
      setUpdateError(err.message || '通信エラーが発生しました。');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 font-medium animate-pulse">編集データを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-4">
        <p className="cursor-pointer text-red-500 font-bold">{error}</p>
        <button onClick={() => router.push(`/events/${eventId}`)} className="text-sm text-indigo-600 hover:underline">
          詳細画面に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">📝 イベントの編集</h1>
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="cursor-pointer text-sm text-gray-500 hover:text-gray-700"
          >
            キャンセル
          </button>
        </div>

        {updateError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded-r-md">
            <p className="text-xs text-red-700 font-medium">{updateError}</p>
          </div>
        )}

        <form onSubmit={handleUpdateEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">イベント名</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">定員 (人数)</label>
            <input
              type="number"
              required
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">開催場所</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">イベントの概要・説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">開始日時</label>
            <div className="flex space-x-2">
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <select
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const h = String(i).padStart(2, '0');
                  return <option key={h} value={h}>{h}時</option>;
                })}
              </select>
              <select
                value={startMinute}
                onChange={(e) => setStartMinute(e.target.value)}
                className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                {Array.from({ length: 60 }, (_, i) => {
                  const m = String(i).padStart(2, '0');
                  return <option key={m} value={m}>{m}分</option>;
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">終了日時</label>
            <div className="flex space-x-2">
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
              <select
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const h = String(i).padStart(2, '0');
                  return <option key={h} value={h}>{h}時</option>;
                })}
              </select>
              <select
                value={endMinute}
                onChange={(e) => setEndMinute(e.target.value)}
                className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                {Array.from({ length: 60 }, (_, i) => {
                  const m = String(i).padStart(2, '0');
                  return <option key={m} value={m}>{m}分</option>;
                })}
              </select>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={updateLoading}
              className="cursor-pointer w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {updateLoading ? '保存中...' : '変更を保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}