// src/index.ts
import express from "express";
import crypto from "crypto";
import { prisma } from "./lib/prisma.js";
import { verifyPasskeyRegistration ,registerPasskey} from "./helper.js";
import { loginPasskey } from "./helper.js";

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
// チャレンジ発行
app.post("/api/challenge", async (req, res) => {
  console.log(req.body);
  const username = req.body.username;
    const challenge = crypto.randomBytes(32).toString('base64url')
    const expiredAt = new Date(Date.now() + CHALLENGE_TTL_MS)
    // challengeをDBに保存
    await prisma.challenge.create({
      data: {
        username,
        challenge,
        expiredAt,
      },
    });
    //usernameを受け取ってchallengeを返す
    const challengeResponse = {
      challenge,
      rp: {
        name: 'localhost',
      },
      user: {
        id: username,
        name: username,
        displayName: username
      },
      pubKeyCredParams: PUB_KEY_CRED_PARAMS,
      // excludeCredentials: credentials.map(({ credentialId }) => ({ type: 'public-key', id: credentialId })),
      timeout: TIMEOUT_MS,
  }
  res.json({challengeResponse});
});

// パスキー登録
app.post("/api/register", async (req, res) => {
  try {
    console.log(req.body.credential);
    const credentialId = req.body.credential.id;
    const username = req.body.username;

    // usernameとcredentialを受け取ってchallengeを検証
    const verifiedRegistrationResponse = await verifyPasskeyRegistration(
      username,
      credentialId,
      req.body.challenge,
      req.body.credential.response.clientDataJSON,
      req.body.credential.response.attestationObject,
    );

    const registrationInfo = verifiedRegistrationResponse.registrationInfo;

    if (!registrationInfo) {
      return res.status(400).json({
        error: "Public key not found in registration response",
      });
    }
    console.log('publickey: ', registrationInfo.credential.publicKey);
    const registerResponse = await registerPasskey(
      credentialId,
      username,
      registrationInfo.credential.publicKey,
    );

    return res.json({ registerResponse });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Registration verification failed" });
  }
});

// ログイン
app.post("/api/login", async (req, res) => {
  // console.log('login body:',req.body);
  const challenge = req.body.challenge;
  const credential = req.body.credential;
  console.log('credential:', credential);
  const username = Buffer.from(credential.response.userHandle || '', 'base64').toString();
  const verifiedResponse = await loginPasskey({
    credential,
    username,
    challenge,
  });
  console.log('verifiedResponse', verifiedResponse);
  if (!verifiedResponse) {
    return res.status(400).json({ error: "Authentication verification failed" });
  }
  console.log('verifiedResponse.verified', verifiedResponse.verified);
  res.json({ verified: verifiedResponse.verified });
});

// サーバー起動
app.listen(port, () => {
  console.log(`Express server: http://localhost:${port}`);
});
