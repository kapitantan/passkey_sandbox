import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "./lib/prisma.js";

const WEBAUTHN_RP_ID = "localhost";
const WEBAUTHN_ORIGIN = `http://${WEBAUTHN_RP_ID}:5173`;

export class AuthenticationError extends Error {}


const claimPasskeyChallenge = async (
  challenge: string,
  username: string,
): Promise<boolean> => prisma.challenge.deleteMany({
    where: {
      challenge,
      username,
      expiredAt: {
        gt: new Date(),
      },
    },
  })
  .then(({ count }) => count === 1)
  .catch((error) => {
    console.error(error);
    return false;
  });


const expectedChallenge = (validChallenges: Set<string>, matchedChallengeRef: { value?: string })  => 
    (challenge: string) : boolean => {
        if (!validChallenges.has(challenge)) {
            return false;
        }
        matchedChallengeRef.value = challenge;
        return true;
    };
//パスキー登録の検証
export const  verifyPasskeyRegistration = async (
  username: string,
  credentialId: string,
  challenge: string,
  clientDataJSON: string,
  attestationObject: string,
): Promise<VerifiedRegistrationResponse> => {
  // SimpleWebAuthn v6 の expectedChallenge は同期関数のみ受け取るため、
  // DBアクセスは検証前に完了させる。
  const storedChallenges = await prisma.challenge.findMany({
    where: {
      username,
      challenge,
      expiredAt: {
        gt: new Date(),
      },
    },
  });

  const validChallenges = new Set(
    storedChallenges.map(({ challenge }) => challenge),
  );
  const matchedChallengeRef: { value?: string } = {};
  console.log('validChallenges: ', validChallenges);
  console.log('matchedChallengeRef: ', matchedChallengeRef);
  const verifiedRegistrationResponse = await verifyRegistrationResponse({
    response: {
      id: credentialId,
      rawId: credentialId,
      response: {
        clientDataJSON,
        attestationObject,
      },
      clientExtensionResults: {},
      type: "public-key",
    },
    expectedChallenge: expectedChallenge(validChallenges, matchedChallengeRef),
    expectedOrigin: WEBAUTHN_ORIGIN,
    expectedRPID: WEBAUTHN_RP_ID,
  });

  if (!verifiedRegistrationResponse.verified || !matchedChallengeRef.value) {
    throw new Error("Registration verification failed");
  }
  const claimed = await claimPasskeyChallenge(matchedChallengeRef.value, username);
  if (!claimed) {
    throw new Error("Challenge has already been used");
  }

  return verifiedRegistrationResponse;
};
// パスキー登録処理
export const registerPasskey = async (
  credentialId: string,
  userId: string,
  username: string,
  publicKey: Uint8Array,
) => {
  return prisma.passkey.create({
    data: {
      credentialId,
      userId,
      username,
      // Prisma 7 の Bytes が要求する ArrayBuffer-backed Uint8Array にコピーする。
      publicKey: Uint8Array.from(publicKey),
    },
  });
};

const findPublicKey = async (
  credentialId: string,
  userId: string,
): Promise<Uint8Array<ArrayBuffer> | null> => {
  const passkeys = await prisma.passkey.findMany({ where: { userId } });
  const passkey = passkeys.find(({ credentialId: storedCredentialId }) => storedCredentialId === credentialId);
  if (!passkey) {
    return null;
  }

  const publicKey = new Uint8Array(passkey.publicKey.byteLength);
  publicKey.set(passkey.publicKey);
  return publicKey;
};

// パスキーログイン検証
export const loginPasskey = async ({
  credential,
  userId,
  challenge,
}: {
  credential: AuthenticationResponseJSON;
  userId: string;
  challenge: string;
}) => {
  // challenge発行時はユーザーがまだ分からないため、challengeだけで検索する。
  const storedChallenges = await prisma.challenge.findMany({
    where: {
      challenge,
      expiredAt: {
        gt: new Date(),
      },
    },
  });
  const validChallenges = new Set(
    storedChallenges.map(({ challenge }) => challenge),
  );
  const matchedChallengeRef: { value?: string } = {};
  console.log('validChallenges: ', validChallenges);
  console.log('matchedChallengeRef: ', matchedChallengeRef);
  console.log('userHandle:', userId);
  const publicKey = await findPublicKey(credential.id, userId);
  if (!publicKey) {
    throw new AuthenticationError("Public key not found for the given credential ID");
  }
  const verifiedAuthenticationResponse = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: expectedChallenge(validChallenges, matchedChallengeRef),
    expectedOrigin: WEBAUTHN_ORIGIN,
    expectedRPID: WEBAUTHN_RP_ID,
    credential:{
      id: credential.id,
      publicKey: publicKey,
      counter: 0, // You should retrieve the actual counter from your database for the given credential ID
    },
  }).catch(error => {
    console.error('failed verification:', error)
    return null
  });
  if (!verifiedAuthenticationResponse?.verified || !matchedChallengeRef.value) {
    throw new AuthenticationError("Authentication verification failed");
  }
  const claimed = await claimPasskeyChallenge(matchedChallengeRef.value, "");
  if (!claimed) {
    throw new AuthenticationError("Challenge has already been used");
  }

  return verifiedAuthenticationResponse;
};
