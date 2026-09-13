import { timestamp } from './time.mjs';
import { requiredText, httpsUrl } from './domain.mjs';

export const signalDefinitions = [
  { key: 'eligibility', label: 'Відповідність умовам участі', weight: 30 },
  { key: 'rewardClarity', label: 'Зрозумілість умов винагороди', weight: 25 },
  { key: 'verifiability', label: 'Можливість підтвердити виконання', weight: 20 },
  { key: 'costClarity', label: 'Відомі витрати участі', weight: 15 },
  { key: 'timeFit', label: 'Можливість встигнути до дедлайну', weight: 10 },
];
const oneOf = (value, choices, label) => {
  if (!choices.includes(value)) throw new Error('Некоректне поле: ' + label);
  return value;
};
export function validateAssessment(input) {
  if (!input || typeof input !== 'object') throw new Error('Потрібні дані оцінки');
  const campaignType = oneOf(input.campaignType, ['unknown','airdrop','grant','points','testnet','quest'], 'тип кампанії');
  const rewardStatus = oneOf(input.rewardStatus, ['unconfirmed','announced','closed'], 'статус винагороди');
  const risk = oneOf(input.risk, ['unknown','low','medium','high'], 'ризик');
  const evidenceUrl = httpsUrl(input.evidenceUrl);
  const evidenceNote = requiredText(input.evidenceNote, 'Доказ умов кампанії', 2000);
  const eligibility = requiredText(input.eligibility, 'Умови участі', 3000);
  const riskNote = requiredText(input.riskNote, 'Обґрунтування ризику', 2000);
  const deadline=timestamp(input.deadline);
  const cost = input.estimatedCostUsd;
  if (cost !== null && (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0 || cost > 1000000)) throw new Error('Витрати: невідомо або число від 0 до 1000000 USD');
  if (input.scanId !== null && (!Number.isSafeInteger(input.scanId) || input.scanId < 1)) throw new Error('Некоректний знімок джерела');
  const signals = {};
  for (const {key, label} of signalDefinitions) {
    const item = input.signals?.[key];
    if (!item || (item.value !== null && (!Number.isInteger(item.value) || item.value < 0 || item.value > 100))) throw new Error(label + ': невідомо або ціле число від 0 до 100');
    const note = item.value === null ? '' : requiredText(item.note, label + ': обґрунтування', 500);
    signals[key] = { value: item.value, note };
  }
  return { campaignType, rewardStatus, risk, evidenceUrl, evidenceNote, eligibility, riskNote, deadline, estimatedCostUsd: cost, scanId: input.scanId, signals };
}
export function summarizeAssessment(record, verified, now = Date.now()) {
  if (!record) return { state: 'missing', score: null, coverage: 0, rewardStatus: 'unconfirmed', deadlineState: 'unknown', warnings: ['Умови кампанії ще не оцінені.'] };
  const data = record.data;
  const current = !!verified && !record.stale;
  const known = signalDefinitions.filter(s => data.signals[s.key].value !== null);
  const coverage = known.reduce((sum,s) => sum + s.weight, 0);
  const points = signalDefinitions.reduce((sum,s) => sum + (data.signals[s.key].value ?? 0) * s.weight / 100, 0);
  const deadlineState = !data.deadline ? 'unknown' : Date.parse(data.deadline) <= now ? 'expired' : Date.parse(data.deadline) - now <= 72 * 3600000 ? 'soon' : 'open';
  const warnings = [];
  if (!current) warnings.push('Оцінка потребує перегляду: джерело змінилося або не підтверджене.');
  if (coverage < 100) warnings.push('Частина сигналів невідома; вона не додає балів.');
  if (data.estimatedCostUsd === null) warnings.push('Витрати ще не визначені.');
  if (data.risk === 'unknown') warnings.push('Ризик ще не оцінений.');
  if (data.risk === 'high') warnings.push('Користувач оцінив ризик як високий.');
  if (deadlineState === 'expired') warnings.push('Дедлайн минув.');
  if (data.rewardStatus === 'closed') warnings.push('Кампанію позначено завершеною.');
  return { state: current ? 'current' : 'stale', score: current ? Math.round(points) : null, coverage, rewardStatus: current ? data.rewardStatus : 'unconfirmed', deadlineState, warnings };
}
