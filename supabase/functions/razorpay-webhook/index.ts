// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
const PLAN_CATALOG = {
  trip_pass_7d: {
    amountPaise: 4900,
    days: 7
  },
  pro_monthly: {
    amountPaise: 9900,
    days: 30
  },
  pro_yearly: {
    amountPaise: 79900,
    days: 365
  }
};
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json'
    },
    status
  });
}
function hexToBytes(hex) {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for(let i = 0; i < bytes.length; i++){
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
/** Constant-time HMAC-SHA256 verification */ async function verifyRazorpaySignature(rawBody, signatureHex, secret) {
  const providedBytes = hexToBytes(signatureHex.trim());
  if (!providedBytes) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)));
  if (mac.length !== providedBytes.length) return false;
  let diff = 0;
  for(let i = 0; i < mac.length; i++){
    diff |= mac[i] ^ providedBytes[i];
  }
  return diff === 0;
}
Deno.serve(async (req)=>{
  if (req.method !== 'POST') {
    return jsonResponse({
      error: 'Method Not Allowed'
    }, 405);
  }
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({
      error: 'Webhook server misconfigured.'
    }, 500);
  }
  try {
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      return jsonResponse({
        error: 'Missing webhook signature.'
      }, 401);
    }
    const rawBody = await req.text();
    const isValid = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return jsonResponse({
        error: 'Invalid signature.'
      }, 401);
    }
    const event = JSON.parse(rawBody);
    const eventType = event.event || '';
    // Handle captured payment events (order.paid also carries payment.entity, deduplicated via payment.id)
    if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
      return jsonResponse({
        status: 'ignored',
        event: eventType
      }, 200);
    }
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;
    if (!payment?.id) {
      return jsonResponse({
        error: 'Missing payment entity in webhook payload.'
      }, 400);
    }
    // Enforce server-created Order, captured status, and INR currency
    if (payment.status !== 'captured') {
      return jsonResponse({
        status: 'ignored_not_captured',
        paymentStatus: payment.status
      }, 200);
    }
    if (payment.currency !== 'INR') {
      return jsonResponse({
        error: 'Unsupported currency.'
      }, 400);
    }
    if (!payment.order_id) {
      return jsonResponse({
        error: 'Missing server-signed order_id.'
      }, 400);
    }
    const notes = {
      ...order?.notes || {},
      ...payment.notes || {}
    };
    const planType = notes.plan_type;
    const userId = notes.user_id?.trim() || '';
    const amountPaise = Number(payment.amount || 0);
    if (!planType || !(planType in PLAN_CATALOG)) {
      return jsonResponse({
        error: 'Invalid or missing plan_type.'
      }, 400);
    }
    const expectedPlan = PLAN_CATALOG[planType];
    if (amountPaise !== expectedPlan.amountPaise) {
      console.error(`Amount mismatch for payment ${payment.id}: expected ${expectedPlan.amountPaise}, got ${amountPaise}`);
      return jsonResponse({
        error: 'Payment amount does not match selected plan price.'
      }, 400);
    }
    if (!userId) {
      return jsonResponse({
        error: 'Missing user_id in order notes.'
      }, 400);
    }
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    // Verify user profile exists before recording payment event
    const { data: profile, error: profileErr } = await supabaseAdmin.from('profiles').select('id, pro_expires_at').eq('id', userId).maybeSingle();
    if (profileErr) {
      console.error('Profile lookup error:', profileErr);
      return jsonResponse({
        error: 'Database lookup failed.'
      }, 500);
    }
    if (!profile) {
      return jsonResponse({
        error: 'Matching user profile not found.'
      }, 404);
    }
    // Atomic idempotency claim via UNIQUE(provider_payment_id) on public.payment_events
    const { error: eventInsertErr } = await supabaseAdmin.from('payment_events').insert({
      provider: 'razorpay',
      provider_payment_id: payment.id,
      provider_order_id: payment.order_id,
      user_id: profile.id,
      plan_id: planType,
      amount_paise: amountPaise,
      currency: payment.currency,
      event_type: eventType
    });
    if (eventInsertErr) {
      if (eventInsertErr.code === '23505') {
        return jsonResponse({
          status: 'duplicate_ignored',
          paymentId: payment.id
        }, 200);
      }
      console.error('payment_events insert failed:', eventInsertErr);
      return jsonResponse({
        error: 'Could not record payment event.'
      }, 500);
    }
    // Credit Pro entitlement; rollback idempotency claim if profile update fails so Razorpay retries cleanly
    const now = new Date();
    const baseDate = profile.pro_expires_at && new Date(profile.pro_expires_at) > now ? new Date(profile.pro_expires_at) : now;
    const newExpiry = new Date(baseDate.getTime() + expectedPlan.days * 24 * 60 * 60 * 1000);
    const { error: updateErr } = await supabaseAdmin.from('profiles').update({
      pro_expires_at: newExpiry.toISOString(),
      updated_at: now.toISOString()
    }).eq('id', profile.id);
    if (updateErr) {
      console.error('Profile Pro update failed, rolling back payment_events:', updateErr);
      await supabaseAdmin.from('payment_events').delete().eq('provider_payment_id', payment.id);
      return jsonResponse({
        error: 'Failed to activate Pro entitlement.'
      }, 500);
    }
    return jsonResponse({
      status: 'ok',
      paymentId: payment.id,
      userId: profile.id,
      pro_expires_at: newExpiry.toISOString()
    }, 200);
  } catch (err) {
    console.error('razorpay-webhook error:', err);
    return jsonResponse({
      error: 'Invalid webhook payload.'
    }, 400);
  }
});
