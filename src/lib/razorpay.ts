import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { showToast, utils } from './utils';
import { swrCache } from './swrCache';

export type EkwlyPlanId = 'trip_pass_7d' | 'pro_monthly' | 'pro_yearly';

export interface EkwlyPlanSpec {
  id: EkwlyPlanId;
  name: string;
  badge: string;
  priceInr: number;
  amountPaise: number;
  periodLabel: string;
  description: string;
}

export const EKWLY_PLANS: EkwlyPlanSpec[] = [
  {
    id: 'trip_pass_7d',
    name: '7-Day Trip Pass',
    badge: 'WEEKEND / GOA TRIP',
    priceInr: 49,
    amountPaise: 4900,
    periodLabel: 'for 7 days (One-Time)',
    description: 'Unlimited AI Magic Scans & Bento Receipt Cards for your entire group trip.',
  },
  {
    id: 'pro_monthly',
    name: 'Ekwly Pro Monthly',
    badge: 'MOST FLEXIBLE',
    priceInr: 99,
    amountPaise: 9900,
    periodLabel: '/ month',
    description: 'Unlimited AI Magic Scans, Category Spend Audit, Top Venues & CSV Exports.',
  },
  {
    id: 'pro_yearly',
    name: 'Ekwly Pro Annual',
    badge: 'BEST VALUE • SAVE 33%',
    priceInr: 799,
    amountPaise: 79900,
    periodLabel: '/ year (₹66/mo)',
    description: 'Full year of unlimited AI Magic Scans, Pro Analytics & priority support.',
  },
];

interface CreateOrderResponse {
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  error?: string;
}

interface RazorpayFailureResponse {
  error?: {
    description?: string;
  };
}

let checkoutScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      checkoutScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return checkoutScriptPromise;
}

export async function launchProCheckout(params: {
  planId: EkwlyPlanId;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  onSuccess?: () => void;
}) {
  const plan = EKWLY_PLANS.find((p) => p.id === params.planId) || EKWLY_PLANS[1];

  // Store Policy Guard (Stage 4 will integrate native Play Billing / StoreKit 2)
  if (Capacitor.isNativePlatform()) {
    showToast(
      'In-app Pro upgrades are coming soon on mobile. Pro unlocked on web syncs automatically.',
      'default'
    );
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token || session.user?.is_anonymous) {
    showToast('Sign in with Google or Email before upgrading to Ekwly Pro.', 'error');
    return;
  }

  const [loaded, orderResult] = await Promise.all([
    loadRazorpayScript(),
    supabase.functions.invoke<CreateOrderResponse>('create-razorpay-order', {
      body: { planId: plan.id },
      headers: { Authorization: `Bearer ${session.access_token}` },
    }),
  ]);

  if (!loaded || !window.Razorpay) {
    showToast('Could not load Razorpay Checkout. Check your connection.', 'error');
    return;
  }

  if (orderResult.error || orderResult.data?.error || !orderResult.data?.orderId) {
    const errMsg =
      orderResult.data?.error ||
      orderResult.error?.message ||
      'Payment checkout is temporarily unavailable.';
    showToast(errMsg, 'error');
    return;
  }

  const keyId = orderResult.data.keyId || import.meta.env.PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    showToast('Payment gateway key is not configured.', 'error');
    return;
  }

  const rzp = new window.Razorpay({
    key: keyId,
    order_id: orderResult.data.orderId,
    amount: orderResult.data.amount ?? plan.amountPaise,
    currency: orderResult.data.currency ?? 'INR',
    name: 'Ekwly',
    description: `${plan.name} (${plan.periodLabel})`,
    prefill: {
      name: params.userName || '',
      email: params.userEmail || session.user.email || '',
    },
    theme: {
      color: '#0080FF',
    },
    handler: () => {
      utils.haptic('heavy');
      swrCache.invalidate('analytics_');
      swrCache.invalidate('profile_');
      showToast(`${plan.name} payment received! Activating Pro status...`, 'success');
      if (params.onSuccess) params.onSuccess();
    },
  });

  rzp.on('payment.failed', (resp: unknown) => {
    const failed = resp as RazorpayFailureResponse;
    showToast(failed?.error?.description || 'Payment was not completed.', 'error');
  });

  rzp.open();
}
