const { webcrypto } = require("crypto");
const { subtle } = webcrypto;

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

// Get encryption key from environment or derive from JWT secret
async function getEncryptionKey(): Promise<CryptoKey> {
  const keySource = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!keySource) {
    throw new Error(
      "ENCRYPTION_KEY or JWT_SECRET environment variable must be set"
    );
  }

  // Derive a key from the key source using web crypto
  const keyMaterial = await subtle.importKey(
    "raw",
    Buffer.from(keySource.slice(0, 32)), // Use first 32 chars
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: Buffer.from("member-data-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a string value using AES-256-GCM
 */
async function encrypt(text: string): Promise<string> {
  if (!text) return text;

  const key = await getEncryptionKey();
  const iv = webcrypto.getRandomValues(new Uint8Array(16));

  const encrypted = await subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    Buffer.from(text, "utf8")
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return Buffer.from(combined).toString("hex");
}

/**
 * Decrypts a string value encrypted with the encrypt function
 */
async function decrypt(encryptedText: string): Promise<string> {
  if (!encryptedText) return encryptedText;

  try {
    const key = await getEncryptionKey();
    const encryptedData = Buffer.from(encryptedText, "hex");

    // Extract IV (first 16 bytes) and encrypted data
    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16);

    const decrypted = await subtle.decrypt(
      { name: "AES-CBC", iv },
      key,
      encrypted
    );

    return Buffer.from(decrypted).toString("utf8");
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypts member data fields that contain sensitive information
 */
async function encryptMemberData(member: {
  name: string;
  email: string;
  address?: string;
  lot: string;
}): Promise<{
  name: string;
  email: string;
  address?: string;
  lot: string;
}> {
  return {
    name: await encrypt(member.name),
    email: await encrypt(member.email),
    address: member.address ? await encrypt(member.address) : member.address,
    lot: await encrypt(member.lot), // Lot numbers might be considered sensitive too
  };
}

/**
 * Decrypts member data fields
 */
async function decryptMemberData(member: {
  name: string;
  email: string;
  address?: string;
  lot: string;
}): Promise<{
  name: string;
  email: string;
  address?: string;
  lot: string;
}> {
  return {
    name: await decrypt(member.name),
    email: await decrypt(member.email),
    address: member.address ? await decrypt(member.address) : member.address,
    lot: await decrypt(member.lot),
  };
}

export { encrypt, decrypt, encryptMemberData, decryptMemberData };
