// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

async function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return computedHex === signature;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!signature || !webhookSecret) {
      throw new Error('Missing Razorpay webhook signature or secret.');
    }

    const rawBody = await req.text();
    const isValid = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event || '';

    if (
      eventType === 'payment.captured' ||
      eventType === 'subscription.charged' ||
      eventType === 'order.paid'
    ) {
      const entity =
        event.payload?.payment?.entity ||
        event.payload?.subscription?.entity ||
        event.payload?.order?.entity;

      const email: string | undefined = entity?.email || entity?.notes?.email;
      const userId: string | undefined = entity?.notes?.user_id;
      const planType: string = entity?.notes?.plan_type || 'pro_monthly';
      const amountPaise: number = Number(entity?.amount || 0);

      // Determine duration: 7 days for ₹49 Trip Pass, 365 days for Annual, 30 days default
      let daysToAdd = 30;
      if (planType === 'trip_pass_7d' || amountPaise === 4900) {
        daysToAdd = 7;
      } else if (planType === 'pro_yearly' || amountPaise >= 79900) {
        daysToAdd = 365;
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      let profileQuery = supabaseAdmin.from('profiles').select('id, pro_expires_at');
      if (userId) profileQuery = profileQuery.eq('id', userId);
      else if (email) profileQuery = profileQuery.eq('email', email);
      else throw new Error('No user_id or email present in payment payload.');

      const { data: profile } = await profileQuery.maybeSingle();
      if (!profile) throw new Error('Matching user profile not found.');

      const now = new Date();
      const baseDate =
        profile.pro_expires_at && new Date(profile.pro_expires_at) > now
          ? new Date(profile.pro_expires_at)
          : now;

      const newExpiry = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      await supabaseAdmin
        .from('profiles')
        .update({ pro_expires_at: newExpiry.toISOString() })
        .eq('id', profile.id);

      return new Response(
        JSON.stringify({ status: 'ok', userId: profile.id, pro_expires_at: newExpiry }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ status: 'ignored', event: eventType }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
