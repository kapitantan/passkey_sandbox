export interface RegisterChallengeResponse {
  challenge: Base64URLString
  rp: {
    name: string
    id: string
  }
  user: {
    id: string
    name: string
    displayName: string
  }
  pubKeyCredParams: { type: 'public-key'; alg: -7 | -257 }[]
//   excludeCredentials: {
//     type: 'public-key'
//     id: Base64URLString
//   }[]
  timeout: number
}