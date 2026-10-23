import { mathEngine } from './mathEngine';
import { utils, showToast } from './utils';
import type { BillItem, CalculationResult, TaxPreset } from './types';
import type { DBMember, SessionRules } from './useSession';

export interface PdfSessionDetails {
  items: BillItem[];
  members: DBMember[];
  formattedClaims: Record<string, Record<string, string>>;
  taxPresets: TaxPreset[];
  sessionRules: SessionRules;
}

function formatPdfMoney(n: number): string {
  return `Rs. ${utils.round2(n).toFixed(2)}`;
}

export const generatePDF = async (
  calculationResult: CalculationResult,
  venueName: string,
  ledger: any[] = [],
  receiptTitle = '',
  mode: 'download' | 'share' = 'download',
  creditorUpiMap: Record<string, string> = {},
  sessionDetails?: PdfSessionDetails
) => {
  try {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;

    const items: BillItem[] = sessionDetails?.items || [];
    const members: DBMember[] = sessionDetails?.members || [];
    const formattedClaims: Record<
      string,
      Record<string, string>
    > = sessionDetails?.formattedClaims || {};
    const taxPresets: TaxPreset[] = sessionDetails?.taxPresets || [];
    const sessionRules: SessionRules = sessionDetails?.sessionRules || {
      venueName,
      isScApplicable: calculationResult.globalSummary.serviceCharge > 0,
      serviceChargeRate: 0.1,
      scTaxPresetId: 'inherit',
      discountType: 'none',
      discountValue: '',
      discountMode: 'pre-tax',
      postTaxDiscountType: 'none',
      postTaxDiscountValue: '',
    };

    const gs = calculationResult.globalSummary;
    const preTaxMultiplier = mathEngine.computePreTaxMultiplier(items, gs.preTaxDiscountAmount);

    // --- 1. TOP DARK SLATE BRAND HEADER BANNER ---
    doc.setFillColor(7, 18, 38); // #071226
    doc.roundedRect(margin, 28, pageWidth - margin * 2, 82, 12, 12, 'F');

    // Draw Ekwly [E=] Monolith Icon inside Header
    const iconX = margin + 18;
    const iconY = 44;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(iconX, iconY, 8, 48, 3, 3, 'F');
    doc.roundedRect(iconX, iconY, 42, 8, 3, 3, 'F');
    doc.roundedRect(iconX, iconY + 20, 28, 8, 3, 3, 'F');
    doc.roundedRect(iconX, iconY + 40, 42, 8, 3, 3, 'F');

    // Dual Azure '=' Bars in Negative Space
    doc.setFillColor(0, 128, 255);
    doc.roundedRect(iconX + 13, iconY + 10, 24, 8, 3, 3, 'F');
    doc.setFillColor(56, 189, 248);
    doc.roundedRect(iconX + 13, iconY + 30, 24, 8, 3, 3, 'F');

    // "kwly" Wordmark & Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(147, 197, 253); // #93C5FD
    doc.text('kwly', iconX + 46, iconY + 34);

    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('EXACT INDIAN GST/VAT & MULTI-OFFER SETTLEMENT STATEMENT', iconX + 46, iconY + 47);

    // Right-Aligned Title, Venue & Date
    const primaryTitle = receiptTitle.trim() || venueName.trim() || 'Dining Bill Split';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(primaryTitle.slice(0, 36), pageWidth - margin - 18, iconY + 18, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(147, 197, 253);
    const totalPeopleCount =
      members.length || Object.keys(calculationResult.individualBreakdowns).length;
    const subHeaderStr = [
      ...(venueName && venueName.toLowerCase() !== primaryTitle.toLowerCase() ? [venueName] : []),
      new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      `${totalPeopleCount} People`,
    ].join('  •  ');
    doc.text(subHeaderStr, pageWidth - margin - 18, iconY + 36, { align: 'right' });

    let cursorY = 124;

    // --- 2. 4-COLUMN EXECUTIVE KPI SUMMARY STRIP ---
    const totalTaxes = Object.values(gs.taxBreakdown).reduce((a: number, b: number) => a + b, 0);
    const kpiCards: { label: string; val: string; color: [number, number, number] }[] = [
      { label: 'RAW SUBTOTAL', val: formatPdfMoney(gs.rawSubTotal), color: [15, 23, 42] },
      {
        label: 'TOTAL DISCOUNTS SAVED',
        val: gs.discountAmount > 0 ? `- ${formatPdfMoney(gs.discountAmount)}` : 'Rs. 0.00',
        color: [16, 185, 129],
      },
      {
        label: 'TAXES & SERVICE CHARGE',
        val: formatPdfMoney(totalTaxes + gs.serviceCharge),
        color: [2, 132, 199],
      },
      {
        label: 'FINAL GRAND TOTAL',
        val: formatPdfMoney(gs.grandTotal),
        color: [0, 128, 255],
      },
    ];

    const kpiGap = 10;
    const kpiW = (pageWidth - margin * 2 - kpiGap * 3) / 4;
    kpiCards.forEach((kpi, idx: number) => {
      const kx = margin + idx * (kpiW + kpiGap);
      doc.setFillColor(242, 248, 255);
      doc.setDrawColor(216, 235, 255);
      doc.roundedRect(kx, cursorY, kpiW, 46, 8, 8, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(kpi.label, kx + 10, cursorY + 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
      doc.text(kpi.val, kx + 10, cursorY + 34);
    });

    cursorY += 62;

    // --- 3. MASTER ITEMIZED BILL TABLE ---
    if (items.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Itemized Bill & Tax Routing Breakdown', margin, cursorY);
      cursorY += 8;

      const itemRows = items.map((item: BillItem, idx: number) => {
        const b = mathEngine.calculateItemBreakdown(item, {
          taxPresets,
          isScApplicable: sessionRules.isScApplicable,
          serviceChargeRate: sessionRules.serviceChargeRate,
          scTaxPresetId: sessionRules.scTaxPresetId,
          preTaxMultiplier,
        });

        const claimers = members
          .filter((m: DBMember) => utils.parseQty(formattedClaims[m.id]?.[item.id]) > 0)
          .map((m: DBMember) => `${m.name} (${formattedClaims[m.id]?.[item.id]})`)
          .join(', ');

        const offerBadge =
          b.itemDiscountAmount > 0
            ? ` [-${
                item.discountType === 'percentage'
                  ? `${item.discountValue}%`
                  : formatPdfMoney(b.itemDiscountAmount)
              }]`
            : '';

        const taxLabel = b.preset ? `${b.preset.name} (${b.preset.rate}%)` : '0%';
        const scFlag =
          sessionRules.isScApplicable && sessionRules.serviceChargeRate > 0 && item.applySC
            ? ` + S.C.`
            : '';

        return [
          String(idx + 1).padStart(2, '0'),
          `${item.name}${offerBadge}`,
          `${item.qty} x ${formatPdfMoney(item.unitPrice)}`,
          `${taxLabel}${scFlag}`,
          claimers || 'Unclaimed',
          formatPdfMoney(b.finalTotal),
        ];
      });

      autoTable(doc, {
        startY: cursorY,
        margin: { left: margin, right: margin },
        head: [['#', 'Item & Offers', 'Qty x Price', 'Tax & S.C.', 'Shared By', 'Line Total']],
        body: itemRows,
        theme: 'grid',
        headStyles: {
          fillColor: [7, 18, 38],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [15, 23, 42],
          cellPadding: 5,
        },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 78, halign: 'right' },
          3: { cellWidth: 86 },
          5: { cellWidth: 72, halign: 'right', fontStyle: 'bold' },
        },
      });

      cursorY = (doc as any).lastAutoTable.finalY + 16;
    }

    // --- 4. 3-LAYER ACCOUNTING SUMMARY TABLE ---
    const accountingRows: [string, string][] = [];
    if (gs.itemDiscountAmount > 0 || gs.preTaxDiscountAmount > 0) {
      accountingRows.push(['Raw Item Subtotal', formatPdfMoney(gs.rawSubTotal)]);
    }
    if (gs.itemDiscountAmount > 0) {
      accountingRows.push([
        'Layer 1: Item & Category Offers',
        `- ${formatPdfMoney(gs.itemDiscountAmount)}`,
      ]);
    }
    if (gs.preTaxDiscountAmount > 0) {
      accountingRows.push([
        'Layer 2: Pre-Tax Restaurant Discount',
        `- ${formatPdfMoney(gs.preTaxDiscountAmount)}`,
      ]);
    }
    accountingRows.push(['Taxable Base Subtotal', formatPdfMoney(gs.subTotal)]);

    Object.entries(gs.taxBreakdown).forEach(([taxName, val]) => {
      if (val > 0) accountingRows.push([taxName, formatPdfMoney(val)]);
    });

    if (gs.serviceCharge > 0) {
      const scPct = Math.round(sessionRules.serviceChargeRate * 100);
      accountingRows.push([`Service Charge (${scPct}%)`, formatPdfMoney(gs.serviceCharge)]);
    }

    if (gs.postTaxDiscountAmount > 0) {
      accountingRows.push([
        'Layer 3: Post-Tax App / Bank Coupon',
        `- ${formatPdfMoney(gs.postTaxDiscountAmount)}`,
      ]);
    }

    if (gs.roundOff !== 0) {
      accountingRows.push([
        'POS Round-Off Adjustment',
        `${gs.roundOff > 0 ? '+' : ''}${formatPdfMoney(gs.roundOff)}`,
      ]);
    }

    accountingRows.push(['FINAL GRAND TOTAL', formatPdfMoney(gs.grandTotal)]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: pageWidth - margin - 260, right: margin },
      body: accountingRows,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (hookData) => {
        if (hookData.row.index === accountingRows.length - 1) {
          hookData.cell.styles.fillColor = [0, 128, 255];
          hookData.cell.styles.textColor = [255, 255, 255];
          hookData.cell.styles.fontSize = 10;
          hookData.cell.styles.cellPadding = 6;
        }
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 22;

    // --- 5. INDIVIDUAL MEMBER SHARES & SETTLEMENT ACTION PLAN ---
    if (cursorY > pageHeight - 160) {
      doc.addPage();
      cursorY = 40;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Individual Shares & Cashier Payments', margin, cursorY);
    cursorY += 8;

    const memberRows =
      members.length > 0
        ? members.map((m: DBMember) => {
            const b = calculationResult.individualBreakdowns[m.id];
            const owed = b ? b.totalOwed : 0;
            const paid = Number(m.paid_amount || 0);
            const net = utils.round2(paid - owed);
            const dishSummary = b
              ? b.items.map((i) => `${i.name} (${i.qtyString})`).join(', ')
              : 'No items';

            return [
              m.name,
              dishSummary || 'No items',
              formatPdfMoney(owed),
              formatPdfMoney(paid),
              net > 0.01
                ? `Receives +${formatPdfMoney(net)}`
                : net < -0.01
                  ? `Owes -${formatPdfMoney(Math.abs(net))}`
                  : 'Settled (0.00)',
            ];
          })
        : Object.values(calculationResult.individualBreakdowns).map((b) => [
            b.memberName,
            b.items.map((i) => `${i.name} (${i.qtyString})`).join(', ') || 'No items',
            formatPdfMoney(b.totalOwed),
            'Rs. 0.00',
            formatPdfMoney(b.totalOwed),
          ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Person', 'Items Consumed', 'Share Owed', 'Paid Cashier', 'Net Position']],
      body: memberRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42], cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        2: { cellWidth: 72, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 72, halign: 'right' },
        4: { cellWidth: 96, halign: 'right', fontStyle: 'bold' },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 20;

    if (ledger && ledger.length > 0) {
      if (cursorY > pageHeight - 130) {
        doc.addPage();
        cursorY = 40;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('3. Settlement Action Plan (Who Pays Whom)', margin, cursorY);
      cursorY += 8;

      const settlementRows = ledger.map((row: any) => {
        const cKey = row.creditor_id || `fallback:${row.creditor_name}`;
        const upi = creditorUpiMap[cKey] || 'Cash / Direct Transfer';
        return [
          row.debtor_name,
          `->  ${row.creditor_name}`,
          formatPdfMoney(Number(row.amount || 0)),
          upi,
          row.settled ? 'PAID / SETTLED' : 'PENDING',
        ];
      });

      autoTable(doc, {
        startY: cursorY,
        margin: { left: margin, right: margin },
        head: [['Payer (Debtor)', 'Recipient (Creditor)', 'Amount', 'UPI ID / Method', 'Status']],
        body: settlementRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 128, 255], textColor: [255, 255, 255], fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5, textColor: [15, 23, 42], cellPadding: 5.5 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { fontStyle: 'bold' },
          2: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'center', fontStyle: 'bold' },
        },
      });
    }

    // Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated by Ekwly (ekwly.app)  •  Page ${p} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 18,
        { align: 'center' }
      );
    }

    const safeFile = (receiptTitle || venueName || 'Ekwly_Statement')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    const fileName = `${safeFile}_statement.pdf`;

    if (
      mode === 'share' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function'
    ) {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: primaryTitle,
            text: `Itemized PDF bill statement for ${primaryTitle} on Ekwly`,
            files: [file],
          });
          showToast('PDF shared!', 'success');
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
        }
      }
    }

    doc.save(fileName);
    showToast('PDF downloaded!', 'success');
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    console.error('PDF generation error:', err);
    showToast('Failed to generate PDF.', 'error');
  }
};
