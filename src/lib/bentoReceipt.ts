import type { CalculationResult } from './types';
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

function drawBrandWordmarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Capital E Monolith
  const ePath = new Path2D(EKWLY_E_PATH);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(ePath);

  // '=' Bars
  ctx.fillStyle = '#0080FF';
  ctx.beginPath();
  ctx.roundRect(37.63, 25.15, 40.63, 13.9, 6);
  ctx.fill();

  ctx.fillStyle = '#38BDF8';
  ctx.beginPath();
  ctx.roundRect(37.63, 60.95, 40.63, 13.9, 6);
  ctx.fill();

  // 'kwly' Vector Strokes
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

function loadSvgElementAsImage(svgEl: SVGElement | null): Promise<HTMLImageElement | null> {
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

export async function exportBentoReceiptImage(params: {
  calculationResult: CalculationResult;
  venueName: string;
  receiptTitle: string;
  ledger: any[];
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
      creditorUpi,
      creditorName,
      qrSvgElement,
      mode = 'share',
    } = params;

    const gs = calculationResult.globalSummary;
    const activeMembers = Object.values(calculationResult.individualBreakdowns).filter(
      (b) => b.totalOwed > 0
    );

    const qrImage = await loadSvgElementAsImage(qrSvgElement || null);

    const width = 1080;
    const memberRowsHeight = activeMembers.length * 86;
    const ledgerRowsHeight = ledger.length > 0 ? 90 + ledger.length * 76 : 0;
    const qrSectionHeight = qrImage && creditorUpi ? 340 : 0;
    const height = Math.max(1180, 680 + memberRowsHeight + ledgerRowsHeight + qrSectionHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');

    // 1. Deep OLED Slate Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#050914');
    bgGrad.addColorStop(1, '#0B1528');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Outer Bento Frame
    ctx.strokeStyle = '#1E2D44';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(36, 36, width - 72, height - 72, 44);
    ctx.stroke();

    // 2. Top Brand Header + Venue & Date
    drawBrandWordmarkOnCanvas(ctx, 84, 82, 0.56);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const dateStr = new Date().toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    ctx.fillText(dateStr.toUpperCase(), width - 84, 118);

    const titleText = receiptTitle.trim() || venueName.trim() || 'Bill Split Summary';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 46px Inter, system-ui, sans-serif';
    ctx.fillText(titleText.slice(0, 32), 84, 210);

    // 3. Hero Grand Total Bento Card
    const heroY = 248;
    const heroGrad = ctx.createLinearGradient(84, heroY, width - 84, heroY + 210);
    heroGrad.addColorStop(0, '#0080FF');
    heroGrad.addColorStop(1, '#0051A8');
    ctx.fillStyle = heroGrad;
    ctx.beginPath();
    ctx.roundRect(84, heroY, width - 168, 210, 32);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillText('GRAND TOTAL (EXACT TAX & S.C. ROUTED)', 124, heroY + 58);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 76px Inter, system-ui, sans-serif';
    ctx.fillText(utils.formatMoney(gs.grandTotal), 124, heroY + 145);

    const totalTax = Object.values(gs.taxBreakdown).reduce((a, b) => a + b, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 22px Inter, system-ui, sans-serif';
    const metaPills = [
      `Base: ${utils.formatMoney(gs.subTotal)}`,
      `Taxes: ${utils.formatMoney(totalTax)}`,
      ...(gs.serviceCharge > 0 ? [`S.C.: ${utils.formatMoney(gs.serviceCharge)}`] : []),
      ...(gs.discountAmount > 0 ? [`Saved: -${utils.formatMoney(gs.discountAmount)}`] : []),
    ].join('  •  ');
    ctx.fillText(metaPills, 124, heroY + 186);

    // 4. Individual Shares Section
    let cursorY = heroY + 265;
    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 22px Inter, system-ui, sans-serif';
    ctx.fillText(`INDIVIDUAL SHARES (${activeMembers.length} PEOPLE)`, 84, cursorY);
    cursorY += 24;

    activeMembers.forEach((member) => {
      ctx.fillStyle = '#0F1724';
      ctx.strokeStyle = '#1E2D44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(84, cursorY, width - 168, 72, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 28px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(member.memberName, 116, cursorY + 46);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 22px Inter, system-ui, sans-serif';
      ctx.fillText(`${member.items.length} items`, 520, cursorY + 45);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 30px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(utils.formatMoney(member.totalOwed), width - 116, cursorY + 46);

      cursorY += 86;
    });

    // 5. Settlement Transfers Section (Who Owes Whom)
    if (ledger.length > 0) {
      cursorY += 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#10B981';
      ctx.font = '800 22px Inter, system-ui, sans-serif';
      ctx.fillText('UPI SETTLEMENT TRANSFERS', 84, cursorY);
      cursorY += 24;

      ledger.forEach((row) => {
        ctx.fillStyle = '#0F1724';
        ctx.strokeStyle = row.settled ? '#059669' : '#1E2D44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(84, cursorY, width - 168, 64, 18);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 25px Inter, system-ui, sans-serif';
        ctx.fillText(`${row.debtor_name}  →  ${row.creditor_name}`, 116, cursorY + 41);

        ctx.textAlign = 'right';
        ctx.fillStyle = row.settled ? '#10B981' : '#F59E0B';
        ctx.font = '800 26px Inter, system-ui, sans-serif';
        const statusStr = row.settled ? '✓ PAID' : utils.formatMoney(Number(row.amount));
        ctx.fillText(statusStr, width - 116, cursorY + 41);

        cursorY += 76;
      });
    }

    // 6. Embedded UPI QR Box (If Creditor UPI is Linked)
    if (qrImage && creditorUpi) {
      cursorY += 26;
      ctx.fillStyle = '#0F1724';
      ctx.strokeStyle = '#0080FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(84, cursorY, width - 168, 280, 28);
      ctx.fill();
      ctx.stroke();

      // White QR Pad
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(116, cursorY + 24, 232, 232, 20);
      ctx.fill();
      ctx.drawImage(qrImage, 132, cursorY + 40, 200, 200);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 22px Inter, system-ui, sans-serif';
      ctx.fillText('SCAN TO SETTLE VIA ANY UPI APP', 384, cursorY + 82);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 34px Inter, system-ui, sans-serif';
      ctx.fillText(`Pay ${creditorName || 'Host'}`, 384, cursorY + 132);

      ctx.fillStyle = '#93C5FD';
      ctx.font = '700 26px monospace';
      ctx.fillText(`UPI ID: ${creditorUpi}`, 384, cursorY + 178);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 20px Inter, system-ui, sans-serif';
      ctx.fillText('Works with GPay • PhonePe • Paytm • BHIM', 384, cursorY + 222);
    }

    // 7. Footer Watermark
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.fillText(
      'Generated with Ekwly — Exact Indian GST/VAT & Multi-Offer Bill Splitter',
      width / 2,
      height - 64
    );

    const safeName = (receiptTitle || venueName || 'Ekwly_Bento_Split')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const fileName = `${safeName}_card.png`;

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Failed to encode Bento PNG');

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
            text: `Here is our exact bill split for ${titleText} on Ekwly!`,
            files: [file],
          });
          showToast('Bento Receipt Card shared!', 'success');
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
    showToast('Bento Receipt Card saved to device!', 'success');
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    console.error(err);
    showToast('Could not generate Bento Receipt Card.', 'error');
  }
}
