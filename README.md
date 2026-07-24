# Passkey Sandbox

WebAuthn（パスキー）の登録・ログインフローを検証するためのサンドボックスリポジトリ。

## 技術スタック

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript (tsx)
- **DB**: PostgreSQL 17 (Docker)
- **ORM**: Prisma

## 起動方法

### 1. DB（PostgreSQL）

```bash
docker compose up -d
```

コンテナ名: `passkey-postgres` / ポート: `5432`

### 2. Backend

```bash
cd backend
yarn install
yarn dev
```

`http://localhost:3000` で起動。初回はマイグレーションを適用する:

```bash
npx prisma migrate dev
```

### 3. Frontend

```bash
# プロジェクトルートで
yarn install
yarn dev
```

`http://localhost:5173` で起動。

## 環境変数

`backend/.env` に以下を設定:

```env
DATABASE_URL="postgresql://passkey_user:passkey_password@localhost:5432/passkey_db"
```
