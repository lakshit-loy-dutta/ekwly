import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '../supabase';
import { showToast, utils } from '../utils';
import { enqueueMutation } from './offlineQueue';
import type { BillItem, TaxPreset, Transaction } from '../types';
import type { DBMember, DBClaim, SessionRules } from '../useSession';

interface MutationDeps {
  sessionId: string | null;
  items: BillItem[];
  members: DBMember[];
  setSessionStatus: Dispatch<SetStateAction<'draft' | 'locked' | 'archived'>>;
  setSessionRules: Dispatch<SetStateAction<SessionRules>>;
  setTaxPresets: Dispatch<SetStateAction<TaxPreset[]>>;
  setItems: Dispatch<SetStateAction<BillItem[]>>;
  setMembers: Dispatch<SetStateAction<DBMember[]>>;
  setClaims: Dispatch<SetStateAction<DBClaim[]>>;
  setLedger: Dispatch<SetStateAction<any[]>>;
}

export function useSessionMutations(deps: MutationDeps) {
  const {
    sessionId,
    items,
    members,
    setSessionStatus,
    setSessionRules,
    setTaxPresets,
    setItems,
    setMembers,
    setClaims,
    setLedger,
  } = deps;

  const updateSessionRulesInDB = async (updates: Partial<SessionRules>) => {
    if (!sessionId) return;
    setSessionRules((prev) => ({ ...prev, ...updates }));
    const payload: any = {
      venue_name: updates.venueName,
      is_sc_applicable: updates.isScApplicable,
      service_charge_rate: updates.serviceChargeRate,
      sc_tax_preset_id: updates.scTaxPresetId,
      discount_type: updates.discountType,
      discount_value: updates.discountValue ? parseFloat(updates.discountValue) : null,
      discount_mode: updates.discountMode,
    };
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    if (!navigator.onLine) {
      enqueueMutation('sessions', 'UPDATE', payload, { id: sessionId });
      return;
    }
    await supabase.from('sessions').update(payload).eq('id', sessionId);
  };

  const addTaxPresetToDB = async (preset: TaxPreset) => {
    if (!sessionId) return;
    setTaxPresets((prev) => [...prev, preset]);

    const payload = {
      id: preset.id,
      session_id: sessionId,
      name: preset.name,
      rate: preset.rate,
      split: preset.split,
    };

    if (!navigator.onLine) {
      enqueueMutation('tax_presets', 'UPSERT', payload);
      return;
    }
    await supabase.from('tax_presets').insert(payload);
  };

  const removeTaxPresetFromDB = async (id: string) => {
    if (!sessionId) return;
    setTaxPresets((prev) => prev.filter((t) => t.id !== id));

    if (!navigator.onLine) {
      enqueueMutation('tax_presets', 'DELETE', null, { id });
      return;
    }
    await supabase.from('tax_presets').delete().eq('id', id);
  };

  const createSessionInDB = async (id: string, pin: string, name?: string | null) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!existingSession) {
      await supabase.from('sessions').insert({
        id,
        name: name || null,
        status: 'draft',
        pin,
        host_id: user?.id || null,
      });
    }

    if (user) {
      const hostName = user.user_metadata?.full_name?.split(' ')[0] || 'Host';
      const { data: existingHost } = await supabase
        .from('members')
        .select('id')
        .eq('session_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingHost) {
        const newHostMember: DBMember = {
          id: utils.generateId(),
          session_id: id,
          name: hostName,
          user_id: user.id,
          paid_amount: 0,
        };

        setMembers((prev) =>
          prev.some((m) => m.user_id === user.id) ? prev : [...prev, newHostMember]
        );
        await supabase.from('members').insert(newHostMember);
      }
    }

    const { data: existingTaxes } = await supabase
      .from('tax_presets')
      .select('id')
      .eq('session_id', id);

    if (!existingTaxes || existingTaxes.length === 0) {
      const defaultTaxes = [
        { id: utils.generateId(), session_id: id, name: 'Food GST', rate: 5, split: true },
        { id: utils.generateId(), session_id: id, name: 'Alcohol VAT', rate: 6, split: false },
        { id: utils.generateId(), session_id: id, name: 'Exempt', rate: 0, split: false },
      ];
      setTaxPresets((prev) => (prev.length > 0 ? prev : defaultTaxes));
      await supabase.from('tax_presets').upsert(defaultTaxes);
    }
  };

  const addMemberToDB = async (name: string, overrideUserId?: string) => {
    if (!sessionId) return null;
    const trimmed = name.trim();
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      return showToast('Name must be unique.', 'error');
    }

    const newMember: DBMember = {
      id: utils.generateId(),
      session_id: sessionId,
      name: trimmed,
      user_id: overrideUserId || null,
      paid_amount: 0,
    };

    setMembers((prev) => [...prev, newMember]);

    if (!navigator.onLine) {
      enqueueMutation('members', 'UPSERT', newMember);
      return newMember;
    }

    const { error } = await supabase.from('members').insert(newMember);
    if (error) {
      setMembers((prev) => prev.filter((m) => m.id !== newMember.id));
      showToast('Network error: Failed to add member.', 'error');
    }
    return newMember;
  };

  const removeMemberFromDB = async (memberId: string) => {
    if (!sessionId) return;
    const memberBackup = members.find((m) => m.id === memberId);

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setClaims((prev) => prev.filter((c) => c.member_id !== memberId));

    if (!navigator.onLine) {
      enqueueMutation('members', 'DELETE', null, { id: memberId });
      return;
    }

    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error && memberBackup) {
      setMembers((prev) => [...prev, memberBackup]);
      showToast('Network error: Failed to remove member.', 'error');
    }
  };

  const claimMemberIdentity = async (memberId: string) => {
    if (!sessionId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return showToast('Sign in to claim a profile.', 'error');
    if (members.some((m) => m.user_id === user.id)) {
      return showToast('You are already at this table.', 'error');
    }

    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_id: user.id } : m)));
    showToast('Profile linked successfully!', 'success');

    if (!navigator.onLine) {
      enqueueMutation('members', 'UPDATE', { user_id: user.id }, { id: memberId });
      return;
    }
    await supabase.from('members').update({ user_id: user.id }).eq('id', memberId);
  };

  const updateMemberPaymentInDB = async (memberId: string, amount: number) => {
    if (!sessionId) return;
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, paid_amount: amount } : m)));

    if (!navigator.onLine) {
      enqueueMutation('members', 'UPDATE', { paid_amount: amount }, { id: memberId });
      return;
    }
    await supabase.from('members').update({ paid_amount: amount }).eq('id', memberId);
  };

  const updateClaimInDB = async (memberId: string, itemId: string, value: string) => {
    if (!sessionId) return;
    const newClaim: DBClaim = {
      session_id: sessionId,
      member_id: memberId,
      item_id: itemId,
      value,
    };
    const isEmpty = !value || value.trim() === '' || value === '0';

    setClaims((prev) => {
      if (isEmpty) return prev.filter((c) => !(c.member_id === memberId && c.item_id === itemId));
      const exists = prev.some((c) => c.member_id === memberId && c.item_id === itemId);
      return exists
        ? prev.map((c) => (c.member_id === memberId && c.item_id === itemId ? newClaim : c))
        : [...prev, newClaim];
    });

    if (!navigator.onLine) {
      if (isEmpty) {
        enqueueMutation('claims', 'DELETE', null, { member_id: memberId, item_id: itemId });
      } else {
        enqueueMutation('claims', 'UPSERT', newClaim, 'item_id,member_id');
      }
      return;
    }

    if (isEmpty) {
      await supabase.from('claims').delete().match({ member_id: memberId, item_id: itemId });
    } else {
      await supabase.from('claims').upsert(newClaim, { onConflict: 'item_id,member_id' });
    }
  };

  const batchUpdateClaimsInDB = async (
    claimUpdates: { memberId: string; itemId: string; value: string }[]
  ) => {
    if (!sessionId) return;
    const newClaims: DBClaim[] = [];
    const toDelete: { member_id: string; item_id: string }[] = [];

    claimUpdates.forEach(({ memberId, itemId, value }) => {
      const isEmpty = !value || value.trim() === '' || value === '0';
      if (isEmpty) toDelete.push({ member_id: memberId, item_id: itemId });
      else newClaims.push({ session_id: sessionId, member_id: memberId, item_id: itemId, value });
    });

    setClaims((prev) => {
      let updated = [...prev];
      toDelete.forEach((del) => {
        updated = updated.filter(
          (c) => !(c.member_id === del.member_id && c.item_id === del.item_id)
        );
      });
      newClaims.forEach((nc) => {
        const exists = updated.some(
          (c) => c.item_id === nc.item_id && c.member_id === nc.member_id
        );
        if (exists) {
          updated = updated.map((c) =>
            c.item_id === nc.item_id && c.member_id === nc.member_id ? nc : c
          );
        } else {
          updated.push(nc);
        }
      });
      return updated;
    });

    if (!navigator.onLine) {
      if (newClaims.length > 0) enqueueMutation('claims', 'UPSERT', newClaims, 'item_id,member_id');
      for (const del of toDelete) enqueueMutation('claims', 'DELETE', null, del);
      return;
    }

    if (newClaims.length > 0) {
      await supabase.from('claims').upsert(newClaims, { onConflict: 'item_id,member_id' });
    }
    for (const del of toDelete) {
      await supabase
        .from('claims')
        .delete()
        .match({ member_id: del.member_id, item_id: del.item_id });
    }
  };

  const addItemToDB = async (item: BillItem) => {
    if (!sessionId) return;
    setItems((prev) => [...prev, item]);

    const payload = {
      id: item.id,
      session_id: sessionId,
      name: item.name,
      qty: item.qty,
      price: item.unitPrice,
      apply_sc: item.applySC,
      tax_preset_id: item.taxPresetId,
    };

    if (!navigator.onLine) {
      enqueueMutation('items', 'UPSERT', payload);
      return;
    }

    const { error } = await supabase.from('items').insert(payload);
    if (error) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showToast('Network error: Failed to add item.', 'error');
    }
  };

  const addItemsBatchToDB = async (newItems: BillItem[]) => {
    if (!sessionId || newItems.length === 0) return;
    setItems((prev) => [...prev, ...newItems]);

    const payloads = newItems.map((item) => ({
      id: item.id,
      session_id: sessionId,
      name: item.name,
      qty: item.qty,
      price: item.unitPrice,
      apply_sc: item.applySC,
      tax_preset_id: item.taxPresetId,
    }));

    if (!navigator.onLine) {
      enqueueMutation('items', 'UPSERT', payloads);
      return;
    }

    const { error } = await supabase.from('items').insert(payloads);
    if (error) {
      const addedIds = new Set(newItems.map((i) => i.id));
      setItems((prev) => prev.filter((i) => !addedIds.has(i.id)));
      showToast('Network error: Failed to save scanned items.', 'error');
    }
  };

  const replaceTaxPresetsInDB = async (newPresets: TaxPreset[]) => {
    if (!sessionId) return;
    setTaxPresets(newPresets);

    const payloads = newPresets.map((p) => ({
      id: p.id,
      session_id: sessionId,
      name: p.name,
      rate: p.rate,
      split: p.split,
    }));

    if (!navigator.onLine) {
      enqueueMutation('tax_presets', 'DELETE', null, { session_id: sessionId });
      if (payloads.length > 0) enqueueMutation('tax_presets', 'UPSERT', payloads);
      return;
    }

    await supabase.from('tax_presets').delete().eq('session_id', sessionId);
    if (payloads.length > 0) {
      await supabase.from('tax_presets').insert(payloads);
    }
  };

  const updateItemInDB = async (item: BillItem) => {
    if (!sessionId) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));

    const payload = {
      name: item.name,
      qty: item.qty,
      price: item.unitPrice,
      apply_sc: item.applySC,
      tax_preset_id: item.taxPresetId,
    };

    if (!navigator.onLine) {
      enqueueMutation('items', 'UPDATE', payload, { id: item.id });
      return;
    }
    await supabase.from('items').update(payload).eq('id', item.id);
  };

  const removeItemFromDB = async (itemId: string) => {
    if (!sessionId) return;
    const itemBackup = items.find((i) => i.id === itemId);

    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setClaims((prev) => prev.filter((c) => c.item_id !== itemId));

    if (!navigator.onLine) {
      enqueueMutation('items', 'DELETE', null, { id: itemId });
      return;
    }

    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (error && itemBackup) {
      setItems((prev) => [...prev, itemBackup]);
      showToast('Network error: Failed to remove item.', 'error');
    }
  };

  const saveLedgerToDB = async (transactions: Transaction[]) => {
    if (!sessionId) return;

    await supabase.from('ledger').delete().eq('session_id', sessionId);

    const ledgerEntries = transactions.map((t) => ({
      session_id: sessionId,
      creditor_id: t.creditor_id || null,
      creditor_fallback_name: t.creditor_name,
      debtor_id: t.debtor_id || null,
      debtor_fallback_name: t.debtor_name,
      amount: t.amount,
      settled: false,
    }));

    if (ledgerEntries.length > 0) {
      const { data, error } = await supabase.from('ledger').insert(ledgerEntries).select();

      if (data) {
        const mappedData = data.map((l: any) => ({
          ...l,
          creditor_name: l.creditor_fallback_name,
          debtor_name: l.debtor_fallback_name,
        }));
        setLedger(mappedData);
      }
      if (error) {
        console.error('Ledger save error:', error);
      }
    } else {
      setLedger([]);
    }
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

    if (!navigator.onLine) {
      enqueueMutation('ledger', 'UPDATE', { settled: !currentStatus }, { id: ledgerId });
      return;
    }
    await supabase.from('ledger').update({ settled: !currentStatus }).eq('id', ledgerId);
  };

  return {
    createSessionInDB,
    updateSessionRulesInDB,
    addTaxPresetToDB,
    removeTaxPresetFromDB,
    addItemToDB,
    addItemsBatchToDB,
    replaceTaxPresetsInDB,
    updateItemInDB,
    removeItemFromDB,
    addMemberToDB,
    removeMemberFromDB,
    claimMemberIdentity,
    updateClaimInDB,
    batchUpdateClaimsInDB,
    updateMemberPaymentInDB,
    saveLedgerToDB,
    lockSessionInDB,
    unlockSessionInDB,
    deleteActiveSessionInDB,
    toggleLedgerSettledInDB,
  };
}
