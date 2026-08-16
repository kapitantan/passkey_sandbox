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
  timeout: number
  excludeCredentials: {
    type: 'public-key'
    id: Base64URLString
    transports?: Array< "ble" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb" >
    // transports?: ( "ble" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb" )[]
  }[]
  authenticatorSelection?: {
    authenticatorAttachment?: "platform" | "cross-platform",
    residentKey?: "discouraged" | "preferred" | "required",
    userVerification?: "discouraged" | "preferred" | "required",
  },
  attestation?: "none" | "indirect" | "direct" | "enterprise",
  userVerification?: "discouraged" | "preferred" | "required",
  rpId?: string
}