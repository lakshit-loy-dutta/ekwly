import type { CalculationResult, IndividualBreakdown } from './types';
import { utils, showToast } from './utils';
import { EKWLY_E_PATH } from '../components/ui/BrandLoader';

const KWLY_SVG_PATHS = [
  'M 14 12 L 14 74',
  'M 46 34 L 18 53 L 48 74',
  'M 70 34 L 83 74 L 99 44 L 115 74 L 128 34',
  'M 152 12 L 152 65 Q 152 74 162 74',
  'M 182 34 L 200 68',
  'M 220 34 L 195 83 Q 190 91 179 89',
];

export interface CreditorQrEntry {
  creditorName: string;
  upiId: string;
  totalReceivable: number;
  qrSvgElement?: SVGElement | null;
}

function drawBrandWordmarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const ePath = new Path2D(EKWLY_E_PATH);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(ePath);

  ctx.fillStyle = '#0080FF';
  ctx.beginPath();
  ctx.roundRect(37.63, 25.15, 40.63, 13.9, 6);
  ctx.fill();

  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.roundRect(37.63, 60.95, 40.63, 13.9, 6);
  ctx.fill();

  ctx.save();
  ctx.translate(91.25, 4.09);
  ctx.scale(1.09, 1.09);
  ctx.strokeStyle = '#93C5FD';
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of KWLY_SVG_PATHS) {
    ctx.stroke(new Path2D(d));
  }
  ctx.restore();
  ctx.restore();
}

function loadSvgElementAsImage(
  svgEl: SVGElement | null | undefined
): Promise<HTMLImageElement | null> {
  if (!svgEl) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Draws a skeuomorphic thermal receipt paper sheet with 28 serrated sawtooth teeth
 * at the top and bottom plus side ticket notches.
 */
function drawSkeuomorphicReceiptSheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  w: number,
  h: number,
  notchY: number
) {
  const teeth = 28;
  const toothW = w / teeth;
  const toothH = 16;
  const yBot = yTop + h;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, yTop + toothH);

  // Top sawtooth blade edge
  for (let i = 0; i < teeth; i++) {
    const tx = x + i * toothW;
    ctx.lineTo(tx + toothW / 2, yTop);
    ctx.lineTo(tx + toothW, yTop + toothH);
  }

  // Right edge down to bottom sawtooth
  ctx.lineTo(x + w, yBot - toothH);

  // Bottom sawtooth blade edge
  for (let i = teeth - 1; i >= 0; i--) {
    const tx = x + i * toothW;
    ctx.lineTo(tx + toothW / 2, yBot);
    ctx.lineTo(tx, yBot - toothH);
  }

  ctx.closePath();

  // Neutral high-contrast Slate-Paper surface that works in both Light & Dark chat feeds
  const paperGrad = ctx.createLinearGradient(x, yTop, x, yBot);
  paperGrad.addColorStop(0, '#152238');
  paperGrad.addColorStop(1, '#111C2E');
  ctx.fillStyle = paperGrad;
  ctx.fill();

  ctx.strokeStyle = '#2C4263';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Perforated Ticket Notches + Dashed Tear Line
  ctx.fillStyle = '#070D19';
  ctx.beginPath();
  ctx.arc(x, notchY, 18, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w, notchY, 18, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  ctx.stroke();

  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = '#3B557D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 26, notchY);
  ctx.lineTo(x + w - 26, notchY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

export async function exportBentoReceiptImage(params: {
  calculationResult: CalculationResult;
  venueName: string;
  receiptTitle: string;
  ledger: any[];
  creditorQrList?: CreditorQrEntry[];
  creditorUpi?: string | null;
  creditorName?: string | null;
  qrSvgElement?: SVGElement | null;
  mode?: 'share' | 'download';
}) {
  try {
    const {
      calculationResult,
      venueName,
      receiptTitle,
      ledger,
      creditorQrList = [],
      creditorUpi,
      creditorName,
      qrSvgElement,
      mode = 'share',
    } = params;

    const gs = calculationResult.globalSummary;
    const activeMembers = Object.values(calculationResult.individualBreakdowns).filter(
      (b) => b.totalOwed > 0
    );

    // Build normalized list of all creditors who have a UPI QR
    const resolvedQrEntries: {
      creditorName: string;
      upiId: string;
      totalReceivable: number;
      img: HTMLImageElement;
    }[] = [];

    if (creditorQrList.length > 0) {
      for (const entry of creditorQrList) {
        const img = await loadSvgElementAsImage(entry.qrSvgElement);
        if (img && entry.upiId) {
          resolvedQrEntries.push({
            creditorName: entry.creditorName,
            upiId: entry.upiId,
            totalReceivable: entry.totalReceivable,
            img,
          });
        }
      }
    } else if (qrSvgElement && creditorUpi) {
      const img = await loadSvgElementAsImage(qrSvgElement);
      if (img) {
        resolvedQrEntries.push({
          creditorName: creditorName || 'Host',
          upiId: creditorUpi,
          totalReceivable: 0,
          img,
        });
      }
    }

    const width = 1080;
    const memberRowsHeight = activeMembers.length * 82;
    const ledgerRowsHeight = ledger.length > 0 ? 96 + ledger.length * 74 : 0;
    const qrSectionHeight = resolvedQrEntries.length * 290;
    const sheetH = 620 + memberRowsHeight + ledgerRowsHeight + qrSectionHeight;
    const height = sheetH + 120;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    // Outer Backdrop
    ctx.fillStyle = '#070D19';
    ctx.fillRect(0, 0, width, height);

    const sheetX = 56;
    const sheetY = 48;
    const sheetW = width - 112;
    const notchY = sheetY + 468;

    drawSkeuomorphicReceiptSheet(ctx, sheetX, sheetY, sheetW, sheetH, notchY);

    // 1. Top Brand Wordmark & Receipt Date
    drawBrandWordmarkOnCanvas(ctx, sheetX + 52, sheetY + 52, 0.54);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('★ OFFICIAL BILL SPLIT ★', sheetX + sheetW - 52, sheetY + 76);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 21px monospace';
    const dateStr = new Date().toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    ctx.fillText(dateStr.toUpperCase(), sheetX + sheetW - 52, sheetY + 108);

    const titleText = receiptTitle.trim() || venueName.trim() || 'Dining Table Bill';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 42px Inter, system-ui, sans-serif';
    ctx.fillText(titleText.slice(0, 32), sheetX + 52, sheetY + 186);

    // 2. Hero Grand Total Box
    const heroY = sheetY + 216;
    const heroGrad = ctx.createLinearGradient(
      sheetX + 52,
      heroY,
      sheetX + sheetW - 52,
      heroY + 206
    );
    heroGrad.addColorStop(0, '#0080FF');
    heroGrad.addColorStop(1, '#0051A8');
    ctx.fillStyle = heroGrad;
    ctx.beginPath();
    ctx.roundRect(sheetX + 52, heroY, sheetW - 104, 206, 28);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 20px monospace';
    ctx.fillText('GRAND TOTAL (TAXES, S.C. & OFFERS ROUTED)', sheetX + 88, heroY + 52);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 72px Inter, system-ui, sans-serif';
    ctx.fillText(utils.formatMoney(gs.grandTotal), sheetX + 88, heroY + 136);

    const totalTax = Object.values(gs.taxBreakdown).reduce((a, b) => a + b, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 21px monospace';
    const metaPills = [
      `Base: ${utils.formatMoney(gs.subTotal)}`,
      `Tax: ${utils.formatMoney(totalTax)}`,
      ...(gs.serviceCharge > 0 ? [`S.C.: ${utils.formatMoney(gs.serviceCharge)}`] : []),
      ...(gs.discountAmount > 0 ? [`Saved: -${utils.formatMoney(gs.discountAmount)}`] : []),
    ].join('  •  ');
    ctx.fillText(metaPills, sheetX + 88, heroY + 180);

    // 3. Individual Shares Section (Below the Perforated Tear Line)
    let cursorY = notchY + 52;
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 21px monospace';
    ctx.fillText(`INDIVIDUAL SHARES (${activeMembers.length} PEOPLE)`, sheetX + 52, cursorY);
    cursorY += 22;

    activeMembers.forEach((member) => {
      ctx.fillStyle = '#0B1322';
      ctx.strokeStyle = '#233554';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sheetX + 52, cursorY, sheetW - 104, 68, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 27px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(member.memberName, sheetX + 80, cursorY + 44);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 21px monospace';
      ctx.fillText(`${member.items.length} items`, sheetX + 460, cursorY + 43);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 28px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(utils.formatMoney(member.totalOwed), sheetX + sheetW - 80, cursorY + 44);

      cursorY += 82;
    });

    // 4. Settlement Summary (Cash, UPI, or Bank Transfer)
    if (ledger.length > 0) {
      cursorY += 28;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#10B981';
      ctx.font = '800 21px monospace';
      ctx.fillText('SETTLEMENT SUMMARY (WHO PAYS WHOM)', sheetX + 52, cursorY);
      cursorY += 22;

      ledger.forEach((row) => {
        ctx.fillStyle = '#0B1322';
        ctx.strokeStyle = row.settled ? '#059669' : '#233554';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sheetX + 52, cursorY, sheetW - 104, 62, 16);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 25px Inter, system-ui, sans-serif';
        ctx.fillText(`${row.debtor_name}  →  ${row.creditor_name}`, sheetX + 80, cursorY + 40);

        ctx.textAlign = 'right';
        ctx.fillStyle = row.settled ? '#10B981' : '#F59E0B';
        ctx.font = '800 25px monospace';
        const statusStr = row.settled ? '✓ SETTLED' : utils.formatMoney(Number(row.amount));
        ctx.fillText(statusStr, sheetX + sheetW - 80, cursorY + 40);

        cursorY += 74;
      });
    }

    // 5. Embedded UPI QR Blocks for Every Unsettled Creditor with a Linked UPI ID
    for (const qrEntry of resolvedQrEntries) {
      cursorY += 22;
      ctx.fillStyle = '#0B1322';
      ctx.strokeStyle = '#0080FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(sheetX + 52, cursorY, sheetW - 104, 260, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(sheetX + 78, cursorY + 22, 216, 216, 18);
      ctx.fill();
      ctx.drawImage(qrEntry.img, sheetX + 92, cursorY + 36, 188, 188);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 20px monospace';
      ctx.fillText('SCAN TO PAY VIA ANY UPI APP', sheetX + 324, cursorY + 72);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 32px Inter, system-ui, sans-serif';
      const headerLabel =
        qrEntry.totalReceivable > 0
          ? `Pay ${qrEntry.creditorName} (${utils.formatMoney(qrEntry.totalReceivable)} total)`
          : `Pay ${qrEntry.creditorName}`;
      ctx.fillText(headerLabel.slice(0, 34), sheetX + 324, cursorY + 120);

      ctx.fillStyle = '#93C5FD';
      ctx.font = '700 24px monospace';
      ctx.fillText(`UPI ID: ${qrEntry.upiId}`, sheetX + 324, cursorY + 166);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 19px Inter, system-ui, sans-serif';
      ctx.fillText('Works with GPay • PhonePe • Paytm • BHIM', sheetX + 324, cursorY + 210);

      cursorY += 268;
    }

    // 6. Footer Watermark
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = '700 19px monospace';
    ctx.fillText(
      'GENERATED BY EKWLY • EXACT INDIAN GST/VAT & MULTI-OFFER BILL SPLITTER',
      width / 2,
      sheetY + sheetH + 44
    );

    const safeName = (receiptTitle || venueName || 'Ekwly_Receipt')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const fileName = `${safeName}_receipt.png`;

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Failed to encode Receipt PNG');

    if (
      mode === 'share' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function'
    ) {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: titleText,
            text: `Here is our itemized bill split for ${titleText} on Ekwly!`,
            files: [file],
          });
          showToast('Receipt Image shared!', 'success');
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }
    }

    const a = document.createElement('a');
    a.download = fileName;
    a.href = URL.createObjectURL(blob);
    a.click();
    showToast('Receipt Image saved to device!', 'success');
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    console.error(err);
    showToast('Could not generate Receipt Image.', 'error');
  }
}

/**
 * Generates a personalized 1-on-1 WhatsApp Payment Request Receipt Ticket for a single debtor,
 * complete with their itemized dishes (if available), exact amount owed, and a pre-filled UPI QR.
 */
export async function exportPersonalNudgeImage(params: {
  debtorName: string;
  creditorName: string;
  amount: number;
  venueName?: string | null;
  upiId?: string | null;
  memberBreakdown?: IndividualBreakdown | null;
  qrSvgElement?: SVGElement | null;
  whatsappTextUrl?: string;
}) {
  try {
    const {
      debtorName,
      creditorName,
      amount,
      venueName,
      upiId,
      memberBreakdown,
      qrSvgElement,
      whatsappTextUrl,
    } = params;

    const qrImage = await loadSvgElementAsImage(qrSvgElement);
    const items = memberBreakdown?.items || [];
    const visibleItems = items.slice(0, 8);

    const width = 1080;
    const itemsH = visibleItems.length > 0 ? 70 + visibleItems.length * 60 : 0;
    const qrH = qrImage && upiId ? 290 : 0;
    const sheetH = 490 + itemsH + qrH;
    const height = sheetH + 110;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    ctx.fillStyle = '#070D19';
    ctx.fillRect(0, 0, width, height);

    const sheetX = 56;
    const sheetY = 44;
    const sheetW = width - 112;
    const notchY = sheetY + 410;

    drawSkeuomorphicReceiptSheet(ctx, sheetX, sheetY, sheetW, sheetH, notchY);

    drawBrandWordmarkOnCanvas(ctx, sheetX + 52, sheetY + 48, 0.52);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('★ PERSONAL SETTLEMENT TICKET ★', sheetX + sheetW - 52, sheetY + 76);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 38px Inter, system-ui, sans-serif';
    ctx.fillText((venueName || 'Shared Bill Settlement').slice(0, 34), sheetX + 52, sheetY + 166);

    // Hero Amount Due Box
    const heroY = sheetY + 194;
    const heroGrad = ctx.createLinearGradient(
      sheetX + 52,
      heroY,
      sheetX + sheetW - 52,
      heroY + 186
    );
    heroGrad.addColorStop(0, '#0080FF');
    heroGrad.addColorStop(1, '#0051A8');
    ctx.fillStyle = heroGrad;
    ctx.beginPath();
    ctx.roundRect(sheetX + 52, heroY, sheetW - 104, 186, 26);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '700 22px monospace';
    ctx.fillText(
      `${debtorName.toUpperCase()}  →  PAY ${creditorName.toUpperCase()}`,
      sheetX + 84,
      heroY + 52
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 68px Inter, system-ui, sans-serif';
    ctx.fillText(utils.formatMoney(amount), sheetX + 84, heroY + 132);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 20px monospace';
    ctx.fillText(
      'Includes your exact share of dishes, GST/VAT & Service Charge',
      sheetX + 84,
      heroY + 166
    );

    let cursorY = notchY + 48;

    // Itemized Dishes for This Person
    if (visibleItems.length > 0) {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 20px monospace';
      ctx.fillText(`${debtorName.toUpperCase()}'S ITEMIZED SHARE`, sheetX + 52, cursorY);
      cursorY += 22;

      visibleItems.forEach((it) => {
        ctx.fillStyle = '#0B1322';
        ctx.beginPath();
        ctx.roundRect(sheetX + 52, cursorY, sheetW - 104, 50, 12);
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '600 22px Inter, system-ui, sans-serif';
        ctx.fillText(`${it.name} (x${it.qtyString})`, sheetX + 76, cursorY + 33);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#93C5FD';
        ctx.font = '700 22px monospace';
        ctx.fillText(utils.formatMoney(it.cost), sheetX + sheetW - 76, cursorY + 33);

        cursorY += 60;
      });
    }

    // Pre-Filled Exact Amount UPI QR
    if (qrImage && upiId) {
      cursorY += 16;
      ctx.fillStyle = '#0B1322';
      ctx.strokeStyle = '#0080FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(sheetX + 52, cursorY, sheetW - 104, 256, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(sheetX + 78, cursorY + 20, 216, 216, 18);
      ctx.fill();
      ctx.drawImage(qrImage, sheetX + 92, cursorY + 34, 188, 188);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#10B981';
      ctx.font = '800 20px monospace';
      ctx.fillText(`PRE-FILLED FOR ${utils.formatMoney(amount)}`, sheetX + 324, cursorY + 70);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 32px Inter, system-ui, sans-serif';
      ctx.fillText(`Scan to Pay ${creditorName}`, sheetX + 324, cursorY + 118);

      ctx.fillStyle = '#93C5FD';
      ctx.font = '700 24px monospace';
      ctx.fillText(`UPI: ${upiId}`, sheetX + 324, cursorY + 164);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 19px Inter, system-ui, sans-serif';
      ctx.fillText('GPay • PhonePe • Paytm • BHIM', sheetX + 324, cursorY + 206);
    }

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Failed to encode Nudge PNG');

    const fileName = `Pay_${creditorName}_${Math.round(amount)}.png`.replace(/[^a-z0-9._-]/gi, '_');

    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Settle ${utils.formatMoney(amount)} with ${creditorName}`,
            text: `Hey ${debtorName}! Here is your itemized split (${utils.formatMoney(amount)})${
              venueName ? ` for ${venueName}` : ''
            }.${upiId ? ` You can scan the QR on this card or pay via UPI: ${upiId}` : ''}`,
            files: [file],
          });
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }
    }

    // Fallback on desktop: download card and open WhatsApp web link
    const a = document.createElement('a');
    a.download = fileName;
    a.href = URL.createObjectURL(blob);
    a.click();
    if (whatsappTextUrl) {
      window.open(whatsappTextUrl, '_blank', 'noopener,noreferrer');
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    if (params.whatsappTextUrl) {
      window.open(params.whatsappTextUrl, '_blank', 'noopener,noreferrer');
    }
  }
}
