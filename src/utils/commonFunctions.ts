import crypto from "crypto";

/** Generates a cryptographically-random password that satisfies common policies. */
export const generateSecurePassword = (length = 12): string => {
  if (length < 4) throw new Error("Password length must be at least 4");

  const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const LOWER = "abcdefghijklmnopqrstuvwxyz";
  const NUMBERS = "0123456789";
  const SPECIAL = "!@#$%^&*()_+{}[]<>?";
  const ALL = UPPER + LOWER + NUMBERS + SPECIAL;

  const randomChar = (chars: string) => chars[crypto.randomInt(0, chars.length)];

  const password = [
    randomChar(UPPER),
    randomChar(LOWER),
    randomChar(NUMBERS),
    randomChar(SPECIAL),
  ];

  for (let i = password.length; i < length; i++) {
    password.push(randomChar(ALL));
  }

  for (let i = password.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
};
