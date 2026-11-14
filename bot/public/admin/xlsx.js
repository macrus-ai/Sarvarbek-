/* Miqyos admin: Excel (.xlsx) fayl yasash, tashqi kutubxonasiz.
   .xlsx — bu ichida bir nechta XML fayl bo'lgan zip arxiv. Bu yerda faqat kerakli qismi bor:
   bir nechta varaq, matn va son kataklar, qalin sarlavha qatori, ustun kengligi,
   muzlatilgan sarlavha va filtr. Zip siqilmagan holda yoziladi (Excel buni oddiy qabul qiladi).

   OvozaXlsx.build([{ name, header: ['A', 'B'], rows: [[1, 'matn'], ...], widths: [10, 20] }]) -> Uint8Array
   Katak: son (number) yoki matn; null, undefined va '' — bo'sh. */
(() => {
  'use strict';

  const enc = new TextEncoder();

  /* ---------- CRC32 (zip uchun) ---------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* ---------- Zip (siqilmagan, "stored") ---------- */
  function dosDateTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  function zip(files, now = new Date()) {
    const { time, date } = dosDateTime(now);
    const parts = [];
    const central = [];
    let offset = 0;
    for (const file of files) {
      const name = enc.encode(file.name);
      const data = typeof file.data === 'string' ? enc.encode(file.data) : file.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true); // kerakli versiya 2.0
      local.setUint16(6, 0x0800, true); // nomlar UTF-8
      local.setUint16(8, 0, true); // siqilmagan
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(8, 0x0800, true);
      entry.setUint16(10, 0, true);
      entry.setUint16(12, time, true);
      entry.setUint16(14, date, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, data.length, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true); // qolganlari (izoh, atributlar) — 0
      central.push(new Uint8Array(entry.buffer), name);

      offset += 30 + name.length + data.length;
    }
    const centralSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    parts.push(...central, new Uint8Array(end.buffer));

    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let pos = 0;
    for (const p of parts) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  }

  /* ---------- SpreadsheetML ---------- */
  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

  // XML'da ruxsat etilmagan belgilar (boshqaruv belgilari, juft bo'lmagan surrogatlar) olib tashlanadi
  const xml = (s) =>
    String(s)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
      .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '�')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // 0 -> A, 25 -> Z, 26 -> AA
  function columnName(index) {
    let n = index + 1;
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // Excel varaq nomi: 31 belgigacha, : \ / ? * [ ] bo'lmaydi, takrorlanmaydi
  function sheetNames(sheets) {
    const used = new Set();
    return sheets.map((s, i) => {
      let base = String(s.name || `Sheet${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`;
      let name = base;
      for (let k = 2; used.has(name.toLowerCase()); k += 1) name = `${base.slice(0, 28)} (${k})`;
      used.add(name.toLowerCase());
      return name;
    });
  }

  const MAX_TEXT = 32767; // Excel katagidagi eng uzun matn

  function cell(ref, value, style) {
    const s = style ? ` s="${style}"` : '';
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
    if (value == null || value === '') return '';
    const text = String(value).slice(0, MAX_TEXT);
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
  }

  function worksheet(sheet) {
    const header = sheet.header || [];
    const width = Math.max(header.length, ...(sheet.rows || []).map((r) => r.length), 1);
    const last = columnName(width - 1);
    const rows = [];
    if (header.length) {
      rows.push(`<row r="1">${header.map((h, c) => cell(`${columnName(c)}1`, h, 1)).join('')}</row>`);
    }
    (sheet.rows || []).forEach((r, i) => {
      const n = i + (header.length ? 2 : 1);
      rows.push(`<row r="${n}">${r.map((v, c) => cell(`${columnName(c)}${n}`, v)).join('')}</row>`);
    });
    const widths = sheet.widths || [];
    const cols = widths.length
      ? `<cols>${widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${Number(w) || 10}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const frozen = header.length
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const filter = header.length ? `<autoFilter ref="A1:${last}${Math.max(1, rows.length)}"/>` : '';
    return `${XML_HEAD}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">${frozen}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows.join('')}</sheetData>${filter}</worksheet>`;
  }

  const STYLES = `${XML_HEAD}<styleSheet xmlns="${NS}">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function build(sheets, { now = new Date() } = {}) {
    if (!sheets.length) throw new Error('xlsx: varaq yo‘q');
    const names = sheetNames(sheets);
    const quoted = (name) => `'${name.replace(/'/g, "''")}'`;

    const contentTypes = `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`;

    const rootRels = `${XML_HEAD}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

    // Filtr uchun Excel talab qiladigan yashirin nom
    const filters = sheets
      .map((s, i) => {
        if (!(s.header || []).length) return '';
        const width = Math.max(s.header.length, ...(s.rows || []).map((r) => r.length), 1);
        const lastRow = (s.rows || []).length + 1;
        return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xml(quoted(names[i]))}!$A$1:$${columnName(width - 1)}$${lastRow}</definedName>`;
      })
      .join('');
    const workbook = `${XML_HEAD}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><bookViews><workbookView/></bookViews><sheets>${names
      .map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets>${filters ? `<definedNames>${filters}</definedNames>` : ''}</workbook>`;

    const workbookRels = `${XML_HEAD}<Relationships xmlns="${NS_PKG}">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${sheets.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`;

    return zip(
      [
        { name: '[Content_Types].xml', data: contentTypes },
        { name: '_rels/.rels', data: rootRels },
        { name: 'xl/workbook.xml', data: workbook },
        { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
        { name: 'xl/styles.xml', data: STYLES },
        ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: worksheet(s) }))
      ],
      now
    );
  }

  globalThis.OvozaXlsx = { build, columnName, crc32 };
})();
