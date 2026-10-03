import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { showToast, utils } from './utils';
import type { BillItem, TaxPreset } from './types';

export interface DBMember {
  id: string;
  session_id: string;
  name: string;
  user_id?: string | null;
  paid_amount: number;
}
export interface DBClaim {
  id: string;
  session_id: string;
  item_id: string;
  member_id: string;
  value: string;
}

export interface SessionRules {
  isScApplicable: boolean;
  serviceChargeRate: number;
  scTaxPresetId: string;
  discountType: 'none' | 'percentage' | 'flat';
  discountValue: string;
  discountMode: 'pre-tax' | 'post-tax';
}

export function useSession(sessionId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'draft' | 'locked' | 'archived'>('draft');

  // Master State
  const [sessionRules, setSessionRules] = useState<SessionRules>({
    isScApplicable: false,
    serviceChargeRate: 0,
    scTaxPresetId: 'none',
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
          isScApplicable: Boolean(sessionRes.data.is_sc_applicable),
          serviceChargeRate: Number(sessionRes.data.service_charge_rate || 0),
          scTaxPresetId: sessionRes.data.sc_tax_preset_id || 'none',
          discountType: sessionRes.data.discount_type || 'none',
          discountValue: sessionRes.data.discount_value?.toString() || '',
          discountMode: sessionRes.data.discount_mode || 'post-tax',
        });
      }
      if (taxRes.data)
        setTaxPresets(
          taxRes.data.map((t: any) => ({
            id: t.id,
            name: t.name,
            rate: Number(t.rate),
            split: t.split,
          }))
        );
      if (itemsRes.data)
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
      if (membersRes.data)
        setMembers(membersRes.data.map((m) => ({ ...m, paid_amount: Number(m.paid_amount || 0) })));
      if (claimsRes.data) setClaims(claimsRes.data);
      if (ledgerRes.data) setLedger(ledgerRes.data);

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
            isScApplicable: Boolean(payload.new.is_sc_applicable),
            serviceChargeRate: Number(payload.new.service_charge_rate || 0),
            scTaxPresetId: payload.new.sc_tax_preset_id || 'none',
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
          if (payload.eventType === 'INSERT')
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
          if (payload.eventType === 'DELETE')
            setTaxPresets((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setLedger((prev) => [...prev, payload.new]);
          if (payload.eventType === 'UPDATE')
            setLedger((prev) => prev.map((l) => (l.id === payload.new.id ? payload.new : l)));
          if (payload.eventType === 'DELETE')
            setLedger((prev) => prev.filter((l) => l.id !== payload.old.id));
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
          if (payload.eventType === 'DELETE')
            setItems((prev) => prev.filter((i) => i.id !== payload.old.id));
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
          if (payload.eventType === 'INSERT')
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
          if (payload.eventType === 'UPDATE')
            setMembers((prev) =>
              prev.map((m) =>
                m.id === payload.new.id
                  ? { ...m, paid_amount: Number(payload.new.paid_amount || 0) }
                  : m
              )
            );
          if (payload.eventType === 'DELETE')
            setMembers((prev) => prev.filter((m) => m.id !== payload.old.id));
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
              if (exists)
                return prev.map((c) =>
                  c.item_id === newClaim.item_id && c.member_id === newClaim.member_id
                    ? newClaim
                    : c
                );
              return [...prev, newClaim];
            });
          }
          if (payload.eventType === 'DELETE')
            setClaims((prev) =>
              prev.filter(
                (c) => !(c.item_id === payload.old.item_id && c.member_id === payload.old.member_id)
              )
            );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fetchSessionData(true);
      });

    const handleWakeUp = () => fetchSessionData(true);
    window.addEventListener('focus', handleWakeUp);
    window.addEventListener('online', handleWakeUp);

    return () => {
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('online', handleWakeUp);
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSessionData]);

  // --- ACTIONS ---
  const updateSessionRulesInDB = async (updates: Partial<SessionRules>) => {
    if (!sessionId) return;
    setSessionRules((prev) => ({ ...prev, ...updates }));
    const payload: any = {
      is_sc_applicable: updates.isScApplicable,
      service_charge_rate: updates.serviceChargeRate,
      sc_tax_preset_id: updates.scTaxPresetId,
      discount_type: updates.discountType,
      discount_value: updates.discountValue ? parseFloat(updates.discountValue) : null,
      discount_mode: updates.discountMode,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
    await supabase.from('sessions').update(payload).eq('id', sessionId);
  };

  const addTaxPresetToDB = async (preset: TaxPreset) => {
    if (!sessionId) return;
    setTaxPresets((prev) => [...prev, preset]);
    await supabase.from('tax_presets').insert({
      id: preset.id,
      session_id: sessionId,
      name: preset.name,
      rate: preset.rate,
      split: preset.split,
    });
  };

  const removeTaxPresetFromDB = async (id: string) => {
    if (!sessionId) return;
    setTaxPresets((prev) => prev.filter((t) => t.id !== id));
    await supabase.from('tax_presets').delete().eq('id', id);
  };

  const createSessionInDB = async (id: string, pin: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. SAFE SESSION CREATION: Check if it exists before writing so we NEVER overwrite a locked room
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!existingSession) {
      await supabase
        .from('sessions')
        .insert({ id, status: 'draft', pin: pin, host_id: user?.id || null });
    }

    // 2. SAFE HOST CREATION: Only insert the Host if they aren't already at the table
    if (user) {
      const hostName = user.user_metadata?.full_name?.split(' ')[0] || 'Host';
      const hostId = `host-${id}-${user.id}`;

      const { data: existingHost } = await supabase
        .from('members')
        .select('id')
        .eq('id', hostId)
        .maybeSingle();

      if (!existingHost) {
        const newHostMember = {
          id: hostId,
          session_id: id,
          name: hostName,
          user_id: user.id,
          paid_amount: 0,
        };

        setMembers((prev) => (prev.some((m) => m.id === hostId) ? prev : [...prev, newHostMember]));
        await supabase.from('members').insert(newHostMember);
      }
    }

    // 3. SAFE TAX CREATION
    const { data: existingTaxes } = await supabase
      .from('tax_presets')
      .select('id')
      .eq('session_id', id);

    if (!existingTaxes || existingTaxes.length === 0) {
      const defaultTaxes = [
        { id: `tax-gst-${id}`, session_id: id, name: 'Food GST', rate: 5, split: true },
        { id: `tax-vat-${id}`, session_id: id, name: 'Alcohol VAT', rate: 6, split: false },
        { id: `tax-exempt-${id}`, session_id: id, name: 'Exempt', rate: 0, split: false },
      ];
      setTaxPresets((prev) => (prev.length > 0 ? prev : defaultTaxes));
      await supabase.from('tax_presets').upsert(defaultTaxes);
    }
  };

  const addMemberToDB = async (name: string, overrideUserId?: string) => {
    if (!sessionId) return null;
    const trimmed = name.trim();
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase()))
      return showToast('Name must be unique.', 'error');
    const newMember: DBMember = {
      id: utils.generateId(),
      session_id: sessionId,
      name: trimmed,
      user_id: overrideUserId || null,
      paid_amount: 0,
    };
    setMembers((prev) => [...prev, newMember]);
    const { error } = await supabase.from('members').insert(newMember);
    if (error) setMembers((prev) => prev.filter((m) => m.id !== newMember.id));
    return newMember;
  };

  const removeMemberFromDB = async (memberId: string) => {
    if (!sessionId) return;
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setClaims((prev) => prev.filter((c) => c.member_id !== memberId));
    await supabase.from('members').delete().eq('id', memberId);
  };

  const updateMemberPaymentInDB = async (memberId: string, amount: number) => {
    if (!sessionId) return;
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, paid_amount: amount } : m)));
    await supabase.from('members').update({ paid_amount: amount }).eq('id', memberId);
  };

  const updateClaimInDB = async (memberId: string, itemId: string, value: string) => {
    if (!sessionId) return;
    const claimId = `${memberId}-${itemId}`;
    const newClaim: DBClaim = {
      id: claimId,
      session_id: sessionId,
      member_id: memberId,
      item_id: itemId,
      value,
    };
    const isEmpty = !value || value.trim() === '' || value === '0';
    setClaims((prev) => {
      if (isEmpty) return prev.filter((c) => !(c.member_id === memberId && c.item_id === itemId));
      const exists = prev.some((c) => c.member_id === memberId && c.item_id === itemId);
      if (exists)
        return prev.map((c) => (c.member_id === memberId && c.item_id === itemId ? newClaim : c));
      return [...prev, newClaim];
    });
    if (isEmpty)
      await supabase.from('claims').delete().match({ member_id: memberId, item_id: itemId });
    else await supabase.from('claims').upsert(newClaim, { onConflict: 'item_id,member_id' });
  };

  const claimMemberIdentity = async (memberId: string) => {
    if (!sessionId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return showToast('Sign in to claim a profile.', 'error');
    if (members.some((m) => m.user_id === user.id))
      return showToast('You are already at this table.', 'error');
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_id: user.id } : m)));
    await supabase.from('members').update({ user_id: user.id }).eq('id', memberId);
    showToast('Profile linked successfully!', 'success');
  };

  const addItemToDB = async (item: BillItem) => {
    if (!sessionId) return;
    setItems((prev) => [...prev, item]);
    const { error } = await supabase.from('items').insert({
      id: item.id,
      session_id: sessionId,
      name: item.name,
      qty: item.qty,
      price: item.unitPrice,
      apply_sc: item.applySC,
      tax_preset_id: item.taxPresetId,
    });
    if (error) setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const updateItemInDB = async (item: BillItem) => {
    if (!sessionId) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    await supabase
      .from('items')
      .update({
        name: item.name,
        qty: item.qty,
        price: item.unitPrice,
        apply_sc: item.applySC,
        tax_preset_id: item.taxPresetId,
      })
      .eq('id', item.id);
  };

  const removeItemFromDB = async (itemId: string) => {
    if (!sessionId) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setClaims((prev) => prev.filter((c) => c.item_id !== itemId));
    await supabase.from('items').delete().eq('id', itemId);
  };

  const saveLedgerToDB = async (transactions: any[]) => {
    if (!sessionId) return;
    await supabase.from('ledger').delete().eq('session_id', sessionId);

    const ledgerEntries = transactions.map((t) => ({
      session_id: sessionId,
      creditor_id: t.creditor_id || null,
      creditor_name: t.creditor_name,
      debtor_id: t.debtor_id || null,
      debtor_name: t.debtor_name,
      amount: t.amount,
      settled: false,
    }));

    // REMOVED setLedger(...) to stop the WebSocket collision
    if (ledgerEntries.length > 0) await supabase.from('ledger').insert(ledgerEntries);
  };

  const lockSessionInDB = async () => {
    if (!sessionId) return;
    setSessionStatus('locked');
    await supabase.from('sessions').update({ status: 'locked' }).eq('id', sessionId);
  };

  const unlockSessionInDB = async () => {
    if (!sessionId) return;
    setSessionStatus('draft');
    await supabase.from('sessions').update({ status: 'draft' }).eq('id', sessionId);
    await supabase.from('ledger').delete().eq('session_id', sessionId);
  };

  const deleteActiveSessionInDB = async () => {
    if (!sessionId) return;
    await supabase.from('sessions').delete().eq('id', sessionId);
  };

  const toggleLedgerSettledInDB = async (ledgerId: string, currentStatus: boolean) => {
    setLedger((prev) =>
      prev.map((l) => (l.id === ledgerId ? { ...l, settled: !currentStatus } : l))
    );
    await supabase.from('ledger').update({ settled: !currentStatus }).eq('id', ledgerId);
  };

  return {
    isLoading,
    sessionStatus,
    sessionRules,
    taxPresets,
    ledger,
    items,
    members,
    claims,
    currentUserId,
    hostId,
    actions: {
      createSessionInDB,
      updateSessionRulesInDB,
      addTaxPresetToDB,
      removeTaxPresetFromDB,
      addItemToDB,
      updateItemInDB,
      removeItemFromDB,
      addMemberToDB,
      removeMemberFromDB,
      claimMemberIdentity,
      updateClaimInDB,
      updateMemberPaymentInDB,
      saveLedgerToDB,
      lockSessionInDB,
      unlockSessionInDB,
      deleteActiveSessionInDB,
      toggleLedgerSettledInDB,
    },
  };
}
