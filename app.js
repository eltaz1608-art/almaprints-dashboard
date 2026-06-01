
// ==========================================
// ALMA PRINTS - DASHBOARD v6 (ENLACE PUBLICO)
// ==========================================

// Tu enlace de publicación directa
const URL_PUBLICA = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?output=csv';

async function fetchDatos() {
    console.log('📥 Descargando desde enlace público...');
    
    const response = await fetch(URL_PUBLICA);
    const text = await response.text();
    
    console.log('📄 Primeros 300 chars:', text.substring(0, 300));
    
    return text;
}

function parseCSVCompleto(text) {
    const lineas = text.trim().split('\n');
    console.log('📋 Total líneas:', lineas.length);
    
    // Encabezados (primera línea = hoja 1)
    const headers = lineas[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📊 Encabezados hoja 1:', headers);
    
    // Datos de la primera hoja
    const datos = lineas.slice(1).map(linea => {
        const valores = linea.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, i) => obj[h] = valores[i] || '');
        return obj;
    }).filter(d => d[headers[0]]); // Eliminar filas vacías
    
    console.log('📦 Datos parseados:', datos.length);
    console.log('👀 Primer registro:', datos[0]);
    
    return datos;
}

async function actualizarDashboard() {
    const btn = document.querySelector('.btn-refresh');
    btn.textContent = '⏳ Cargando...';
    btn.disabled = true;
    
    try {
        console.log('=== INICIO v6 ===');
        
        const csvText = await fetchDatos();
        const datos = parseCSVCompleto(csvText);
        
        if (datos.length === 0) {
            alert('⚠️ No hay datos');
            return;
        }
        
        // Detectar tipo de datos por encabezados
        const headers = Object.keys(datos[0]);
        console.log('🔑 Todas las columnas:', headers);
        
        // Determinar si es catálogo o ventas
        const esCatalogo = headers.includes('SKU') && headers.includes('CATEGORÍA');
        const esVentas = headers.includes('CLIENTE') && headers.includes('CANAL');
        
        console.log('¿Es catálogo?', esCatalogo);
        console.log('¿Es ventas?', esVentas);
        
        let catalogo = [];
        let ventas = [];
        
        if (esCatalogo) {
            catalogo = datos;
        } else if (esVentas) {
            ventas = datos;
        }
        
        // Si no puede detectar, usar todo como catálogo
        if (catalogo.length === 0 && ventas.length === 0) {
            catalogo = datos;
        }
        
        console.log('📦 Productos:', catalogo.length);
        console.log('💰 Ventas:', ventas.length);
        
        calcularKPIs(catalogo, ventas);
        generarGraficos(ventas, catalogo);
        mostrarAlertas(catalogo);
        
        document.getElementById('last-update').textContent = new Date().toLocaleString('es-PE', {timeZone: 'America/Lima'});
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
    
    btn.textContent = '🔄 Actualizar Datos';
    btn.disabled = false;
}

// KPIs
function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, activos = 0, bajoStock = 0;
    
    ventas.forEach(v => {
        const total = parseFloat(v['TOTAL']) || parseFloat(v['TOTAL_SALIDA']) || 0;
        const cant = parseFloat(v['CANTIDAD']) || 0;
        if (cant > 0 && total > 0) {
            ingresos += total;
            pedidos++;
        }
    });
    
    catalogo.forEach(p => {
        const nombre = p['NOMBRE'] || p['NOMBRE_PRODUCTO'] || p['PRODUCTO'] || '';
        const stock = parseFloat(p['STOCK']) || parseFloat(p['STOCK_ACTUAL']) || 0;
        const min = parseFloat(p['MINIMO']) || parseFloat(p['STOCK_MINIMO']) || 0;
        const estado = p['ESTADO'] || '';
        
        console.log(`${nombre}: stock=${stock}, min=${min}, estado=${estado}`);
        
        if (estado === 'Activo') {
            activos++;
            if (stock < min) bajoStock++;
        }
    });
    
    const beneficio = Math.round(ingresos * 0.4);
    const ticket = pedidos > 0 ? Math.round(ingresos / pedidos) : 0;
    
    document.getElementById('kpi-ingresos').textContent = 'S/ ' + ingresos.toLocaleString();
    document.getElementById('kpi-beneficio').textContent = 'S/ ' + beneficio.toLocaleString();
    document.getElementById('kpi-ticket').textContent = 'S/ ' + ticket.toLocaleString();
    document.getElementById('kpi-pedidos').textContent = pedidos;
    document.getElementById('kpi-productos').textContent = activos;
    document.getElementById('kpi-stock').textContent = bajoStock;
    
    console.log('✅ RESULTADO:', {ingresos, pedidos, activos, bajoStock});
}

// Gráficos
let chartC, chartCat;

function generarGraficos(ventas, catalogo) {
    const canales = {};
    ventas.forEach(v => {
        const total = parseFloat(v['TOTAL']) || 0;
        if (total > 0) {
            canales[v['CANAL'] || v['CANAL_VENTA'] || 'Otro'] = (canales[v['CANAL']||'Otro'] || 0) + total;
        }
    });
    
    const ctxC = document.getElementById('chart-canales');
    if (chartC) chartC.destroy();
    chartC = new Chart(ctxC, { type: 'doughnut', data: { labels: Object.keys(canales), datasets: [{ data: Object.values(canales), backgroundColor: ['#E1306C','#25D366'] }] } });
    
    const categorias = {};
    catalogo.forEach(p => {
        const c = p['CATEGORÍA'] || p['CATEG'] || 'Otro';
        categorias[c] = (categorias[c] || 0) + 1;
    });
    
    const ctxCat = document.getElementById('chart-categorias');
    if (chartCat) chartCat.destroy();
    chartCat = new Chart(ctxCat, { type: 'bar', data: { labels: Object.keys(categorias), datasets: [{ data: Object.values(categorias), backgroundColor: '#DDA7A5' }] } });
}

function mostrarAlertas(catalogo) {
    const tbody = document.getElementById('alerts-body');
    const bajo = catalogo.filter(p => {
        const stock = parseFloat(p['STOCK']) || parseFloat(p['STOCK_ACTUAL']) || 0;
        const min = parseFloat(p['MINIMO']) || parseFloat(p['STOCK_MINIMO']) || 0;
        return p['ESTADO'] === 'Activo' && stock < min;
    });
    
    tbody.innerHTML = bajo.length === 0 
        ? '<tr><td colspan="5" style="text-align:center;">✅ Stock OK</td></tr>'
        : bajo.map(p => `<tr><td>${p['NOMBRE']||p['NOMBRE_PRODUCTO']}</td><td>${p['SKU']}</td><td>${p['STOCK']}</td><td>${p['MINIMO']}</td><td>⚠️</td></tr>`).join('');
}

window.onload = actualizarDashboard;