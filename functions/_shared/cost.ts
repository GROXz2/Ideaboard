const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.0000005, out: 0.0000015 },
};

export function calcCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o-mini"];
  const cost = tokensIn * pricing.in + tokensOut * pricing.out;
  return Math.round(cost * 10000) / 10000;
}
