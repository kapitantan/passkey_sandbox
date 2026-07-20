// import base64url from 'base64url'
// const decodeBase64Url = (value: Base64URLString): Uint8Array<ArrayBuffer> => Uint8Array.from(base64url.toBuffer(value))
import type { RegisterChallengeResponse } from './models'
import { Buffer } from 'buffer'
const decodeBase64Url = (value: Base64URLString): Uint8Array<ArrayBuffer> => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')

    return Uint8Array.from(Buffer.from(base64, 'base64'))
}


const toCreationOptions = (challengeResponse: RegisterChallengeResponse): PublicKeyCredentialCreationOptions => ({
  challenge: decodeBase64Url(challengeResponse.challenge),
//   excludeCredentials: challengeResponse.excludeCredentials.map(({ type, id }) => ({ type, id: decodeBase64Url(id) })),
  rp: challengeResponse.rp,
  pubKeyCredParams: challengeResponse.pubKeyCredParams,
  timeout: challengeResponse.timeout,
  user: {
    id: new TextEncoder().encode(challengeResponse.user.id),
    name: challengeResponse.user.name,
    displayName: challengeResponse.user.displayName,
  },
})



function Login() {
    // health check
    const handleHealthClick = async () => {
        const response = await fetch('/api/health', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
        })
        console.log(response)
        alert(`${response.status}: ${response.statusText}`)
    }

    // simplewebauthnを使わないパスキー登録
    const handleCustomRegisterClick = async () => {
        const response = await fetch('/api/challenge', {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username: 'testuser'}),
        })
        //チャレンジ発行
        const {challengeResponse} = await response.json()
        console.log('challengeResponse: ', challengeResponse)
        //パスキー作成
        const publicKeyCredential = await navigator.credentials.create({ publicKey: toCreationOptions(challengeResponse) })
        console.log('publicKeyCredential: ', publicKeyCredential)
        //パスキー登録
        const registerResponse = await fetch('/api/register', {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username: 'testuser', credential: publicKeyCredential}),
        })
        const registerResponseJson = await registerResponse.json()
        console.log('registerResponseJson: ', registerResponseJson)
    }

    // simplewebauthnを使わないパスキーでのログイン
    const handleCustomPasskeyLogin = async () => {
        const challenge = await fetch('/api/challenge', {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username: 'testuser'}),
        })
        //チャレンジ発行
        const {challengeResponse} = await challenge.json()
        console.log('challengeResponse: ', challengeResponse)
        //パスキーでのログイン
        const credential = await navigator.credentials.get({ publicKey: toCreationOptions(challengeResponse) })
        console.log('credential: ', credential)
        const loginResponse = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username: 'testuser'}),
        })

        console.log(loginResponse)
    }

    return (
        <>
            <h1>login</h1>
            <div className="button-container">
                <button onClick={handleHealthClick}>health</button>
                <button onClick={handleCustomRegisterClick}>register</button>
                <button onClick={handleCustomPasskeyLogin}>passkey login</button>
            </div>
        </>
    )
}

export default Login