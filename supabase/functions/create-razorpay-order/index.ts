// deno-lint-ignore no-import-prefix
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const PLAN_CATALOG = {
  trip_pass_7d: {
    amountPaise: 4900,
    days: 7,
    name: '7-Day Trip Pass'
  },
  pro_monthly: {
    amountPaise: 9900,
    days: 30,
    name: 'Ekwly Pro Monthly'
  },
  pro_yearly: {
    amountPaise: 79900,
    days: 365,
    name: 'Ekwly Pro Annual'
  }
};
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    status
  });
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return jsonResponse({
      error: 'Method Not Allowed'
    }, 405);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
  if (!supabaseUrl || !supabaseAnonKey || !razorpayKeyId || !razorpayKeySecret) {
    return jsonResponse({
      error: 'Payment gateway is not configured on the server.'
    }, 503);
  }
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({
        error: 'Sign in required to purchase Ekwly Pro.'
      }, 401);
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({
        error: 'Invalid or expired session.'
      }, 401);
    }
    if (user.is_anonymous) {
      return jsonResponse({
        error: 'Please link a Google or Email account before upgrading to Pro.'
      }, 403);
    }
    const body = await req.json();
    const planId = body.planId;
    if (!planId || !(planId in PLAN_CATALOG)) {
      return jsonResponse({
        error: 'Invalid subscription plan selected.'
      }, 400);
    }
    const plan = PLAN_CATALOG[planId];
    // Razorpay receipt field max length is 40 chars
    const receipt = `ekw_${user.id.slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40);
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: plan.amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          user_id: user.id,
          email: user.email || '',
          plan_type: planId
        }
      })
    });
    if (!orderRes.ok) {
      const errBody = await orderRes.text();
      console.error('Razorpay order creation failed:', orderRes.status, errBody);
      return jsonResponse({
        error: 'Could not initialize payment order. Please try again.'
      }, 502);
    }
    const order = await orderRes.json();
    return jsonResponse({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      planId
    }, 200);
  } catch (err) {
    console.error('create-razorpay-order error:', err);
    return jsonResponse({
      error: 'Unexpected error initializing checkout.'
    }, 500);
  }
});
