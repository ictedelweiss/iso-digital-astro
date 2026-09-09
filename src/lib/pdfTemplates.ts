import type { PurchaseRequisition, LeaveRequest, HandoverForm, Meeting } from './types';

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

const SIGNATURE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] as string
  );
}

/**
 * Renders a stored signature as an `<img>` tag, or nothing at all.
 *
 * Signature values are persisted strings that end up interpolated straight
 * into document HTML. Interpolating them blindly allows a stored XSS payload
 * such as `x" onerror="...`. Values are therefore both type-checked as image
 * data URLs and HTML-escaped before use.
 */
function signatureImg(value: unknown, className?: string): string {
  if (typeof value !== 'string' || !SIGNATURE_DATA_URL.test(value)) {
    return '';
  }
  const classAttr = className ? ` class="${escapeHtml(className)}"` : '';
  return `<img src="${escapeHtml(value)}"${classAttr} alt="TTD">`;
}

import { isDraftPrNumber } from './prNumber';

export function generatePrPdfHtml(pr: PurchaseRequisition, logoBase64: string = '/logo.png'): string {
  const budgetStatus = (pr.budget_status || '').toLowerCase();
  const isDianggarkan = budgetStatus.includes('dianggarkan') && !budgetStatus.includes('belum');
  const isBelumDianggarkan = budgetStatus.includes('belum');
  const displayPrNum = isDraftPrNumber(pr.pr_number) ? '(Menunggu Penerbitan No. PR - Accounting)' : (pr.pr_number || '-');

  // Format Items rows
  let itemRowsHtml = '';
  let grandTotal = 0;

  const itemsToRender = [...(pr.items || [])];
  // Fill up to at least 5 rows for standard ISO physical format
  while (itemsToRender.length < 5) {
    itemsToRender.push({ id: 0, item_name: '', qty: 0, unit: '', price: 0 });
  }

  itemsToRender.forEach((item, index) => {
    const isReal = item.qty > 0 || item.item_name !== '';
    const total = isReal ? (item.qty * item.price) : 0;
    if (isReal) grandTotal += total;

    itemRowsHtml += `
      <tr>
        <td class="no">${index + 1}</td>
        <td class="desc">${item.item_name || '&nbsp;'}</td>
        <td class="qty">${isReal ? Number(item.qty).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '&nbsp;'}</td>
        <td class="unit">${item.unit || '&nbsp;'}</td>
        <td class="price">${isReal ? 'Rp ' + Number(item.price).toLocaleString('id-ID') : '&nbsp;'}</td>
        <td class="total">${isReal ? 'Rp ' + Number(total).toLocaleString('id-ID') : '&nbsp;'}</td>
      </tr>
    `;
  });

  // Approver Signatures
  const pemohonSig = pr.requester_signature ? signatureImg(pr.requester_signature) : '';
  
  const koordApp = pr.approvals?.find(a => a.role === 'koordinator');
  const koordSig = (koordApp?.status === 'approved' && koordApp.signature) ? signatureImg(koordApp.signature) : '';
  const koordName = koordApp?.approverName || '—';

  const accApp = pr.approvals?.find(a => a.role === 'accounting');
  const accSig = (accApp?.status === 'approved' && accApp.signature) ? signatureImg(accApp.signature) : '';
  const accName = accApp?.approverName || '—';

  const ketuaApp = pr.approvals?.find(a => a.role === 'ketua_yayasan');
  const ketuaSig = (ketuaApp?.status === 'approved' && ketuaApp.signature) ? signatureImg(ketuaApp.signature) : '';
  const ketuaName = ketuaApp?.approverName || '—';

  return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Purchase Requisition - ${displayPrNum}</title>
    <style>
        @page {
            size: A4;
            margin: 10mm 10mm;
        }
        * {
            box-sizing: border-box;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111;
            font-size: 12px;
            margin: 0;
            background: #fff;
            padding: 4mm;
        }
        .header-table, .meta-table, .items-table, .note-table, .sign-table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-table {
            margin-bottom: 2px;
        }
        .header-left {
            width: 20%;
            border: 1px solid #111;
            text-align: center;
            font-weight: 700;
            font-size: 13px;
            line-height: 1.25;
            padding: 8px 4px;
        }
        .header-title {
            width: 50%;
            text-align: center;
            color: #1f4ea3;
            font-size: 18px;
            font-weight: 700;
        }
        .header-right {
            width: 30%;
            text-align: right;
            vertical-align: middle;
        }
        .header-right img {
            max-height: 46px;
            max-width: 150px;
        }
        .meta-table {
            margin: 0 0 8px 0;
        }
        .meta-table td {
            padding: 2px 4px;
            vertical-align: top;
            font-size: 12px;
        }
        .label { width: 18%; }
        .value { width: 30%; }
        .right-label { width: 12%; }
        .right-value { width: 20%; }
        .budget-cell {
            width: 20%;
            font-weight: 700;
            white-space: nowrap;
        }
        .check {
            display: inline-block;
            width: 14px;
            height: 14px;
            line-height: 12px;
            text-align: center;
            border: 1px solid #111;
            margin-right: 5px;
            font-size: 12px;
            font-weight: 700;
            vertical-align: middle;
        }
        .items-table th, .items-table td {
            border: 1px solid #111;
            padding: 5px 6px;
            font-size: 12px;
        }
        .items-table th {
            text-align: center;
            font-weight: 700;
            background: #fff;
        }
        .items-table td {
            height: 25px;
        }
        .no { width: 36px; text-align: center; }
        .desc { width: 40%; }
        .qty, .unit { width: 12%; text-align: center; }
        .price, .total { width: 18%; text-align: right; }
        .grand-label { text-align: right; font-weight: 700; }
        .grand-rp { text-align: center; font-weight: 700; }
        .grand-total { text-align: right; font-weight: 700; }
        .note-table { margin-top: 6px; }
        .note-table td {
            border: 1px solid #111;
            padding: 7px 8px;
            font-size: 12px;
        }
        .sign-table {
            margin-top: 18px;
            table-layout: fixed;
        }
        .sign-table td {
            width: 25%;
            text-align: center;
            vertical-align: top;
            padding: 0 6px;
        }
        .sign-role {
            min-height: 32px;
            line-height: 1.2;
            font-size: 12px;
        }
        .sign-role strong {
            display: block;
            font-size: 12px;
        }
        .signature-box {
            height: 52px;
            margin: 6px 0 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .signature-box img {
            max-height: 48px;
            max-width: 95%;
        }
        .sign-name {
            font-size: 11px;
        }
        .footer {
            margin-top: 10px;
            text-align: right;
            font-size: 10px;
            line-height: 1.2;
        }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td class="header-left">
                YAYASAN<br>
                SINAR PUTIH<br>
                EDELWEISS
            </td>
            <td class="header-title">Purchase Requisition</td>
            <td class="header-right">
                <img src="${logoBase64}" alt="Logo">
            </td>
        </tr>
    </table>

    <table class="meta-table">
        <tr>
            <td class="label">Nama Pemohon</td>
            <td class="value">: <strong>${pr.requester}</strong></td>
            <td class="right-label">Tanggal</td>
            <td class="right-value">: ${pr.needed_date || ''}</td>
            <td class="budget-cell" rowspan="2">
                <div><span class="check">${isDianggarkan ? '✓' : ''}</span>Dianggarkan</div>
                <div style="margin-top: 5px;"><span class="check">${isBelumDianggarkan ? '✓' : ''}</span>Belum dianggarkan</div>
            </td>
        </tr>
        <tr>
            <td class="label">Departemen</td>
            <td class="value">: ${pr.department}</td>
            <td class="right-label">Nomor</td>
            <td class="right-value">: ${displayPrNum}</td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th class="no">No</th>
                <th class="desc">Deskripsi</th>
                <th class="qty">Jumlah</th>
                <th class="unit">Satuan</th>
                <th class="price">Harga</th>
                <th class="total">Total</th>
            </tr>
        </thead>
        <tbody>
            ${itemRowsHtml}
            <tr>
                <td colspan="4" class="grand-label">Grand Total</td>
                <td class="grand-rp">Rp</td>
                <td class="grand-total">${grandTotal.toLocaleString('id-ID')}</td>
            </tr>
        </tbody>
    </table>

    <table class="note-table">
        <tr>
            <td><strong>Catatan:</strong> ${pr.notes || '-'}</td>
            ${pr.attachment_name ? `<td style="text-align: right; width: 45%; font-size: 11px;"><strong>Lampiran:</strong> 📎 ${pr.attachment_name}</td>` : ''}
        </tr>
    </table>

    <table class="sign-table">
        <tr>
            <td>
                <div class="sign-role">Dibuat oleh,<br><strong>Pemohon</strong></div>
                <div class="signature-box">${pemohonSig}</div>
                <div class="sign-name">( ${pr.requester} )</div>
            </td>
            <td>
                <div class="sign-role">Disetujui oleh,<br><strong>Koordinator</strong></div>
                <div class="signature-box">${koordSig}</div>
                <div class="sign-name">( ${koordName} )</div>
            </td>
            <td>
                <div class="sign-role">Diverifikasi oleh,<br><strong>Accounting</strong></div>
                <div class="signature-box">${accSig}</div>
                <div class="sign-name">( ${accName} )</div>
            </td>
            <td>
                <div class="sign-role">Disetujui oleh,<br><strong>Ketua Yayasan</strong></div>
                <div class="signature-box">${ketuaSig}</div>
                <div class="sign-name">( ${ketuaName} )</div>
            </td>
        </tr>
    </table>

    <div class="footer">
        YSPE-FNA-FM-001<br>
        Rev.03, 22-10-2024
    </div>
</body>
</html>`;
}

export function generateLeavePdfHtml(leave: LeaveRequest, logoBase64: string = '/logo.png'): string {
  const pemohonSig = leave.signature_pemohon ? signatureImg(leave.signature_pemohon, 'sig-img') : '';
  
  const koordApp = leave.approvals?.find(a => a.role === 'koordinator');
  const koordSig = (koordApp?.status === 'approved' && koordApp.signature) ? signatureImg(koordApp.signature, 'sig-img') : '';
  const koordName = koordApp?.approverName || '—';

  const hrdApp = leave.approvals?.find(a => a.role === 'hrd' || a.role === 'ketua_yayasan');
  const hrdSig = (hrdApp?.status === 'approved' && hrdApp.signature) ? signatureImg(hrdApp.signature, 'sig-img') : '';
  const hrdName = hrdApp?.approverName || '—';

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const todayStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Form Permohonan Cuti - ${leave.name}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            color: #000;
            font-size: 11px;
            margin: 0;
            padding: 20px 40px;
            line-height: 1.5;
            background: #fff;
        }
        .header {
            width: 100%;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #1e40af;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-left {
            width: 30%;
            font-weight: bold;
            font-size: 12px;
            color: #003087;
            vertical-align: middle;
            text-align: left;
        }
        .header-center {
            width: 40%;
            text-align: center;
            vertical-align: middle;
        }
        .header-title {
            color: #1e40af;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .header-right {
            width: 30%;
            text-align: right;
            vertical-align: middle;
        }
        .header-right img {
            max-height: 50px;
        }
        .field-row {
            margin-bottom: 5px;
            display: flex;
        }
        .field-label {
            width: 130px;
            flex-shrink: 0;
        }
        .field-value {
            flex: 1;
            border-bottom: 1px dotted #000;
            padding-left: 5px;
            min-height: 15px;
            font-weight: 500;
        }
        .narrative {
            margin: 20px 0;
            line-height: 1.8;
        }
        .narrative-line {
            border-bottom: 1px dotted #000;
            padding: 0 10px;
            display: inline-block;
            min-width: 50px;
            text-align: center;
            font-weight: 600;
        }
        .narrative-line-block {
            border-bottom: 1px dotted #000;
            padding: 2px 5px;
            min-height: 20px;
            width: 100%;
            margin-top: 5px;
        }
        .notes {
            margin-top: 20px;
            font-size: 11px;
        }
        .notes-title {
            text-decoration: underline;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .notes ol {
            padding-left: 20px;
            margin: 0;
        }
        .notes li {
            margin-bottom: 8px;
            text-align: justify;
        }
        .calc-table {
            margin-left: 20px;
            margin-top: 8px;
            width: calc(100% - 40px);
            border-collapse: collapse;
        }
        .calc-table tr { line-height: 1.6; }
        .calc-label { width: 55%; padding-right: 10px; }
        .calc-eq { width: 30px; text-align: center; }
        .calc-val {
            width: 80px;
            text-align: left;
            border-bottom: 1px dotted #000;
            padding-left: 5px;
            font-weight: bold;
        }
        .calc-unit { width: 70px; padding-left: 10px; }
        .sig-container { margin-top: 30px; }
        .sig-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
        }
        .sig-table td {
            border: 1px solid #000;
            text-align: center;
            vertical-align: top;
            width: 33.33%;
            padding: 10px;
        }
        .sig-role {
            margin-bottom: 10px;
            font-size: 11px;
        }
        .sig-img-container {
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 5px;
        }
        .sig-img {
            max-height: 48px;
            max-width: 140px;
            display: block;
        }
        .sig-name {
            font-weight: bold;
            font-size: 11px;
            margin-top: 5px;
        }
        .sig-title {
            font-weight: bold;
            font-size: 11px;
            margin-top: 2px;
            color: #333;
        }
        .footer-id {
            text-align: right;
            font-size: 9px;
            color: #666;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <table class="header-table">
            <tr>
                <td class="header-left">
                    YAYASAN SINAR<br>PUTIH EDELWEISS
                </td>
                <td class="header-center">
                    <span class="header-title">FORM PERMOHONAN CUTI</span>
                </td>
                <td class="header-right">
                    <img src="${logoBase64}" alt="Edelweiss School">
                </td>
            </tr>
        </table>
    </div>

    <div class="field-row">
        <span class="field-label">Nama :</span>
        <span class="field-value">${leave.name}</span>
    </div>
    <div class="field-row">
        <span class="field-label">Jabatan :</span>
        <span class="field-value">${leave.position}</span>
    </div>
    <div class="field-row">
        <span class="field-label">Departemen :</span>
        <span class="field-value">${leave.department}</span>
    </div>

    <div class="narrative">
        Dengan ini mengajukan permohonan cuti selama
        <span class="narrative-line">${leave.work_days}</span>
        hari kerja, terhitung mulai tanggal<br>
        <span class="narrative-line" style="min-width: 140px;">${leave.start_date}</span>
        s/d
        <span class="narrative-line" style="min-width: 140px;">${leave.end_date}</span>
        untuk keperluan :<br>
        <div class="narrative-line-block">${leave.purpose}</div>
    </div>

    <div style="margin-top: 15px;">
        Demikian permohonan cuti ini saya buat, untuk dapat dipertimbangkan sebagaimana mestinya
    </div>

    <div class="notes">
        <div class="notes-title">Note :</div>
        <ol>
            <li>Surat permohonan cuti kerja harus sudah diajukan 1 (satu) minggu sebelum pelaksanaan cuti.</li>
            <li>Permohonan Cuti yang mendadak harus dilandasi oleh alasan kuat yang berhubungan dengan cuti dimaksud.</li>
            <li>
                <table class="calc-table">
                    <tr>
                        <td class="calc-label">Hak Cuti Thn. ${prevYear} (sebelumnya)</td>
                        <td class="calc-eq">=</td>
                        <td class="calc-val">${leave.hak_prev}</td>
                        <td class="calc-unit">Hari</td>
                    </tr>
                    <tr>
                        <td class="calc-label"><strong>Hak Cuti Thn. ${currentYear} (berjalan)</strong></td>
                        <td class="calc-eq">=</td>
                        <td class="calc-val">${leave.hak_curr}</td>
                        <td class="calc-unit">+/+</td>
                    </tr>
                    <tr>
                        <td class="calc-label">Total Hak Cuti</td>
                        <td class="calc-eq">=</td>
                        <td class="calc-val">${leave.total_hak}</td>
                        <td class="calc-unit">Hari</td>
                    </tr>
                    <tr>
                        <td class="calc-label"><strong>Cuti yang telah diambil s/d ${todayStr} (hari ini)</strong></td>
                        <td class="calc-eq">=</td>
                        <td class="calc-val">${leave.taken_until}</td>
                        <td class="calc-unit">Hari -/-</td>
                    </tr>
                    <tr>
                        <td class="calc-label">Sisa Cuti</td>
                        <td class="calc-eq">=</td>
                        <td class="calc-val">${leave.sisa_curr}</td>
                        <td class="calc-unit">Hari</td>
                    </tr>
                    <tr>
                        <td class="calc-label">Permohonan Cuti</td>
                        <td class="calc-eq">=</td>
                        <td class="calc-val">${leave.request_days}</td>
                        <td class="calc-unit">Hari -/-</td>
                    </tr>
                    <tr>
                        <td class="calc-label"><strong>Sisa Cuti Per ${todayStr} (tanggal hari ini)</strong></td>
                        <td class="calc-eq">=</td>
                        <td class="calc-val">${leave.sisa_after}</td>
                        <td class="calc-unit"><strong>Hari</strong></td>
                    </tr>
                </table>
            </li>
            <li>Bagi Karyawan yang belum memiliki hak cuti atau hak cuti sudah habis (cuti negatif), wajib meminta persetujuan Ketua Yayasan untuk pengajuan permohonan cuti dan diserahkan kepada HRD.</li>
        </ol>
    </div>

    <div class="sig-container">
        <table class="sig-table">
            <tr>
                <td>
                    <div class="sig-role">Diajukan Oleh,</div>
                    <div class="sig-img-container">${pemohonSig}</div>
                    <div class="sig-name">${leave.name}</div>
                    <div class="sig-title">Pemohon</div>
                </td>
                <td>
                    <div class="sig-role">Disetujui Oleh,</div>
                    <div class="sig-img-container">${koordSig}</div>
                    <div class="sig-name">${koordName}</div>
                    <div class="sig-title">Direct Superior</div>
                </td>
                <td>
                    <div class="sig-role">Diketahui Oleh,</div>
                    <div class="sig-img-container">${hrdSig}</div>
                    <div class="sig-name">${hrdName}</div>
                    <div class="sig-title">HRD / Chairman</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="footer-id">
        YSPE-HRD-FM-019<br>
        Rev.02, 17-04-2023
    </div>
</body>
</html>`;
}

export function generateHandoverPdfHtml(handover: HandoverForm, logoBase64: string = '/logo.png'): string {
  const ictSig = handover.ict_signature_path ? signatureImg(handover.ict_signature_path, 'sig-img') : '';
  
  const recipientApp = handover.approvals?.find(a => a.role === 'recipient');
  const recipientSig = (recipientApp?.status === 'approved' && recipientApp.signature) ? signatureImg(recipientApp.signature, 'sig-img') : '';
  const recipientName = handover.recipient_name;

  const koordApp = handover.approvals?.find(a => a.role === 'koordinator');
  const koordSig = (koordApp?.status === 'approved' && koordApp.signature) ? signatureImg(koordApp.signature, 'sig-img') : '';
  const koordName = koordApp?.approverName || '—';

  const hrdApp = handover.approvals?.find(a => a.role === 'hrd');
  const hrdSig = (hrdApp?.status === 'approved' && hrdApp.signature) ? signatureImg(hrdApp.signature, 'sig-img') : '';
  const hrdName = hrdApp?.approverName || '—';

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Form Serah Terima Perangkat ICT</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            color: #000;
            font-size: 11px;
            margin: 0;
            padding: 15px 30px;
            line-height: 1.3;
            background: #fff;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            border: 1px solid #000;
        }
        .header-table td {
            border: 1px solid #000;
            padding: 8px;
            vertical-align: middle;
            text-align: center;
        }
        .header-left { width: 25%; font-weight: bold; font-size: 12px; }
        .header-center { width: 50%; font-weight: bold; font-size: 14px; }
        .header-right { width: 25%; }
        .header-right img { max-width: 120px; max-height: 50px; }
        .info-section { margin-bottom: 12px; padding-left: 5px; }
        .info-row { display: table; width: 100%; margin-bottom: 3px; }
        .info-label { display: table-cell; width: 180px; }
        .info-sep { display: table-cell; width: 10px; }
        .info-val { display: table-cell; font-weight: 500; }
        .guide-section { margin-bottom: 12px; padding-left: 5px; }
        .guide-title { text-decoration: underline; font-weight: bold; margin-bottom: 4px; }
        .guide-list { margin: 0; padding-left: 20px; }
        .guide-list li { margin-bottom: 2px; }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
        }
        .items-table th, .items-table td {
            border: 1px solid #000;
            padding: 5px;
            text-align: center;
            vertical-align: middle;
        }
        .items-table th { font-weight: bold; background-color: #fff; height: 35px; }
        .items-table td { height: 25px; }
        .confirmation-text { text-align: center; margin: 12px 0 20px 0; font-size: 11px; }
        .signature-table {
            width: 100%;
            border-collapse: collapse;
            border: none;
            margin-top: 15px;
        }
        .signature-table td {
            border: none;
            text-align: center;
            vertical-align: top;
            width: 25%;
            padding: 0 5px;
        }
        .sig-role { margin-bottom: 8px; font-size: 11px; }
        .sig-img-container {
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 4px;
        }
        .sig-img { max-height: 48px; max-width: 100px; display: block; }
        .sig-name { font-weight: bold; text-decoration: underline; }
        .sig-title { font-weight: bold; margin-top: 2px; font-size: 10px; color: #444; }
        .doc-id { text-align: right; font-size: 9px; color: #666; margin-top: 15px; }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td class="header-left">
                YAYASAN<br>SINAR PUTIH<br>EDELWEISS
            </td>
            <td class="header-center">
                FORM SERAH TERIMA<br>PERANGKAT ICT
            </td>
            <td class="header-right">
                <img src="${logoBase64}" alt="Edelweiss School">
            </td>
        </tr>
    </table>

    <div class="info-section">
        <div class="info-row">
            <div class="info-label">Dari</div>
            <div class="info-sep">:</div>
            <div class="info-val">ICT Department</div>
        </div>
        <div class="info-row">
            <div class="info-label">Kepada (Nama Peminjam)</div>
            <div class="info-sep">:</div>
            <div class="info-val">${handover.recipient_name}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Perihal</div>
            <div class="info-sep">:</div>
            <div class="info-val">${handover.item_name}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Hari & Tanggal</div>
            <div class="info-sep">:</div>
            <div class="info-val">${handover.handover_date}</div>
        </div>
    </div>

    <div class="guide-section">
        <div class="guide-title">Panduan Penggunaan</div>
        <ol class="guide-list">
            <li>Untuk digunakan dalam menjalankan pekerjaan yang berkaitan dengan pekerjaan Yayasan/Sekolah.</li>
            <li>Penggunaan harus sesuai dengan ketentuan Perusahaan dan kode etik yang berlaku terkait ITE dan media sosial.</li>
            <li>ICT meminta tandatangan di bagian kolom penyerahan pada karyawan yang menerima perangkat.</li>
            <li>ICT meminta tandatangan di bagian kolom pengembalian pada karyawan setelah proses pengembalian perangkat.</li>
            <li>Wajib menjaga laptop secara baik dan aman.</li>
            <li>Wajib melaporkan ke Yayasan jika terdapat kerusakan dan atau kehilangan.</li>
            <li>Peminjam wajib mengganti jika karena kecerobohan dan kelalaian menyebabkan laptop rusak dan hilang.</li>
        </ol>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th width="5%">No</th>
                <th width="22%">Nama Barang</th>
                <th width="20%">Spesifikasi</th>
                <th width="8%">Jumlah</th>
                <th width="15%">Masa Peminjaman</th>
                <th width="10%">Penyerahan<br>(Paraf)</th>
                <th width="10%">Pengembalian<br>(Paraf)</th>
                <th width="10%">Keterangan</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td><strong>${handover.item_name}</strong></td>
                <td style="font-size:10px;">${handover.specification || '-'}</td>
                <td>${handover.quantity}</td>
                <td>${handover.loan_period}</td>
                <td>✓</td>
                <td></td>
                <td>${handover.notes || '-'}</td>
            </tr>
            <tr><td>2</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td>3</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td>4</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td>5</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
    </table>

    <div class="confirmation-text">
        Mohon dilakukan pengecekan bersama dan ditandatangani apabila sudah diterima dengan baik.
    </div>

    <table class="signature-table">
        <tr>
            <td>
                <div class="sig-role">Diketahui Oleh,</div>
                <div class="sig-img-container">${koordSig}</div>
                <div class="sig-name">(${koordName})</div>
                <div class="sig-title">Koordinator</div>
            </td>
            <td>
                <div class="sig-role">Disetujui Oleh,</div>
                <div class="sig-img-container">${hrdSig}</div>
                <div class="sig-name">(${hrdName})</div>
                <div class="sig-title">HRD</div>
            </td>
            <td>
                <div class="sig-role">Diserahkan Oleh,</div>
                <div class="sig-img-container">${ictSig}</div>
                <div class="sig-name">(Petugas ICT)</div>
                <div class="sig-title">ICT</div>
            </td>
            <td>
                <div class="sig-role">Diterima Oleh,</div>
                <div class="sig-img-container">${recipientSig}</div>
                <div class="sig-name">(${recipientName})</div>
                <div class="sig-title">${handover.recipient_department}</div>
            </td>
        </tr>
    </table>

    <div class="doc-id">
        YSPE-ICT-FM-002<br>
        Rev.04, 10-12-2024
    </div>
</body>
</html>`;
}

function formatMeetingDate(dateStr: string): string {
  if (!dateStr) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(d) && m >= 0 && m < 12) {
      return `${d} ${months[m]} ${y}`;
    }
  }
  return dateStr;
}

export function generateMeetingPdfHtml(meeting: Meeting, logoBase64: string = '/logo.png'): string {
  const perPage = 16;
  const attendees = meeting.attendees || [];
  const totalPages = Math.max(1, Math.ceil(attendees.length / perPage));

  const rawAgendas = Array.isArray(meeting.agenda) && meeting.agenda.length > 0
    ? meeting.agenda
    : (meeting.title ? [meeting.title] : []);
  const agenda1 = rawAgendas[0] || '';
  const agenda2 = rawAgendas[1] || '';
  const agenda3 = rawAgendas[2] || '';

  const rawDate = meeting.date || '';
  const formattedDate = formatMeetingDate(rawDate);
  const formattedTime = meeting.time ? `${meeting.time} WIB` : '';

  let pagesHtml = '';

  for (let p = 0; p < totalPages; p++) {
    const isFirstPage = p === 0;
    const chunk = attendees.slice(p * perPage, (p + 1) * perPage);

    let rowsHtml = '';
    // 16 rows per page = 8 pairs (odd & even)
    for (let i = 0; i < perPage; i += 2) {
      const oddIndex = i;
      const evenIndex = i + 1;

      const oddAttendee = chunk[oddIndex];
      const evenAttendee = chunk[evenIndex];

      const oddNo = (p * perPage) + oddIndex + 1;
      const evenNo = (p * perPage) + evenIndex + 1;

      const oddName = oddAttendee ? escapeHtml(oddAttendee.name) : '&nbsp;';
      const oddJob = oddAttendee ? escapeHtml(oddAttendee.division || '-') : '&nbsp;';
      const oddSig = oddAttendee?.signature_path ? signatureImg(oddAttendee.signature_path, 'sig-img') : '';

      const evenName = evenAttendee ? escapeHtml(evenAttendee.name) : '&nbsp;';
      const evenJob = evenAttendee ? escapeHtml(evenAttendee.division || '-') : '&nbsp;';
      const evenSig = evenAttendee?.signature_path ? signatureImg(evenAttendee.signature_path, 'sig-img') : '';

      rowsHtml += `
        <tr>
          <td class="col-no">${oddNo}</td>
          <td class="col-name">${oddName}</td>
          <td class="col-job">${oddJob}</td>
          <td class="sig-cell sig-odd" rowspan="2">
            <div class="sig-num">${oddNo}.</div>
            ${oddSig ? `<div class="sig-img-wrap">${oddSig}</div>` : ''}
          </td>
          <td class="sig-cell sig-even" rowspan="2">
            ${evenSig ? `<div class="sig-img-wrap">${evenSig}</div>` : ''}
            <div class="sig-num">${evenNo}.</div>
          </td>
        </tr>
        <tr>
          <td class="col-no">${evenNo}</td>
          <td class="col-name">${evenName}</td>
          <td class="col-job">${evenJob}</td>
        </tr>
      `;
    }

    pagesHtml += `
      <div class="page-container">
        <!-- Header Table -->
        <table class="header-table">
          <tr>
            <td class="header-left">
              YAYASAN<br>
              SINAR PUTIH EDELWEISS
            </td>
            <td class="header-middle">
              DAFTAR HADIR${p > 0 ? ' (Lanjutan)' : ''}
            </td>
            <td class="header-right">
              <img src="${logoBase64}" alt="Edelweiss School">
            </td>
          </tr>
        </table>

        <!-- Metadata Section -->
        ${isFirstPage ? `
          <table class="meta-table">
            <tr>
              <td class="meta-label">AGENDA RAPAT</td>
              <td class="meta-colon">:</td>
              <td class="meta-value">
                <div class="agenda-line">
                  <span class="agenda-num">1)</span>
                  <span class="dotted-fill">${escapeHtml(agenda1)}</span>
                </div>
                <div class="agenda-line">
                  <span class="agenda-num">2)</span>
                  <span class="dotted-fill">${escapeHtml(agenda2)}</span>
                </div>
                <div class="agenda-line">
                  <span class="agenda-num">3)</span>
                  <span class="dotted-fill">${escapeHtml(agenda3)}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td class="meta-label">TANGGAL</td>
              <td class="meta-colon">:</td>
              <td class="meta-value">
                <div class="agenda-line">
                  <span class="dotted-fill">${escapeHtml(formattedDate)}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td class="meta-label">JAM</td>
              <td class="meta-colon">:</td>
              <td class="meta-value">
                <div class="agenda-line">
                  <span class="dotted-fill">${escapeHtml(formattedTime)}</span>
                </div>
              </td>
            </tr>
          </table>
          <div class="peserta-title">PESERTA RAPAT :</div>
        ` : `
          <div class="continuation-meta">
            <span><strong>Agenda:</strong> ${escapeHtml(meeting.title)}</span> &bull; 
            <span><strong>Tanggal:</strong> ${escapeHtml(formattedDate)}</span>
          </div>
          <div class="peserta-title">PESERTA RAPAT (Lanjutan) :</div>
        `}

        <!-- Participant Table -->
        <table class="participant-table">
          <thead>
            <tr>
              <th class="col-no">NO</th>
              <th class="col-name">NAMA</th>
              <th class="col-job">JABATAN</th>
              <th class="col-sig" colspan="2">TANDA TANGAN</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Footer Table -->
        <table class="footer-table">
          <tr>
            <td class="footer-left"></td>
            <td class="footer-center">${p + 1}</td>
            <td class="footer-right">
              YSPE-MGT-FM-007<br>
              Rev.01 20-01-2022
            </td>
          </tr>
        </table>
      </div>
      ${p < totalPages - 1 ? '<div class="page-break"></div>' : ''}
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Daftar Hadir Rapat - ${escapeHtml(meeting.title)}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 15mm 12mm 15mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        body {
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            color: #000;
            margin: 0;
            padding: 0;
            background: #e2e8f0;
            line-height: 1.2;
        }
        .page-container {
            width: 100%;
            max-width: 210mm;
            min-height: 297mm;
            margin: 15px auto;
            padding: 14mm 15mm 12mm 15mm;
            background: #fff;
            position: relative;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .page-break {
            page-break-after: always;
            break-after: page;
            height: 0;
        }

        @media print {
            body {
                background: #fff;
            }
            .page-container {
                max-width: none;
                min-height: auto;
                margin: 0;
                padding: 0;
                box-shadow: none;
            }
        }

        /* Header Table */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.2px solid #000;
            margin-bottom: 12px;
        }
        .header-table td {
            border: 1.2px solid #000;
            padding: 10px 8px;
            vertical-align: middle;
        }
        .header-left {
            width: 32%;
            text-align: center;
            font-weight: 700;
            font-size: 13px;
            line-height: 1.35;
            letter-spacing: 0.2px;
        }
        .header-middle {
            width: 40%;
            text-align: center;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: 0.5px;
        }
        .header-right {
            width: 28%;
            text-align: center;
        }
        .header-right img {
            max-height: 46px;
            max-width: 100%;
            display: block;
            margin: 0 auto;
            object-fit: contain;
        }

        /* Metadata Section */
        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
            margin-bottom: 8px;
            font-size: 12px;
        }
        .meta-table td {
            padding: 1px 0;
            vertical-align: top;
            border: none;
        }
        .meta-label {
            width: 125px;
            font-weight: 700;
            font-size: 12px;
            letter-spacing: 0.2px;
            white-space: nowrap;
        }
        .meta-colon {
            width: 14px;
            font-weight: 700;
            text-align: left;
        }
        .meta-value {
            width: auto;
        }
        .agenda-line {
            display: flex;
            align-items: flex-end;
            min-height: 19px;
            margin-bottom: 2px;
        }
        .agenda-num {
            width: 18px;
            font-weight: 700;
            flex-shrink: 0;
            line-height: 1.2;
            font-size: 12px;
        }
        .dotted-fill {
            flex-grow: 1;
            border-bottom: 1px dotted #000;
            padding-left: 3px;
            padding-bottom: 1px;
            min-height: 15px;
            line-height: 1.2;
            font-size: 12px;
        }
        .peserta-title {
            font-weight: 700;
            font-size: 12px;
            margin-top: 12px;
            margin-bottom: 6px;
            letter-spacing: 0.3px;
        }
        .continuation-meta {
            font-size: 11px;
            margin-top: 8px;
            margin-bottom: 6px;
            color: #333;
        }

        /* Participant Table */
        .participant-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.2px solid #000;
        }
        .participant-table th,
        .participant-table td {
            border: 1px solid #000;
        }
        .participant-table th {
            padding: 8px 4px;
            font-weight: 700;
            text-align: center;
            font-size: 12.5px;
            letter-spacing: 0.3px;
            background: #fff;
            height: 34px;
        }
        .participant-table td.col-no {
            width: 40px;
            text-align: center;
            font-weight: 700;
            font-size: 12px;
            height: 39px;
        }
        .participant-table td.col-name {
            width: 205px;
            padding: 2px 8px;
            font-size: 12px;
            height: 39px;
            vertical-align: middle;
        }
        .participant-table td.col-job {
            width: 135px;
            padding: 2px 8px;
            font-size: 12px;
            height: 39px;
            vertical-align: middle;
        }
        .col-sig {
            width: 230px;
        }
        .sig-cell {
            width: 115px;
            height: 78px; /* 2 rows x 39px */
            padding: 2px 4px;
            position: relative;
            vertical-align: top;
            border: 1px solid #000;
        }
        .sig-odd {
            vertical-align: top;
        }
        .sig-even {
            vertical-align: bottom;
        }
        .sig-odd .sig-num {
            position: absolute;
            top: 3px;
            left: 5px;
            font-size: 11.5px;
            font-weight: 700;
            line-height: 1;
            z-index: 2;
        }
        .sig-even .sig-num {
            position: absolute;
            bottom: 3px;
            left: 5px;
            font-size: 11.5px;
            font-weight: 700;
            line-height: 1;
            z-index: 2;
        }
        .sig-img-wrap {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .sig-img {
            max-height: 60px;
            max-width: 100px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
        }

        /* Footer Table */
        .footer-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
            font-size: 11px;
        }
        .footer-table td {
            border: none;
            padding: 0;
            vertical-align: top;
        }
        .footer-left {
            width: 30%;
        }
        .footer-center {
            width: 40%;
            text-align: center;
            font-weight: 700;
            font-size: 12px;
        }
        .footer-right {
            width: 30%;
            text-align: right;
            font-weight: 700;
            line-height: 1.35;
            font-size: 10px;
        }
    </style>
</head>
<body>
    ${pagesHtml}
</body>
</html>`;
}
