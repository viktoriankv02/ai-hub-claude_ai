import { readCatalogue } from './ink-catalogue.mjs';
import { createHash } from 'node:crypto';

export const sources = [
  { id: 'ink-builders', name: 'Ink Builder Program', network: 'ink', url: 'https://docs.inkonchain.com/ink-builder-program/overview', purpose: 'Перевірити умови Spark, Forge та Echo; оцінити відповідність власного продукту.' },
  { id: 'ink-docs', name: 'Ink: документація мережі', network: 'ink', url: 'https://docs.inkonchain.com/general/network-information', purpose: 'Перевірити параметри мережі та офіційні посилання.' },
  { id: 'ink-apps', name: 'Ink: каталог застосунків', network: 'ink', url: 'https://inkonchain.com/apps', purpose: 'Дослідити застосунки та умови кампаній. Наявність у каталозі не підтверджує винагороду.' },
];

export function readableText(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) html = main[1];
  return html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
}

// Fixed, curated HTTPS endpoints only. User URLs are never fetched by this adapter.
export class InkOpportunitySource {
  constructor(fetcher = fetch) { this.fetcher = fetcher; }
  async read(id) {
    const source = sources.find(s => s.id === id);
    if (!source) throw new Error('Невідоме офіційне джерело');
    const response = await this.fetcher(source.url, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'text/html', 'User-Agent': 'DropHunter/0.2 research-monitor' } });
    if (!response.ok) throw new Error(`Джерело повернуло HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Джерело не повернуло HTML');
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1500000) throw new Error('Сторінка перевищує ліміт 1.5 MB'); chunks.push(Buffer.from(value)); }
    } finally { await reader.cancel(); }
    const html = Buffer.concat(chunks).toString('utf8');
    const text = id === 'ink-apps' ? await readCatalogue(html, this.fetcher) : readableText(html);
    if (text.length < 100) throw new Error('Замало тексту для аналізу; можливо, сторінка потребує JavaScript');
    return { source, text: text.slice(0, 100000), hash: createHash('sha256').update(text).digest('hex'), fetchedAt: new Date().toISOString() };
  }
}

export class DiscoveryService {
  constructor(store, adapter = new InkOpportunitySource()) { this.store = store; this.adapter = adapter; this.running = new Map(); }
  scan(id) {
    if (!sources.some(s => s.id === id)) return Promise.reject(new Error('Невідоме джерело'));
    if (this.running.has(id)) return this.running.get(id);
    const previous = this.store.latestScan(id);
    if (previous && Date.now() - Date.parse(previous.attemptedAt) < 60000) return Promise.reject(new Error('Повторна перевірка доступна через хвилину'));
    const run = this.perform(id).finally(() => this.running.delete(id));
    this.running.set(id, run); return run;
  }
  async perform(id) {
    try { return this.store.saveScan(await this.adapter.read(id)); }
    catch (error) { this.store.scanFailure(id, error.message); throw error; }
  }
}
