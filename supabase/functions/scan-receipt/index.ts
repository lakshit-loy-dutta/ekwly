// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BASE64_LENGTH = 4_500_000; // ~3.3 MB binary cap

interface SanitizedTaxPreset {
  id: string;
  name: string;
  rate: number;
  split: boolean;
}

interface PrintedTaxLine {
  name?: string;
  ratePct?: number;
  amount?: number;
}

interface PrintedSummary {
  subTotal?: number;
  serviceChargeAmount?: number;
  serviceChargeRatePct?: number;
  taxLines?: PrintedTaxLine[];
  discountAmount?: number;
  roundOff?: number;
  grandTotal?: number;
}

interface RawExtractedPreset {
  tempId?: string;
  name?: string;
  rate?: number;
  split?: boolean;
}

interface RawExtractedItem {
  name?: string;
  qty?: number;
  price?: number;
  taxCategory?: 'food_gst' | 'alcohol_vat' | 'tobacco_sin' | 'exempt_mrp' | 'custom';
  taxRatePct?: number;
  isGstSplit?: boolean;
  taxPresetId?: string;
  applySC?: boolean;
  applyDiscount?: boolean;
  discountType?: 'none' | 'percentage' | 'flat';
  discountValue?: number;
}

interface RawSessionRules {
  isScApplicable?: boolean;
  serviceChargeRate?: number;
  scTaxPresetId?: string;
  discountType?: 'none' | 'percentage' | 'flat';
  discountValue?: string;
  discountMode?: 'pre-tax' | 'post-tax';
  postTaxDiscountType?: 'none' | 'percentage' | 'flat';
  postTaxDiscountValue?: string;
}

interface ExtractedReceiptPayload {
  reasoning?: string;
  venueName?: string;
  printedSummary?: PrintedSummary;
  sessionRules?: RawSessionRules;
  newTaxPresets?: RawExtractedPreset[];
  items?: RawExtractedItem[];
}

interface VenueDbMatch {
  id: string;
  name: string;
  service_charge_rate: number;
  tax_presets: Array<{ name: string; rate: number; split?: boolean }>;
  similarity: number;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sanitizeExistingTaxes(rawTaxes: unknown): SanitizedTaxPreset[] {
  if (!Array.isArray(rawTaxes)) return [];
  return rawTaxes.slice(0, 15).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const t = entry as Record<string, unknown>;
    const id = typeof t.id === 'string' ? t.id.slice(0, 64) : '';
    const name =
      typeof t.name === 'string'
        ? t.name
            .replace(/[\r\n`]/g, ' ')
            .trim()
            .slice(0, 40)
        : '';
    const rate = Number(t.rate);
    if (!id || !name || !Number.isFinite(rate) || rate < 0 || rate > 100) return [];
    return [{ id, name, rate, split: Boolean(t.split) }];
  });
}

/**
 * Deterministic Indian POS Math Evaluator (mirrors src/lib/mathEngine.ts)
 * Used to verify Gemini's extraction against the receipt's printed Grand Total
 * and auto-solve Service Charge taxation topologies ('inherit' vs 'food_gst' vs 'none').
 */
function simulateBillTotal(params: {
  items: RawExtractedItem[];
  presetsById: Map<string, { rate: number; split: boolean }>;
  rules: RawSessionRules;
  scTaxPresetIdOverride?: string;
}): {
  subTotal: number;
  serviceCharge: number;
  totalTax: number;
  grandTotal: number;
} {
  const { items, presetsById, rules } = params;
  const scTaxId = params.scTaxPresetIdOverride ?? (rules.scTaxPresetId || 'inherit');
  const rawScRate = Number(rules.serviceChargeRate ?? 0);
  const scRate = rules.isScApplicable ? (rawScRate > 1 ? rawScRate / 100 : rawScRate) : 0;

  // 1. Item-level discounts & eligible pre-tax base
  let eligiblePreTaxBase = 0;
  const afterItemBases = items.map((item) => {
    const rawBase = Math.max(0.01, Number(item.qty) || 1) * Math.max(0, Number(item.price) || 0);
    const dVal = Number(item.discountValue || 0);
    let itemDisc = 0;
    if (item.discountType === 'percentage' && dVal > 0) {
      itemDisc = Math.min(rawBase, rawBase * (dVal / 100));
    } else if (item.discountType === 'flat' && dVal > 0) {
      itemDisc = Math.min(rawBase, dVal);
    }
    const postItem = Math.max(0, rawBase - itemDisc);
    if (item.applyDiscount !== false) eligiblePreTaxBase += postItem;
    return postItem;
  });

  // 2. Selective Pre-Tax Discount
  const preTaxVal = parseFloat(String(rules.discountValue || '0')) || 0;
  let preTaxDisc = 0;
  if (
    rules.discountType &&
    rules.discountType !== 'none' &&
    (rules.discountMode === 'pre-tax' || !rules.discountMode) &&
    preTaxVal > 0 &&
    eligiblePreTaxBase > 0
  ) {
    preTaxDisc =
      rules.discountType === 'percentage'
        ? eligiblePreTaxBase * (preTaxVal / 100)
        : Math.min(eligiblePreTaxBase, preTaxVal);
  }
  const preTaxMultiplier =
    eligiblePreTaxBase > 0
      ? Math.max(0, (eligiblePreTaxBase - preTaxDisc) / eligiblePreTaxBase)
      : 1;

  // 3. Accumulate Base, Service Charge & Taxes
  let subTotal = 0;
  let serviceCharge = 0;
  let totalTax = 0;

  items.forEach((item, idx) => {
    const effBase =
      item.applyDiscount !== false ? afterItemBases[idx] * preTaxMultiplier : afterItemBases[idx];
    const itemSc = scRate > 0 && item.applySC !== false ? effBase * scRate : 0;
    const preset = presetsById.get(String(item.taxPresetId || ''));
    const itemRate = preset ? preset.rate / 100 : (Number(item.taxRatePct) || 0) / 100;

    let itemTax = effBase * itemRate;
    if (scTaxId === 'inherit') {
      itemTax += itemSc * itemRate;
    } else if (scTaxId !== 'none' && itemSc > 0) {
      const scPreset = presetsById.get(scTaxId);
      if (scPreset) itemTax += itemSc * (scPreset.rate / 100);
    }

    subTotal += effBase;
    serviceCharge += itemSc;
    totalTax += itemTax;
  });

  const grossTotal = subTotal + serviceCharge + totalTax;

  // 4. Post-Tax Coupon / App Discount
  const postTaxVal = parseFloat(String(rules.postTaxDiscountValue || '0')) || 0;
  let postTaxDisc = 0;
  if (
    rules.postTaxDiscountType &&
    rules.postTaxDiscountType !== 'none' &&
    postTaxVal > 0 &&
    grossTotal > 0
  ) {
    postTaxDisc =
      rules.postTaxDiscountType === 'percentage'
        ? grossTotal * (postTaxVal / 100)
        : Math.min(grossTotal, postTaxVal);
  }

  return {
    subTotal: round2(subTotal),
    serviceCharge: round2(serviceCharge),
    totalTax: round2(totalTax),
    grandTotal: Math.round(grossTotal - postTaxDisc),
  };
}

/**
 * Reconciles CGST+SGST pairs, matches existing session presets + verified DB venue presets,
 * and runs deterministic math verification against the receipt's printed Grand Total.
 */
function reconcileAndVerifyReceipt(params: {
  raw: ExtractedReceiptPayload;
  existingTaxes: SanitizedTaxPreset[];
  matchedVenue: VenueDbMatch | null;
}) {
  const { raw, existingTaxes, matchedVenue } = params;
  const items = Array.isArray(raw.items) ? raw.items : [];
  const rawNewPresets = Array.isArray(raw.newTaxPresets) ? raw.newTaxPresets : [];

  const isHalfGst = (name: string) =>
    /\b(c\.?g\.?s\.?t|s\.?g\.?s\.?t|u\.?t\.?g\.?s\.?t)\b/i.test(name);

  const tempIdRemap = new Map<string, string>();
  const finalNewPresets: RawExtractedPreset[] = [];
  const allPresetsMap = new Map<string, { name: string; rate: number; split: boolean }>();

  for (const t of existingTaxes) {
    allPresetsMap.set(t.id, { name: t.name, rate: t.rate, split: t.split });
  }

  // Merge half-rate CGST/SGST components into full-rate split:true brackets
  const halfPresets = rawNewPresets.filter(
    (p) => typeof p.name === 'string' && isHalfGst(p.name) && Number(p.rate) > 0
  );
  const fullPresets = rawNewPresets.filter(
    (p) => !(typeof p.name === 'string' && isHalfGst(p.name) && Number(p.rate) > 0)
  );

  for (const fp of fullPresets) {
    const rate = round2(Math.min(100, Math.max(0, Number(fp.rate) || 0)));
    const name = String(fp.name || `Tax ${rate}%`)
      .trim()
      .slice(0, 40);
    const split = Boolean(fp.split);
    const tid = String(fp.tempId || `tax_${rate}_${finalNewPresets.length}`);

    const existingMatch = existingTaxes.find((t) => Math.abs(t.rate - rate) < 0.15);
    if (existingMatch) {
      tempIdRemap.set(tid, existingMatch.id);
    } else {
      finalNewPresets.push({ tempId: tid, name, rate, split });
      allPresetsMap.set(tid, { name, rate, split });
    }
  }

  const halfGroups = new Map<number, RawExtractedPreset[]>();
  for (const hp of halfPresets) {
    const r = round2(Number(hp.rate));
    const arr = halfGroups.get(r) || [];
    arr.push(hp);
    halfGroups.set(r, arr);
  }

  for (const [halfRate, group] of halfGroups.entries()) {
    const combinedRate = round2(halfRate * 2);
    const existingMatch = existingTaxes.find((t) => Math.abs(t.rate - combinedRate) < 0.15);
    if (existingMatch) {
      for (const g of group) if (g.tempId) tempIdRemap.set(g.tempId, existingMatch.id);
      continue;
    }

    const alreadyCreated = finalNewPresets.find(
      (t) => Math.abs(Number(t.rate) - combinedRate) < 0.15
    );
    if (alreadyCreated?.tempId) {
      alreadyCreated.split = true;
      for (const g of group) if (g.tempId) tempIdRemap.set(g.tempId, alreadyCreated.tempId);
      continue;
    }

    // Check if matched DB venue has a canonical name for this combined rate
    const venuePresetMatch = matchedVenue?.tax_presets?.find(
      (vp) => Math.abs(Number(vp.rate) - combinedRate) < 0.15
    );
    const canonicalTempId = group[0]?.tempId || `gst_${combinedRate}`;
    const label =
      venuePresetMatch?.name || (combinedRate === 5 ? 'Food GST' : `GST ${combinedRate}%`);

    finalNewPresets.push({ tempId: canonicalTempId, name: label, rate: combinedRate, split: true });
    allPresetsMap.set(canonicalTempId, { name: label, rate: combinedRate, split: true });
    for (const g of group) if (g.tempId) tempIdRemap.set(g.tempId, canonicalTempId);
  }

  // Normalize items and guarantee every item points to a valid preset ID
  const normalizedItems: RawExtractedItem[] = items
    .filter((it) => it && typeof it.name === 'string' && it.name.trim().length > 0)
    .map((it) => {
      const rawId = String(it.taxPresetId || '');
      let resolvedId = tempIdRemap.get(rawId) || rawId;

      if (!allPresetsMap.has(resolvedId)) {
        // Fallback match by extracted taxRatePct (doubling if half-rate CGST was extracted)
        const rawRate = Number(it.taxRatePct ?? 0);
        const targetRate =
          it.taxCategory === 'food_gst' && rawRate > 0 && rawRate < 4
            ? round2(rawRate * 2)
            : rawRate;

        let matchedId: string | null = null;
        for (const [id, spec] of allPresetsMap.entries()) {
          if (Math.abs(spec.rate - targetRate) < 0.15) {
            matchedId = id;
            break;
          }
        }

        if (!matchedId && targetRate >= 0) {
          const newId = `auto_tax_${targetRate}_${finalNewPresets.length}`;
          const isSplit =
            it.taxCategory === 'food_gst' ||
            it.taxCategory === 'tobacco_sin' ||
            Boolean(it.isGstSplit);
          const autoName =
            it.taxCategory === 'exempt_mrp' || targetRate === 0
              ? 'Exempt'
              : it.taxCategory === 'alcohol_vat'
                ? `Alcohol VAT ${targetRate}%`
                : targetRate === 5
                  ? 'Food GST'
                  : `Tax ${targetRate}%`;
          finalNewPresets.push({ tempId: newId, name: autoName, rate: targetRate, split: isSplit });
          allPresetsMap.set(newId, { name: autoName, rate: targetRate, split: isSplit });
          matchedId = newId;
        }
        resolvedId = matchedId || existingTaxes[0]?.id || '';
      }

      return {
        ...it,
        name: it.name!.trim(),
        qty: Math.max(0.01, Number(it.qty) || 1),
        price: Math.max(0, Number(it.price) || 0),
        taxPresetId: resolvedId,
        applySC: it.taxCategory === 'exempt_mrp' ? false : it.applySC !== false,
        applyDiscount: it.taxCategory === 'exempt_mrp' ? false : it.applyDiscount !== false,
      };
    });

  // Normalize sessionRules + Auto-Solve Service Charge Tax Topology against printedGrandTotal
  const rules: RawSessionRules = { ...(raw.sessionRules || {}) };
  if (rules.scTaxPresetId && tempIdRemap.has(rules.scTaxPresetId)) {
    rules.scTaxPresetId = tempIdRemap.get(rules.scTaxPresetId);
  }

  let sim = simulateBillTotal({
    items: normalizedItems,
    presetsById: allPresetsMap,
    rules,
  });

  const printedGrand = Number(raw.printedSummary?.grandTotal || 0);
  let autoSolvedScTopology = false;

  if (printedGrand > 0 && Math.abs(sim.grandTotal - printedGrand) > 2.0 && rules.isScApplicable) {
    let foodPresetId: string | null = null;
    for (const [id, spec] of allPresetsMap.entries()) {
      if (/food|gst/i.test(spec.name) && spec.rate > 0) {
        foodPresetId = id;
        break;
      }
    }

    const candidates = ['inherit', ...(foodPresetId ? [foodPresetId] : []), 'none'];
    let bestMode = rules.scTaxPresetId || 'inherit';
    let bestDiff = Math.abs(sim.grandTotal - printedGrand);

    for (const candidate of candidates) {
      const testSim = simulateBillTotal({
        items: normalizedItems,
        presetsById: allPresetsMap,
        rules,
        scTaxPresetIdOverride: candidate,
      });
      const diff = Math.abs(testSim.grandTotal - printedGrand);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMode = candidate;
        sim = testSim;
      }
    }

    if (bestMode !== (rules.scTaxPresetId || 'inherit') && bestDiff <= 2.0) {
      rules.scTaxPresetId = bestMode;
      autoSolvedScTopology = true;
    }
  }

  const delta = printedGrand > 0 ? round2(sim.grandTotal - printedGrand) : 0;

  return {
    normalized: {
      reasoning: raw.reasoning,
      venueName:
        matchedVenue?.name ||
        (typeof raw.venueName === 'string' && raw.venueName.trim()
          ? raw.venueName.trim()
          : undefined),
      sessionRules: rules,
      newTaxPresets: finalNewPresets,
      items: normalizedItems,
    },
    verification: {
      printedGrandTotal: printedGrand > 0 ? printedGrand : null,
      computedGrandTotal: sim.grandTotal,
      delta,
      matchedPrintedTotal: printedGrand > 0 ? Math.abs(delta) <= 2.0 : true,
      autoSolvedScTopology,
    },
  };
}

async function callGeminiHydrogen(params: {
  geminiApiKey: string;
  mimeType: string;
  imageBase64: string;
  prompt: string;
}): Promise<ExtractedReceiptPayload> {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': params.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: params.mimeType,
                  data: params.imageBase64,
                },
              },
              {
                text: params.prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          mediaResolution: 'MEDIA_RESOLUTION_HIGH',
          thinkingConfig: {
            thinkingLevel: 'HIGH',
          },
          response_mime_type: 'application/json',
          response_schema: {
            type: 'OBJECT',
            properties: {
              reasoning: {
                type: 'STRING',
                description:
                  'Step-by-step audit showing exact transcribed names, item taxes (combined CGST+SGST vs Liquor VAT vs MRP), selective Service Charge, discounts, and proof that computed total equals printed Grand Total.',
              },
              venueName: {
                type: 'STRING',
                description:
                  'Brand/restaurant/pub name at the top of the bill (prefer brand name over legal Pvt Ltd entity if both appear).',
              },
              printedSummary: {
                type: 'OBJECT',
                description: 'Exact summary figures printed at the bottom of the paper bill.',
                properties: {
                  subTotal: { type: 'NUMBER' },
                  serviceChargeAmount: { type: 'NUMBER' },
                  serviceChargeRatePct: { type: 'NUMBER' },
                  taxLines: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        name: { type: 'STRING' },
                        ratePct: { type: 'NUMBER' },
                        amount: { type: 'NUMBER' },
                      },
                    },
                  },
                  discountAmount: { type: 'NUMBER' },
                  roundOff: { type: 'NUMBER' },
                  grandTotal: { type: 'NUMBER' },
                },
              },
              sessionRules: {
                type: 'OBJECT',
                properties: {
                  isScApplicable: { type: 'BOOLEAN' },
                  serviceChargeRate: { type: 'NUMBER' },
                  scTaxPresetId: { type: 'STRING' },
                  discountType: { type: 'STRING' },
                  discountValue: { type: 'STRING' },
                  discountMode: { type: 'STRING' },
                  postTaxDiscountType: { type: 'STRING' },
                  postTaxDiscountValue: { type: 'STRING' },
                },
              },
              newTaxPresets: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    tempId: { type: 'STRING' },
                    name: { type: 'STRING' },
                    rate: { type: 'NUMBER' },
                    split: { type: 'BOOLEAN' },
                  },
                },
              },
              items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    qty: { type: 'NUMBER' },
                    price: { type: 'NUMBER' },
                    taxCategory: { type: 'STRING' },
                    taxRatePct: { type: 'NUMBER' },
                    isGstSplit: { type: 'BOOLEAN' },
                    taxPresetId: { type: 'STRING' },
                    applySC: { type: 'BOOLEAN' },
                    applyDiscount: { type: 'BOOLEAN' },
                    discountType: { type: 'STRING' },
                    discountValue: { type: 'NUMBER' },
                  },
                  required: ['name', 'qty', 'price'],
                },
              },
            },
            required: ['reasoning', 'printedSummary', 'items'],
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errDetail = await response.text();
    console.error('Gemini API upstream error:', response.status, errDetail);
    throw new Error('AI vision service is temporarily unavailable. Your quota was not charged.');
  }

  const geminiData = await response.json();
  const parts = geminiData?.candidates?.[0]?.content?.parts;
  const textPart = Array.isArray(parts)
    ? parts.find((p: Record<string, unknown>) => typeof p.text === 'string' && !p.thought) ||
      parts.find((p: Record<string, unknown>) => typeof p.text === 'string')
    : null;

  if (!textPart?.text) {
    throw new Error('AI could not read this receipt image. Try a clearer photo.');
  }

  const parsed = JSON.parse(textPart.text) as ExtractedReceiptPayload;
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('No line items detected on this receipt.');
  }
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !geminiApiKey) {
    return jsonResponse({ error: 'Server configuration incomplete.' }, 500);
  }

  let quotaConsumedForUserId: string | null = null;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. AUTHENTICATE & BLOCK ANONYMOUS CALLERS
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'UNAUTHORIZED: Sign in to use Magic Scan.' }, 401);
    }
    const token = authHeader.slice('Bearer '.length).trim();

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: 'UNAUTHORIZED: Invalid or expired session.' }, 401);
    }
    if (user.is_anonymous) {
      return jsonResponse(
        { error: 'ANON_NOT_ALLOWED: Link a Google or Email account to use AI Magic Scan.' },
        403
      );
    }

    // 2. VALIDATE PAYLOAD & SANITIZE CONTEXT
    const body = (await req.json()) as Record<string, unknown>;
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'image/jpeg';

    if (!imageBase64) {
      return jsonResponse({ error: 'No receipt image provided.' }, 400);
    }
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return jsonResponse(
        { error: 'Receipt image is too large. Please retake closer to the bill.' },
        413
      );
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return jsonResponse({ error: 'Unsupported image format. Use JPEG, PNG, or WebP.' }, 400);
    }

    const existingTaxes = sanitizeExistingTaxes(body.currentTaxes);
    const rawRules =
      body.currentRules && typeof body.currentRules === 'object'
        ? (body.currentRules as Record<string, unknown>)
        : {};
    const clientVenueName =
      typeof rawRules.venueName === 'string' ? rawRules.venueName.trim().slice(0, 80) : '';

    // Pre-lookup venue in DB if user already typed/selected one
    let matchedVenue: VenueDbMatch | null = null;
    if (clientVenueName.length >= 2) {
      const { data: venueRows } = await supabaseAdmin.rpc('search_venues', {
        search_term: clientVenueName,
      });
      if (Array.isArray(venueRows) && venueRows.length > 0 && venueRows[0].similarity >= 0.45) {
        matchedVenue = venueRows[0] as VenueDbMatch;
      }
    }

    // 3. ATOMIC ROW-LOCKED QUOTA CONSUMPTION
    const { data: quotaRows, error: quotaError } = await supabaseAdmin.rpc(
      'consume_ai_scan_quota',
      { p_user_id: user.id, p_monthly_limit: 3 }
    );
    if (quotaError) {
      console.error('Quota RPC error:', quotaError);
      return jsonResponse({ error: 'Could not verify scan quota.' }, 500);
    }

    const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
    if (!quota?.allowed) {
      return jsonResponse({ error: 'RATE_LIMIT_REACHED' }, 402);
    }
    if (!quota.is_pro) {
      quotaConsumedForUserId = user.id;
    }

    // 4. PASS 1: GEMINI 4 HYDROGEN FORENSIC EXTRACTION
    const baseSystemPrompt = `You are a forensic Indian restaurant, pub, and retail receipt OCR & POS tax accountant. Extract every line item, tax bracket, service charge rule, discount, venue name, and bottom-of-bill printed summary into the JSON schema.

EXISTING SESSION TAX PRESETS:
${JSON.stringify(existingTaxes)}

${
  matchedVenue
    ? `COMMUNITY-VERIFIED VENUE TAX PROFILE (${matchedVenue.name}):
- Service Charge Rate: ${Number(matchedVenue.service_charge_rate || 0) * 100}%
- Verified Tax Brackets: ${JSON.stringify(matchedVenue.tax_presets)}
(Use this as a strong prior, while still verifying against the printed numbers on this specific bill.)`
    : ''
}

CRITICAL INDIAN POS EXTRACTION & TAX RULES:
1. CHARACTER-ACCURATE TRANSCRIPTION: Read every dish, cocktail, beer, spirit, smoke, and MRP item carefully character-by-character (e.g., "Jagermeister", "Glenfiddich", "Hoegaarden", "Paneer Tikka"). Do NOT include Subtotal, Tax, Service Charge, Discount, or Round-Off summary lines as items.
2. UNIT PRICE & QTY: Set 'qty' and per-unit 'price' (before item discount) so qty * price equals the line's pre-discount amount.
3. COMBINING INDIAN CGST + SGST & MULTI-TAX ROUTING:
   - Indian receipts print CGST and SGST on separate lines (e.g., "CGST 2.5%" + "SGST 2.5%", or "CGST 9%" + "SGST 9%").
   - NEVER output separate CGST-only or SGST-only brackets! Always combine CGST X% + SGST X% into ONE combined rate 2X% with "isGstSplit": true and "split": true.
   - Classify each item's 'taxCategory':
     * "food_gst": Food, mocktails, soft drinks, aerated beverages (usually 5% or 18% split CGST+SGST).
     * "alcohol_vat": Beer, wine, IMFL, spirits, cocktails containing liquor (state-specific VAT/Excise like 5%, 6%, 10%, 12.5%, 18%, 20%, 25%, or 0% if liquor is tax-included/exempt on that POS — single unsplit rate, split: false).
     * "tobacco_sin": Cigarettes, smokes, hookah, tobacco (28% or 40% split CGST+SGST + any Cess).
     * "exempt_mrp": Bottled water / packaged MRP items with 0% tax ("taxRatePct": 0, "applySC": false, "applyDiscount": false).
   - If an existing session preset matches the item's combined rate, reuse its exact 'id' in 'taxPresetId'. Otherwise define the combined preset in 'newTaxPresets' with a 'tempId'.
4. SERVICE CHARGE (SC) — PARTIAL APPLICABILITY & TAX TOPOLOGY:
   - Check if SC is printed (e.g., "Service Charge 5%" or "10%" or "Staff Welfare"). If absent, set 'isScApplicable': false, 'serviceChargeRate': 0.
   - PARTIAL SC: Check whether SC was computed on ALL items or ONLY on Food or ONLY on Drinks/Bar! Set 'applySC': true ONLY on items that contributed to the printed SC amount, and 'applySC': false on excluded items (such as MRP water or food-only bills).
   - SC TAX TOPOLOGY ('scTaxPresetId'):
     * "inherit": GST/VAT is calculated on (Item Base + Item SC).
     * "<food-gst-id-or-tempId>": SC is taxed separately under a single bracket (e.g. 5% or 18% GST on SC while liquor has VAT or 0% tax).
     * "none": SC is added after taxes (no tax on SC).
5. 3-LAYER DISCOUNTS:
   - Item/Category discount -> set 'discountType' ("percentage" | "flat") and 'discountValue' on the specific item(s).
   - Pre-Tax restaurant discount (subtracted BEFORE tax) -> set sessionRules 'discountType', 'discountValue', 'discountMode': "pre-tax", and set 'applyDiscount': false on excluded items (e.g. alcohol/MRP when offer is food-only).
   - Post-Tax coupon/app discount (subtracted AFTER tax, e.g. Swiggy Dineout / Zomato Gold) -> set sessionRules 'postTaxDiscountType' and 'postTaxDiscountValue'.
6. PRINTED SUMMARY ANCHORS: Populate 'printedSummary' with the exact printed SubTotal, Service Charge amount, every printed Tax line + amount, Discount amount, Round-Off, and final Grand Total from the bottom of the bill.`;

    let extracted = await callGeminiHydrogen({
      geminiApiKey,
      mimeType,
      imageBase64,
      prompt: baseSystemPrompt,
    });

    // 5. POST-OCR VENUE DB LOOKUP (IF VENUE WAS GUESSED FROM RECEIPT HEADER)
    if (!matchedVenue && extracted.venueName && extracted.venueName.length >= 2) {
      const { data: venueRows } = await supabaseAdmin.rpc('search_venues', {
        search_term: extracted.venueName,
      });
      if (Array.isArray(venueRows) && venueRows.length > 0 && venueRows[0].similarity >= 0.5) {
        matchedVenue = venueRows[0] as VenueDbMatch;
      }
    }

    // 6. DETERMINISTIC MATH VERIFICATION & AUTO-SOLVER
    let reconciled = reconcileAndVerifyReceipt({
      raw: extracted,
      existingTaxes,
      matchedVenue,
    });

    // 7. TARGETED PASS 2 SELF-CORRECTION IF DELTA > ₹2.00
    if (
      reconciled.verification.printedGrandTotal !== null &&
      !reconciled.verification.matchedPrintedTotal
    ) {
      const correctionPrompt = `${baseSystemPrompt}

SELF-CORRECTION AUDIT ALERT (PREVIOUS PASS MISMATCH):
- Printed Grand Total on receipt: ₹${reconciled.verification.printedGrandTotal}
- Your previous extraction computed: ₹${reconciled.verification.computedGrandTotal} (Difference: ₹${reconciled.verification.delta})
- Previous items extracted: ${JSON.stringify(extracted.items)}
- Previous sessionRules: ${JSON.stringify(extracted.sessionRules)}

Re-examine the image carefully to find the exact cause of the ₹${Math.abs(reconciled.verification.delta)} difference:
1. Check if a quantity (qty) or unit price was misread, or if an item line was missed/duplicated.
2. Check if Service Charge applies ONLY to Drinks/Bar or ONLY to Food (set 'applySC': false on excluded items).
3. Check if Alcohol has 0% tax (tax-inclusive bar pricing) or a different state VAT % than Food GST, or if CGST+SGST was doubled/halved.
4. Check if a discount is Pre-Tax vs Post-Tax, or excludes Alcohol/MRP ('applyDiscount': false).
Fix the items, tax rates, 'applySC', and 'sessionRules' so the computed Grand Total matches ₹${reconciled.verification.printedGrandTotal} within ₹1.`;

      try {
        const corrected = await callGeminiHydrogen({
          geminiApiKey,
          mimeType,
          imageBase64,
          prompt: correctionPrompt,
        });
        const reVerified = reconcileAndVerifyReceipt({
          raw: corrected,
          existingTaxes,
          matchedVenue,
        });
        if (Math.abs(reVerified.verification.delta) <= Math.abs(reconciled.verification.delta)) {
          extracted = corrected;
          reconciled = reVerified;
        }
      } catch {
        // Keep Pass 1 result if Pass 2 fails transiently
      }
    }

    // Quota stays consumed on successful extraction
    quotaConsumedForUserId = null;

    return jsonResponse(
      {
        ...reconciled.normalized,
        matchedVenue: matchedVenue ? { id: matchedVenue.id, name: matchedVenue.name } : null,
        verification: reconciled.verification,
      },
      200
    );
  } catch (error) {
    if (quotaConsumedForUserId) {
      await supabaseAdmin.rpc('refund_ai_scan_quota', { p_user_id: quotaConsumedForUserId });
    }
    const errMessage =
      error instanceof Error ? error.message : 'Failed to process receipt. Please try again.';
    return jsonResponse({ error: errMessage }, 500);
  }
});
