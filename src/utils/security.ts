import { AES, enc } from 'crypto-js';

const ENCRYPTION_KEY = 'your-secret-key';  // In production, use environment variable

export const encryptData = (data: any): string => {
  return AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
};

export const decryptData = (encryptedData: string): any => {
  try {
    const bytes = AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedString = bytes.toString(enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return null;
  }
};

export const generateToken = (userId: string, role: string): string => {
  const payload = {
    userId,
    role,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  return encryptData(payload);
};

export const verifyToken = (token: string): boolean => {
  try {
    const payload = decryptData(token);
    if (!payload) return false;
    
    // Check if token is expired
    if (payload.exp < Date.now()) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};
