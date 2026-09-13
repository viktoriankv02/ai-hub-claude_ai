import type { DropHunterReport, ProjectOpportunity, ScoredOpportunity } from "./types.ts";

const WEIGHTS = {
  fundingEvidence: 15,
  developerProgram: 15,
  testnetActivity: 12,
  mainnetReadiness: 8,
  onchainVerifiability: 15,
  ecosystemActivity: 10,
  rewardSignals: 15,
  userFit: 5,
  timing: 5,
} as const;

function clamp(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function weighted(signals: ProjectOpportunity["signals"]): number {
  const entries = Object.entries(WEIGHTS) as Array<[keyof typeof WEIGHTS, number]>;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedScore = entries.reduce(
    (sum, [key, weight]) => sum + (clamp(signals[key]) / 100) * weight,
    0,
  );
  return Math.round((weightedScore / totalWeight) * 100);
}

function confidence(opportunity: ProjectOpportunity): number {
  const evidenceCount = opportunity.sources.length;
  const populatedSignals = Object.values(opportunity.signals).filter(
    (value) => value !== undefined,
  ).length;

  return Math.min(100, evidenceCount * 15 + populatedSignals * 8);
}

function reasons(opportunity: ProjectOpportunity): string[] {
  const { signals } = opportunity;
  const result: string[] = [];

  if ((signals.developerProgram ?? 0) >= 70) result.push("strong developer-program signal");
  if ((signals.testnetActivity ?? 0) >= 70) result.push("active testnet opportunity");
  if ((signals.rewardSignals ?? 0) >= 70) result.push("explicit reward/incentive signal");
  if ((signals.onchainVerifiability ?? 0) >= 70) result.push("actions are easy to verify on-chain");
  if ((signals.fundingEvidence ?? 0) >= 70) result.push("strong funding evidence");
  if ((signals.timing ?? 0) >= 70) result.push("good timing for early participation");
  if (opportunity.priority >= 90) result.push("first-priority target");

  return result;
}

export function scoreOpportunity(opportunity: ProjectOpportunity): ScoredOpportunity {
  return {
    ...opportunity,
    score: weighted(opportunity.signals),
    confidence: confidence(opportunity),
    reasons: reasons(opportunity),
  };
}

export function rankOpportunities(opportunities: ProjectOpportunity[]): ScoredOpportunity[] {
  return opportunities
    .map(scoreOpportunity)
    .sort((a, b) => b.score - a.score || b.priority - a.priority || a.name.localeCompare(b.name));
}

export function createReport(opportunities: ProjectOpportunity[]): DropHunterReport {
  return {
    generatedAt: new Date().toISOString(),
    opportunities: rankOpportunities(opportunities),
  };
}
