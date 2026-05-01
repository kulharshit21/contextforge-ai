export function estimateTokensFromText(input: string) {
  return Math.max(1, Math.ceil(input.length / 4));
}

export function estimateSavings(rawText: string, capsuleText: string) {
  const estimatedRawTokens = estimateTokensFromText(rawText);
  const estimatedCapsuleTokens = estimateTokensFromText(capsuleText);
  const savedPercent =
    estimatedRawTokens <= 0
      ? 0
      : Number(
          (
            ((estimatedRawTokens - estimatedCapsuleTokens) / estimatedRawTokens) *
            100
          ).toFixed(1),
        );

  return {
    estimatedRawTokens,
    estimatedCapsuleTokens,
    savedPercent: Math.max(0, savedPercent),
  };
}
