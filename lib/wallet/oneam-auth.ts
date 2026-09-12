/**
 * 1AM wallet authentication for VeilPay merchant login.
 *
 * Uses the same key scheme as the 1am.xyz gateway: the NightExternal role key
 * derived from the wallet seed via @midnight-ntwrk/wallet-sdk-hd, signing a
 * challenge with BIP-340 Schnorr. The seed never leaves the browser — only the
 * public key and signature are sent to the server.
 */

export interface WalletKeys {
  secretKey: Uint8Array
  /** 33-byte compressed BIP-340 public key, hex encoded. */
  publicKey: string
}

export interface LoginSignature {
  signature: string
  publicKey: string
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Accepts either a 64-character hex seed or a 12/24-word BIP-39 recovery
 * phrase and returns the raw seed bytes for HD derivation.
 */
async function normalizeSeed(input: string): Promise<Uint8Array> {
  const trimmed = input.trim().replace(/\s+/g, ' ')

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  const words = trimmed.toLowerCase().split(' ').filter(Boolean)
  if (words.length === 12 || words.length === 24) {
    const [{ validateMnemonic, mnemonicToSeed }, { wordlist }] = await Promise.all([
      import('@scure/bip39'),
      import('@scure/bip39/wordlists/english.js'),
    ])
    const mnemonic = words.join(' ')
    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new Error('That recovery phrase is not valid. Check the words and try again.')
    }
    return mnemonicToSeed(mnemonic)
  }

  throw new Error('Enter a 64-character hex seed or a 12/24-word recovery phrase.')
}

/** Derive the NightExternal signing key, exactly as the gateway does. */
export async function deriveWalletKeys(seedInput: string): Promise<WalletKeys> {
  const seedBytes = await normalizeSeed(seedInput)
  const [{ HDWallet, Roles }, { schnorr }] = await Promise.all([
    import('@midnight-ntwrk/wallet-sdk-hd'),
    import('@noble/curves/secp256k1.js'),
  ])

  const hd = HDWallet.fromSeed(seedBytes)
  if (hd.type !== 'seedOk') throw new Error('Invalid wallet seed.')
  const derived = hd.hdWallet.selectAccount(0).selectRoles([Roles.NightExternal]).deriveKeysAt(0)
  if (derived.type !== 'keysDerived') throw new Error('Wallet key derivation failed.')

  const secretKey = derived.keys[Roles.NightExternal]
  if (!secretKey) throw new Error('NightExternal key not found in wallet derivation.')

  return { secretKey, publicKey: bytesToHex(schnorr.getPublicKey(secretKey)) }
}

/** Generate a fresh 24-word BIP-39 recovery phrase. */
export async function generateRecoveryPhrase(): Promise<string> {
  const [{ generateMnemonic }, { wordlist }] = await Promise.all([
    import('@scure/bip39'),
    import('@scure/bip39/wordlists/english.js'),
  ])
  return generateMnemonic(wordlist, 256)
}

/** Challenge message format, mirroring the gateway's 1AM-AUTH-v1 scheme. */
export function buildLoginMessage(nonce: string, timestamp: number): string {
  return `VEILPAY-AUTH-v1\nveilpay.app\n${nonce}\n${timestamp}`
}

/** Sign the login challenge with the wallet's NightExternal key. */
export async function signLoginMessage(
  secretKey: Uint8Array,
  message: string,
): Promise<LoginSignature> {
  const [{ schnorr }, { sha256 }] = await Promise.all([
    import('@noble/curves/secp256k1.js'),
    import('@noble/hashes/sha2.js'),
  ])
  const messageHash = sha256(new TextEncoder().encode(message))
  const signature = schnorr.sign(messageHash, secretKey)
  return { signature: bytesToHex(signature), publicKey: bytesToHex(schnorr.getPublicKey(secretKey)) }
}

/** Short display form of a wallet public key: 0x1234…abcd */
export function shortPublicKey(publicKey: string): string {
  if (publicKey.length < 12) return publicKey
  return `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`
}
