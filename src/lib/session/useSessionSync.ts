import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { processOfflineQueue } from './offlineQueue';
import type { BillItem, TaxPreset } from '../types';
import type { DBMember, DBClaim, SessionRules } from '../useSession';

export function useSessionSync(sessionId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'draft' | 'locked' | 'archived'>('draft');

  const [sessionRules, setSessionRules] = useState<SessionRules>({
    venueName: '',
    isScApplicable: false,
    serviceChargeRate: 0,
    scTaxPresetId: 'inherit',
    discountType: 'none',
    discountValue: '',
    discountMode: 'post-tax',
  });
  const [taxPresets, setTaxPresets] = useState<TaxPreset[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);
  const [members, setMembers] = useState<DBMember[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [claims, setClaims] = useState<DBClaim[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  const fetchSessionData = useCallback(
    async (isBackground = false) => {
      if (!sessionId) return;
      if (!isBackground) setIsLoading(true);

      const [itemsRes, membersRes, claimsRes, sessionRes, ledgerRes, taxRes] = await Promise.all([
        supabase.from('items').select('*').eq('session_id', sessionId),
        supabase.from('members').select('*').eq('session_id', sessionId),
        supabase.from('claims').select('*').eq('session_id', sessionId),
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('ledger').select('*').eq('session_id', sessionId),
        supabase.from('tax_presets').select('*').eq('session_id', sessionId),
      ]);

      if (sessionRes.data) {
        setSessionStatus(sessionRes.data.status);
        setHostId(sessionRes.data.host_id);
        setSessionRules({
          venueName: sessionRes.data.venue_name || '',
          isScApplicable: Boolean(sessionRes.data.is_sc_applicable),
          serviceChargeRate: Number(
            (sessionRes.data.service_charge_rate || 0) > 1
              ? sessionRes.data.service_charge_rate / 100
              : sessionRes.data.service_charge_rate || 0
          ),
          scTaxPresetId: sessionRes.data.sc_tax_preset_id || 'inherit',
          discountType: sessionRes.data.discount_type || 'none',
          discountValue: sessionRes.data.discount_value?.toString() || '',
          discountMode: sessionRes.data.discount_mode || 'post-tax',
        });
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
        setItems(
          itemsRes.data.map((dbItem) => ({
            id: dbItem.id,
            name: dbItem.name,
            qty: Number(dbItem.qty),
            unitPrice: Number(dbItem.price),
            applySC: dbItem.apply_sc,
            taxPresetId: dbItem.tax_preset_id || 'tx-1',
            taxRate: 0,
            totalBase: Number(dbItem.qty) * Number(dbItem.price),
          }))
        );
      }
      if (membersRes.data) {
        setMembers(membersRes.data.map((m) => ({ ...m, paid_amount: Number(m.paid_amount || 0) })));
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

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          setSessionStatus(payload.new.status);
          setHostId(payload.new.host_id);
          setSessionRules({
            venueName: payload.new.venue_name || '',
            isScApplicable: Boolean(payload.new.is_sc_applicable),
            serviceChargeRate: Number(
              (payload.new.service_charge_rate || 0) > 1
                ? payload.new.service_charge_rate / 100
                : payload.new.service_charge_rate || 0
            ),
            scTaxPresetId: payload.new.sc_tax_preset_id || 'inherit',
            discountType: payload.new.discount_type || 'none',
            discountValue: payload.new.discount_value?.toString() || '',
            discountMode: payload.new.discount_mode || 'post-tax',
          });
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
            const newItem = payload.new as any;
            setItems((prev) =>
              prev.some((i) => i.id === newItem.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: newItem.id,
                      name: newItem.name,
                      qty: Number(newItem.qty),
                      unitPrice: Number(newItem.price),
                      applySC: newItem.apply_sc,
                      taxPresetId: newItem.tax_preset_id || 'tx-1',
                      taxRate: 0,
                      totalBase: Number(newItem.qty) * Number(newItem.price),
                    },
                  ]
            );
          }
          if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== payload.old.id));
          }
          if (payload.eventType === 'UPDATE') {
            const upItem = payload.new as any;
            setItems((prev) =>
              prev.map((i) =>
                i.id === upItem.id
                  ? {
                      ...i,
                      name: upItem.name,
                      qty: Number(upItem.qty),
                      unitPrice: Number(upItem.price),
                      applySC: upItem.apply_sc,
                      taxPresetId: upItem.tax_preset_id,
                      totalBase: Number(upItem.qty) * Number(upItem.price),
                    }
                  : i
              )
            );
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
        if (status === 'SUBSCRIBED') fetchSessionData(true);
      });

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
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSessionData]);

  return {
    isLoading,
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
