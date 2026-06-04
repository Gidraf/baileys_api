export function sanitizeJid(jid) {
  if (!jid || typeof jid !== 'string') return jid;

  // Trim spaces and special characters like ~
  let clean = jid.trim().replace(/[~\s]/g, '');

  if (clean === 'status@c.us' || clean.toLowerCase() === 'status') {
    return 'status@broadcast';
  }

  if (clean.includes('@c.us@s.whatsapp.net')) {
    return clean.replace('@c.us@s.whatsapp.net', '@s.whatsapp.net');
  }

  if (clean.endsWith('@c.us')) {
    return clean.replace('@c.us', '@s.whatsapp.net');
  }

  // If it's a numeric string without any domain suffix (e.g. "2547XXXXXXXX"), append @s.whatsapp.net
  if (/^[0-9:\-]+$/.test(clean) && !clean.includes('@')) {
    return `${clean}@s.whatsapp.net`;
  }

  return clean;
}

export function isValidJid(jid) {
  if (!jid || typeof jid !== 'string') return false;
  if (jid === 'status@broadcast') return true;
  const parts = jid.split('@');
  if (parts.length !== 2) return false;
  
  const validDomains = ['s.whatsapp.net', 'g.us', 'newsletter', 'lid'];
  if (!validDomains.includes(parts[1])) return false;
  
  return /^[0-9:\-]+$/.test(parts[0]);
}
