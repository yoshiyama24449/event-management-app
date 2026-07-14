# Codespacesで構築するKubernetes（Kind）開発ガイド

Docker Composeで動作するイベント管理アプリを、Codespaces上のローカルKubernetes（Kind）クラスターに移植して動作させるための手順書です。
---

## 🛠️ 1. ローカルツールのインストール

Codespacesの標準ターミナルで実行し、必要なCLIツールをセットアップします。

```bash
# kubectlのインストールと確認
curl -LO "[https://dl.k8s.io/release/$(curl](https://dl.k8s.io/release/$(curl) -L -s [https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl](https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl)"
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl
kubectl version --client

# Kindのインストールと確認
curl -Lo ./kind [https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64](https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64)
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
kind version
```

---

## 🏗️ 2. クラスターの作成

Codespaces内のDocker上で動作する軽量なKubernetesクラスターを起動します。

```bash
# クラスターの作成
kind create cluster --name event-cluster

# クラスター情報の確認
kubectl cluster-info
```

---

## 📦 3. イメージのビルドとクラスターへの転送

Docker Composeと違い、k8sはローカルのファイルを自動マウントしません。手元でビルドしたイメージをクラスター内にロードする必要があります。

```bash
# 1. Dockerイメージのビルド
docker build -t event-backend:latest ./backend
docker build -t event-frontend:latest ./frontend

# 2. ビルドしたイメージをKindクラスター内へロード
kind load docker-image event-backend:latest --name event-cluster
kind load docker-image event-frontend:latest --name event-cluster
```

### 💾 4. データベースの初期化（初回起動時のテーブル作成）

データの保存領域（PVC）を作成した直後はデータベースが空っぽのため、手動でSQLを流し込んで初期化します。

```bash
# 設定を読み込ませる方法
kubectl create configmap db-init-script --from-file=init.sql
```

```bash
# 一時的に手動でやる場合（マニフェスト適用後にやる）
# 1. DBのPod名を取得
DB_POD=$(kubectl get pods -l app=db -o jsonpath="{.items[0].metadata.name}")

# 2. init.sqlをコンテナ内のPostgreSQLへ流し込む
kubectl exec -i $DB_POD -- psql -U postgres -d event_db < init.sql
```

---

## 🚀 5. マニフェストの適用と起動

`k8s/` フォルダ配下に作成したYAMLファイル（マニフェスト）を一括で適用します。

```bash
# 全マニフェストの適用
kubectl apply -f k8s/

# 起動状態の確認（すべてのPodがRunningになるまで監視）
kubectl get pods --watch
```

> 💡 `--watch` や後述の `logs -f` を抜ける時は **`Ctrl + C`** を押します。

---

## 🔍 6. トラブルシューティング & ログ確認コマンド

アプリが動かない、エラーを吐いている場合に原因を突き止めるための必須コマンドです。

### 📋 ログの確認（基本）

```bash
# 特定のPodのログを表示する
kubectl logs <Pod名>

# Deployment単位でログを表示する（Pod名がランダムに変わっても追尾できて便利）
kubectl logs deployment/backend
kubectl logs deployment/db
kubectl logs deployment/frontend
```

### ⏱️ ログをリアルタイムで監視（追尾モード）

```bash
# `-f` (follow) オプションでログが流れるのをリアルタイム監視
kubectl logs deployment/backend -f
```

### 🚨 起動失敗・コンテナが途中で落ちる原因を探る

```bash
# Podが「Error」や「CrashLoopBackOff」の際、何が起きたかの詳細イベントを表示
kubectl describe pod <Pod名>
```

---

## 🌐 7. アプリへのアクセス（ポートフォワード）

ローカルPC（ブラウザ）からCodespaces上のKubernetesにアクセスするためにポートを通します。それぞれのポートで別ターミナルを開いて実行します。

```bash
# バックエンド (API) 用のポートフォワード (ターミナル1で実行)
kubectl port-forward service/backend 8000:8000

# フロントエンド用用のポートフォワード (ターミナル2で実行)
kubectl port-forward service/frontend 3000:3000
```

> 💡 VS Code (Codespaces) の「Ports」タブに表示される `3000` 番ポートのリンクからアプリにアクセスできます。

---

## 🧹 7. お片付け

作業を終了し、Codespacesのディスク容量やメモリを解放したい時はクラスターを削除します。

```bash
# クラスターの削除（マニフェスト等もすべて一括で消去されます）
kind delete cluster --name event-cluster
```