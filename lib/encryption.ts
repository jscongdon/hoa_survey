const { webcrypto } = require("crypto");
const { subtle } = webcrypto;
const nodeCrypto = require("crypto");

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
    Buffer.from(keySource, "hex").slice(0, 32), // Decode hex and take first 32 bytes
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
 * Encrypts a string value using AES-256-CBC
 */
async function encrypt(text: string, fixedIV?: string): Promise<string> {
  if (!text) return text;

  const key = await getEncryptionKey();
  let iv: Buffer | Uint8Array;
  if (fixedIV) {
    // Derive a 16-byte IV from the provided fixedIV string deterministically
    iv = nodeCrypto.createHash("sha256").update(fixedIV).digest().slice(0, 16);
  } else {
    iv = webcrypto.getRandomValues(new Uint8Array(16));
  }

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

    // If the data is too short to contain IV + encrypted data, assume plain text
    if (encryptedData.length <= 16) {
      return encryptedText;
    }

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
    // Assume the data is plain text if decryption fails
    return encryptedText;
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

/**
 * Encrypts admin data fields that contain sensitive information
 */
async function encryptAdminData(admin: {
  name?: string;
  email: string;
}): Promise<{
  name?: string;
  email: string;
}> {
  return {
    name: admin.name ? await encrypt(admin.name, 'admin-name-iv') : admin.name,
    email: await encrypt(admin.email, 'admin-email-iv'),
  };
}

/**
 * Decrypts admin data fields, handling both encrypted and plain text data
 */
async function decryptAdminData(admin: {
  name?: string;
  email: string;
}): Promise<{
  name?: string;
  email: string;
}> {
  const decryptField = async (field: string): Promise<string> => {
    try {
      return await decrypt(field);
    } catch (error) {
      // If decryption fails, assume it's plain text and return as-is
      return field;
    }
  };

  return {
    name: admin.name ? await decryptField(admin.name) : admin.name,
    email: await decryptField(admin.email),
  };
}

export {
  encrypt,
  decrypt,
  encryptMemberData,
  decryptMemberData,
  encryptAdminData,
  decryptAdminData,
};
