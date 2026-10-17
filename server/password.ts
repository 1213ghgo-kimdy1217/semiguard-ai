import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, salt, storedHex] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/i.test(salt ?? "") || !/^[a-f0-9]{128}$/i.test(storedHex ?? "")) return false;
  return timingSafeEqual(Buffer.from(storedHex, "hex"), scryptSync(password, salt, 64));
}
