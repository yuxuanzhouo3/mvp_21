export interface VerificationCodeEntry {
  code: string;
  expiresAt: number;
}

const verificationCodes = new Map<string, VerificationCodeEntry>();

export function getVerificationCode(phone: string) {
  return verificationCodes.get(phone);
}

export function setVerificationCode(phone: string, value: VerificationCodeEntry) {
  verificationCodes.set(phone, value);
}

export function clearVerificationCode(phone: string) {
  verificationCodes.delete(phone);
}

export function verifyVerificationCode(
  phone: string,
  code: string,
  options?: { allowAnyInDevelopment?: boolean },
) {
  const stored = verificationCodes.get(phone);

  if (!stored) {
    return Boolean(options?.allowAnyInDevelopment && process.env.NODE_ENV === "development");
  }

  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(phone);
    return false;
  }

  if (stored.code !== code) {
    return false;
  }

  verificationCodes.delete(phone);
  return true;
}
