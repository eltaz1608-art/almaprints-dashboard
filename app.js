
// ==========================================
// ALMA PRINTS - DASHBOARD v10 FINAL
// ==========================================

const URL_CATALOGO = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=1986570963&single=true&output=csv';
const URL_VENTAS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=2131622946&single=true&output=csv';

// ⭐ LIMPIAR MONEDA CORRECTAMENTE
function limpiarNumero(valor) {
    if (!valor) return 0;
    const limpio = String(valor)
        .replace('S/.', '')
        .replace('S/. ', '')
        .replace(/,/g, '')
        .trim();
    return parseFloat(limpio) || 0;
}

async function fetchCSV(url) {
    const resp = await fetch(url);
    return resp.text();
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
            fetchCSV(URL_CATALOGO),
            fetchCSV(URL_VENTAS)
        ]);
        
        const catalogo = parsearCSV(csvCat);
        const ventas = parsearCSV(csvVen);
        
        console.log('📦:', catalogo.length, '💰:', ventas.length);
        
        calcularKPIs(catalogo, ventas);
        generarGraficos(ventas, catalogo);
        mostrarAlertas(catalogo);
        
        document.getElementById('last-update').textContent = new Date().toLocaleString('es-PE');
    } catch (e) {
        console.error(e);
    }
    
    btn.textContent = '🔄 Actualizar Datos';
    btn.disabled = false;
}

// KPIs
function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, activos = 0, bajoStock = 0;
    
    ventas.forEach(v => {
        const total = limpiarNumero(v['TOTAL_SALIDA']);
        const cant = limpiarNumero(v['CANTIDAD']);
        
        if (cant > 0 && total > 0) {
            ingresos += total;
            pedidos++;
            console.log('✅ VENTA:', v['CANAL_VENTA'], '=', total);
        }
    });
    
    catalogo.forEach(p => {
        const stock = limpiarNumero(p['STOCK_ACTUAL']);
        const min = limpiarNumero(p['STOCK_MINIMO']);
        if (p['ESTADO'] === 'Activo') {
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
    
    console.log('📊 TOTAL INGRESOS:', ingresos);
}

// Gráficos - VERSIÓN SIMPLE Y FUNCIONAL
let chartC, chartCat;

function generarGraficos(ventas, catalogo) {
    console.log('🎨 Generando gráficos...');
    
    // ⭐ CANALES - Agrupar manualmente
    const canales = {
        'Instagram': 0,
        'WhatsApp': 0,
        'Web': 0,
        'Presencial': 0,
        'Marketplace': 0
    };
    
    ventas.forEach(v => {
        const total = limpiarNumero(v['TOTAL_SALIDA']);
        const canal = v['CANAL_VENTA'] || 'Otro';
        console.log(`📱 ${canal}: ${total}`);
        
        if (canales[canal] !== undefined) {
            canales[canal] += total;
        } else {
            canales['Otro'] = (canales['Otro'] || 0) + total;
        }
    });
    
    // Limpiar ceros
    Object.keys(canales).forEach(k => {
        if (canales[k] === 0) delete canales[k];
    });
    
    console.log('📊 Canales finales:', canales);
    
    // Dibujar
    const ctxC = document.getElementById('chart-canales');
    if (chartC) chartC.destroy();
    
    if (Object.keys(canales).length === 0) {
        canales['Sin datos'] = 1;
    }
    
    chartC = new Chart(ctxC, {
        type: 'doughnut',
        data: {
            labels: Object.keys(canales),
            datasets: [{
                data: Object.values(canales),
                backgroundColor: ['#E1306C', '#25D366', '#3b5998', '#FFD700', '#9C27B0', '#DDA7A5'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
    
    // Categorías
    const cats = {};
    catalogo.forEach(p => {
        const c = p['CATEGORÍA'] || 'Otro';
        cats[c] = (cats[c] || 0) + 1;
    });
    
    const ctx = document.getElementById('chart-categorias');
    if (chartCat) chartCat.destroy();
    chartCat = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: '#DDA7A5', borderRadius: 8 }]
        },
        options: { responsive: true }
    });
}

function mostrarAlertas(catalogo) {
    const tbody = document.getElementById('alerts-body');
    const bajo = catalogo.filter(p => {
        const s = limpiarNumero(p['STOCK_ACTUAL']);
        const m = limpiarNumero(p['STOCK_MINIMO']);
        return p['ESTADO'] === 'Activo' && s < m;
    });
    
    tbody.innerHTML = bajo.length === 0 
        ? '<tr><td colspan="5">✅ Stock OK</td></tr>'
        : bajo.map(p => `<tr><td>${p['NOMBRE_PRODUCTO']}</td><td>${p['SKU']}</td><td>${p['STOCK_ACTUAL']}</td><td>${p['STOCK_MINIMO']}</td><td>⚠️</td></tr>`).join('');
}

window.onload = actualizarDashboard;