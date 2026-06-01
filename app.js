
// ==========================================
// ALMA PRINTS - DASHBOARD v8 (CON DEBUG)
// ==========================================

const URL_CATALOGO = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=1986570963&single=true&output=csv';
const URL_VENTAS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=2131622946&single=true&output=csv';

async function fetchCSV(url, nombre) {
    const response = await fetch(url);
    return response.text();
}

function parsearCSV(text) {
    const lineas = text.trim().split('\n');
    const headers = lineas[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lineas.slice(1).map(linea => {
        const valores = linea.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, i) => obj[h] = valores[i] || '');
        return obj;
    }).filter(d => Object.values(d).some(v => v));
}

async function actualizarDashboard() {
    const btn = document.querySelector('.btn-refresh');
    btn.textContent = '⏳ Cargando...';
    btn.disabled = true;
    
    try {
        const [csvCat, csvVen] = await Promise.all([
            fetchCSV(URL_CATALOGO, 'Catálogo'),
            fetchCSV(URL_VENTAS, 'Ventas')
        ]);
        
        const catalogo = parsearCSV(csvCat);
        const ventas = parsearCSV(csvVen);
        
        console.log('📦 Productos:', catalogo.length);
        console.log('💰 Ventas:', ventas.length);
        
        // 🔍 DEBUG: Ver estructura real de una venta
        if (ventas.length > 0) {
            console.log('💵 PRIMERA VENTA COMPLETA:', JSON.stringify(ventas[0], null, 2));
        }
        
        // 🔍 DEBUG: Ver estructura real de un producto
        if (catalogo.length > 0) {
            console.log('📦 PRIMER PRODUCTO COMPLETO:', JSON.stringify(catalogo[0], null, 2));
        }
        
        calcularKPIs(catalogo, ventas);
        generarGraficos(ventas, catalogo);
        mostrarAlertas(catalogo);
        
        document.getElementById('last-update').textContent = new Date().toLocaleString('es-PE', {timeZone: 'America/Lima'});
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    btn.textContent = '🔄 Actualizar Datos';
    btn.disabled = false;
}

function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, activos = 0, bajoStock = 0;
    
    // ⭐ CLAVE: Ver exactitud de cada campo
    console.log('=== 🔍 PROCESANDO VENTAS ===');
    ventas.forEach((v, i) => {
        const keys = Object.keys(v);
        console.log(`V${i} keys:`, keys);
        console.log(`V${i} TOTAL_SALIDA=`, v['TOTAL_SALIDA'], 'tipo:', typeof v['TOTAL_SALIDA']);
        console.log(`V${i} CANTIDAD=`, v['CANTIDAD']);
        console.log(`V${i} CANAL_VENTA=`, v['CANAL_VENTA']);
        
        const total = parseFloat(v['TOTAL_SALIDA']) || 0;
        const cant = parseFloat(v['CANTIDAD']) || 0;
        
        if (cant > 0 && total > 0) {
            ingresos += total;
            pedidos++;
        }
    });
    
    console.log('=== 🔍 PROCESANDO PRODUCTOS ===');
    catalogo.slice(0,3).forEach((p, i) => {
        console.log(`P${i}: NOMBRE=${p['NOMBRE_PRODUCTO']}, STOCK=${p['STOCK_ACTUAL']}, MINIMO=${p['STOCK_MINIMO']}, ESTADO=${p['ESTADO']}`);
        
        const stock = parseFloat(p['STOCK_ACTUAL']) || 0;
        const min = parseFloat(p['STOCK_MINIMO']) || 0;
        const estado = p['ESTADO'] || '';
        
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
    
    console.log('✅ FINAL:', {ingresos, pedidos, activos, bajoStock});
}

let chC, chCat;

function generarGraficos(ventas, catalogo) {
    const canales = {};
    ventas.forEach(v => {
        const t = parseFloat(v['TOTAL_SALIDA']) || 0;
        if (t > 0) {
            const c = v['CANAL_VENTA'] || 'Otro';
            canales[c] = (canales[c] || 0) + t;
        }
    });
    
    const ctxC = document.getElementById('chart-canales');
    if (chC) chC.destroy();
    chC = new Chart(ctxC, {
        type: 'doughnut',
        data: {
            labels: Object.keys(canales).length ? Object.keys(canales) : ['Sin datos'],
            datasets: [{ data: Object.values(canales).length || [1], backgroundColor: ['#E1306C','#25D366','#FFD700','#DDA7A5'] }]
        }
    });
    
    const cats = {};
    catalogo.forEach(p => {
        const c = p['CATEGORÍA'] || 'Otro';
        cats[c] = (cats[c] || 0) + 1;
    });
    
    const ctx = document.getElementById('chart-categorias');
    if (chCat) chCat.destroy();
    chCat = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: '#DDA7A5' }]
        }
    });
}

function mostrarAlertas(catalogo) {
    const tbody = document.getElementById('alerts-body');
    const bajo = catalogo.filter(p => {
        const s = parseFloat(p['STOCK_ACTUAL']) || 0;
        const m = parseFloat(p['STOCK_MINIMO']) || 0;
        return p['ESTADO'] === 'Activo' && s < m;
    });
    
    tbody.innerHTML = bajo.length === 0 
        ? '<tr><td colspan="5" style="text-align:center;">✅ Stock OK</td></tr>'
        : bajo.map(p => `<tr><td>${p['NOMBRE_PRODUCTO']}</td><td>${p['SKU']}</td><td>${p['STOCK_ACTUAL']}</td><td>${p['STOCK_MINIMO']}</td><td>⚠️</td></tr>`).join('');
}

window.onload = actualizarDashboard;