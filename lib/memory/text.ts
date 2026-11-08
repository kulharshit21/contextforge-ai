// Shared tokenization used by ranking (tiered-context) and near-duplicate
// detection (simhash). Both must see identical tokens for a given text.
export const STOP_WORDS = new Set(
  "the and for with from that this into about your then were when will have should could using project code files need all".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g) || []).filter(
    (token) => !STOP_WORDS.has(token),
  );
}
