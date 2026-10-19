// Lightweight publish-time safety screening. Not a complete trust-and-safety system.
// Terms identifying a race, nationality or identity are NOT prohibited on their own.
const profanity = /\b(?:fuck(?:ing|ed|er|s)?|shit(?:ty)?|bitch(?:es)?|cunt|nigg(?:er|a)s?)\b/i;
const directedAbuse = /\b(?:kill|exterminate|attack|hurt)\s+(?:all\s+)?(?:women|men|black people|white people|asian people|jewish people|muslims|gay people)\b/i;
export function moderationReason(...fields:(unknown)[]): string | null {
  const content = fields.filter(s=>typeof s==="string").join(" ").slice(0,12500);
  if (directedAbuse.test(content)) return "Threatening or identity-targeted abuse";
  if (profanity.test(content)) return "Profanity or potentially hateful language";
  return null;
}
