import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { showToast, utils } from './utils';
import type { BillItem } from './types';

export interface DBMember {
  id: string;
  session_id: string;
  name: string;
  user_id?: string | null;
}
export interface DBClaim {
  id: string;
  session_id: string;
  item_id: string;
  member_id: string;
  value: string;
}

export function useSession(sessionId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<'draft' | 'locked' | 'archived'>('draft');
  const [items, setItems] = useState<BillItem[]>([]);
  const [members, setMembers] = useState<DBMember[]>([]);
  const [claims, setClaims] = useState<DBClaim[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);

  const fetchSessionData = useCallback(
    async (isBackground = false) => {
      if (!sessionId) return;
      if (!isBackground) setIsLoading(true);

      const [itemsRes, membersRes, claimsRes, sessionRes, ledgerRes] = await Promise.all([
        supabase.from('items').select('*').eq('session_id', sessionId),
        supabase.from('members').select('*').eq('session_id', sessionId),
        supabase.from('claims').select('*').eq('session_id', sessionId),
        supabase.from('sessions').select('status').eq('id', sessionId).single(),
        supabase.from('ledger').select('*').eq('session_id', sessionId),
      ]);

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
      if (membersRes.data) setMembers(membersRes.data);
      if (claimsRes.data) setClaims(claimsRes.data);
      if (sessionRes.data) setSessionStatus(sessionRes.data.status);
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
            setItems((prev) => {
              if (prev.some((i) => i.id === newItem.id)) return prev;
              return [
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
              ];
            });
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
              prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as DBMember]
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

  const addMemberToDB = async (name: string) => {
    if (!sessionId) return null;
    const trimmed = name.trim();
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Name must be unique.', 'error');
      return null;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const newMember: DBMember = {
      id: utils.generateId(),
      session_id: sessionId,
      name: trimmed,
      user_id: user?.id || null,
    };
    setMembers((prev) => [...prev, newMember]);
    const { error } = await supabase.from('members').insert(newMember);
    if (error) {
      setMembers((prev) => prev.filter((m) => m.id !== newMember.id));
      showToast('Network error: Failed to add member.', 'error');
      return null;
    }
    return newMember;
  };

  const removeMemberFromDB = async (memberId: string) => {
    if (!sessionId) return;
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setClaims((prev) => prev.filter((c) => c.member_id !== memberId));
    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) showToast('Network error while deleting member.', 'error');
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

    if (isEmpty) {
      await supabase.from('claims').delete().match({ member_id: memberId, item_id: itemId });
    } else {
      await supabase.from('claims').upsert(newClaim, { onConflict: 'item_id,member_id' });
    }
  };

  const createSessionInDB = async (id: string, pin: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('sessions')
      .upsert({ id, status: 'draft', pin: pin, host_id: user?.id || null });
    if (error) showToast('Cloud Sync Error: Could not initialize session.', 'error');
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
    if (error) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showToast('Network error: Failed to add item.', 'error');
    }
  };

  const updateItemInDB = async (item: BillItem) => {
    if (!sessionId) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    const { error } = await supabase
      .from('items')
      .update({
        name: item.name,
        qty: item.qty,
        price: item.unitPrice,
        apply_sc: item.applySC,
        tax_preset_id: item.taxPresetId,
      })
      .eq('id', item.id);
    if (error) showToast('Network error: Failed to update item.', 'error');
  };

  const removeItemFromDB = async (itemId: string) => {
    if (!sessionId) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setClaims((prev) => prev.filter((c) => c.item_id !== itemId));
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (error) showToast('Network error: Failed to delete item.', 'error');
  };

  const saveLedgerToDB = async (breakdowns: Record<string, any>) => {
    if (!sessionId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ledger').delete().eq('session_id', sessionId);
    const ledgerEntries = members.reduce<any[]>((acc, m) => {
      const breakdown = breakdowns[m.name];
      if (breakdown && breakdown.totalOwed > 0 && m.user_id !== user.id) {
        acc.push({
          session_id: sessionId,
          creditor_id: user.id,
          debtor_id: m.user_id || null,
          debtor_name: m.name,
          amount: breakdown.totalOwed,
        });
      }
      return acc;
    }, []);
    if (ledgerEntries.length > 0) await supabase.from('ledger').insert(ledgerEntries);
  };

  const lockSessionInDB = async () => {
    if (!sessionId) return;
    setSessionStatus('locked'); // <-- Optimistic UI update instantly changes the screen
    await supabase.from('sessions').update({ status: 'locked' }).eq('id', sessionId);
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
    ledger,
    items,
    members,
    claims,
    actions: {
      createSessionInDB,
      addItemToDB,
      updateItemInDB,
      removeItemFromDB,
      addMemberToDB,
      removeMemberFromDB,
      updateClaimInDB,
      saveLedgerToDB,
      lockSessionInDB,
      toggleLedgerSettledInDB,
    },
  };
}
