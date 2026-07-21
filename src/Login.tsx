// import base64url from 'base64url'
// const decodeBase64Url = (value: Base64URLString): Uint8Array<ArrayBuffer> => Uint8Array.from(base64url.toBuffer(value))
import type { RegisterChallengeResponse } from './models'
import { Buffer } from 'buffer'
import { useEffect, useState } from 'react'


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

type RawPasskey = {
    credentialId: string
    username: string
    publicKey?: { type?: string; data?: number[] } | string | null
    createdAt?: string
}

type DebugItem = {
    variable: string
    type: string
    value: string
}

const formatPublicKey = (publicKey: RawPasskey['publicKey']): string => {
    if (!publicKey) {
        return '-'
    }

    if (typeof publicKey === 'string') {
        return publicKey
    }

    if (publicKey.type === 'Buffer' && Array.isArray(publicKey.data)) {
        return `${publicKey.data.length} bytes`
    }

    return '-'
}

const formatDate = (value?: string): string => {
    if (!value) {
        return '-'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }

    return date.toLocaleString('ja-JP')
}

const formatDebugValue = (value: unknown): string => {
    if (typeof value === 'string') {
        return value
    }

    try {
        return JSON.stringify(
            value,
            (_key, currentValue) => {
                if (currentValue instanceof Uint8Array) {
                    return `Uint8Array(length=${currentValue.length})`
                }

                if (currentValue instanceof ArrayBuffer) {
                    return `ArrayBuffer(byteLength=${currentValue.byteLength})`
                }

                return currentValue
            },
            2,
        )
    } catch {
        return String(value)
    }
}

const getCredentialSummary = (credential: Credential | null): Record<string, unknown> | null => {
    if (!credential) {
        return null
    }

    const publicKeyCredential = credential as PublicKeyCredential
    const response = publicKeyCredential.response

    const summary: Record<string, unknown> = {
        id: publicKeyCredential.id,
        type: publicKeyCredential.type,
        rawId: `ArrayBuffer(byteLength=${publicKeyCredential.rawId.byteLength})`,
    }

    if ('attestationObject' in response && 'clientDataJSON' in response) {
        const attestationResponse = response as AuthenticatorAttestationResponse
        summary.response = {
            clientDataJSON: `ArrayBuffer(byteLength=${attestationResponse.clientDataJSON.byteLength})`,
            attestationObject: `ArrayBuffer(byteLength=${attestationResponse.attestationObject.byteLength})`,
        }
        return summary
    }

    if ('authenticatorData' in response && 'signature' in response) {
        const assertionResponse = response as AuthenticatorAssertionResponse
        summary.response = {
            clientDataJSON: `ArrayBuffer(byteLength=${assertionResponse.clientDataJSON.byteLength})`,
            authenticatorData: `ArrayBuffer(byteLength=${assertionResponse.authenticatorData.byteLength})`,
            signature: `ArrayBuffer(byteLength=${assertionResponse.signature.byteLength})`,
            userHandle: assertionResponse.userHandle
                ? `ArrayBuffer(byteLength=${assertionResponse.userHandle.byteLength})`
                : null,
        }
        return summary
    }

    summary.response = 'Unknown response format'
    return summary
}

const createArgumentSnippet = `navigator.credentials.create({
    publicKey: {
        challenge: new Uint8Array([/* challenge bytes */]),
        rp: { name: 'example.com' },
        user: {
            id: new Uint8Array([/* user id bytes */]),
            name: 'alice',
            displayName: 'Alice',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    },
})`

const getArgumentSnippet = `navigator.credentials.get({
    publicKey: {
        challenge: new Uint8Array([/* challenge bytes */]),
    },
})`


function Login() {
    const [username, setUsername] = useState('')
    const [passkeys, setPasskeys] = useState<RawPasskey[]>([])
    const [registerDebugItems, setRegisterDebugItems] = useState<DebugItem[]>([])
    const [loginDebugItems, setLoginDebugItems] = useState<DebugItem[]>([])

    const fetchPasskeys = async () => {
        const response = await fetch('/api/passkeys', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = await response.json()
        setPasskeys(data.passkeys ?? [])
    }

    useEffect(() => {
        fetchPasskeys()
    }, [])

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
        const createOptions = toCreationOptions(challengeResponse)
        //パスキー作成
        const publicKeyCredential = await navigator.credentials.create({ publicKey: createOptions })
        console.log('publicKeyCredential: ', publicKeyCredential)

        if (!publicKeyCredential) {
            setRegisterDebugItems([
                { variable: 'challenge', type: 'string', value: challengeResponse.challenge },
                { variable: 'createOptions', type: 'PublicKeyCredentialCreationOptions', value: formatDebugValue(createOptions) },
                { variable: 'credential', type: 'null', value: 'null' },
            ])
            return
        }

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

        setRegisterDebugItems([
            { variable: 'challenge', type: 'string', value: challengeResponse.challenge },
            { variable: 'createOptions', type: 'PublicKeyCredentialCreationOptions', value: formatDebugValue(createOptions) },
            {
                variable: 'credential',
                type: 'PublicKeyCredential',
                value: formatDebugValue(getCredentialSummary(publicKeyCredential)),
            },
            {
                variable: 'registerResponseJson',
                type: 'Record<string, unknown>',
                value: formatDebugValue(registerResponseJson),
            },
        ])

        await fetchPasskeys()
    }

    // simplewebauthnを使わないパスキーでのログイン
    const handleCustomPasskeyLogin = async () => {
        const challenge = await fetch('/api/challenge', {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username: ''}),
        })
        //チャレンジ発行
        // この時点ではusenameはまだわからない
        const {challengeResponse} = await challenge.json()
        console.log('challengeResponse: ', challengeResponse)
        const requestOptions = toRequestOptions(challengeResponse)
        //パスキーでのログイン
        // credential.getの返り値にはuserHandleが含まれるので、これを使ってusernameを取得する
        const credential = await navigator.credentials.get({ publicKey: requestOptions })
        console.log('credential: ', credential)

        if (!credential) {
            setLoginDebugItems([
                { variable: 'challenge', type: 'string', value: challengeResponse.challenge },
                { variable: 'getOptions', type: 'PublicKeyCredentialRequestOptions', value: formatDebugValue(requestOptions) },
                { variable: 'credential', type: 'null', value: 'null' },
            ])
            return
        }

        const loginResponse = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ challenge: challengeResponse.challenge, credential}),
        })
        const loginResponseJson = await loginResponse.json()
        console.log('loginResponseJson: ', loginResponseJson)

        setLoginDebugItems([
            { variable: 'challenge', type: 'string', value: challengeResponse.challenge },
            { variable: 'getOptions', type: 'PublicKeyCredentialRequestOptions', value: formatDebugValue(requestOptions) },
            {
                variable: 'credential',
                type: 'PublicKeyCredential',
                value: formatDebugValue(getCredentialSummary(credential)),
            },
            {
                variable: 'loginResponseJson',
                type: 'Record<string, unknown>',
                value: formatDebugValue(loginResponseJson),
            },
        ])

        if (loginResponseJson.verified) {
            alert('Login successful')
        }
    }

    return (
        <>
            <h1 className="login-title">login</h1>
            <div className="login-layout">
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
                    <div className="debug-panel">
                        <div className="debug-section">
                            <div className="debug-title">register output</div>
                            {registerDebugItems.length === 0 && <div className="debug-empty">no output yet</div>}
                            {registerDebugItems.map((item) => (
                                <div className="debug-row" key={`register-${item.variable}`}>
                                    <div className="debug-meta">{item.variable} : {item.type}</div>
                                    <pre className="debug-value">{item.value}</pre>
                                </div>
                            ))}
                        </div>
                        <div className="debug-section">
                            <div className="debug-title">login output</div>
                            {loginDebugItems.length === 0 && <div className="debug-empty">no output yet</div>}
                            {loginDebugItems.map((item) => (
                                <div className="debug-row" key={`login-${item.variable}`}>
                                    <div className="debug-meta">{item.variable} : {item.type}</div>
                                    <pre className="debug-value">{item.value}</pre>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="snippet-panel">
                        <pre className="snippet-block">{createArgumentSnippet}</pre>
                        <pre className="snippet-block">{getArgumentSnippet}</pre>
                    </div>
                </div>

                <div className="passkey-table-panel">
                    <table className="passkey-table">
                        <thead>
                            <tr>
                                <th>username</th>
                                <th>credentialId</th>
                                <th>publicKey</th>
                                <th>createdAt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {passkeys.length === 0 && (
                                <tr>
                                    <td colSpan={4}>no passkeys</td>
                                </tr>
                            )}
                            {passkeys.map((passkey) => (
                                <tr key={passkey.credentialId}>
                                    <td>{passkey.username}</td>
                                    <td>{passkey.credentialId}</td>
                                    <td>{formatPublicKey(passkey.publicKey)}</td>
                                    <td>{formatDate(passkey.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    )
}

export default Login