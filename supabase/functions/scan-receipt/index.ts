// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageBase64, mimeType = 'image/jpeg', currentRules, currentTaxes } = await req.json();
    if (!imageBase64) throw new Error('No image provided.');

    // 1. AUTH & QUOTA CHECK
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('UNAUTHORIZED: Sign in to use Magic Scan.');

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    if (userError || !user)
      throw new Error(`UNAUTHORIZED: ${userError?.message || 'Invalid session.'}`);

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('ai_scans_used, last_scan_reset, pro_expires_at')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found.');

    const now = new Date();
    const lastReset = new Date(profile.last_scan_reset || 0);
    let scansUsed = profile.ai_scans_used;

    // Check if the month has changed to grant 3 new free scans
    if (
      now.getUTCFullYear() > lastReset.getUTCFullYear() ||
      now.getUTCMonth() > lastReset.getUTCMonth()
    ) {
      scansUsed = 0;
      await supabaseClient
        .from('profiles')
        .update({ ai_scans_used: 0, last_scan_reset: now.toISOString() })
        .eq('id', user.id);
    }

    // Check if user has an active Pro subscription
    const isPro = profile.pro_expires_at && new Date(profile.pro_expires_at) > now;

    if (!isPro && scansUsed >= 3) {
      throw new Error('RATE_LIMIT_REACHED');
    }

    // 2. GEMINI CALL
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const prompt = `
You are an expert tax accountant for Indian restaurants. Analyze this receipt and extract the data strictly into the provided JSON schema.

KNOWN VENUE CONTEXT:
- Service Charge Applicable: ${currentRules?.isScApplicable} (${currentRules?.serviceChargeRate * 100}%)
- Existing Tax Presets: ${JSON.stringify(currentTaxes)}

EXTRACTION RULES:
1. Extract all food/drink items. Ignore subtotal, tax, and round-off rows.
2. For each item, assign the correct 'taxPresetId' from the Existing Tax Presets context. 
3. If an item requires a tax that is NOT in the Existing Tax Presets, define it in the 'newTaxPresets' array with a unique 'tempId', and use that tempId for the item.
4. If a Service Charge is applied, set 'isScApplicable' to true, and set 'serviceChargeRate' to the whole number percentage (e.g. 5 for 5%, 10 for 10%). Set 'applySC' to true for all items that attract this charge.
5. Mathematically normalize any discounts into a single 'discountValue'.
6. Determine how the Service Charge is taxed by analyzing the receipt's math:
   - If taxes are calculated on (Item Base + Item SC), set 'scTaxPresetId' to "inherit".
   - If Service Charge is aggregated and taxed separately, set 'scTaxPresetId' to the specific tax preset ID (or tempId) applied to it.
   - If Service Charge is not taxed at all, set 'scTaxPresetId' to "none".
`;

    // FIX 1: Point to the low-latency 3.5-flash-lite endpoint
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          // FIX 2: Provide a strict response schema to bypass the thinking loop
          generationConfig: {
            temperature: 0.0,
            response_mime_type: 'application/json',
            response_schema: {
              type: 'OBJECT',
              properties: {
                sessionRules: {
                  type: 'OBJECT',
                  properties: {
                    isScApplicable: { type: 'BOOLEAN' },
                    serviceChargeRate: { type: 'NUMBER' },
                    scTaxPresetId: { type: 'STRING' }, // <-- ADD THIS TO THE SCHEMA
                    discountType: { type: 'STRING' },
                    discountValue: { type: 'STRING' },
                    discountMode: { type: 'STRING' },
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
                      taxPresetId: { type: 'STRING' },
                      applySC: { type: 'BOOLEAN' },
                    },
                    required: ['name', 'qty', 'price'],
                  },
                },
              },
              required: ['items'],
            },
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Google API Error: ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      throw new Error('AI failed to read the image. Ensure the receipt is clear.');
    }

    const rawText = geminiData.candidates[0].content.parts[0].text;

    let parsedJson;
    try {
      parsedJson = JSON.parse(rawText);
      if (!parsedJson.items || !Array.isArray(parsedJson.items)) {
        throw new Error('Malformed JSON array');
      }
    } catch (_parseError) {
      throw new Error('AI could not extract valid items. Your quota was NOT charged.');
    }

    // 3. CHARGE QUOTA ONLY UPON SUCCESS
    await supabaseClient
      .from('profiles')
      .update({ ai_scans_used: profile.ai_scans_used + 1 })
      .eq('id', user.id);

    return new Response(JSON.stringify(parsedJson), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
