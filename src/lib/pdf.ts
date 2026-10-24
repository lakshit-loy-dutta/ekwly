import { showToast, utils } from './utils';
import { mathEngine } from './mathEngine';
import { EKWLY_E_PATH } from '../components/ui/BrandLoader';
import type { CalculationResult, BillItem, TaxPreset } from './types';
import type { DBMember } from './useSession';

const KWLY_PATHS = [
  '<path d="M 14 12 L 14 74" />',
  '<path d="M 46 34 L 18 53 L 48 74" />',
  '<path d="M 70 34 L 83 74 L 99 44 L 115 74 L 128 34" />',
  '<path d="M 152 12 L 152 65 Q 152 74 162 74" />',
  '<path d="M 182 34 L 200 68" />',
  '<path d="M 220 34 L 195 83 Q 190 91 179 89" />',
].join('');

/**
 * Renders the exact locked v3 <BrandWordmark /> ([E=]kwly) SVG to a crisp high-DPI PNG data URL
 * for embedding into the PDF header.
 */
function renderBrandWordmarkPngDataUrl(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  const svgStr = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 354 114" width="708" height="228" fill="none">',
    `<path d="${EKWLY_E_PATH}" fill="#001E3B" />`,
    '<rect x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill="#0080FF" />',
    '<rect x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill="#38BDF8" />',
    '<g transform="translate(91.25, 4.09) scale(1.09)" stroke="#0284C7" stroke-width="15" stroke-linecap="round" stroke-linejoin="round">',
    KWLY_PATHS,
    '</g>',
    '</svg>',
  ].join('');

  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 708;
      canvas.height = 228;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      const img = new Image();
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 708, 228);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
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

function renderSvgElementToPngDataUrl(
  svgEl: SVGElement | null | undefined
): Promise<string | null> {
  if (!svgEl || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 240, 240);
          ctx.drawImage(img, 10, 10, 220, 220);
        }
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
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

export const exportToPDF = async (
  calculationResult: CalculationResult | null,
  receiptTitle: string,
  items: BillItem[],
  taxPresets: TaxPreset[],
  scTaxPresetId: string,
  serviceChargeRate: number,
  members: DBMember[],
  ledger: any[],
  mode: 'download' | 'share' = 'download',
  upiMap: Record<string, string> = {},
  qrSvgMap: Record<string, SVGElement | null> = {}
) => {
  try {
    if (!calculationResult) return showToast('Calculate split first.', 'error');

    const [{ jsPDF }, { default: autoTable }, wordmarkPng] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
      renderBrandWordmarkPngDataUrl(),
    ]);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const { globalSummary: gs, individualBreakdowns } = calculationResult;

    const preTaxMultiplier = mathEngine.computePreTaxMultiplier(items, gs.preTaxDiscountAmount);

    const customTitle = receiptTitle.trim();
    const dateStr = new Date().toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const docTitle = customTitle ? customTitle : 'Settlement Receipt';

    const primaryColor: [number, number, number] = [0, 128, 255];
    const primaryLight: [number, number, number] = [216, 235, 255];
    const darkText: [number, number, number] = [0, 30, 59];
    const mutedText: [number, number, number] = [71, 85, 105];
    const accentBlueText: [number, number, number] = [0, 69, 137];
    const emeraldText: [number, number, number] = [5, 150, 105];
    const borderColor: [number, number, number] = [186, 218, 255];
    const headerFill: [number, number, number] = [230, 242, 255];

    // Helper: Ensures a logical section (heading + table) fits on the current page without splitting
    const ensurePageSpace = (neededHeightMm: number, currentY: number): number => {
      if (currentY + neededHeightMm > pageHeight - 20) {
        doc.addPage();
        return 25;
      }
      return currentY;
    };

    let startY = 22;

    // --- HEADER (With True v3 [E=]kwly Brand Wordmark on Right) ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.text(docTitle.slice(0, 34), 14, startY + 2);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(
      `Generated on ${dateStr}  •  ${members.length} ${members.length === 1 ? 'Person' : 'People'}  •  ${items.length} ${items.length === 1 ? 'Item' : 'Items'}`,
      14,
      startY + 9
    );

    if (wordmarkPng) {
      // Aspect ratio of 354 x 114 is 3.105:1 -> 34mm wide x 10.95mm tall at top-right
      doc.addImage(wordmarkPng, 'PNG', pageWidth - 14 - 34, startY - 6, 34, 11);
    }

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.line(14, startY + 15, pageWidth - 14, startY + 15);
    startY += 25;

    // --- 1. MASTER BILL BREAKDOWN ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('MASTER BILL BREAKDOWN', 14, startY);
    startY += 5;

    const masterTableData = items.map((i) => {
      const breakdown = mathEngine.calculateItemBreakdown(i, {
        taxPresets,
        serviceChargeRate,
        scTaxPresetId,
        preTaxMultiplier,
      });

      const discLabel =
        breakdown.itemDiscountAmount > 0 ? ` (-Rs.${breakdown.itemDiscountAmount.toFixed(0)})` : '';

      const ratePct = (breakdown.dynamicTaxRate * 100).toFixed(1).replace(/\.0$/, '');
      const taxNameStr = breakdown.preset
        ? `${breakdown.preset.name} (${ratePct}%)`
        : `${ratePct}%`;
      const scStr = i.applySC && serviceChargeRate > 0 ? ' + S.C.' : '';

      return [
        `${i.name}${discLabel}`,
        i.qty.toString(),
        `Rs. ${i.unitPrice.toFixed(2)}`,
        `${taxNameStr}${scStr}`,
        `Rs. ${breakdown.finalTotal.toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY,
      head: [['Item', 'Qty', 'Unit Price', 'Tax & Fees', 'Total']],
      body: masterTableData,
      theme: 'grid',
      headStyles: {
        fillColor: headerFill,
        textColor: accentBlueText,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: { textColor: darkText, fontSize: 9 },
      styles: { lineColor: borderColor, lineWidth: 0.15, cellPadding: 3.8 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'center', cellWidth: 44 },
        4: { halign: 'right', fontStyle: 'bold', textColor: primaryColor, cellWidth: 34 },
      },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 8;

    // --- 2. SUMMARY SUB-TABLE (Right-Aligned Accounting Block) ---
    const computedGrossTotal =
      gs.subTotal + gs.serviceCharge + Object.values(gs.taxBreakdown).reduce((a, b) => a + b, 0);
    const summaryData: any[] = [];

    if (gs.itemDiscountAmount > 0 || gs.preTaxDiscountAmount > 0) {
      summaryData.push(['Raw Subtotal:', `Rs. ${gs.rawSubTotal.toFixed(2)}`]);
    }
    if (gs.itemDiscountAmount > 0) {
      summaryData.push(['Item / Category Discounts:', `- Rs. ${gs.itemDiscountAmount.toFixed(2)}`]);
    }
    if (gs.preTaxDiscountAmount > 0) {
      summaryData.push([
        'Restaurant Discount (Pre-Tax):',
        `- Rs. ${gs.preTaxDiscountAmount.toFixed(2)}`,
      ]);
    }

    summaryData.push(['Taxable Base Subtotal:', `Rs. ${gs.subTotal.toFixed(2)}`]);

    for (const [taxName, amount] of Object.entries(gs.taxBreakdown)) {
      if (amount > 0) summaryData.push([`${taxName}:`, `Rs. ${amount.toFixed(2)}`]);
    }

    if (gs.serviceCharge > 0) {
      const scPct = Math.round(serviceChargeRate * 100);
      summaryData.push([`Service Charge (${scPct}%):`, `Rs. ${gs.serviceCharge.toFixed(2)}`]);
    }

    if (gs.postTaxDiscountAmount > 0) {
      summaryData.push(['Gross Total:', `Rs. ${computedGrossTotal.toFixed(2)}`]);
      summaryData.push([
        'Coupon / App Discount (Post-Tax):',
        `- Rs. ${gs.postTaxDiscountAmount.toFixed(2)}`,
      ]);
    }

    if (gs.roundOff !== 0) {
      summaryData.push([
        'POS Round Off:',
        `${gs.roundOff > 0 ? '+' : ''} Rs. ${gs.roundOff.toFixed(2)}`,
      ]);
    }

    summaryData.push(['GRAND TOTAL:', `Rs. ${gs.grandTotal.toFixed(2)}`]);

    startY = ensurePageSpace(summaryData.length * 7 + 10, startY);

    autoTable(doc, {
      startY,
      body: summaryData,
      theme: 'plain',
      styles: { fontSize: 9, textColor: mutedText, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 62, halign: 'right' },
        1: { cellWidth: 36, halign: 'right', textColor: darkText, fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        const label = String(data.row.raw[0] || '');
        if (label.includes('Discount')) {
          data.cell.styles.textColor = emeraldText;
        }
        if (label === 'GRAND TOTAL:') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
          data.cell.styles.fillColor = primaryLight;
          data.cell.styles.textColor = data.column.index === 1 ? primaryColor : darkText;
          data.cell.styles.cellPadding = 4;
        }
      },
      margin: { left: pageWidth - 14 - 98, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 14;

    // --- 3. WHO PAID THE RESTAURANT ---
    const payers = members.filter((m) => (m.paid_amount || 0) > 0);
    if (payers.length > 0) {
      startY = ensurePageSpace(20 + payers.length * 10, startY);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('PAYMENTS TO RESTAURANT', 14, startY);
      startY += 5;

      autoTable(doc, {
        startY,
        head: [['Member Who Paid Cashier', 'Amount Paid']],
        body: payers.map((m) => [m.name, `Rs. ${Number(m.paid_amount).toFixed(2)}`]),
        theme: 'grid',
        headStyles: {
          fillColor: headerFill,
          textColor: accentBlueText,
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        bodyStyles: { textColor: darkText, fontSize: 9 },
        styles: { lineColor: borderColor, lineWidth: 0.15, cellPadding: 3.8 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right', fontStyle: 'bold', textColor: accentBlueText },
        },
        margin: { left: 14, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 14;
    }

    // --- 4. SETTLEMENT TRANSACTIONS (WHO OWES WHOM + UPI ID & QR) ---
    if (ledger.length > 0) {
      startY = ensurePageSpace(24 + ledger.length * 11, startY);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('SETTLEMENT TRANSACTIONS', 14, startY);
      startY += 5;

      const ledgerTableData = ledger.map((l) => {
        const cKey = l.creditor_id || `fallback:${l.creditor_name}`;
        const upi = upiMap[cKey];
        const statusStr = l.settled ? 'PAID' : upi ? `UPI: ${upi}` : 'Pending';
        return [
          l.debtor_name,
          'owes',
          l.creditor_name,
          statusStr,
          `Rs. ${Number(l.amount).toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY,
        head: [['Payer', '', 'Recipient', 'UPI ID / Status', 'Amount']],
        body: ledgerTableData,
        theme: 'grid',
        headStyles: {
          fillColor: headerFill,
          textColor: accentBlueText,
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        styles: { lineColor: borderColor, lineWidth: 0.15, cellPadding: 3.8, fontSize: 9 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: darkText },
          1: { halign: 'center', textColor: mutedText, fontSize: 8, cellWidth: 16 },
          2: { fontStyle: 'bold', textColor: darkText },
          3: { textColor: mutedText, fontSize: 8.5 },
          4: { halign: 'right', fontStyle: 'bold', textColor: primaryColor, cellWidth: 34 },
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // Embed Scannable UPI QR Code Cards for Unsettled Creditors (If Available)
      const uniqueCreditors: { key: string; name: string; upi: string; total: number }[] = [];
      const seenKeys = new Set<string>();
      for (const l of ledger) {
        if (l.settled) continue;
        const cKey = l.creditor_id || `fallback:${l.creditor_name}`;
        const upi = upiMap[cKey];
        if (upi && !seenKeys.has(cKey)) {
          seenKeys.add(cKey);
          const totalForCreditor = ledger
            .filter(
              (row) => !row.settled && (row.creditor_id || `fallback:${row.creditor_name}`) === cKey
            )
            .reduce((s, row) => s + Number(row.amount || 0), 0);
          uniqueCreditors.push({
            key: cKey,
            name: l.creditor_name,
            upi,
            total: utils.round2(totalForCreditor),
          });
        }
      }

      for (const cred of uniqueCreditors) {
        const qrDataUrl = await renderSvgElementToPngDataUrl(qrSvgMap[cred.key]);
        if (qrDataUrl) {
          startY = ensurePageSpace(38, startY);
          doc.setFillColor(242, 248, 255);
          doc.setDrawColor(...borderColor);
          doc.roundedRect(14, startY, pageWidth - 28, 34, 3, 3, 'FD');
          doc.addImage(qrDataUrl, 'PNG', 18, startY + 3, 28, 28);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(...primaryColor);
          doc.text(`SCAN TO PAY ${cred.name.toUpperCase()} VIA ANY UPI APP`, 52, startY + 11);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...darkText);
          doc.text(`UPI ID: ${cred.upi}`, 52, startY + 19);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...mutedText);
          doc.text(
            `Total Receivable: Rs. ${cred.total.toFixed(2)}  •  Works with GPay, PhonePe, Paytm & BHIM`,
            52,
            startY + 27
          );
          startY += 40;
        }
      }
    }

    // --- 5. INDIVIDUAL SETTLEMENTS (NEW PAGE — KEEPING EACH PERSON'S BLOCK TOGETHER) ---
    doc.addPage();
    startY = 24;

    if (wordmarkPng) {
      doc.addImage(wordmarkPng, 'PNG', pageWidth - 14 - 28, startY - 5, 28, 9);
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('INDIVIDUAL SETTLEMENTS', 14, startY);
    startY += 10;

    Object.keys(individualBreakdowns).forEach((person) => {
      const b = individualBreakdowns[person];
      if (b.totalOwed === 0) return;

      // Calculate exact height needed for this person's heading + table so it never splits across a page break
      const rowCount = b.items.length + (b.serviceCharge > 0 ? 1 : 0) + 1;
      const estimatedBlockHeight = 16 + rowCount * 8.5;
      if (startY + estimatedBlockHeight > pageHeight - 18 && startY > 35) {
        doc.addPage();
        startY = 25;
      }

      doc.setFontSize(11.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(b.memberName || person, 14, startY);
      startY += 4;

      const tableData: any[] = b.items.map((i) => [
        i.name,
        i.qtyString,
        `Rs. ${i.cost.toFixed(2)}`,
      ]);
      if (b.serviceCharge > 0) {
        tableData.push([
          {
            content: 'Service Charge (inc. Tax)',
            styles: { textColor: mutedText, fontStyle: 'normal' },
          },
          '-',
          {
            content: `Rs. ${b.serviceCharge.toFixed(2)}`,
            styles: { textColor: mutedText, fontStyle: 'normal' },
          },
        ]);
      }

      tableData.push([
        {
          content: 'Total Owed:',
          colSpan: 2,
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fillColor: primaryLight,
            textColor: primaryColor,
            fontSize: 10,
          },
        },
        {
          content: `Rs. ${b.totalOwed.toFixed(2)}`,
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fillColor: primaryLight,
            textColor: primaryColor,
            fontSize: 10,
          },
        },
      ]);

      autoTable(doc, {
        startY,
        head: [['Item Consumed', 'Qty', 'Allocated Cost']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: headerFill,
          textColor: accentBlueText,
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        bodyStyles: { textColor: darkText, fontSize: 9 },
        styles: { lineColor: borderColor, lineWidth: 0.15, cellPadding: 3.8 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'center', cellWidth: 28 },
          2: { halign: 'right', cellWidth: 42 },
        },
        margin: { left: 14, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 12;
    });

    // --- GLOBAL DECORATIONS (Top Accent Bar & Page Numbers) ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 4, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...mutedText);
      doc.text(
        `Ekwly Settlement Receipt  •  Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        {
          align: 'center',
        }
      );
    }

    const safeFilename = customTitle
      ? customTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : `Settlement_${new Date().toISOString().slice(0, 10)}`;
    const fileNameWithExt = `${safeFilename}.pdf`;

    if (mode === 'share') {
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileNameWithExt, { type: 'application/pdf' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        try {
          await navigator.share({
            title: docTitle,
            text: `Bill split receipt for ${docTitle} generated via Ekwly.`,
            files: [pdfFile],
          });
          showToast('Receipt shared!', 'success');
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
          doc.save(fileNameWithExt);
          showToast('PDF downloaded to device!', 'success');
        }
        return;
      }
    }

    doc.save(fileNameWithExt);
    showToast('PDF downloaded to device!', 'success');
  } catch (error: any) {
    if (error?.name === 'AbortError') return;
    console.error(error);
    showToast('Error generating PDF.', 'error');
  }
};

// Alias for compatibility if any module imports generatePDF
export const generatePDF = exportToPDF;
