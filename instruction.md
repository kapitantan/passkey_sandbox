# Passkey検証環境の構築手順

React + TypeScript + Viteのフロントエンドと、Express + Prisma + PostgreSQLのバックエンドで、WebAuthn（パスキー）の登録・ログインを検証するための環境構築手順です。

## 前提環境

- Node.js
- Yarn Classic（v1系）
- Docker / Docker Compose

## ディレクトリ構成

```text
passkey/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── generated/prisma/
│   │   ├── lib/prisma.ts
│   │   └── index.ts
│   ├── .env
│   ├── package.json
│   ├── prisma.config.ts
│   └── tsconfig.json
├── src/
├── compose.yaml
├── package.json
└── vite.config.ts
```

## 1. フロントエンドの作成

```bash
yarn create vite
```

作成時の選択内容：

```text
Project name: passkey
Select a framework: React
Select a variant: TypeScript + React Compiler
Which linter to use?: ESLint
Install with yarn and start now?: Yes
```

必要に応じて、Base64URLの処理に使用するパッケージを追加します。

```bash
cd passkey
yarn add -D base64url buffer
```

## 2. バックエンドの作成

```bash
mkdir backend
cd backend
yarn init -y
```

依存パッケージをインストールします。

```bash
yarn add express dotenv @simplewebauthn/server
yarn add @prisma/client @prisma/adapter-pg pg
yarn add -D typescript tsx prisma
yarn add -D @types/node @types/express @types/pg
```

`backend/package.json` にES Modulesの設定とスクリプトを追加します。

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

TypeScript設定を作成します。

```bash
yarn tsc --init
```

`backend/tsconfig.json` では、少なくとも次の設定を使用します。

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}
```

`module: "nodenext"` を使用するため、バックエンド内の相対importには `.js` を付けます。

```ts
import { prisma } from "./lib/prisma.js";
```

## 3. PostgreSQLの作成

プロジェクト直下に `compose.yaml` を作成します。

```yaml
services:
  postgres:
    image: postgres:17
    container_name: passkey-postgres
    environment:
      POSTGRES_USER: passkey_user
      POSTGRES_PASSWORD: passkey_password
      POSTGRES_DB: passkey_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        - CMD-SHELL
        - pg_isready -U passkey_user -d passkey_db
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

PostgreSQLを起動します。

```bash
docker compose up -d
docker compose ps
```

PostgreSQLへ直接接続する場合：

```bash
docker compose exec postgres psql -U passkey_user -d passkey_db
```

## 4. Prismaの初期化

`backend` ディレクトリで実行します。

```bash
cd backend
yarn prisma init --datasource-provider postgresql
```

`backend/.env` に接続先を設定します。

```dotenv
DATABASE_URL="postgresql://passkey_user:passkey_password@localhost:5432/passkey_db"
```

Prisma 7の `backend/prisma.config.ts`：

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

`backend/prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Challenge {
  challenge String   @id
  expiredAt DateTime @map("expires_at")
  username  String

  @@index([username])
  @@index([expiredAt])
  @@map("challenges")
}

model Passkey {
  credentialId String   @id @map("credential_id")
  username     String
  publicKey    Bytes    @map("public_key")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([username])
  @@map("passkeys")
}
```

マイグレーションとPrisma Client生成を実行します。

```bash
yarn prisma migrate dev --name init
yarn prisma generate
```

スキーマだけをDBへ反映する場合は、次のコマンドも使用できます。

```bash
yarn prisma db push
```

既存DBの構造を取得する場合：

```bash
yarn prisma db pull
```

## 5. Prisma Clientの作成

`backend/src/lib/prisma.ts`：

```ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});
```

## 6. ViteからExpressへのプロキシ

フロントエンドから `/api` で始まるリクエストをExpressへ転送するため、`vite.config.ts` にプロキシを設定します。

```ts
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

例えば、ブラウザから `http://localhost:5173/api/health` へ送ったリクエストは、`http://localhost:3000/api/health` へ転送されます。

## 7. 開発環境の起動

ターミナル1（PostgreSQL）：

```bash
docker compose up -d
```

ターミナル2（Express）：

```bash
cd backend
yarn dev
```

ターミナル3（Vite）：

```bash
yarn dev
```

アクセス先：

- フロントエンド: `http://localhost:5173`
- バックエンド: `http://localhost:3000`
- ヘルスチェック: `http://localhost:5173/api/health`

## 8. 動作確認

バックエンドの型チェック：

```bash
cd backend
yarn typecheck
```

フロントエンドのビルド：

```bash
yarn build
```

PostgreSQLのテーブル確認：

```bash
docker compose exec postgres psql -U passkey_user -d passkey_db
```

```sql
\dt
SELECT * FROM challenges;
SELECT * FROM passkeys;
```

## WebAuthnのローカル開発設定

ローカル開発時は次の値を使用します。

```ts
const expectedOrigin = "http://localhost:5173";
const expectedRPID = "localhost";
```

- `expectedOrigin` はフロントエンドのURLです。スキームとポートを含めて完全一致させます。
- `expectedRPID` にはスキームとポートを含めません。
- `localhost` はローカル開発に限り、HTTPでもWebAuthnを利用できます。

## 実装時の注意点

- Prismaのコードでは `credentialId`、`publicKey`、`createdAt` のようなモデルのフィールド名を使用します。`credential_id` などはDB上のカラム名です。
- WebAuthnの公開鍵は `Bytes` として保存します。SimpleWebAuthnが返す `credentialPublicKey` を使用します。
- Prisma 7の `Bytes` に渡す際に型が合わない場合は、`Uint8Array.from(credentialPublicKey)` で `ArrayBuffer` を基盤とするバイト列へコピーします。
- `@simplewebauthn/server` v6の `expectedChallenge` コールバックは同期的な `boolean` を返す必要があります。非同期のDB検索をコールバックへ直接渡さないでください。
- challengeはDBで有効期限を確認し、登録成功時に削除して再利用を防止します。
- 認証処理を追加するときは、公開鍵だけでなく署名カウンターもDBへ保存・更新します。

