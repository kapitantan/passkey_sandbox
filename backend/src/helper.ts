import { verifyRegistrationResponse, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "./lib/prisma.js";

const WEBAUTHN_RP_ID = "localhost";
const WEBAUTHN_ORIGIN = `http://${WEBAUTHN_RP_ID}:5173`;

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
  .then(() => true)
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
export const verifyPasskeyRegistration = async (
  username: string,
  credentialId: string,
  challenge: string,
  clientDataJSON: string,
  attestationObject: string,
) => {
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
  username: string,
  publicKey: Uint8Array,
) => {
  return prisma.passkey.create({
    data: {
      credentialId,
      username,
      // Prisma 7 の Bytes が要求する ArrayBuffer-backed Uint8Array にコピーする。
      publicKey: Uint8Array.from(publicKey),
    },
  });
};

const findPublicKey = async (credentialId: string, username: string): Promise<Uint8Array | null> => {
  const passkey = await prisma.passkey.findUnique({
    where: {
      credentialId,
      username,
    },
  });
  return passkey ? Uint8Array.from(passkey.publicKey) : null;
};

// パスキーログイン検証
export const loginPasskey = async ({ credential, username, challenge }: { credential: any; username: string; challenge: string }) => {
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
  const publicKey = await findPublicKey(credential.id, username);
  if (!publicKey) {
    throw new Error("Public key not found for the given credential ID");
  }
  const verifiedAuthenticationResponse = await verifyAuthenticationResponse({
    response: {
      id: credential.id,
      rawId: credential.rawId,
      response: credential.response,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.clientExtensionResults,
      type: credential.type,
    },
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
    throw new Error("Authentication verification failed");
  }
  const claimed = await claimPasskeyChallenge(matchedChallengeRef?.value, username);
  if (!claimed) {
    throw new Error("Challenge has already been used");
  }

  return verifiedAuthenticationResponse;
};