export const utils = {
	round2: (num: number) => Math.round((num + Number.EPSILON) * 100) / 100,

	formatMoney: (num: number) => `₹${num.toFixed(2)}`,

	generateId: () =>
		Date.now().toString(36) + Math.random().toString(36).substring(2),

	parseQty: (val: string | number | undefined): number => {
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

		let fracMatch = str.match(/^(\d*\.?\d+)\/(\d*\.?\d+)$/);
		if (fracMatch) {
			let num = parseFloat(fracMatch[1]);
			let den = parseFloat(fracMatch[2]);
			if (den !== 0) return num / den;
		}

		let parsed = parseFloat(str);
		return isNaN(parsed) ? 0 : parsed;
	},

	getFractionString: (qty: number, dividers: number): string => {
		let n = Math.round(qty * 10000);
		let d = Math.round(dividers * 10000);
		const gcd = (a: number, b: number): number =>
			b === 0 ? a : gcd(b, a % b);
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

	getSplitNames: (name: string) => {
		let base = name.trim();
		if (/GST/i.test(base)) {
			return {
				cgst: base.replace(/GST/i, "CGST"),
				sgst: base.replace(/GST/i, "SGST"),
			};
		}
		return { cgst: `${base} (CGST)`, sgst: `${base} (SGST)` };
	},
};

export const showToast = (
	message: string,
	type: "default" | "error" | "success" = "default",
) => {
	const container = document.getElementById("toast-container");
	if (!container) return alert(message);

	const toast = document.createElement("div");
	toast.className = `toast ${type}`;

	const icon =
		type === "error"
			? `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
			: type === "success"
				? `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
				: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

	toast.innerHTML = `${icon} <span>${message.replace(/[&<>'"]/g, (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[tag as string] || tag)}</span>`;
	container.appendChild(toast);

	setTimeout(() => {
		toast.classList.add("fade-out");
		setTimeout(() => toast.remove(), 300);
	}, 3000);
};
