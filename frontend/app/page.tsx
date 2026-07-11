'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  
  // ログインモードか、アカウント作成モードかの切り替え状態
  const [isLogin, setIsLogin] = useState(true);
  
  // 入力フォームの状態管理
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // エラーやローディングの状態表示
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 💡 クラウド上のブラウザでも絶対に迷子にならないよう、自サーバーへの相対パスに変更
    const mode = isLogin ? 'login' : 'register';
    const apiUrl = `/api/auth?mode=${mode}`;
    
    // バックエンドの仕様に合わせてリクエストボディを構築
    const bodyData = isLogin 
      ? { username, password } 
      : { username, email, password };

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || '認証に失敗しました。');
      }

      // 💡 ログイン成功、またはアカウント作成成功時の処理
      if (isLogin) {
        // バックエンドから返ってきたアクセストークンを保存
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', username);
        
        // 無事に認証されたのでダッシュボードへ遷移
        router.push('/dashboard');
      } else {
        // アカウント作成が成功したら、自動的にログインモードに切り替える
        alert('アカウントを作成しました！ログインしてください。');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        {/* タイトル部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            📅 EventHub
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {isLogin ? 'アカウントにログインしてイベントを管理' : '新しくアカウントを作成して始めましょう'}
          </p>
        </div>

        {/* エラーメッセージ表示 */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              ユーザー名
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900"
              placeholder="yoshiyama"
            />
          </div>

          {/* アカウント作成時のみメールアドレス入力を表示 */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900"
                placeholder="example@email.com"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50 mt-2"
          >
            {loading ? '処理中...' : isLogin ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        {/* モード切り替えリンク */}
        <div className="text-center mt-6 pt-6 border-t border-gray-100 text-sm">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {isLogin ? '新規アカウントをお持ちでないですか？ 作成' : '既にアカウントをお持ちですか？ ログイン'}
          </button>
        </div>

      </div>
    </main>
  );
}