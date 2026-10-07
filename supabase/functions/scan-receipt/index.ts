// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Accept the new mimeType property
    const { imageBase64, mimeType = 'image/jpeg', currentRules, currentTaxes } = await req.json();
    if (!imageBase64) throw new Error('No image provided.');

    // 2. AUTH & QUOTA CHECK
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('UNAUTHORIZED: Sign in to use Magic Scan.');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('UNAUTHORIZED: Invalid session.');

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('ai_scans_used, unlimited_scans')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found.');

    if (!profile.unlimited_scans && profile.ai_scans_used >= 3) {
      throw new Error('RATE_LIMIT_REACHED');
    }

    // 3. GEMINI CALL
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
4. If a Service Charge is applied to the items, set 'applySC' to true for those items.
5. Mathematically normalize any discounts into a single 'discountValue'.

OUTPUT SCHEMA:
Return ONLY raw JSON matching this structure exactly:
{
  "sessionRules": { "isScApplicable": boolean, "serviceChargeRate": number, "discountType": "none" | "flat" | "percentage", "discountValue": "string", "discountMode": "pre-tax" | "post-tax" },
  "newTaxPresets": [{ "tempId": "string", "name": "string", "rate": number, "split": boolean }],
  "items": [{ "name": "string", "qty": number, "price": number, "taxPresetId": "string", "applySC": boolean }]
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
                // 4. Inject the dynamic MIME type here
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.0, response_mime_type: 'application/json' },
        }),
      }
    );

    // 5. Expose the actual Google AI error if it fails
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

    // 6. CHARGE QUOTA ONLY UPON SUCCESS
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
      // 7. RETURN 200 SO THE SDK DOES NOT SWALLOW THE ERROR MESSAGE!
      status: 200,
    });
  }
});
