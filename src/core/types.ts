export type OpportunityStage = "research" | "testnet" | "mainnet" | "builder-program" | "incentivized";

export interface OpportunitySignals {
  fundingUsd?: number;
  fundingEvidence?: number;
  developerProgram?: number;
  testnetActivity?: number;
  mainnetReadiness?: number;
  onchainVerifiability?: number;
  ecosystemActivity?: number;
  rewardSignals?: number;
  userFit?: number;
  timing?: number;
}

export interface ProjectOpportunity {
  id: string;
  name: string;
  chainId?: number;
  vm: "EVM" | "SUI" | "CUSTOM";
  stage: OpportunityStage;
  priority: number;
  signals: OpportunitySignals;
  sources: string[];
  actions: string[];
  notes?: string;
}

export interface ScoredOpportunity extends ProjectOpportunity {
  score: number;
  confidence: number;
  reasons: string[];
}

export interface DropHunterReport {
  generatedAt: string;
  opportunities: ScoredOpportunity[];
}
