// Parse data literals only; downloaded JavaScript is never executed.
export function catalogueText(script) {
  for (const match of script.matchAll(/JSON\.parse\('((?:\\.|[^'\\])*)'\)/g)) {
    let data;
    try {
      const literal = match[1].replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\\'"bfnrtv])/g, (_, escape) => {
        if (escape[0] === 'u' || escape[0] === 'x') return String.fromCharCode(parseInt(escape.slice(1), 16));
        return ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t', v:'\v' })[escape] ?? escape;
      });
      data = JSON.parse(literal);
    } catch { continue; }
    if (!Array.isArray(data?.l) || !data.l.length || data.l.length > 1000) continue;
    const apps = data.l.filter(app => app.network === 'Mainnet').map(app => {
      if (typeof app.name !== 'string' || typeof app.description !== 'string') throw new Error('Змінився формат каталогу Ink');
      let url;
      try { url = new URL(app.links?.mainnetWebsite); } catch { return null; }
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      return { name:app.name.slice(0,200), description:app.description.slice(0,3000), url:url.href };
    }).filter(Boolean).sort((a,b) => a.url.localeCompare(b.url) || a.name.localeCompare(b.name));
    if (!apps.length) continue;
    return 'Ink: каталог застосунків Mainnet. Наявність у каталозі не підтверджує винагороду.\n\n' +
      apps.map(app => app.name + '\n' + app.url + '\n' + app.description).join('\n\n');
  }
  return null;
}

export async function readCatalogue(html, fetcher) {
  const paths = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]))];
  // Only same-origin Next.js assets advertised by the curated page.
  const urls = paths.map(path => new URL(path, 'https://inkonchain.com')).filter(url =>
    url.origin === 'https://inkonchain.com' && /^\/_next\/static\/chunks\/[^?]+\.js$/.test(url.pathname));
  if (urls.length > 40) throw new Error('Каталог перевищує ліміт файлів');
  let total = 0;
  for (const url of urls) {
    const response = await fetcher(url.href, { redirect:'error', signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Не вдалося прочитати файл каталогу Ink');
    const reader = response.body.getReader(); const chunks = [];
    try {
      while (true) {
        const {done,value} = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > 12000000) throw new Error('Каталог перевищує ліміт 12 MB');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
    const text = catalogueText(Buffer.concat(chunks).toString('utf8'));
    if (text) return text;
  }
  throw new Error('Формат каталогу Ink змінився: записи застосунків не знайдено');
}
