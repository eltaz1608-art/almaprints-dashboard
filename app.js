
// ==========================================
// ALMA PRINTS - DASHBOARD v13 (FIX)
// ==========================================

// 💾 Tus hojas publicadas
const URL_CATALOGO = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=1986570963&single=true&output=csv';
const URL_VENTAS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=2131622946&single=true&output=csv';

// ⭐ Mejor función para limpiar valores
function limpiarNumero(valor) {
    if (!valor) return 0;
    // Quitar S/., comas, espacios
    const limpio = String(valor)
        .replace(/S\/\.\s*/g, '')  // S/. o S/.
        .replace(/,/g, '')       // comas de miles
        .trim();
    const num = parseFloat(limpio);
    // ⭐ Validar: si es muy pequeño o muy grande, ignorar
    if (isNaN(num) || num < 0.1 || num > 50000) return 0;
    return num;
}

// 📥 Descargar CSV
async function fetchCSV(url) {
    const resp = await fetch(url);
    return resp.text();
}

// 📋 Parsear CSV
function parsearCSV(text) {
    const lineas = text.trim().split('\n');
    const headers = lineas[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // ⭐ Debug: mostrar headers
    console.log('📋 Headers:', headers);
    
    return lineas.slice(1).map(linea => {
        const valores = linea.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, i) => obj[h] = valores[i] || '');
        return obj;
    }).filter(d => Object.values(d).some(v => v));
}

// 🚀 Función principal
async function actualizarDashboard() {
    const btn = document.querySelector('.btn-refresh');
    btn.textContent = '⏳';
    btn.disabled = true;
    
    try {
        const [csvCat, csvVen] = await Promise.all([fetchCSV(URL_CATALOGO), fetchCSV(URL_VENTAS)]);
        const catalogo = parsearCSV(csvCat);
        const ventas = parsearCSV(csvVen);
        
        console.log('📦 Productos:', catalogo.length);
        console.log('💰 Ventas:', ventas.length);
        
        calcularKPIs(catalogo, ventas);
        generarGraficos(ventas, catalogo);
        mostrarAlertas(catalogo);
        
        document.getElementById('last-update').textContent = new Date().toLocaleString('es-PE');
    } catch (e) { 
        console.error(e);
    }
    
    btn.textContent = '🔄';
    btn.disabled = false;
}

// 💰 Calcular KPIs
function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, activos = 0, bajoStock = 0, costoTotal = 0, unidadesTotal = 0;
    
    ventas.forEach((v, idx) => {
        // ⭐ Obtener valores
        const total = limpiarNumero(v['TOTAL_SALIDA']);
        const cant = limparNumero(v['CANTIDAD']);
        const sku = v['SKU'] || '';
        const canal = v['CANAL_VENTA'] || '';
        
        // ⭐ Debug cada venta
        console.log(`V${idx}: SKU=${sku}, CANAL=${canal}, CANT=${cant}, TOTAL=${total}`);
        
        // ⭐ Validar: debe tener SKU, cantidad > 0, total > 0 y parece realista
        if (sku && cant > 0 && total > 0 && total < 10000) {
            const producto = catalogo.find(p => p['SKU'] === sku);
            const costoUnit = producto ? limpiarNumero(producto['COSTO_UNITARIO']) : 0;
            const costoVenta = costoUnit * cant;
            
            console.log(`  ✅ Válido: ${cant} × S/ ${total/cant}, costo: S/ ${costoUnit} × ${cant}`);
            
            ingresos += total;
            costoTotal += costoVenta;
            pedidos++;
            unidadesTotal += cant;
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
    
    const beneficio = ingresos - costoTotal;
    const ticket = pedidos > 0 ? Math.round(ingresos / pedidos) : 0;
    
    // Actualizar HTML
    document.getElementById('kpi-ingresos').textContent = 'S/ ' + ingresos.toLocaleString();
    document.getElementById('kpi-beneficio').textContent = 'S/ ' + beneficio.toLocaleString();
    document.getElementById('kpi-ticket').textContent = 'S/ ' + ticket.toLocaleString();
    document.getElementById('kpi-pedidos').textContent = pedidos;
    document.getElementById('kpi-unidades').textContent = unidadesTotal;
    document.getElementById('kpi-productos').textContent = activos;
    document.getElementById('kpi-stock').textContent = bajoStock;
    
    console.log('=== RESUMEN ===');
    console.log('💰 Ingresos:', ingresos);
    console.log('📦 Costo:', costoTotal);
    console.log('✨ Beneficio:', beneficio);
}

// 📊 Gráficos
let chCanales, chCategorias;

function generarGraficos(ventas, catalogo) {
    const canales = {};
    ventas.forEach(v => {
        const t = limpiarNumero(v['TOTAL_SALIDA']);
        const sku = v['SKU'] || '';
        const c = v['CANAL_VENTA'] || '';
        // Solo gráfico si es válido
        if (sku && t > 0 && t < 10000) {
            canales[c] = (canales[c] || 0) + t;
        }
    });
    
    const ctxC = document.getElementById('chart-canales');
    if (chCanales) chCanales.destroy();
    chCanales = new Chart(ctxC, {
        type: 'doughnut',
        data: {
            labels: Object.keys(canales).length ? Object.keys(canales) : ['Sin datos'],
            datasets: [{data: Object.values(canales).length || [1], backgroundColor: ['#E1306C','#25D366','#3b5998','#FFD700','#9C27B0']}]
        },
        options: { responsive: true }
    });
    
    const cats = {};
    catalogo.forEach(p => { const c = p['CATEGORÍA'] || 'Otro'; cats[c] = (cats[c]||0)+1; });
    
    const ctx = document.getElementById('chart-categorias');
    if (chCategorias) chCategorias.destroy();
    chCategorias = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(cats),
            datasets: [{data: Object.values(cats), backgroundColor: '#DDA7A5'}]
        },
        options: { responsive: true }
    });
}

// ⚠️ Alertas de stock
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

// 🚀 Iniciar al cargar
window.onload = actualizarDashboard;