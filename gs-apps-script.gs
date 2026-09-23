const SPREADSHEET_ID = '1ymPQESDrB_NuZpUMDU2R40tmaCoxJSoXkJHrpJmOaEM';
const SHEET_NAME = 'Registros';

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['#', 'Tipo', 'Timestamp', 'Fecha', 'Hora', 'Turno', 'Descripcion']);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(['#', 'Tipo', 'Timestamp', 'Fecha', 'Hora', 'Turno', 'Descripcion']);
  }
}

function doGet(e) {
  setup();
  if (e.parameter && e.parameter.tipo) {
    return addRecord(e);
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ success: true, records: [], total: 0 })).setMimeType(ContentService.MimeType.JSON);
  }
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === '' || row[0] === null) continue;
    records.push({ id: row[0], tipo: row[1], timestamp: row[2], fecha: row[3], hora: row[4], turno: row[5], descripcion: row[6] });
  }
  return ContentService.createTextOutput(JSON.stringify({ success: true, records: records, total: records.length })).setMimeType(ContentService.MimeType.JSON);
}

function addRecord(e) {
  try {
    const tipo = e.parameter.tipo;
    const timestamp = e.parameter.timestamp || new Date().toISOString();
    const descripcion = e.parameter.descripcion || 'Control de Aforo';
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['#', 'Tipo', 'Timestamp', 'Fecha', 'Hora', 'Turno', 'Descripcion']);
    }
    const lastRow = sheet.getLastRow();
    const newId = lastRow;
    const now = new Date();
    const timeStr = Utilities.formatDate(now, 'America/El_Salvador', 'HH:mm');
    const dateStr = Utilities.formatDate(now, 'America/El_Salvador', 'yyyy-MM-dd');
    let turno = 'Fuera de Horario';
    const hour = now.getHours();
    if (hour >= 8 && hour < 12) turno = 'Matutino';
    else if (hour >= 13 && hour < 19) turno = 'Vespertino';
    sheet.appendRow([newId, tipo, timestamp, dateStr, timeStr, turno, descripcion]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: newId, tipo: tipo, turno: turno })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
