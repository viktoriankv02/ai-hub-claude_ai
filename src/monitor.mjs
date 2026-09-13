import { sources } from './discovery.mjs';
export class Monitor {
  constructor(store, discovery, intervalMs = 21600000) { this.store=store; this.discovery=discovery; this.intervalMs=intervalMs; this.running=false; }
  state() { return { enabled:this.store.setting('monitorEnabled',false), running:this.running, intervalHours:this.intervalMs/3600000, lastRun:this.store.setting('monitorLastRun',null) }; }
  async tick() {
    if (this.running || !this.state().enabled) return;
    if (this.state().lastRun && Date.now()-Date.parse(this.state().lastRun)<this.intervalMs) return;
    this.running=true;
    try {
      for (const source of sources) { if (!this.state().enabled) break; try { await this.discovery.scan(source.id); } catch { /* failure is persisted by discovery */ } }
      this.store.setSetting('monitorLastRun',new Date().toISOString());
    } finally { this.running=false; }
  }
  start() { this.timer=setInterval(()=>this.tick().catch(console.error),60000); this.timer.unref(); this.tick().catch(console.error); }
  stop() { clearInterval(this.timer); }
}
