import { Capacitor } from '@capacitor/core';
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

  // Google Play Store Compliance Guard: Native Android/iOS builds cannot open third-party web payment gateways
  if (Capacitor.isNativePlatform()) {
    const subject = encodeURIComponent(`Ekwly ${plan.name} Activation`);
    const body = encodeURIComponent(
      `Hi, I would like to activate ${plan.name} (₹${plan.priceInr}) on my Ekwly account.\n\nRegistered Email: ${params.userEmail || ''}\nUser ID: ${params.userId || ''}`
    );
    window.location.href = `mailto:lloy.dutta@gmail.com?subject=${subject}&body=${body}`;
    return;
  }

  const keyId = import.meta.env.PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    // Graceful fallback before PUBLIC_RAZORPAY_KEY_ID is added to .env
    const subject = encodeURIComponent(`Ekwly ${plan.name} Upgrade Request (₹${plan.priceInr})`);
    const body = encodeURIComponent(
      `Hi, I would like to upgrade my account to ${plan.name} (₹${plan.priceInr}).\n\nRegistered Email: ${params.userEmail || ''}\nUser ID: ${params.userId || ''}`
    );
    showToast('Opening upgrade request...', 'default');
    window.location.href = `mailto:lloy.dutta@gmail.com?subject=${subject}&body=${body}`;
    return;
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    showToast('Could not load Razorpay Checkout. Check your connection.', 'error');
    return;
  }

  const rzp = new window.Razorpay({
    key: keyId,
    amount: plan.amountPaise,
    currency: 'INR',
    name: 'Ekwly',
    description: `${plan.name} (${plan.periodLabel})`,
    prefill: {
      name: params.userName || '',
      email: params.userEmail || '',
    },
    notes: {
      user_id: params.userId || '',
      email: params.userEmail || '',
      plan_type: plan.id,
    },
    theme: {
      color: '#0080FF',
    },
    handler: () => {
      utils.haptic('heavy');
      swrCache.invalidate('analytics_');
      swrCache.invalidate('profile_');
      showToast(`${plan.name} activated! Refreshing your Pro status...`, 'success');
      if (params.onSuccess) params.onSuccess();
    },
  });

  rzp.on('payment.failed', (resp: any) => {
    showToast(resp?.error?.description || 'Payment was not completed.', 'error');
  });

  rzp.open();
}
