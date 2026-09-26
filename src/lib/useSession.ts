import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { showToast, utils } from "./utils";
import type { BillItem } from "./types";

export interface DBMember {
	id: string;
	session_id: string;
	name: string;
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

	// Data States
	const [items, setItems] = useState<BillItem[]>([]);
	const [members, setMembers] = useState<DBMember[]>([]);
	const [claims, setClaims] = useState<DBClaim[]>([]);

	// 1. INITIAL LOAD & WEBSOCKET SUBSCRIPTIONS
	useEffect(() => {
		if (!sessionId) {
			setIsLoading(false);
			return;
		}

		const fetchSessionData = async () => {
			setIsLoading(true);
			const [itemsRes, membersRes, claimsRes] = await Promise.all([
				supabase.from("items").select("*").eq("session_id", sessionId),
				supabase.from("members").select("*").eq("session_id", sessionId),
				supabase.from("claims").select("*").eq("session_id", sessionId),
			]);

			if (itemsRes.data) {
				setItems(
					itemsRes.data.map((dbItem) => ({
						id: dbItem.id,
						name: dbItem.name,
						qty: Number(dbItem.qty),
						unitPrice: Number(dbItem.price),
						applySC: dbItem.apply_sc,
						taxPresetId: dbItem.tax_preset_id || "tx-1",
						taxRate: 0,
						totalBase: Number(dbItem.qty) * Number(dbItem.price),
					}))
				);
			}
			if (membersRes.data) setMembers(membersRes.data);
			if (claimsRes.data) setClaims(claimsRes.data);

			setIsLoading(false);
		};

		fetchSessionData();

		// 2. REAL-TIME MULTIPLAYER SYNC
		const channel = supabase
			.channel(`session-${sessionId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "items", filter: `session_id=eq.${sessionId}` },
				(payload) => {
					if (payload.eventType === "INSERT") {
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
									taxPresetId: newItem.tax_preset_id || "tx-1",
									taxRate: 0,
									totalBase: Number(newItem.qty) * Number(newItem.price),
								},
							];
						});
					}
					if (payload.eventType === "DELETE") {
						setItems((prev) => prev.filter((i) => i.id !== payload.old.id));
					}
				}
			)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "members", filter: `session_id=eq.${sessionId}` },
				(payload) => {
					if (payload.eventType === "INSERT") {
						setMembers((prev) =>
							prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as DBMember]
						);
					}
					if (payload.eventType === "DELETE") {
						setMembers((prev) => prev.filter((m) => m.id !== payload.old.id));
					}
				}
			)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "claims", filter: `session_id=eq.${sessionId}` },
				(payload) => {
					if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
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
					if (payload.eventType === "DELETE") {
						setClaims((prev) =>
							prev.filter(
								(c) => !(c.item_id === payload.old.item_id && c.member_id === payload.old.member_id)
							)
						);
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [sessionId]);

	// 3. OPTIMISTIC MUTATION ACTIONS

	const addMemberToDB = async (name: string) => {
		if (!sessionId) return null;
		const trimmed = name.trim();
		if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
			showToast("Name must be unique.", "error");
			return null;
		}

		const newMember: DBMember = { id: utils.generateId(), session_id: sessionId, name: trimmed };

		// Instantly update UI
		setMembers((prev) => [...prev, newMember]);

		// Background DB Sync
		const { error } = await supabase.from("members").insert(newMember);
		if (error) {
			setMembers((prev) => prev.filter((m) => m.id !== newMember.id));
			showToast("Network error: Failed to add member.", "error");
			return null;
		}
		return newMember;
	};

	const removeMemberFromDB = async (memberId: string) => {
		if (!sessionId) return;

		// Instantly update UI
		setMembers((prev) => prev.filter((m) => m.id !== memberId));
		setClaims((prev) => prev.filter((c) => c.member_id !== memberId));

		// Background DB Sync
		const { error } = await supabase.from("members").delete().eq("id", memberId);
		if (error) showToast("Network error while deleting member.", "error");
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

		// Instantly update UI
		setClaims((prev) => {
			const exists = prev.some((c) => c.member_id === memberId && c.item_id === itemId);
			if (exists)
				return prev.map((c) => (c.member_id === memberId && c.item_id === itemId ? newClaim : c));
			return [...prev, newClaim];
		});

		// Background DB Sync
		if (!value || value.trim() === "" || value === "0") {
			await supabase.from("claims").delete().match({ member_id: memberId, item_id: itemId });
		} else {
			await supabase.from("claims").upsert(newClaim, { onConflict: "item_id,member_id" });
		}
	};
	// --- NEW ACTIONS ---
	const createSessionInDB = async (id: string) => {
		// We use upsert so we don't crash if it accidentally fires twice
		const { error } = await supabase.from("sessions").upsert({ id, status: "draft" });
		if (error) showToast("Cloud Sync Error: Could not initialize session.", "error");
	};

	const addItemToDB = async (item: BillItem) => {
		if (!sessionId) return;

		setItems((prev) => [...prev, item]); // Optimistic UI

		const { error } = await supabase.from("items").insert({
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
			showToast("Network error: Failed to add item.", "error");
		}
	};

	const updateItemInDB = async (item: BillItem) => {
		if (!sessionId) return;

		setItems((prev) => prev.map((i) => (i.id === item.id ? item : i))); // Optimistic UI

		const { error } = await supabase
			.from("items")
			.update({
				name: item.name,
				qty: item.qty,
				price: item.unitPrice,
				apply_sc: item.applySC,
				tax_preset_id: item.taxPresetId,
			})
			.eq("id", item.id);

		if (error) showToast("Network error: Failed to update item.", "error");
	};

	const removeItemFromDB = async (itemId: string) => {
		if (!sessionId) return;

		setItems((prev) => prev.filter((i) => i.id !== itemId)); // Optimistic UI
		setClaims((prev) => prev.filter((c) => c.item_id !== itemId)); // Cascade delete local claims

		const { error } = await supabase.from("items").delete().eq("id", itemId);
		if (error) showToast("Network error: Failed to delete item.", "error");
	};

	return {
		isLoading,
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
		},
	};
}
