import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { swrCache } from '../lib/swrCache';
import { utils, showToast } from '../lib/utils';
import BrandLoader from './ui/BrandLoader';
import ProUpgradeSheet from './ui/ProUpgradeSheet';
import {
  BarChart3,
  Sparkles,
  TrendingUp,
  Store,
  Users,
  Lock,
  CheckCircle2,
  PieChart,
  Download,
} from 'lucide-react';

interface VenueStat {
  venue_name: string | null;
  visits: number;
  total_spent: number;
}

interface DebtorStat {
  debtor_name: string;
  total_owed: number;
}

interface CategoryAuditStat {
  foodBase: number;
  liquorAndHighTaxBase: number;
  taxesAndSc: number;
}

interface CachedAnalyticsData {
  isPro: boolean;
  proExpiresAt: string | null;
  scansUsed: number;
  venueStats: VenueStat[];
  topDebtors: DebtorStat[];
  totalSettledSpend: number;
  totalSessionsHosted: number;
  categoryAudit: CategoryAuditStat;
}

interface Props {
  user: SupabaseUser | null;
  onBack: () => void;
}

export default function Analytics({ user }: Props) {
  const cacheKey = `analytics_${user?.id || 'guest'}`;
  const cached = swrCache.get<CachedAnalyticsData>(cacheKey);

  const [isLoading, setIsLoading] = useState(!cached);
  const [isPro, setIsPro] = useState(cached?.isPro || false);
  const [proExpiresAt, setProExpiresAt] = useState<string | null>(cached?.proExpiresAt || null);
  const [scansUsed, setScansUsed] = useState(cached?.scansUsed || 0);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);

  const [venueStats, setVenueStats] = useState<VenueStat[]>(cached?.venueStats || []);
  const [topDebtors, setTopDebtors] = useState<DebtorStat[]>(cached?.topDebtors || []);
  const [totalSettledSpend, setTotalSettledSpend] = useState(cached?.totalSettledSpend || 0);
  const [totalSessionsHosted, setTotalSessionsHosted] = useState(cached?.totalSessionsHosted || 0);
  const [categoryAudit, setCategoryAudit] = useState<CategoryAuditStat>(
    cached?.categoryAudit || { foodBase: 0, liquorAndHighTaxBase: 0, taxesAndSc: 0 }
  );

  const fetchAnalytics = useCallback(async () => {
    if (!user || user.is_anonymous) {
      setIsLoading(false);
      return;
    }

    const [profileRes, venueRes, creditorRes, sessionsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('ai_scans_used, last_scan_reset, pro_expires_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('personal_analytics')
        .select('venue_name, visits, total_spent')
        .eq('user_id', user.id)
        .order('total_spent', { ascending: false })
        .limit(6),
      supabase
        .from('global_ledger')
        .select('debtor_name, total_owed')
        .eq('creditor_id', user.id)
        .order('total_owed', { ascending: false })
        .limit(5),
      supabase
        .from('sessions')
        .select('id, service_charge_rate, is_sc_applicable')
        .eq('host_id', user.id)
        .limit(40),
    ]);

    const now = new Date();
    const exp = profileRes.data?.pro_expires_at || null;
    const nextIsPro = Boolean(exp && new Date(exp) > now);
    const nextScansUsed = profileRes.data?.ai_scans_used || 0;

    const mappedVenues: VenueStat[] = (venueRes.data || []).map((v: any) => ({
      venue_name: v.venue_name || 'Unnamed Venue',
      visits: Number(v.visits || 1),
      total_spent: Number(v.total_spent || 0),
    }));
    const nextSettledSpend = mappedVenues.reduce((acc, row) => acc + row.total_spent, 0);

    const mappedDebtors: DebtorStat[] = (creditorRes.data || []).map((d: any) => ({
      debtor_name: d.debtor_name,
      total_owed: Number(d.total_owed || 0),
    }));

    const hostedRows = sessionsRes.data || [];
    const nextHosted = hostedRows.length;

    // Compute Category Spend Audit across hosted sessions
    let foodBase = 0;
    let liquorAndHighTaxBase = 0;
    let taxesAndSc = 0;

    if (hostedRows.length > 0) {
      const sessionIds = hostedRows.map((s: any) => s.id);
      const scRateBySession = new Map<string, number>();
      hostedRows.forEach((s: any) => {
        const rawRate = Number(s.service_charge_rate || 0);
        const normRate = rawRate > 1 ? rawRate / 100 : rawRate;
        scRateBySession.set(s.id, s.is_sc_applicable ? normRate : 0);
      });

      const [itemsRes, taxesRes] = await Promise.all([
        supabase
          .from('items')
          .select('session_id, qty, price, tax_preset_id, apply_sc')
          .in('session_id', sessionIds),
        supabase.from('tax_presets').select('id, name, rate').in('session_id', sessionIds),
      ]);

      const taxMap = new Map<string, { name: string; rate: number }>();
      (taxesRes.data || []).forEach((t: any) => {
        taxMap.set(t.id, { name: t.name || '', rate: Number(t.rate || 0) });
      });

      (itemsRes.data || []).forEach((item: any) => {
        const base = Number(item.qty || 1) * Number(item.price || 0);
        const preset = taxMap.get(item.tax_preset_id);
        const rate = preset ? preset.rate : 5;
        const name = preset ? preset.name.toLowerCase() : '';
        const scRate = item.apply_sc !== false ? scRateBySession.get(item.session_id) || 0 : 0;

        const isLiquorOrSin =
          rate > 5 || /alcohol|liquor|vat|beer|wine|tobacco|sin|aerated/i.test(name);
        if (isLiquorOrSin) {
          liquorAndHighTaxBase += base;
        } else {
          foodBase += base;
        }

        const itemSc = base * scRate;
        const itemTax = (base + itemSc) * (rate / 100);
        taxesAndSc += itemSc + itemTax;
      });
    }

    const nextCategoryAudit: CategoryAuditStat = {
      foodBase: utils.round2(foodBase),
      liquorAndHighTaxBase: utils.round2(liquorAndHighTaxBase),
      taxesAndSc: utils.round2(taxesAndSc),
    };

    setProExpiresAt(exp);
    setIsPro(nextIsPro);
    setScansUsed(nextScansUsed);
    setVenueStats(mappedVenues);
    setTotalSettledSpend(nextSettledSpend);
    setTopDebtors(mappedDebtors);
    setTotalSessionsHosted(nextHosted);
    setCategoryAudit(nextCategoryAudit);

    swrCache.set<CachedAnalyticsData>(cacheKey, {
      isPro: nextIsPro,
      proExpiresAt: exp,
      scansUsed: nextScansUsed,
      venueStats: mappedVenues,
      topDebtors: mappedDebtors,
      totalSettledSpend: nextSettledSpend,
      totalSessionsHosted: nextHosted,
      categoryAudit: nextCategoryAudit,
    });

    setIsLoading(false);
  }, [user, cacheKey]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportCsv = () => {
    utils.haptic('light');
    const lines = [
      'Category / Venue,Metric,Amount (INR)',
      `Category Audit,Food & Regular Dining Base,${categoryAudit.foodBase.toFixed(2)}`,
      `Category Audit,Liquor / Bar & High-Tax Items,${categoryAudit.liquorAndHighTaxBase.toFixed(2)}`,
      `Category Audit,GST / VAT & Service Charges Paid,${categoryAudit.taxesAndSc.toFixed(2)}`,
      ...venueStats.map(
        (v) =>
          `"${(v.venue_name || 'Venue').replace(/"/g, '""')}",${v.visits} visits,${v.total_spent.toFixed(2)}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.download = `Ekwly_Analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.href = URL.createObjectURL(blob);
    a.click();
    showToast('Expense Analytics CSV downloaded!', 'success');
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-12">
        <BrandLoader fullScreen label="Loading Insights..." />
      </div>
    );
  }

  const maxVenueSpend = Math.max(...venueStats.map((v) => v.total_spent), 1);
  const maxDebtorAmount = Math.max(...topDebtors.map((d) => d.total_owed), 1);
  const totalAuditedSpend = Math.max(
    categoryAudit.foodBase + categoryAudit.liquorAndHighTaxBase + categoryAudit.taxesAndSc,
    1
  );

  return (
    <div className="w-full flex flex-col flex-1 px-4 py-6 md:px-8 bg-page pb-28 relative">
      <ProUpgradeSheet
        isOpen={showUpgradeSheet}
        onClose={() => setShowUpgradeSheet(false)}
        userId={user?.id}
        userEmail={user?.email}
        userName={user?.user_metadata?.full_name}
        onActivated={fetchAnalytics}
      />

      <div className="flex flex-col items-center mb-6 mt-2 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold mb-4 shadow-sm">
          <BarChart3 size={28} />
        </div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-main tracking-tight">Personal Analytics</h2>
          {isPro && (
            <span className="px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-widest bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded-full">
              PRO
            </span>
          )}
        </div>
        <p className="text-muted text-sm font-medium mt-1">
          Your lifetime dining insights, tax audit &amp; venue frequency
        </p>
      </div>

      {/* QUOTA & SUBSCRIPTION STATUS CARD */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-6 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted">
              AI Magic Scan Quota
            </span>
          </div>
          <span className="text-xs font-bold text-primary tabular-nums">
            {isPro ? 'Unlimited (Pro Active)' : `${Math.min(scansUsed, 3)} / 3 Free Used`}
          </span>
        </div>

        <div className="w-full h-2.5 bg-page rounded-full overflow-hidden border border-border">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: isPro ? '100%' : `${Math.min((scansUsed / 3) * 100, 100)}%` }}
          />
        </div>

        {isPro && proExpiresAt && (
          <p className="text-xs text-muted font-medium">
            Pro entitlement active until{' '}
            <strong className="text-main">{new Date(proExpiresAt).toLocaleDateString()}</strong>
          </p>
        )}
      </div>

      {/* KPI SUMMARY GRID */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 text-muted mb-1">
            <TrendingUp size={16} className="text-primary" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">
              Settled Spend
            </span>
          </div>
          <span className="text-xl font-extrabold text-main tabular-nums">
            {utils.formatMoney(totalSettledSpend)}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 text-muted mb-1">
            <Store size={16} className="text-success" />
            <span className="text-[0.65rem] font-bold uppercase tracking-widest">Rooms Hosted</span>
          </div>
          <span className="text-xl font-extrabold text-main tabular-nums">
            {totalSessionsHosted}
          </span>
        </div>
      </div>

      {/* PRO PAYWALL GATE OR FULL CHARTS */}
      {!isPro ? (
        <div className="bg-surface border border-primary/25 rounded-3xl p-6 text-center shadow-sm flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Lock size={22} />
          </div>
          <h3 className="text-lg font-extrabold text-main mb-1">Unlock Deep Dining Insights</h3>
          <p className="text-sm text-muted mb-5 max-w-xs leading-relaxed">
            Get a ₹49 7-Day Trip Pass or Ekwly Pro to unlock your Food vs. Liquor tax audit, top
            dining venues, and unlimited AI receipt scans.
          </p>
          <ul className="flex flex-col gap-2.5 text-left w-full bg-page border border-border rounded-2xl p-4 mb-6">
            <li className="flex items-center gap-2 text-sm font-medium text-main">
              <CheckCircle2 size={16} className="text-success shrink-0" /> Food vs. Liquor vs. Tax
              &amp; S.C. Spend Audit
            </li>
            <li className="flex items-center gap-2 text-sm font-medium text-main">
              <CheckCircle2 size={16} className="text-success shrink-0" /> Top Venues &amp; Debtor
              Leaderboards
            </li>
            <li className="flex items-center gap-2 text-sm font-medium text-main">
              <CheckCircle2 size={16} className="text-success shrink-0" /> Unlimited AI Magic Scans
              &amp; CSV Export
            </li>
          </ul>
          <button
            type="button"
            onClick={() => {
              utils.haptic('medium');
              setShowUpgradeSheet(true);
            }}
            className="w-full h-12 premium-gradient-card text-white rounded-xl font-bold text-sm flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            View Plans — Starting at ₹49
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* CATEGORY SPEND & TAX AUDIT CARD */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                <PieChart size={15} className="text-primary" /> Category &amp; Tax Audit
              </h3>
              <button
                type="button"
                onClick={handleExportCsv}
                className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
              >
                <Download size={13} /> Export CSV
              </button>
            </div>

            {[
              {
                label: 'Food & Regular Dining (≤5% GST)',
                val: categoryAudit.foodBase,
                color: 'bg-primary',
              },
              {
                label: 'Liquor, Bar & Sin Items (>5% VAT/GST)',
                val: categoryAudit.liquorAndHighTaxBase,
                color: 'bg-amber-500',
              },
              {
                label: 'Total GST, VAT & Service Charges',
                val: categoryAudit.taxesAndSc,
                color: 'bg-rose-500',
              },
            ].map((row, idx) => {
              const pct = Math.round((row.val / totalAuditedSpend) * 100);
              return (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold text-main truncate pr-2">{row.label}</span>
                    <span className="font-bold text-main tabular-nums shrink-0">
                      {utils.formatMoney(row.val)}{' '}
                      <span className="text-xs text-muted font-medium">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-page rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, 4)}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.06 }}
                      className={`h-full rounded-full ${row.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* TOP VENUES CHART */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                <Store size={15} className="text-primary" /> Top Dining Venues
              </h3>
              <span className="text-xs text-muted font-medium">By settled spend</span>
            </div>

            {venueStats.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">
                No settled venue data yet. Complete and settle a session to see your breakdown!
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {venueStats.map((v, idx) => {
                  const pct = Math.max((v.total_spent / maxVenueSpend) * 100, 6);
                  return (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-main truncate pr-2">
                          {v.venue_name}
                        </span>
                        <span className="font-bold text-main tabular-nums shrink-0">
                          {utils.formatMoney(v.total_spent)}{' '}
                          <span className="text-xs text-muted font-medium">
                            ({v.visits} {v.visits === 1 ? 'visit' : 'visits'})
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-page rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: idx * 0.06 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TOP DEBTORS LEADERBOARD */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                <Users size={15} className="text-success" /> Top Outstanding Debtors
              </h3>
              <span className="text-xs text-muted font-medium">Unsettled</span>
            </div>

            {topDebtors.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">
                Everyone has settled up with you!
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {topDebtors.map((d, idx) => {
                  const pct = Math.max((d.total_owed / maxDebtorAmount) * 100, 6);
                  return (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-main truncate pr-2">
                          {d.debtor_name}
                        </span>
                        <span className="font-bold text-success tabular-nums shrink-0">
                          +{utils.formatMoney(d.total_owed)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-page rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: idx * 0.06 }}
                          className="h-full bg-success rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
