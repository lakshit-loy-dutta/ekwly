import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { processOfflineQueue } from './offlineQueue';
import type { BillItem, TaxPreset } from '../types';
import type { DBMember, DBClaim, SessionRules } from '../useSession';

function mapDbItemToBillItem(dbItem: any): BillItem {
  return {
    id: dbItem.id,
    name: dbItem.name,
    qty: Number(dbItem.qty),
    unitPrice: Number(dbItem.price),
    applySC: dbItem.apply_sc !== false,
    applyDiscount: dbItem.apply_discount !== false,
    discountType: dbItem.discount_type || 'none',
    discountValue: Number(dbItem.discount_value || 0),
    taxPresetId: dbItem.tax_preset_id || 'tx-1',
    taxRate: 0,
    totalBase: Number(dbItem.qty) * Number(dbItem.price),
  };
}

function mapDbSessionRules(sessionRow: any): SessionRules {
  const rawMode = sessionRow.discount_mode || 'post-tax';
  const rawType = sessionRow.discount_type || 'none';
  const rawVal = sessionRow.discount_value?.toString() || '';
  const rawPostType = sessionRow.post_tax_discount_type || 'none';
  const rawPostVal =
    sessionRow.post_tax_discount_value && Number(sessionRow.post_tax_discount_value) > 0
      ? sessionRow.post_tax_discount_value.toString()
      : '';

  return {
    venueName: sessionRow.venue_name || '',
    isScApplicable: Boolean(sessionRow.is_sc_applicable),
    serviceChargeRate: Number(
      (sessionRow.service_charge_rate || 0) > 1
        ? sessionRow.service_charge_rate / 100
        : sessionRow.service_charge_rate || 0
    ),
    scTaxPresetId: sessionRow.sc_tax_preset_id || 'inherit',
    discountType: rawType,
    discountValue: rawVal,
    discountMode: rawMode,
    postTaxDiscountType: rawPostType,
    postTaxDiscountValue: rawPostVal,
  };
}

export function useSessionSync(sessionId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'draft' | 'locked' | 'archived'>('draft');
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  const [sessionRules, setSessionRules] = useState<SessionRules>({
    venueName: '',
    isScApplicable: false,
    serviceChargeRate: 0,
    scTaxPresetId: 'inherit',
    discountType: 'none',
    discountValue: '',
    discountMode: 'pre-tax',
    postTaxDiscountType: 'none',
    postTaxDiscountValue: '',
  });
  const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);
  const [members, setMembers] = useState<DBMember[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [claims, setClaims] = useState<DBClaim[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user?.id || null));
  }, []);

  const enableRealtime = useCallback(() => {
    if (!sessionId) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ekwly_multiplayer_${sessionId}`, 'true');
    }
    setIsRealtimeActive(true);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    const onEnableEvent = (e: Event) => {
      const custom = e as CustomEvent<{ sessionId?: string }>;
      if (!custom.detail?.sessionId || custom.detail.sessionId === sessionId) {
        enableRealtime();
      }
    };
    window.addEventListener('ekwly:enable-realtime', onEnableEvent);
    return () => window.removeEventListener('ekwly:enable-realtime', onEnableEvent);
  }, [sessionId, enableRealtime]);

  const fetchSessionData = useCallback(
    async (isBackground = false) => {
      if (!sessionId) return;
      if (!isBackground) setIsLoading(true);

      const [itemsRes, membersRes, claimsRes, sessionRes, ledgerRes, taxRes, authRes] =
        await Promise.all([
          supabase.from('items').select('*').eq('session_id', sessionId),
          supabase.from('members').select('*').eq('session_id', sessionId),
          supabase.from('claims').select('*').eq('session_id', sessionId),
          supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
          supabase.from('ledger').select('*').eq('session_id', sessionId),
          supabase.from('tax_presets').select('*').eq('session_id', sessionId),
          supabase.auth.getSession(),
        ]);

      const activeUid = authRes.data.session?.user?.id || null;
      if (activeUid) setCurrentUserId(activeUid);

      if (sessionRes.data) {
        setSessionStatus(sessionRes.data.status);
        setHostId(sessionRes.data.host_id);
        setSessionRules(mapDbSessionRules(sessionRes.data));
      }
      if (taxRes.data) {
        setTaxPresets(
          taxRes.data.map((t: any) => ({
            id: t.id,
            name: t.name,
            rate: Number(t.rate),
            split: t.split,
          }))
        );
      }
      if (itemsRes.data) {
        setItems(itemsRes.data.map(mapDbItemToBillItem));
      }
      if (membersRes.data) {
        const mappedMembers = membersRes.data.map((m) => ({
          ...m,
          paid_amount: Number(m.paid_amount || 0),
        }));
        setMembers(mappedMembers);

        const isShared =
          typeof window !== 'undefined' &&
          localStorage.getItem(`ekwly_multiplayer_${sessionId}`) === 'true';
        const isGuestJoining =
          Boolean(sessionRes.data?.host_id && activeUid && sessionRes.data.host_id !== activeUid) ||
          (typeof window !== 'undefined' &&
            localStorage.getItem(`ekwly_host_${sessionId}`) !== 'true');
        const hasMultipleLinkedUsers =
          mappedMembers.filter((m) => Boolean(m.user_id)).length > 1 ||
          mappedMembers.some((m) => m.user_id && m.user_id !== sessionRes.data?.host_id);

        if (isShared || isGuestJoining || hasMultipleLinkedUsers) {
          setIsRealtimeActive(true);
        }
      }
      if (claimsRes.data) setClaims(claimsRes.data);
      if (ledgerRes.data) {
        setLedger(
          ledgerRes.data.map((l) => ({
            ...l,
            creditor_name: l.creditor_fallback_name,
            debtor_name: l.debtor_fallback_name,
          }))
        );
      }

      if (!isBackground) setIsLoading(false);
    },
    [sessionId]
  );

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }
    fetchSessionData(false);

    const handleWakeUp = async () => {
      if (navigator.onLine) {
        await processOfflineQueue();
      }
      await fetchSessionData(true);
    };
    window.addEventListener('focus', handleWakeUp);
    window.addEventListener('online', handleWakeUp);

    return () => {
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('online', handleWakeUp);
    };
  }, [sessionId, fetchSessionData]);

  useEffect(() => {
    if (!sessionId || !isRealtimeActive) return;

    let isInitialSubscription = true;

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          setSessionStatus(payload.new.status);
          setHostId(payload.new.host_id);
          setSessionRules(mapDbSessionRules(payload.new));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tax_presets',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTaxPresets((prev) =>
              prev.some((t) => t.id === payload.new.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: payload.new.id,
                      name: payload.new.name,
                      rate: Number(payload.new.rate),
                      split: payload.new.split,
                    },
                  ]
            );
          }
          if (payload.eventType === 'DELETE') {
            setTaxPresets((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const mapped: any = {
              ...payload.new,
              creditor_name: payload.new.creditor_fallback_name,
              debtor_name: payload.new.debtor_fallback_name,
            };
            setLedger((prev) => (prev.some((l) => l.id === mapped.id) ? prev : [...prev, mapped]));
          }
          if (payload.eventType === 'UPDATE') {
            const mapped: any = {
              ...payload.new,
              creditor_name: payload.new.creditor_fallback_name,
              debtor_name: payload.new.debtor_fallback_name,
            };
            setLedger((prev) => prev.map((l) => (l.id === mapped.id ? mapped : l)));
          }
          if (payload.eventType === 'DELETE') {
            setLedger((prev) => prev.filter((l) => l.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = mapDbItemToBillItem(payload.new);
            setItems((prev) => (prev.some((i) => i.id === newItem.id) ? prev : [...prev, newItem]));
          }
          if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== payload.old.id));
          }
          if (payload.eventType === 'UPDATE') {
            const upItem = mapDbItemToBillItem(payload.new);
            setItems((prev) => prev.map((i) => (i.id === upItem.id ? upItem : i)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMembers((prev) =>
              prev.some((m) => m.id === payload.new.id)
                ? prev
                : [
                    ...prev,
                    {
                      ...(payload.new as DBMember),
                      paid_amount: Number(payload.new.paid_amount || 0),
                    },
                  ]
            );
          }
          if (payload.eventType === 'UPDATE') {
            setMembers((prev) =>
              prev.map((m) =>
                m.id === payload.new.id
                  ? {
                      ...m,
                      name: payload.new.name ?? m.name,
                      user_id: payload.new.user_id ?? m.user_id,
                      paid_amount: Number(payload.new.paid_amount || 0),
                    }
                  : m
              )
            );
          }
          if (payload.eventType === 'DELETE') {
            setMembers((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newClaim = payload.new as DBClaim;
            setClaims((prev) => {
              const exists = prev.some(
                (c) => c.item_id === newClaim.item_id && c.member_id === newClaim.member_id
              );
              if (exists) {
                return prev.map((c) =>
                  c.item_id === newClaim.item_id && c.member_id === newClaim.member_id
                    ? newClaim
                    : c
                );
              }
              return [...prev, newClaim];
            });
          }
          if (payload.eventType === 'DELETE') {
            setClaims((prev) =>
              prev.filter(
                (c) => !(c.item_id === payload.old.item_id && c.member_id === payload.old.member_id)
              )
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (isInitialSubscription) {
            isInitialSubscription = false;
          } else {
            fetchSessionData(true);
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, isRealtimeActive, fetchSessionData]);

  return {
    isLoading,
    isRealtimeActive,
    enableRealtime,
    currentUserId,
    sessionStatus,
    setSessionStatus,
    sessionRules,
    setSessionRules,
    taxPresets,
    setTaxPresets,
    items,
    setItems,
    members,
    setMembers,
    hostId,
    claims,
    setClaims,
    ledger,
    setLedger,
  };
}
