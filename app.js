const App = {
	state: {
		items: [],
		people: [],
		assignments: {},
		serviceChargeRate: 0,
		scTaxPresetId: "none",
		taxPresets: [
			{ id: "tx-1", name: "Food GST", rate: 5, split: true },
			{ id: "tx-2", name: "Alcohol VAT", rate: 6, split: false },
			{ id: "tx-3", name: "Tobacco Cess", rate: 40, split: false },
			{ id: "tx-4", name: "Exempt", rate: 0, split: false },
		],
		editingItemId: null,
		calculationResult: null,
	},

	utils: {
		round2: (num) => Math.round((num + Number.EPSILON) * 100) / 100,
		formatMoney: (num) => `₹${num.toFixed(2)}`,
		escapeHTML: (str) =>
			String(str).replace(
				/[&<>'"]/g,
				(tag) =>
					({
						"&": "&amp;",
						"<": "&lt;",
						">": "&gt;",
						"'": "&#39;",
						'"': "&quot;",
					})[tag],
			),
		generateId: () =>
			Date.now().toString(36) + Math.random().toString(36).substr(2),
		parseQty: (val) => {
			if (!val) return 0;
			if (typeof val === "number") return val;
			let str = String(val).trim();

			let mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
			if (mixedMatch) {
				let whole = parseFloat(mixedMatch[1]);
				let num = parseFloat(mixedMatch[2]);
				let den = parseFloat(mixedMatch[3]);
				if (den !== 0) return whole + num / den;
			}

			if (str.includes("/")) {
				let parts = str.split("/");
				if (parts.length === 2) {
					let num = parseFloat(parts[0]);
					let den = parseFloat(parts[1]);
					if (!isNaN(num) && !isNaN(den) && den !== 0) {
						return num / den;
					}
				}
			}
			let parsed = parseFloat(str);
			return isNaN(parsed) ? 0 : parsed;
		},
		getFractionString: (qty, dividers) => {
			let n = Math.round(qty * 10000);
			let d = Math.round(dividers * 10000);
			const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
			const divisor = gcd(n, d);
			n /= divisor;
			d /= divisor;
			if (d === 1) return `${n}`;
			if (n > d) {
				const whole = Math.floor(n / d);
				const rem = n % d;
				return `${whole} ${rem}/${d}`;
			}
			return `${n}/${d}`;
		},
		getSplitNames: (name) => {
			let base = name.trim();
			if (/GST/i.test(base)) {
				return {
					cgst: base.replace(/GST/i, "CGST"),
					sgst: base.replace(/GST/i, "SGST"),
				};
			}
			return { cgst: `${base} (CGST)`, sgst: `${base} (SGST)` };
		},
	},

	init() {
		this.renderTaxPresets();
		this.render();
	},

	showToast(message, type = "default") {
		const container = document.getElementById("toast-container");
		const toast = document.createElement("div");
		toast.className = `toast ${type}`;

		const icon =
			type === "error"
				? `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
				: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

		toast.innerHTML = `${icon} <span>${this.utils.escapeHTML(message)}</span>`;
		container.appendChild(toast);

		setTimeout(() => {
			toast.classList.add("fade-out");
			setTimeout(() => toast.remove(), 300);
		}, 3000);
	},

	toggleTheme() {
		const html = document.documentElement;
		const icon = document.getElementById("theme-icon");
		if (html.getAttribute("data-theme") === "light") {
			html.setAttribute("data-theme", "dark");
			icon.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`;
		} else {
			html.setAttribute("data-theme", "light");
			icon.innerHTML = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`;
		}
	},

	renderTaxPresets() {
		const itemTaxEl = document.getElementById("itemTax");
		const scTaxEl = document.getElementById("scTaxSelect");
		const listEl = document.getElementById("taxPresetList");

		const presetOptions = this.state.taxPresets
			.map(
				(t) =>
					`<option value="${t.id}">${this.utils.escapeHTML(t.name)} (${t.rate}%)</option>`,
			)
			.join("");

		itemTaxEl.innerHTML = presetOptions;
		scTaxEl.innerHTML =
			`<option value="none">None</option>` + presetOptions;
		scTaxEl.value = this.state.scTaxPresetId;

		listEl.innerHTML = this.state.taxPresets
			.map((t) => {
				const badges = t.split
					? `<span class="chip-split-badge">Split</span>`
					: "";
				return `
            <div class="chip">
                ${this.utils.escapeHTML(t.name)} (${t.rate}%)${badges}
                <button type="button" onclick="App.removeTaxPreset('${t.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            </div>
            `;
			})
			.join("");
	},

	addTaxPreset() {
		const nameEl = document.getElementById("newTaxName");
		const rateEl = document.getElementById("newTaxRate");
		const splitEl = document.getElementById("newTaxSplit");

		const name = nameEl.value.trim();
		const rate = parseFloat(rateEl.value);
		const split = splitEl ? splitEl.checked : false;

		if (!name) return this.showToast("Preset name is required.", "error");
		if (isNaN(rate) || rate < 0)
			return this.showToast("Valid tax rate is required.", "error");

		this.state.taxPresets.push({
			id: this.utils.generateId(),
			name,
			rate,
			split,
		});

		nameEl.value = "";
		rateEl.value = "";
		if (splitEl) splitEl.checked = true;

		this.renderTaxPresets();
		this.showToast(`Added ${name} preset.`);
	},

	removeTaxPreset(id) {
		if (this.state.taxPresets.length <= 1) {
			return this.showToast(
				"You must have at least one tax preset.",
				"error",
			);
		}
		this.state.taxPresets = this.state.taxPresets.filter(
			(t) => t.id !== id,
		);
		if (this.state.scTaxPresetId === id) this.state.scTaxPresetId = "none";
		this.renderTaxPresets();
		this.renderItems();
	},

	saveItem() {
		const nameEl = document.getElementById("itemName");
		const qtyEl = document.getElementById("itemQty");
		const priceEl = document.getElementById("itemUnitPrice");
		const taxEl = document.getElementById("itemTax");
		const applySCEl = document.getElementById("itemApplySC");

		const name = nameEl.value.trim();
		const qty = parseFloat(qtyEl.value);
		const unitPrice = parseFloat(priceEl.value);

		const taxPreset = this.state.taxPresets.find(
			(t) => t.id === taxEl.value,
		);
		const taxRate = taxPreset ? taxPreset.rate / 100 : 0;
		const taxPresetId = taxPreset ? taxPreset.id : null;
		const applySC = applySCEl.checked;

		if (!name) return this.showToast("Item name is required.", "error");
		if (isNaN(qty) || qty <= 0)
			return this.showToast("Valid quantity is required.", "error");
		if (isNaN(unitPrice) || unitPrice < 0)
			return this.showToast("Valid unit price is required.", "error");

		const totalBase = qty * unitPrice;

		if (this.state.editingItemId) {
			const idx = this.state.items.findIndex(
				(i) => i.id === this.state.editingItemId,
			);
			if (idx > -1) {
				this.state.items[idx] = {
					id: this.state.editingItemId,
					name,
					qty,
					unitPrice,
					taxRate,
					taxPresetId,
					applySC,
					totalBase,
				};
			}
			this.state.editingItemId = null;
			document.getElementById("saveItemBtn").innerHTML =
				`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg> Add`;
			this.showToast(`${name} updated successfully.`);
		} else {
			this.state.items.push({
				id: this.utils.generateId(),
				name,
				qty,
				unitPrice,
				taxRate,
				taxPresetId,
				applySC,
				totalBase,
			});
			this.showToast(`${name} added to bill.`);
		}

		nameEl.value = "";
		priceEl.value = "";
		qtyEl.value = "1";
		nameEl.focus();

		this.render();
	},

	editItem(id) {
		const item = this.state.items.find((i) => i.id === id);
		if (!item) return;

		document.getElementById("itemName").value = item.name;
		document.getElementById("itemQty").value = item.qty;
		document.getElementById("itemUnitPrice").value = item.unitPrice;
		document.getElementById("itemApplySC").checked = item.applySC;

		const taxEl = document.getElementById("itemTax");
		if (
			Array.from(taxEl.options).some(
				(opt) => opt.value === item.taxPresetId,
			)
		) {
			taxEl.value = item.taxPresetId;
		}

		this.state.editingItemId = id;
		document.getElementById("saveItemBtn").innerHTML =
			`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Update`;

		document.getElementById("itemName").focus();
		window.scrollTo({ top: 0, behavior: "smooth" });
	},

	removeItem(id) {
		this.state.items = this.state.items.filter((i) => i.id !== id);
		this.render();
	},

	addPerson() {
		const input = document.getElementById("personName");
		const name = input.value.trim();

		if (!name)
			return this.showToast("Participant name cannot be empty.", "error");
		if (this.state.people.includes(name))
			return this.showToast("Name must be unique.", "error");

		this.state.people.push(name);
		this.state.assignments[name] = {};
		input.value = "";

		this.render();
	},

	removePerson(name) {
		this.state.people = this.state.people.filter((p) => p !== name);
		delete this.state.assignments[name];
		this.render();
	},

	updateServiceCharge(val) {
		this.state.serviceChargeRate = parseFloat(val) / 100 || 0;
		this.renderItems();
	},

	updateSCTax(val) {
		this.state.scTaxPresetId = val;
		this.renderItems();
	},

	updateShare(person, itemId, value) {
		this.state.assignments[person][itemId] = String(value).trim() || "";
		this.renderTrackers();
	},

	renderQuickSplit() {
		const section = document.getElementById("quickSplitSection");
		if (this.state.items.length === 0 || this.state.people.length === 0) {
			section.style.display = "none";
			return;
		}

		section.style.display = "block";

		const select = document.getElementById("qsItem");
		select.innerHTML = this.state.items
			.map(
				(item) =>
					`<option value="${item.id}">${this.utils.escapeHTML(item.name)} (Qty: ${item.qty})</option>`,
			)
			.join("");

		const peopleDiv = document.getElementById("qsPeople");
		peopleDiv.innerHTML = this.state.people
			.map(
				(person) => `
                <button type="button" class="toggle-chip" onclick="this.classList.toggle('active')" data-name="${this.utils.escapeHTML(person)}">
                    ${this.utils.escapeHTML(person)}
                </button>
            `,
			)
			.join("");
	},

	applyQuickSplit() {
		const itemId = document.getElementById("qsItem").value;
		const item = this.state.items.find((i) => i.id === itemId);
		if (!item) return;

		const activeChips = document.querySelectorAll(
			"#qsPeople .toggle-chip.active",
		);
		const selectedPeople = Array.from(activeChips).map(
			(chip) => chip.dataset.name,
		);

		if (selectedPeople.length === 0) {
			return this.showToast("Select at least one participant.", "error");
		}

		const fractionString = this.utils.getFractionString(
			item.qty,
			selectedPeople.length,
		);

		this.state.people.forEach((person) => {
			this.state.assignments[person][item.id] = "";
		});

		selectedPeople.forEach((person) => {
			this.state.assignments[person][item.id] = fractionString;
		});

		activeChips.forEach((chip) => chip.classList.remove("active"));

		this.renderAssignments();
		this.renderTrackers();
		this.showToast(
			`Divided ${item.name} evenly among ${selectedPeople.length} people.`,
		);
	},

	render() {
		this.renderItems();
		this.renderPeople();
		this.renderQuickSplit();
		this.renderAssignments();
		this.renderTrackers();
	},

	renderItems() {
		const tbody = document.getElementById("itemsList");
		if (this.state.items.length === 0) {
			tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No items added to the bill yet.</td></tr>`;
			return;
		}

		const scTaxPreset = this.state.taxPresets.find(
			(t) => t.id === this.state.scTaxPresetId,
		);

		tbody.innerHTML = this.state.items
			.map((item) => {
				const itemTaxAmount = item.totalBase * item.taxRate;
				const itemSC = item.applySC
					? item.totalBase * this.state.serviceChargeRate
					: 0;
				const itemSCTaxAmount =
					scTaxPreset && itemSC > 0
						? itemSC * (scTaxPreset.rate / 100)
						: 0;
				const finalItemTotal =
					item.totalBase + itemTaxAmount + itemSC + itemSCTaxAmount;

				let taxString = `${(item.taxRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
				if (item.applySC) {
					taxString += `<br><span class="text-muted text-sm">+ SC ${scTaxPreset ? `(+${scTaxPreset.rate}%)` : ""}</span>`;
				}

				return `
                <tr>
                    <td class="font-medium">${this.utils.escapeHTML(item.name)}</td>
                    <td class="text-right">${item.qty}</td>
                    <td class="text-right">${this.utils.formatMoney(item.unitPrice)}</td>
                    <td class="text-right text-sm text-nowrap">${taxString}</td>
                    <td class="text-right font-semibold text-primary">${this.utils.formatMoney(finalItemTotal)}</td>
                    <td class="text-right">
                        <div style="display: flex; gap: 4px; justify-content: flex-end;">
                            <button type="button" class="edit-icon" onclick="App.editItem('${item.id}')" aria-label="Edit" title="Edit">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button type="button" class="danger-icon" onclick="App.removeItem('${item.id}')" aria-label="Remove" title="Remove">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
                `;
			})
			.join("");
	},

	renderPeople() {
		const div = document.getElementById("peopleList");
		div.innerHTML = this.state.people
			.map(
				(p) => `
                <div class="chip">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${this.utils.escapeHTML(p)} 
                    <button type="button" onclick="App.removePerson('${this.utils.escapeHTML(p)}')"><svg aria-hidden="true" aria-label="Remove" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                </div>
            `,
			)
			.join("");
	},

	renderTrackers() {
		const trackerDiv = document.getElementById("qtyTrackers");
		if (this.state.items.length === 0 || this.state.people.length === 0) {
			trackerDiv.classList.add("d-none");
			return;
		}

		trackerDiv.classList.remove("d-none");
		trackerDiv.innerHTML = this.state.items
			.map((item) => {
				let claimed = 0;
				this.state.people.forEach(
					(p) =>
						(claimed += this.utils.parseQty(
							this.state.assignments[p][item.id],
						)),
				);
				let remaining = this.utils.round2(item.qty - claimed);

				let statusClass = "yellow";
				let icon = `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`;

				if (Math.abs(remaining) < 0.01) {
					statusClass = "green";
					remaining = 0;
					icon = `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`;
				} else if (remaining < 0) {
					statusClass = "red";
					icon = `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`;
				}

				return `<div class="tracker-badge ${statusClass}">
                    <svg aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${icon}</svg>
                    ${this.utils.escapeHTML(item.name)}: ${remaining} / ${item.qty} left
                </div>`;
			})
			.join("");
	},

	renderAssignments() {
		const grid = document.getElementById("assignmentGrid");
		if (this.state.people.length === 0 || this.state.items.length === 0) {
			grid.innerHTML =
				'<div class="empty-state border-dashed w-full" style="grid-column: 1 / -1;">Add items and participants to begin splitting.</div>';
			return;
		}

		grid.innerHTML = this.state.people
			.map(
				(person) => `
                <div class="person-card p-0">
                    <div class="person-card-header">
                        <h3 class="m-0"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${this.utils.escapeHTML(person)}</h3>
                    </div>
                    <div class="person-card-body">
                        ${this.state.items
							.map(
								(item) => `
                                <div class="item-row">
                                    <span class="font-medium text-sm">
                                        ${this.utils.escapeHTML(item.name)}
                                    </span>
                                    <input type="text" inputmode="decimal" value="${this.utils.escapeHTML(this.state.assignments[person][item.id] || "")}" 
                                        aria-label="Quantity of ${this.utils.escapeHTML(item.name)} for ${this.utils.escapeHTML(person)}"
                                        oninput="App.updateShare('${this.utils.escapeHTML(person)}', '${item.id}', this.value)" placeholder="0">
                                </div>
                            `,
							)
							.join("")}
                    </div>
                </div>
            `,
			)
			.join("");
	},

	calculateSplit() {
		if (this.state.items.length === 0 || this.state.people.length === 0) {
			return this.showToast(
				"Need items and participants to calculate.",
				"error",
			);
		}

		let warnings = [];
		this.state.items.forEach((item) => {
			let claimed = 0;
			this.state.people.forEach(
				(p) =>
					(claimed += this.utils.parseQty(
						this.state.assignments[p][item.id],
					)),
			);
			let diff = this.utils.round2(item.qty - claimed);

			if (diff > 0.01)
				warnings.push(`'${item.name}' has ${diff} unassigned.`);
			if (diff < -0.01)
				warnings.push(
					`'${item.name}' is over-assigned by ${Math.abs(diff)}.`,
				);
		});

		if (warnings.length > 0) {
			const proceed = confirm(
				"Math Warning:\n" +
					warnings.join("\n") +
					"\n\nDo you want to force calculation anyway?",
			);
			if (!proceed) return;
		}

		let globalSummary = {
			totalQty: 0,
			subTotal: 0,
			taxBreakdown: {},
			serviceCharge: 0,
			grandTotal: 0,
		};
		const scTaxPreset = this.state.taxPresets.find(
			(t) => t.id === this.state.scTaxPresetId,
		);

		const addTaxToBreakdown = (preset, amount, fallbackName) => {
			if (amount <= 0) return;
			if (preset) {
				if (preset.split) {
					const names = this.utils.getSplitNames(preset.name);
					const half = amount / 2;
					globalSummary.taxBreakdown[names.cgst] =
						(globalSummary.taxBreakdown[names.cgst] || 0) + half;
					globalSummary.taxBreakdown[names.sgst] =
						(globalSummary.taxBreakdown[names.sgst] || 0) + half;
				} else {
					globalSummary.taxBreakdown[preset.name] =
						(globalSummary.taxBreakdown[preset.name] || 0) + amount;
				}
			} else {
				globalSummary.taxBreakdown[fallbackName] =
					(globalSummary.taxBreakdown[fallbackName] || 0) + amount;
			}
		};

		this.state.items.forEach((item) => {
			const itemTaxAmount = item.totalBase * item.taxRate;
			const itemSC = item.applySC
				? item.totalBase * this.state.serviceChargeRate
				: 0;
			const itemSCTaxAmount =
				scTaxPreset && itemSC > 0
					? itemSC * (scTaxPreset.rate / 100)
					: 0;

			globalSummary.totalQty += item.qty;
			globalSummary.subTotal += item.totalBase;
			globalSummary.serviceCharge += itemSC;

			const itemPreset = this.state.taxPresets.find(
				(t) => t.id === item.taxPresetId,
			);
			addTaxToBreakdown(itemPreset, itemTaxAmount, "Other Tax");
			addTaxToBreakdown(scTaxPreset, itemSCTaxAmount, "S.C. Tax");
		});

		const individualBreakdowns = {};
		let calcGrandTotal = 0;

		this.state.people.forEach((person) => {
			let subtotal = 0;
			let totalScAmount = 0;
			let consumedItems = [];

			this.state.items.forEach((item) => {
				const consumedQtyString =
					this.state.assignments[person][item.id];
				const consumedQty = this.utils.parseQty(consumedQtyString);

				if (consumedQty > 0) {
					const proportion = consumedQty / item.qty;

					const baseShare = proportion * item.totalBase;
					const itemTaxShare = baseShare * item.taxRate;

					const scShare = item.applySC
						? proportion *
							(item.totalBase * this.state.serviceChargeRate)
						: 0;
					const scTaxShare =
						scTaxPreset && scShare > 0
							? scShare * (scTaxPreset.rate / 100)
							: 0;

					const finalCostShare = baseShare + itemTaxShare;
					const finalScBurden = scShare + scTaxShare;

					subtotal += finalCostShare;
					totalScAmount += finalScBurden;

					consumedItems.push({
						name: item.name,
						qtyString: consumedQtyString || consumedQty.toString(),
						cost: finalCostShare,
					});
				}
			});

			const totalOwed = subtotal + totalScAmount;
			calcGrandTotal += totalOwed;

			individualBreakdowns[person] = {
				subtotal: subtotal,
				serviceCharge: totalScAmount,
				totalOwed: totalOwed,
				items: consumedItems,
			};
		});

		globalSummary.grandTotal = calcGrandTotal;
		this.state.calculationResult = { individualBreakdowns, globalSummary };
		this.renderResults();
		this.showToast("Calculation complete! Scroll down to view.");
	},

	renderResults() {
		const resDiv = document.getElementById("resultsContent");
		const { individualBreakdowns, globalSummary } =
			this.state.calculationResult;

		let taxesHtml = "";
		for (const [taxName, amount] of Object.entries(
			globalSummary.taxBreakdown,
		)) {
			if (amount > 0) {
				taxesHtml += `<div class="result-item"><span>Total ${this.utils.escapeHTML(taxName)}</span><span class="bold">${this.utils.formatMoney(amount)}</span></div>`;
			}
		}

		let htmlStr = `
            <div class="summary-block">
                <h3 class="text-primary flex-center mb-4">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Master Bill Summary
                </h3>
                <div class="result-item"><span>Total Items (Qty)</span><span class="bold">${globalSummary.totalQty.toFixed(2).replace(/\.00$/, "")}</span></div>
                <div class="result-item"><span>Base Subtotal</span><span class="bold">${this.utils.formatMoney(globalSummary.subTotal)}</span></div>
                ${taxesHtml}
                ${globalSummary.serviceCharge > 0 ? `<div class="result-item"><span>Total Service Charge</span><span class="bold">${this.utils.formatMoney(globalSummary.serviceCharge)}</span></div>` : ""}
                <div class="total-row pt-4"><span>Grand Total</span><span>${this.utils.formatMoney(globalSummary.grandTotal)}</span></div>
            </div>
            <div class="results-grid">
        `;

		htmlStr += Object.keys(individualBreakdowns)
			.map((person) => {
				const b = individualBreakdowns[person];
				if (b.totalOwed === 0) return "";
				return `
                <div class="person-card p-0">
                    <div class="person-card-header">
                        <h3 class="text-primary m-0">${this.utils.escapeHTML(person)}</h3>
                    </div>
                    <div class="person-card-body">
                        ${b.items
							.map(
								(i) => `
                            <div class="result-item">
                                <span>${this.utils.escapeHTML(i.name)} <span class="text-sm text-muted">x${this.utils.escapeHTML(i.qtyString)}</span></span>
                                <span class="bold">${this.utils.formatMoney(i.cost)}</span>
                            </div>
                        `,
							)
							.join("")}
                        ${
							b.serviceCharge > 0
								? `
                        <div class="result-item mt-4 text-sm border-t pt-3">
                            <span>Service Charge (inc. Tax)</span>
                            <span class="bold">${this.utils.formatMoney(b.serviceCharge)}</span>
                        </div>`
								: ""
						}
                    </div>
                    <div class="person-card-footer">
                        <div class="total-row final-owed m-0 pt-0 border-none">
                            <span>Owes</span>
                            <span>${this.utils.formatMoney(b.totalOwed)}</span>
                        </div>
                    </div>
                </div>
            `;
			})
			.join("");

		htmlStr += `</div>`;
		resDiv.innerHTML = htmlStr;

		const resultsSection = document.getElementById("results");
		resultsSection.classList.remove("d-none");
		resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
	},

	exportToPDF() {
		try {
			if (!this.state.calculationResult)
				return this.showToast("Calculate split first.", "error");
			if (!window.jspdf || !window.jspdf.jsPDF)
				return this.showToast("PDF Library failed to load.", "error");

			const { jsPDF } = window.jspdf;
			const doc = new jsPDF();

			const customTitle = document
				.getElementById("receiptTitle")
				.value.trim();
			const dateStr = new Date().toLocaleDateString();
			const docTitle = customTitle ? customTitle : "Settlement Receipt";

			const primaryColor = [79, 70, 229];
			const darkText = [17, 24, 39];
			const mutedText = [107, 114, 128];

			let startY = 25;

			doc.setFontSize(26);
			doc.setFont("helvetica", "bold");
			doc.setTextColor(...darkText);
			doc.text(docTitle, 14, startY);

			doc.setFontSize(10);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(...mutedText);
			doc.text(`Generated by Ekwly on ${dateStr}`, 14, startY + 6);

			doc.setDrawColor(229, 231, 235);
			doc.line(14, startY + 12, 196, startY + 12);
			startY += 25;

			doc.setFontSize(12);
			doc.setFont("helvetica", "bold");
			doc.setTextColor(...primaryColor);
			doc.text("MASTER BILL BREAKDOWN", 14, startY);
			startY += 6;

			const scTaxPreset = this.state.taxPresets.find(
				(t) => t.id === this.state.scTaxPresetId,
			);

			const masterTableData = this.state.items.map((i) => {
				const itemTaxAmount = i.totalBase * i.taxRate;
				const itemSC = i.applySC
					? i.totalBase * this.state.serviceChargeRate
					: 0;
				const itemSCTaxAmount =
					scTaxPreset && itemSC > 0
						? itemSC * (scTaxPreset.rate / 100)
						: 0;
				const finalTotal =
					i.totalBase + itemTaxAmount + itemSC + itemSCTaxAmount;

				return [
					i.name,
					i.qty.toString(),
					`Rs. ${i.unitPrice.toFixed(2)}`,
					`${(i.taxRate * 100).toFixed(1).replace(/\.0$/, "")}% ${i.applySC ? "+ SC" : ""}`,
					`Rs. ${finalTotal.toFixed(2)}`,
				];
			});

			doc.autoTable({
				startY: startY,
				head: [["Item", "Qty", "Unit Price", "Tax & Fees", "Total"]],
				body: masterTableData,
				theme: "grid",
				headStyles: {
					fillColor: primaryColor,
					textColor: 255,
					fontStyle: "bold",
					fontSize: 9,
				},
				bodyStyles: { textColor: darkText, fontSize: 9 },
				alternateRowStyles: { fillColor: [249, 250, 251] },
				columnStyles: {
					0: { fontStyle: "bold" },
					1: { halign: "center" },
					2: { halign: "right" },
					3: { halign: "center" },
					4: { halign: "right", fontStyle: "bold" },
				},
				margin: { left: 14, right: 14 },
			});

			startY = doc.lastAutoTable.finalY + 15;

			const { globalSummary } = this.state.calculationResult;
			const summaryData = [
				["Base Subtotal:", `Rs. ${globalSummary.subTotal.toFixed(2)}`],
			];

			for (const [taxName, amount] of Object.entries(
				globalSummary.taxBreakdown,
			)) {
				if (amount > 0) {
					summaryData.push([
						`${taxName}:`,
						`Rs. ${amount.toFixed(2)}`,
					]);
				}
			}

			if (globalSummary.serviceCharge > 0)
				summaryData.push([
					"Total Service Charge:",
					`Rs. ${globalSummary.serviceCharge.toFixed(2)}`,
				]);

			summaryData.push([
				{
					content: "Grand Total:",
					styles: {
						fontStyle: "bold",
						textColor: primaryColor,
						fontSize: 13,
					},
				},
				{
					content: `Rs. ${globalSummary.grandTotal.toFixed(2)}`,
					styles: {
						fontStyle: "bold",
						textColor: primaryColor,
						fontSize: 13,
					},
				},
			]);

			doc.autoTable({
				startY: startY,
				body: summaryData,
				theme: "plain",
				styles: { fontSize: 10, textColor: darkText },
				columnStyles: { 0: { cellWidth: 130 }, 1: { halign: "right" } },
				margin: { left: 14, right: 14 },
			});

			startY = doc.lastAutoTable.finalY + 25;

			doc.setFontSize(12);
			doc.setFont("helvetica", "bold");
			doc.setTextColor(...primaryColor);
			doc.text("INDIVIDUAL SETTLEMENTS", 14, startY);
			startY += 8;

			const { individualBreakdowns } = this.state.calculationResult;

			Object.keys(individualBreakdowns).forEach((person) => {
				const b = individualBreakdowns[person];
				if (b.totalOwed === 0) return;

				if (startY > 230) {
					doc.addPage();
					startY = 25;
				}

				doc.setFontSize(12);
				doc.setFont("helvetica", "bold");
				doc.setTextColor(...darkText);
				doc.text(person, 14, startY);
				startY += 4;

				const tableData = b.items.map((i) => [
					i.name,
					i.qtyString,
					`Rs. ${i.cost.toFixed(2)}`,
				]);

				if (b.serviceCharge > 0) {
					tableData.push([
						{
							content: "Service Charge (inc. Tax)",
							styles: { textColor: mutedText },
						},
						"-",
						{
							content: `Rs. ${b.serviceCharge.toFixed(2)}`,
							styles: { textColor: mutedText },
						},
					]);
				}

				tableData.push([
					{
						content: "Owes:",
						colSpan: 2,
						styles: {
							halign: "right",
							fontStyle: "bold",
							fillColor: [243, 244, 246],
							textColor: primaryColor,
							fontSize: 11,
						},
					},
					{
						content: `Rs. ${b.totalOwed.toFixed(2)}`,
						styles: {
							fontStyle: "bold",
							fillColor: [243, 244, 246],
							textColor: primaryColor,
							fontSize: 11,
						},
					},
				]);

				doc.autoTable({
					startY: startY,
					head: [["Item Consumed", "Qty", "Allocated Cost"]],
					body: tableData,
					theme: "grid",
					headStyles: {
						fillColor: [243, 244, 246],
						textColor: mutedText,
						fontStyle: "normal",
					},
					bodyStyles: { textColor: darkText },
					styles: { fontSize: 9.5, cellPadding: 3 },
					columnStyles: {
						1: { halign: "center" },
						2: { halign: "right" },
					},
					margin: { left: 14, right: 14 },
				});

				startY = doc.lastAutoTable.finalY + 12;
			});

			const safeFilename = customTitle
				? customTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()
				: `Settlement_${new Date().toISOString().slice(0, 10)}`;
			doc.save(`${safeFilename}.pdf`);

			this.showToast("PDF Generated Successfully!", "success");
		} catch (error) {
			console.error(error);
			this.showToast("Error generating PDF.", "error");
		}
	},
};

document.addEventListener("DOMContentLoaded", () => {
	App.init();

	if ("serviceWorker" in navigator) {
		window.addEventListener("load", () => {
			navigator.serviceWorker
				.register("./sw.js")
				.then((registration) => {
					console.log(
						"ServiceWorker registered with scope:",
						registration.scope,
					);
				})
				.catch((error) => {
					console.log("ServiceWorker registration failed:", error);
				});
		});
	}
});
