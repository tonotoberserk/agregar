const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyt0Z3-WRVkULQlNqqxWqqD4UiUx_YXWLRhlYH18axQmYYe9VHF6vQ1y8LCTclY2T66OQ/exec';
const SPREADSHEET_ID = '1ymPQESDrB_NuZpUMDU2R40tmaCoxJSoXkJHrpJmOaEM';
let records = [];
let occupancy = 0;
let isLoading = false;
let autoRefreshInterval;

/* ── UTILS: El Salvador Time ── */
function getSalvadorTime() {
  return new Date().toLocaleTimeString('es-SV', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function getSalvadorDate() {
  return new Date().toLocaleDateString('es-SV', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function getSalvadorHour() {
  return new Date().getHours();
}

function getISOTimestamp() {
  return new Date().toISOString();
}

function getShiftLabel(hour) {
  if (hour >= 8 && hour < 12) return 'Matutino';
  if (hour >= 13 && hour < 19) return 'Vespertino';
  return 'Fuera de Horario';
}

function getShiftKey(hour) {
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 13 && hour < 19) return 'evening';
  return 'night';
}

function getCurrentShiftLabel() {
  const h = getSalvadorHour();
  if (h >= 8 && h < 12) return 'Matutino (08:00 - 12:00)';
  if (h >= 13 && h < 19) return 'Vespertino (13:00 - 19:00)';
  return 'Fuera de Horario';
}

function getShiftCSSClass() {
  const h = getSalvadorHour();
  if ((h >= 8 && h < 12) || (h >= 13 && h < 19)) return 'off-hours';
  return 'outside-hours';
}

/* ── DATA: Google Sheets via Apps Script (GET) ── */
function fetchRecords() {
  if (isLoading) return;
  isLoading = true;
  var loadingEl = document.getElementById('loading-indicator');
  if (loadingEl) loadingEl.style.display = 'block';

  return fetch(API_BASE_URL + '?action=read')
    .then(function (response) {
      if (!response.ok) throw new Error('Error de red: ' + response.status);
      return response.json();
    })
    .then(function (data) {
      if (data.success && Array.isArray(data.records)) {
        records = data.records;
        recalcOccupancy();
        fullUpdate();
      } else {
        console.warn('Respuesta inesperada:', data);
      }
    })
    .catch(function (err) {
      console.error('Error al cargar registros:', err);
      toast('Error al cargar datos de Google Sheets. Verifica que el Web App esté desplegado.', 'error');
    })
    .finally(function () {
      isLoading = false;
      if (loadingEl) loadingEl.style.display = 'none';
    });
}

function sendRecord(record) {
  var params = 'tipo=' + encodeURIComponent(record.tipo) +
    '&timestamp=' + encodeURIComponent(record.timestamp || getISOTimestamp()) +
    '&descripcion=' + encodeURIComponent(record.descripcion || 'Control de Aforo');
  var url = API_BASE_URL + '?' + params;

  return fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error('Error de red: ' + response.status);
      return response.json();
    })
    .then(function (data) {
      if (data.success) {
        return data;
      }
      throw new Error(data.error || 'Error al guardar');
    })
    .catch(function (err) {
      console.error('Error al enviar registro:', err);
      throw err;
    });
}

function loadRecords() {
  fetchRecords();
  startAutoRefresh();
}

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(function () {
    fetchRecords();
  }, 30000);
}

function recalcOccupancy() {
  occupancy = 0;
  records.forEach(function (r) {
    if (r.tipo === 'entry') occupancy++;
    else if (r.tipo === 'exit') occupancy--;
  });
  if (occupancy < 0) occupancy = 0;
}

/* ── TOAST ── */
function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (type || '');
  setTimeout(function () { el.classList.add('show'); }, 10);
  setTimeout(function () { el.classList.remove('show'); }, 2500);
}

/* ── UI UPDATE ── */
function updateOccupancyDisplay() {
  document.getElementById('occupancy-number').textContent = occupancy;
  var bar = document.getElementById('occupancy-bar');
  var pct = Math.min((occupancy / 100) * 100, 100);
  bar.style.width = pct + '%';
  bar.className = 'occupancy-bar';
  if (pct > 70) bar.classList.add('danger');
  else if (pct > 40) bar.classList.add('warning');

  var txt = 'Aforo actual: ' + occupancy + ' persona' + (occupancy !== 1 ? 's' : '');
  document.getElementById('occupancy-text').textContent = txt;

  var circle = document.getElementById('occupancy-circle');
  if (occupancy > 70) circle.style.background = 'linear-gradient(135deg, #dc2626, #ef4444)';
  else if (occupancy > 40) circle.style.background = 'linear-gradient(135deg, #f59e0b, #fbbf24)';
  else circle.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
}

function updateShiftLabel() {
  var label = getCurrentShiftLabel();
  var el = document.getElementById('current-shift-label');
  el.textContent = label;
  el.className = 'current-shift ' + getShiftCSSClass();
}

function updateClock() {
  document.getElementById('current-time').textContent = getSalvadorTime();
}

function updateStats() {
  var mIn = 0, mOut = 0, eIn = 0, eOut = 0, nIn = 0, nOut = 0;
  var tIn = 0, tOut = 0;

  records.forEach(function (r) {
    tIn += (r.tipo === 'entry') ? 1 : 0;
    tOut += (r.tipo === 'exit') ? 1 : 0;
    var shift = (r.turno || '').toLowerCase();
    if (shift.indexOf('matutino') !== -1) {
      mIn += (r.tipo === 'entry') ? 1 : 0;
      mOut += (r.tipo === 'exit') ? 1 : 0;
    } else if (shift.indexOf('vespertino') !== -1) {
      eIn += (r.tipo === 'entry') ? 1 : 0;
      eOut += (r.tipo === 'exit') ? 1 : 0;
    } else {
      nIn += (r.tipo === 'entry') ? 1 : 0;
      nOut += (r.tipo === 'exit') ? 1 : 0;
    }
  });

  document.getElementById('stat-morning-in').textContent = mIn;
  document.getElementById('stat-morning-out').textContent = mOut;
  document.getElementById('stat-morning-net').textContent = mIn - mOut;

  document.getElementById('stat-evening-in').textContent = eIn;
  document.getElementById('stat-evening-out').textContent = eOut;
  document.getElementById('stat-evening-net').textContent = eIn - eOut;

  document.getElementById('stat-night-in').textContent = nIn;
  document.getElementById('stat-night-out').textContent = nOut;
  document.getElementById('stat-night-net').textContent = nIn - nOut;

  document.getElementById('stat-total-in').textContent = tIn;
  document.getElementById('stat-total-out').textContent = tOut;
  document.getElementById('stat-total-records').textContent = records.length;
}

function updateRecordsList() {
  var list = document.getElementById('records-list');
  var recent = records.slice(-15).reverse();
  list.innerHTML = '';
  if (recent.length === 0) {
    list.innerHTML = '<li style="text-align:center;color:var(--text-light)">No hay registros</li>';
    return;
  }
  recent.forEach(function (r) {
    var li = document.createElement('li');
    li.className = r.tipo;
    var timeStr = r.hora || 'N/A';
    var shiftLabel = r.turno || 'Fuera';
    if (shiftLabel.indexOf('Matutino') !== -1) shiftLabel = 'Matutino';
    else if (shiftLabel.indexOf('Vespertino') !== -1) shiftLabel = 'Vespertino';
    else shiftLabel = 'Fuera';
    li.innerHTML =
      '<span class="record-time">' + timeStr + '</span>' +
      '<span class="record-type" style="color:' + (r.tipo === 'entry' ? 'var(--entry-green)' : 'var(--exit-red)') + '">' +
        (r.tipo === 'entry' ? 'ENTRADA' : 'SALIDA') +
      '</span>' +
      '<span class="record-shift">' + shiftLabel + '</span>';
    list.appendChild(li);
  });
}

function fullUpdate() {
  updateClock();
  updateShiftLabel();
  updateOccupancyDisplay();
  updateStats();
  updateRecordsList();
}

/* ── ACTIONS ── */
function registerEntry() {
  var now = new Date();
  var hour = now.getHours();
  var record = {
    tipo: 'entry',
    timestamp: getISOTimestamp(),
    turno: getShiftLabel(hour),
    turnoKey: getShiftKey(hour),
    descripcion: 'Control de Aforo'
  };

  sendRecord(record)
    .then(function () {
      toast('Entrada registrada', 'success');
      fetchRecords();
    })
    .catch(function () {
      toast('Error al registrar entrada', 'error');
    });
}

function registerExit() {
  if (occupancy <= 0) {
    toast('No hay personas para registrar salida', 'error');
    return;
  }
  var now = new Date();
  var hour = now.getHours();
  var record = {
    tipo: 'exit',
    timestamp: getISOTimestamp(),
    turno: getShiftLabel(hour),
    turnoKey: getShiftKey(hour),
    descripcion: 'Control de Aforo'
  };

  sendRecord(record)
    .then(function () {
      toast('Salida registrada', 'success');
      fetchRecords();
    })
    .catch(function () {
      toast('Error al registrar salida', 'error');
    });
}

/* ── EXCEL EXPORT (SheetJS) ── */
function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    toast('SheetJS no cargado', 'error');
    return;
  }
  if (records.length === 0) {
    toast('No hay datos para exportar', 'error');
    return;
  }

  var wsData = [
    ['#', 'Tipo', 'Hora', 'Fecha', 'Turno', 'Descripcion'],
  ];

  records.forEach(function (r, i) {
    var shiftDesc = r.turno || 'Fuera de Horario';
    wsData.push([
      i + 1,
      r.tipo === 'entry' ? 'Entrada' : 'Salida',
      r.hora || '',
      r.fecha || getSalvadorDate(),
      shiftDesc,
      r.descripcion || 'Control de Aforo'
    ]);
  });

  var ws = XLSX.utils.aoa_to_sheet(wsData);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');

  var summaryData = [
    ['Resumen de Aforo'],
    ['Ocupacion Actual', occupancy],
    ['Total Entradas', records.filter(function (r) { return r.tipo === 'entry'; }).length],
    ['Total Salidas', records.filter(function (r) { return r.tipo === 'exit'; }).length],
  ];
  var ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');

  XLSX.writeFile(wb, 'aforo_' + getSalvadorDate() + '.xlsx');
  toast('Archivo Excel exportado', 'success');
}

/* ── RESET ── */
function resetData() {
  if (records.length === 0) return;
  if (confirm('¿Seguro que desea resetear todos los datos? Esto no se puede deshacer.')) {
    records = [];
    occupancy = 0;
    fullUpdate();
    toast('Datos reseteados (localmente). Los datos de Google Sheets persisten.', 'success');
  }
}

/* ── EVENT LISTENERS ── */
function setupEvents() {
  document.getElementById('btn-entry').addEventListener('click', registerEntry);
  document.getElementById('btn-exit').addEventListener('click', registerExit);

  document.getElementById('btn-stats').addEventListener('click', function (e) {
    e.stopPropagation();
    document.getElementById('stats-dropdown').classList.toggle('active');
  });

  document.getElementById('close-dropdown').addEventListener('click', function () {
    document.getElementById('stats-dropdown').classList.remove('active');
  });

  document.addEventListener('click', function (e) {
    var dd = document.getElementById('stats-dropdown');
    var btn = document.getElementById('btn-stats');
    if (!dd.contains(e.target) && !btn.contains(e.target)) {
      dd.classList.remove('active');
    }
  });

  document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);
  document.getElementById('btn-import-excel').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) {
      importFromExcel(e.target.files[0]);
      e.target.value = '';
    }
  });
  document.getElementById('btn-reset-data').addEventListener('click', resetData);

  setInterval(updateClock, 1000);
  setInterval(updateShiftLabel, 60000);
}

/* ── EXCEL IMPORT (SheetJS) ── */
function importFromExcel(file) {
  if (typeof XLSX === 'undefined') {
    toast('SheetJS no cargado', 'error');
    return;
  }
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var data = new Uint8Array(e.target.result);
      var wb = XLSX.read(data, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var json = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!json || json.length === 0) {
        toast('Archivo vacío o inválido', 'error');
        return;
      }

      var imported = [];
      json.forEach(function (row) {
        if (row['Tipo'] === 'Entrada' || row['Tipo'] === 'Salida') {
          var hour = row['Hora'] ? parseInt(row['Hora'].toString().split(':')[0]) : 0;
          imported.push({
            tipo: row['Tipo'] === 'Entrada' ? 'entry' : 'exit',
            timestamp: new Date().toISOString(),
            turno: getShiftLabel(hour),
            turnoKey: getShiftKey(hour),
            descripcion: 'Importado desde Excel'
          });
        }
      });

      if (imported.length === 0) {
        toast('No se encontraron registros válidos', 'error');
        return;
      }

      var confirmImport = confirm('Se van a registrar ' + imported.length + ' entradas/salidas desde Excel. ¿Continuar?');
      if (confirmImport) {
        var count = 0;
        imported.forEach(function (rec) {
          sendRecord(rec)
            .then(function () { count++; })
            .catch(function () {});
        });
        setTimeout(function () {
          fetchRecords();
          toast(count + ' registros importados desde Excel', 'success');
        }, imported.length * 500 + 1000);
      }
    } catch (err) {
      toast('Error al leer el archivo', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ── INIT ── */
function init() {
  setupEvents();
  loadRecords();
  fullUpdate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
