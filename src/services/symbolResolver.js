// Normalize broker/import exchange suffixes to Yahoo Finance symbols.
// Trade Republic imports can contain venue-specific suffixes such as .TI;
// Yahoo's canonical German listings are usually .DE (XETRA) or .F (Frankfurt).
function candidates(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return [];

  const result = [raw];
  const match = raw.match(/^(.+)\.([A-Z0-9]+)$/);
  if (match) {
    const [, base, suffix] = match;
    if (suffix === 'TI' || suffix === 'TLO' || suffix === 'TRG') {
      result.push(`${base}.DE`, `${base}.F`);
    }
  }

  return [...new Set(result)];
}

function canonical(symbol) {
  return candidates(symbol).find(s => /\.DE$|\.F$/.test(s)) || String(symbol || '').trim().toUpperCase();
}

module.exports = { candidates, canonical };
