// src/index.ts
import express from "express";
import crypto from "crypto";
import { prisma } from "./lib/prisma.js";
import { verifyPasskeyRegistration ,registerPasskey} from "./helper.js";
import { loginPasskey, AuthenticationError } from "./helper.js";

const app = express();
const port = 3000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PUB_KEY_CRED_PARAMS = [
  { type: 'public-key', alg: -7 },
  { type: 'public-key', alg: -257 },
]
const TIMEOUT_MS = 60 * 1000


// JSON形式のリクエストボディを読み取れるようにする
app.use(express.json());

// 動作確認用API
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
  });
});
// パスキー一覧取得
app.get("/api/passkeys", async (req, res) => {
  const passkeys = await prisma.passkey.findMany({})
  res.json({ passkeys });
});

// チャレンジ一覧取得
app.get("/api/challenges", async (_req, res) => {
  const challenges = await prisma.challenge.findMany({
    orderBy: {
      expiredAt: 'asc',
    },
  });
  res.json({ challenges });
});

// チャレンジ一括削除
app.delete("/api/challenges", async (_req, res) => {
  const result = await prisma.challenge.deleteMany({});
  res.json({ deletedCount: result.count });
});
// チャレンジ発行
app.post("/api/challenge", async (req, res) => {
  console.log(req.body);
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const challenge = crypto.randomBytes(32).toString("base64url");
  const expiredAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const passkeys = username
    ? await prisma.passkey.findMany({ where: { username } })
    : [];
  const userId = passkeys[0]?.userId ?? crypto.randomBytes(16).toString("base64url");
  console.log("passkeys: ", passkeys);
  // challengeをDBに保存
  await prisma.challenge.create({
    data: {
      username,
      userId,
      challenge,
      expiredAt,
    },
  });
  // usernameを受け取ってchallengeを返す
  const challengeResponse = {
    challenge,
    rp: {
      // id: 'localhost',
      name: "passkey_sandbox",
    },
    user: {
      id: userId,
      name: username,
      displayName: "displayName:" + username,
    },
    pubKeyCredParams: PUB_KEY_CRED_PARAMS,
    excludeCredentials: passkeys.map(({ credentialId }) => ({ type: "public-key", id: credentialId })),
    timeout: TIMEOUT_MS,
  }
  res.json({challengeResponse});
});

// パスキー登録
app.post("/api/register", async (req, res) => {
  try {
    console.log('body keyof:', Object.keys(req.body));
    console.log('credential keyof:', Object.keys(req.body.credential));
    const credentialId = req.body.credential.id;
    const username = req.body.username;
    const challenge = req.body.challenge;

    const registrationChallenge = await prisma.challenge.findFirst({
      where: {
        challenge,
        username,
        expiredAt: {
          gt: new Date(),
        },
      },
    });
    if (!registrationChallenge?.userId) {
      return res.status(400).json({ error: "Invalid registration challenge" });
    }

    // usernameとcredentialを受け取ってchallengeを検証
    const verifiedRegistrationResponse = await verifyPasskeyRegistration(
      username,
      credentialId,
      challenge,
      req.body.credential.response.clientDataJSON,
      req.body.credential.response.attestationObject,
    );
    console.log('verifiedRegistrationResponse keyof:', Object.keys(verifiedRegistrationResponse));

    const registrationInfo = verifiedRegistrationResponse.registrationInfo;
    if (!registrationInfo) {
      return res.status(400).json({
        error: "Public key not found in registration response",
      });
    }
    console.log('registrationInfo keyof:', Object.keys(registrationInfo));

    const registerResponse = await registerPasskey(
      credentialId,
      registrationChallenge.userId,
      username,
      registrationInfo.credential.publicKey,
    );
    console.log('registerResponse:', Object.keys(registerResponse));
    return res.json({ registerResponse });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Registration verification failed" });
  }
});

// ログイン
app.post("/api/login", async (req, res) => {
  const challenge = req.body?.challenge;
  const credential = req.body?.credential;
  console.log('credential:', credential);

  if (typeof challenge !== "string" || !credential?.id || !credential?.response) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const userId = credential.response.userHandle;
  if (typeof userId !== "string" || !userId) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  try {
    const verifiedResponse = await loginPasskey({ credential, userId, challenge });
    console.log('verifiedResponse.verified', verifiedResponse.verified);
    return res.json({ verified: verifiedResponse.verified });
  } catch (error) {
    console.error(error);
    // 失敗理由を返すとクレデンシャル列挙に使われるため、認証失敗はすべて同じ応答にする
    if (error instanceof AuthenticationError) {
      return res.status(401).json({ error: "Authentication failed" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// サーバー起動
app.listen(port, () => {
  console.log(`Express server: http://localhost:${port}`);
});
