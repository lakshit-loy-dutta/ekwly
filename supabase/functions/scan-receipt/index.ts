// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, currentRules, currentTaxes } = await req.json();
    if (!imageBase64) throw new Error('No image provided');

    // 1. RATE LIMITING & AUTH CHECK
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('UNAUTHORIZED: Sign in to use Magic Scan');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('UNAUTHORIZED: Invalid session');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('ai_scans_used, unlimited_scans')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    if (!profile.unlimited_scans && profile.ai_scans_used >= 3) {
      throw new Error('RATE_LIMIT_REACHED');
    }

    // 2. GEMINI CALL
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const prompt = `
You are an expert tax accountant for Indian restaurants. Analyze this receipt and extract the data strictly into the provided JSON schema.

KNOWN VENUE CONTEXT:
The user has historically identified these tax rules for this venue:
- Service Charge Applicable: ${currentRules?.isScApplicable} (${currentRules?.serviceChargeRate * 100}%)
- Existing Tax Presets: ${JSON.stringify(currentTaxes)}

EXTRACTION RULES:
1. Extract all food/drink items. Ignore subtotal, tax, and round-off rows.
2. For each item, assign the correct 'taxPresetId' from the Existing Tax Presets context. 
3. If an item requires a tax that is NOT in the Existing Tax Presets, define it in the 'newTaxPresets' array with a unique 'tempId' (e.g., "temp-1"), and use that tempId for the item.
4. If the receipt shows a Service Charge applied to the items, set 'applySC' to true for those items.
5. If there is a discount on the receipt, mathematically normalize it into a single 'discountValue'.

OUTPUT SCHEMA:
Return ONLY raw JSON matching this structure exactly:
{
  "sessionRules": {
    "isScApplicable": boolean,
    "serviceChargeRate": number,
    "discountType": "none" | "flat" | "percentage",
    "discountValue": "string",
    "discountMode": "pre-tax" | "post-tax"
  },
  "newTaxPresets": [
    { "tempId": "string", "name": "string", "rate": number, "split": boolean }
  ],
  "items": [
    { "name": "string", "qty": number, "price": number, "taxPresetId": "string", "applySC": boolean }
  ]
}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.0, response_mime_type: 'application/json' },
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates[0].content.parts[0].text;
    const parsedJson = JSON.parse(rawText);

    // 3. INCREMENT USAGE COUNT
    await supabaseClient
      .from('profiles')
      .update({ ai_scans_used: profile.ai_scans_used + 1 })
      .eq('id', user.id);

    return new Response(JSON.stringify(parsedJson), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    // TYPE FIX: Strictly evaluate the unknown error type
    const errMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
