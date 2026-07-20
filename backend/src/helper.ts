import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { prisma } from "./lib/prisma.js";

const WEBAUTHN_RP_ID = 'localhost'

const claimPasskeyChallenge =  async (challenge: string): boolean => {
    const [storedChallenges] = await prisma.challenge.findMany({
        where: {
            challenge,
            expiredAt: {
                gt: new Date(),
            },
        },
    });
    console.log('storedChallenges',storedChallenges)
    if (storedChallenges) {
        // challengeが有効であればDBから削除
        await prisma.challenge.delete({
            where: {
                challenge: storedChallenges.challenge,
            },
        });
        return true;
    }
    return false;
};

export const verifyPasskeyRegistration = (credentialId:string, clientDataJSON: string, attestationObject: string) => {
    const credentialResponse = {
      id: credentialId,
      rawId: credentialId,
      response: { clientDataJSON, attestationObject },
      clientExtensionResults: {},
      type: 'public-key',
    }
    const expectedOrigin = `http://${WEBAUTHN_RP_ID}:5173`
    const expectedRPID = WEBAUTHN_RP_ID
    
    return verifyRegistrationResponse({
        credential: credentialResponse,
        expectedChallenge:claimPasskeyChallenge,// ((challenge: string) => boolean)
        expectedOrigin,
        expectedRPID,
      }).then(verifiedRegistrationResponse => {
        if (!verifiedRegistrationResponse.verified) {
          throw new Error('Registration verification failed')
        }
        // console.log('Registration verified successfully:', verifiedRegistrationResponse)
        return verifiedRegistrationResponse
      })
      .catch(error => {
        console.error(error)
        return null
      })
  }

export const registerPasskey = async (credentialId: string, username: string, publicKey: Uint8Array) => {
    const passkey = await prisma.passkey.create({
        data: {
            credentialId: credentialId,
            username,
            publicKey: publicKey,
            createdAt: new Date(),
        },
    });
    return passkey;
}