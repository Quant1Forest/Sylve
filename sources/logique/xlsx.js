/* ==========================================================================
   Écriture de classeurs .xlsx sans aucune bibliothèque externe.
   Un .xlsx est une archive ZIP : on écrit les entrées en « stored » (sans
   compression), ce qui évite d'embarquer un compresseur. Le fichier reste
   parfaitement lisible par Excel et LibreOffice.
   ========================================================================== */

var _crcTable = null;
function crcTable() {
  if (_crcTable) return _crcTable;
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  _crcTable = t;
  return t;
}
function crc32(buf) {
  var t = crcTable(), crc = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function utf8(s) { return new TextEncoder().encode(s); }

function zipStore(files) {
  var enc = files.map(function (f) {
    var name = utf8(f.name), data = (f.data instanceof Uint8Array) ? f.data : utf8(f.data);
    return { name: name, data: data, crc: crc32(data) };
  });
  var size = 0;
  enc.forEach(function (f) { size += 30 + f.name.length + f.data.length + 46 + f.name.length; });
  size += 22;
  var out = new Uint8Array(size), dv = new DataView(out.buffer), p = 0;
  function u32(v) { dv.setUint32(p, v, true); p += 4; }
  function u16(v) { dv.setUint16(p, v, true); p += 2; }
  function raw(b) { out.set(b, p); p += b.length; }

  enc.forEach(function (f) {
    f.offset = p;
    u32(0x04034b50); u16(20); u16(0x0800); u16(0);   // sig, version, flags(UTF-8), stored
    u16(0); u16(33);                                  // heure, date DOS = 1980-01-01
    u32(f.crc); u32(f.data.length); u32(f.data.length);
    u16(f.name.length); u16(0);
    raw(f.name); raw(f.data);
  });
  var cdStart = p;
  enc.forEach(function (f) {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0);
    u16(0); u16(33);
    u32(f.crc); u32(f.data.length); u32(f.data.length);
    u16(f.name.length); u16(0); u16(0);
    u16(0); u16(0); u32(0); u32(f.offset);
    raw(f.name);
  });
  var cdSize = p - cdStart;
  u32(0x06054b50); u16(0); u16(0); u16(enc.length); u16(enc.length);
  u32(cdSize); u32(cdStart); u16(0);
  return out;
}

/* ------------------------------------------------------------------- XML */

function xesc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
  }).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
function colName(n) {                     // 1 -> A, 27 -> AA
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

/* Styles. L'ordre des remplissages est imposé par Excel : 0 = none, 1 = gray125. */
var STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="3">' +
  '<numFmt numFmtId="164" formatCode="0.00"/>' +
  '<numFmt numFmtId="165" formatCode="0.0%"/>' +
  '<numFmt numFmtId="166" formatCode="#,##0.00\\ &quot;€&quot;"/>' +
  '</numFmts>' +
  '<fonts count="5">' +
  '<font><sz val="10"/><name val="Arial"/></font>' +
  '<font><b/><sz val="10"/><name val="Arial"/></font>' +
  '<font><b/><sz val="14"/><name val="Arial"/></font>' +
  '<font><sz val="9"/><color rgb="FF555555"/><name val="Arial"/></font>' +
  '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +
  '</fonts>' +
  '<fills count="5">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFDDE5DA"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEFEDE3"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF2E4A3C"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color rgb="FFAAAAAA"/></left><right style="thin"><color rgb="FFAAAAAA"/></right>' +
  '<top style="thin"><color rgb="FFAAAAAA"/></top><bottom style="thin"><color rgb="FFAAAAAA"/></bottom><diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="13">' +
  /* 0  normal            */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  /* 1  gras              */ '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  /* 2  titre             */ '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  /* 3  en-tête colonne   */ '<xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  /* 4  texte bordé       */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
  /* 5  nombre 0,00       */ '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  /* 6  entier            */ '<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  /* 7  total texte       */ '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  /* 8  total 0,00        */ '<xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  /* 9  total entier      */ '<xf numFmtId="1" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  /* 10 pourcentage       */ '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  /* 11 euros             */ '<xf numFmtId="166" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  /* 12 saisie (prix)     */ '<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// cell : null | string | number | {v, s, t:'n'|'s'}
function cellXml(ref, cell) {
  if (cell === null || cell === undefined || cell === '') return '';
  var v = cell, s = 0, t = null;
  if (typeof cell === 'object') { v = cell.v; s = cell.s || 0; t = cell.t || null; }
  if (v === null || v === undefined || v === '') {
    return s ? '<c r="' + ref + '" s="' + s + '"/>' : '';
  }
  var isNum = (t === 'n') || (t !== 's' && typeof v === 'number' && isFinite(v));
  if (isNum) return '<c r="' + ref + '"' + (s ? ' s="' + s + '"' : '') + '><v>' + (+v) + '</v></c>';
  return '<c r="' + ref + '"' + (s ? ' s="' + s + '"' : '') + ' t="inlineStr"><is><t xml:space="preserve">' +
    xesc(v) + '</t></is></c>';
}

function sheetXml(sheet) {
  var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if (sheet.cols && sheet.cols.length) {
    x += '<cols>';
    sheet.cols.forEach(function (w, i) {
      x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    });
    x += '</cols>';
  }
  x += '<sheetData>';
  (sheet.rows || []).forEach(function (row, ri) {
    if (!row || !row.length) return;
    var cells = '';
    for (var ci = 0; ci < row.length; ci++) cells += cellXml(colName(ci + 1) + (ri + 1), row[ci]);
    if (cells) x += '<row r="' + (ri + 1) + '">' + cells + '</row>';
  });
  x += '</sheetData>';
  if (sheet.merges && sheet.merges.length) {
    x += '<mergeCells count="' + sheet.merges.length + '">';
    sheet.merges.forEach(function (m) { x += '<mergeCell ref="' + m + '"/>'; });
    x += '</mergeCells>';
  }
  x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
  if (sheet.paysage) x += '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>';
  x += '</worksheet>';
  return x;
}

function xlsxBuild(sheets) {
  var files = [];
  var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  sheets.forEach(function (s, i) {
    ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  });
  ct += '</Types>';
  files.push({ name: '[Content_Types].xml', data: ct });

  files.push({
    name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>'
  });

  var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
  sheets.forEach(function (s, i) {
    wb += '<sheet name="' + xesc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
  });
  wb += '</sheets></workbook>';
  files.push({ name: 'xl/workbook.xml', data: wb });

  var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  sheets.forEach(function (s, i) {
    rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
  });
  rels += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  rels += '</Relationships>';
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: rels });
  files.push({ name: 'xl/styles.xml', data: STYLES_XML });
  sheets.forEach(function (s, i) {
    files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s) });
  });
  return zipStore(files);
}

var BCX_API = { xlsxBuild: xlsxBuild, zipStore: zipStore, crc32: crc32, colName: colName };
if (typeof module !== 'undefined' && module.exports) module.exports = BCX_API;
if (typeof window !== 'undefined') window.BCX = BCX_API;

