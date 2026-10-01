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
	if (typeof document === "undefined") return;

	let container = document.getElementById("toast-container");
	if (!container) {
		container = document.createElement("div");
		container.id = "toast-container";
		container.style.cssText =
			"position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 10px; z-index: 99999; width: 90%; max-width: 400px; pointer-events: none;";
		document.body.appendChild(container);
	}

	const toast = document.createElement("div");
	const bgColor =
		type === "error"
			? "#DF1B41"
			: type === "success"
				? "#00D924"
				: "#141A28";

	toast.style.cssText = `background: ${bgColor}; color: #ffffff; padding: 14px 20px; border-radius: 12px; font-size: 0.95rem; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px; transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: translateY(20px); opacity: 0; pointer-events: auto; border: 1px solid rgba(255,255,255,0.1);`;

	const icon =
		type === "error"
			? `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
			: type === "success"
				? `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
				: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

	toast.innerHTML = `${icon} <span style="flex-1">${message.replace(/[&<>'"]/g, (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[tag as string] || tag)}</span>`;
	container.appendChild(toast);

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			toast.style.transform = "translateY(0)";
			toast.style.opacity = "1";
		});
	});

	setTimeout(() => {
		toast.style.opacity = "0";
		toast.style.transform = "translateY(10px)";
		setTimeout(() => toast.remove(), 300);
	}, 3500);
};
