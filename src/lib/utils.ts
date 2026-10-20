import type { GlobalLedgerRow, NettedBalanceRow, SavedSquad, FriendDossierStats } from './types';

const SQUADS_STORAGE_PREFIX = 'ekwly_squads_';

export const utils = {
  round2: (num: number) => Math.round((num + Number.EPSILON) * 100) / 100,

  formatMoney: (num: number) => `₹${num.toFixed(2)}`,

  generateId: () => crypto.randomUUID(),

  parseQty: (val: string | number | undefined): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (!str) return 0;

    // Handle simple fractions ("1/2", "1/3") and mixed fractions ("1 1/2", "2 3/4")
    if (str.includes('/')) {
      const spaceParts = str.split(' ').filter((part) => part.length > 0);
      if (spaceParts.length === 2 && spaceParts[1].includes('/')) {
        const whole = parseFloat(spaceParts[0]);
        const [numStr, denStr] = spaceParts[1].split('/');
        const num = parseFloat(numStr);
        const den = parseFloat(denStr);
        if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
          return whole + num / den;
        }
      } else if (spaceParts.length === 1) {
        const [numStr, denStr] = spaceParts[0].split('/');
        const num = parseFloat(numStr);
        const den = parseFloat(denStr);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          return num / den;
        }
      }
    }

    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  },

  getFractionString: (qty: number, dividers: number): string => {
    let n = Math.round(qty * 10000);
    let d = Math.round(dividers * 10000);
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(n, d);
    n /= divisor;
    d /= divisor;
    if (d === 1) return `${n}`;
    if (n > d) {
      const whole = Math.floor(n / d);
      const rem = n % d;
      return `${whole} ${rem}/${d}`;
    }
    return `${n}/${d}`;
  },

  resolvePath: (subpath: string) => {
    const rawBase = import.meta.env.BASE_URL || '/';
    const base = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
    const clean = subpath.startsWith('/') ? subpath.slice(1) : subpath;
    return `${base}/${clean}`;
  },

  getSplitNames: (name: string) => {
    let base = name.trim();
    if (/GST/i.test(base)) {
      return {
        cgst: base.replace(/GST/i, 'CGST'),
        sgst: base.replace(/GST/i, 'SGST'),
      };
    }
    return { cgst: `${base} (CGST)`, sgst: `${base} (SGST)` };
  },

  haptic: (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(style === 'heavy' ? 25 : style === 'medium' ? 14 : 7);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  },

  buildUpiUrl: (params: {
    upiId: string;
    payeeName: string;
    amount: number;
    note?: string;
  }): string => {
    const cleanUpi = params.upiId.trim();
    const cleanAmt = utils.round2(params.amount).toFixed(2);
    const encodedName = encodeURIComponent(params.payeeName.trim() || 'Ekwly User');
    let url = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodedName}&am=${cleanAmt}&cu=INR`;
    if (params.note && params.note.trim()) {
      url += `&tn=${encodeURIComponent(params.note.trim())}`;
    }
    return url;
  },

  buildWhatsAppReminderUrl: (params: {
    debtorName: string;
    creditorName: string;
    amount: number;
    venueName?: string;
    upiId?: string | null;
  }) => {
    const formattedAmt = `₹${params.amount.toFixed(2)}`;
    const contextStr = params.venueName ? ` for *${params.venueName}*` : '';
    let message = `Hey ${params.debtorName}! 👋 Your split share${contextStr} on Ekwly is *${formattedAmt}* (owed to ${params.creditorName}).`;
    if (params.upiId) {
      const upiLink = utils.buildUpiUrl({
        upiId: params.upiId,
        payeeName: params.creditorName,
        amount: params.amount,
        note: params.venueName ? `Ekwly: ${params.venueName}` : 'Ekwly Split',
      });
      message += `\n\nPay instantly via UPI (${params.upiId}):\n${upiLink}`;
    }
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  },

  netBilateralBalances: (
    owedToMeRows: GlobalLedgerRow[],
    iOweRows: GlobalLedgerRow[]
  ): {
    netOwedToMe: NettedBalanceRow[];
    netIOwe: NettedBalanceRow[];
    zeroedCounterparties: NettedBalanceRow[];
    totalOwedToMe: number;
    totalIOwe: number;
  } => {
    const map = new Map<
      string,
      {
        counterpartyKey: string;
        counterpartyId: string | null;
        counterpartyName: string;
        selfName: string;
        grossOwedToMe: number;
        grossIOwe: number;
      }
    >();

    const getKey = (id: string | null, name: string) =>
      id ? `id:${id}` : `name:${(name || 'guest').trim().toLowerCase()}`;

    for (const row of owedToMeRows) {
      const amt = Number(row.total_owed || 0);
      if (amt <= 0) continue;
      const key = getKey(row.debtor_id, row.debtor_name);
      const existing = map.get(key);
      if (existing) {
        existing.grossOwedToMe = utils.round2(existing.grossOwedToMe + amt);
        if (!existing.counterpartyId && row.debtor_id) existing.counterpartyId = row.debtor_id;
      } else {
        map.set(key, {
          counterpartyKey: key,
          counterpartyId: row.debtor_id || null,
          counterpartyName: (row.debtor_name || 'Guest').trim(),
          selfName: (row.creditor_name || 'Me').trim(),
          grossOwedToMe: utils.round2(amt),
          grossIOwe: 0,
        });
      }
    }

    for (const row of iOweRows) {
      const amt = Number(row.total_owed || 0);
      if (amt <= 0) continue;
      const key = getKey(row.creditor_id, row.creditor_name);
      const existing = map.get(key);
      if (existing) {
        existing.grossIOwe = utils.round2(existing.grossIOwe + amt);
        if (!existing.counterpartyId && row.creditor_id) existing.counterpartyId = row.creditor_id;
      } else {
        map.set(key, {
          counterpartyKey: key,
          counterpartyId: row.creditor_id || null,
          counterpartyName: (row.creditor_name || 'Guest').trim(),
          selfName: (row.debtor_name || 'Me').trim(),
          grossOwedToMe: 0,
          grossIOwe: utils.round2(amt),
        });
      }
    }

    const netOwedToMe: NettedBalanceRow[] = [];
    const netIOwe: NettedBalanceRow[] = [];
    const zeroedCounterparties: NettedBalanceRow[] = [];

    for (const entry of map.values()) {
      const diff = utils.round2(entry.grossOwedToMe - entry.grossIOwe);
      const hasOpposing = entry.grossOwedToMe > 0 && entry.grossIOwe > 0;

      if (diff > 0.01) {
        netOwedToMe.push({
          ...entry,
          direction: 'owed_to_me',
          netAmount: diff,
          hasOpposing,
        });
      } else if (diff < -0.01) {
        netIOwe.push({
          ...entry,
          direction: 'i_owe',
          netAmount: Math.abs(diff),
          hasOpposing,
        });
      } else if (hasOpposing) {
        zeroedCounterparties.push({
          ...entry,
          direction: 'owed_to_me',
          netAmount: 0,
          hasOpposing: true,
        });
      }
    }

    netOwedToMe.sort((a, b) => b.netAmount - a.netAmount);
    netIOwe.sort((a, b) => b.netAmount - a.netAmount);

    const totalOwedToMe = utils.round2(netOwedToMe.reduce((sum, item) => sum + item.netAmount, 0));
    const totalIOwe = utils.round2(netIOwe.reduce((sum, item) => sum + item.netAmount, 0));

    return {
      netOwedToMe,
      netIOwe,
      zeroedCounterparties,
      totalOwedToMe,
      totalIOwe,
    };
  },

  getSavedSquads: (userId?: string | null): SavedSquad[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`${SQUADS_STORAGE_PREFIX}${userId || 'guest'}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveSquads: (userId: string | null | undefined, squads: SavedSquad[]): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${SQUADS_STORAGE_PREFIX}${userId || 'guest'}`, JSON.stringify(squads));
    } catch {
      // Ignore storage quota errors
    }
  },

  computeFriendDossierStats: (
    sessions: {
      id: string;
      name: string | null;
      venue_name: string | null;
      created_at: string;
    }[]
  ): FriendDossierStats => {
    const uniqueMap = new Map<
      string,
      { id: string; name: string | null; venue_name: string | null; created_at: string }
    >();
    for (const s of sessions) {
      if (s && s.id && !uniqueMap.has(s.id)) {
        uniqueMap.set(s.id, s);
      }
    }

    const deduped = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const venueCounts = new Map<string, { display: string; count: number }>();
    for (const s of deduped) {
      const rawVenue = (s.venue_name || s.name || '').trim();
      if (!rawVenue || /^splitwise/i.test(rawVenue)) continue;
      const key = rawVenue.toLowerCase();
      const existing = venueCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        venueCounts.set(key, { display: rawVenue, count: 1 });
      }
    }

    let favoriteVenue: string | null = null;
    let maxVisits = 0;
    for (const v of venueCounts.values()) {
      if (v.count > maxVisits) {
        maxVisits = v.count;
        favoriteVenue = v.display;
      }
    }

    const recentSessions = deduped.slice(0, 3).map((s) => ({
      id: s.id,
      title: (s.venue_name || s.name || 'Dining Session').trim(),
      created_at: s.created_at,
    }));

    return {
      sharedSessionCount: deduped.length,
      favoriteVenue,
      recentSessions,
    };
  },
};

export const showToast = (message: string, type: 'default' | 'error' | 'success' = 'default') => {
  if (typeof document === 'undefined') return;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText =
      'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 10px; z-index: 99999; width: 90%; max-width: 400px; pointer-events: none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bgColor = type === 'error' ? '#DF1B41' : type === 'success' ? '#00D924' : '#141A28';

  toast.style.cssText = `background: ${bgColor}; color: #ffffff; padding: 14px 20px; border-radius: 12px; font-size: 0.95rem; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px; transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: translateY(20px); opacity: 0; pointer-events: auto; border: 1px solid rgba(255,255,255,0.1);`;

  const icon =
    type === 'error'
      ? `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      : type === 'success'
        ? `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        : `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  toast.innerHTML = `${icon} <span style="flex-1">${message.replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[tag as string] || tag)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};
