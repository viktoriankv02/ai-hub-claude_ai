import { scoreOpportunity } from './core/scorer.ts';
import { networks } from './networks.mjs';

export function requiredText(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label}: потрібно від 1 до ${max} символів`);
  return value.trim();
}
export function httpsUrl(value) {
  const url = new URL(requiredText(value, 'URL', 2000));
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Потрібне HTTPS-посилання без облікових даних');
  return url.href;
}
export function validateProject(input) {
  if (!input || typeof input !== 'object') throw new Error('Некоректний проєкт');
  const name = requiredText(input.name, 'Назва', 120);
  if (!networks.some(n => n.id === input.network)) throw new Error('Невідома мережа');
  return { name, network: input.network, source: httpsUrl(input.source), notes: typeof input.notes === 'string' ? input.notes.slice(0, 4000) : '' };
}
export function evaluate(project) {
  const signals = {}; // Source verification alone is not an on-chain or reward signal.
  const result = scoreOpportunity({ id: project.id, name: project.name, vm: project.network === 'sui' ? 'SUI' : 'EVM', stage: 'research', priority: 50, signals, sources: project.verified ? [project.source] : [], actions: [] });
  return { score: result.score, reasons: project.verified ? ['Джерело підтверджено користувачем. Умови винагороди ще не оцінені.'] : ['Джерело потребує ручної перевірки.'], rewardStatus: 'unconfirmed' };
}
export function taskPolicy(kind, verified) {
  if (!verified) return 'blocked';
  if (['bridge', 'swap', 'deploy', 'contract-call', 'mint', 'stake'].includes(kind)) return 'approval';
  return 'manual'; // No live execution adapter is enabled yet.
}
export const taskKinds = ['research', 'check-in', 'social', 'faucet', 'bridge', 'swap', 'deploy', 'contract-call', 'mint', 'stake'];
