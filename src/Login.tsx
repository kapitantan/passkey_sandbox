// import base64url from 'base64url'
// const decodeBase64Url = (value: Base64URLString): Uint8Array<ArrayBuffer> => Uint8Array.from(base64url.toBuffer(value))
import type { RegisterChallengeResponse } from './models'
import { Buffer } from 'buffer'
import { useState } from 'react'


const decodeBase64Url = (value: Base64URLString): Uint8Array<ArrayBuffer> => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')

    return Uint8Array.from(Buffer.from(base64, 'base64'))
}

// credential.create用のPublicKeyCredentialCreationOptionsに変換する関数
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

// credential.get用のPublicKeyCredentialRequestOptionsに変換する関数
const toRequestOptions = (challengeResponse: RegisterChallengeResponse): PublicKeyCredentialRequestOptions => ({
  challenge: decodeBase64Url(challengeResponse.challenge),
  timeout: challengeResponse.timeout,
  rpId: challengeResponse.rp.id,
  userVerification: 'required',
  // allowCredentials: challengeResponse.allowCredentials.map(({ type, id }) => ({ type, id: decodeBase64Url(id) })),
})


function Login() {
    const [username, setUsername] = useState('')

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
            body: JSON.stringify({username: username}),
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
            body: JSON.stringify({username: username, challenge: challengeResponse.challenge, credential: publicKeyCredential}),
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
            body: JSON.stringify({username: username}),
        })
        //チャレンジ発行
        const {challengeResponse} = await challenge.json()
        console.log('challengeResponse: ', challengeResponse)
        //パスキーでのログイン
        const credential = await navigator.credentials.get({ publicKey: toRequestOptions(challengeResponse) })
        console.log('credential: ', credential)
        const loginResponse = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username: username, challenge: challengeResponse.challenge, credential}),
        })
        const loginResponseJson = await loginResponse.json()
        console.log('loginResponseJson: ', loginResponseJson)
        if (loginResponseJson.verified) {
            alert('Login successful')
        }
    }

    return (
        <>
            <h1>login</h1>
            <div className="button-container">
                <button onClick={handleHealthClick}>health</button>
                <div className="register-container">
                    <form onSubmit={(e) => {
                        e.preventDefault()
                        handleCustomRegisterClick()
                    }}>
                    <button type="submit">passkey register</button>
                    <input 
                        type="text" 
                        id="username" 
                        name="username" 
                        value={username} 
                        onChange={(e) => 
                            setUsername(e.target.value)
                        } 

                        required
                    />
                    </form>
                </div>
                <button onClick={handleCustomPasskeyLogin}>passkey login</button>
            </div>
        </>
    )
}

export default Login