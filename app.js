
// ==========================================
// ALMA PRINTS - DASHBOARD v11 (BENEFICIO REAL)
// ==========================================

const URL_CATALOGO = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=1986570963&single=true&output=csv';
const URL_VENTAS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSk2HaPMvDNEFZmTGWAJ2uPSzyrxSkeganv7haL98f8oxfrEkNT6QwVqIR2sj4Rmt-WHUf2LkGsxXsw/pub?gid=2131622946&single=true&output=csv';

function limpiarNumero(valor) {
    if (!valor) return 0;
    return parseFloat(String(valor).replace('S/.', '').replace(/,/g, '').trim()) || 0;
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
    btn.textContent = '⏳';
    btn.disabled = true;
    
    try {
        const [csvCat, csvVen] = await Promise.all([fetchCSV(URL_CATALOGO), fetchCSV(URL_VENTAS)]);
        const catalogo = parsearCSV(csvCat);
        const ventas = parsearCSV(csvVen);
        
        calcularKPIs(catalogo, ventas);
        generarGraficos(ventas, catalogo);
        mostrarAlertas(catalogo);
        
        document.getElementById('last-update').textContent = new Date().toLocaleString('es-PE');
    } catch (e) { console.error(e); }
    
    btn.textContent = '🔄';
    btn.disabled = false;
}

// ⭐ BENEFICIO REAL
function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, activos = 0, bajoStock = 0, costoTotal = 0;
    
    ventas.forEach(v => {
        const total = limpiarNumero(v['TOTAL_SALIDA']);
        const cant = limpiarNumero(v['CANTIDAD']);
        const sku = v['SKU'];
        
        if (cant > 0 && total > 0) {
            // Buscar costo por SKU
            const producto = catalogo.find(p => p['SKU'] === sku);
            const costoUnit = producto ? limpiarNumero(producto['COSTO_UNITARIO']) : 0;
            const costoVenta = costoUnit * cant;
            
            console.log(`✅ ${sku}: ${cant} × S/ ${total/cant} - costo S/ ${costoUnit} = ganancia S/ ${total - costoVenta}`);
            
            ingresos += total;
            costoTotal += costoVenta;
            pedidos++;
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
    
    const beneficio = ingresos - costoTotal; // ⭐ BENEFICIO REAL
    const ticket = pedidos > 0 ? Math.round(ingresos / pedidos) : 0;
    
    document.getElementById('kpi-ingresos').textContent = 'S/ ' + ingresos.toLocaleString();
    document.getElementById('kpi-beneficio').textContent = 'S/ ' + beneficio.toLocaleString();
    document.getElementById('kpi-ticket').textContent = 'S/ ' + ticket.toLocaleString();
    document.getElementById('kpi-pedidos').textContent = pedidos;
    document.getElementById('kpi-productos').textContent = activos;
    document.getElementById('kpi-stock').textContent = bajoStock;
    
    console.log('💰 Ingresos:', ingresos);
    console.log('📦 Costo:', costoTotal);
    console.log('✨ Beneficio REAL:', beneficio);
}

let chC, chCat;

function generarGraficos(ventas, catalogo) {
    const canales = {'Instagram':0,'WhatsApp':0,'Web':0,'Presencial':0,'Marketplace':0,'Otro':0};
    ventas.forEach(v => {
        const t = limpiarNumero(v['TOTAL_SALIDA']);
        const c = v['CANAL_VENTA'] || 'Otro';
        if (t > 0) canales[c] = (canales[c] || 0) + t;
    });
    Object.keys(canales).forEach(k => { if(canales[k]===0) delete canales[k]; });
    
    const ctxC = document.getElementById('chart-canales');
    if (chC) chC.destroy();
    chC = new Chart(ctxC, {type:'doughnut',data:{labels:Object.keys(canales),datasets:[{data:Object.values(canales),backgroundColor:['#E1306C','#25D366','#3b5998','#FFD700','#9C27B0']}]}});
    
    const cats = {};
    catalogo.forEach(p => { const c = p['CATEGORÍA'] || 'Otro'; cats[c] = (cats[c]||0)+1; });
    const ctx = document.getElementById('chart-categorias');
    if (chCat) chCat.destroy();
    chCat = new Chart(ctx, {type:'bar',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:'#DDA7A5'}]}});
}

function mostrarAlertas(catalogo) {
    const tbody = document.getElementById('alerts-body');
    const bajo = catalogo.filter(p => limpiarNumero(p['STOCK_ACTUAL']) < limpiarNumero(p['STOCK_MINIMO']) && p['ESTADO']==='Activo');
    tbody.innerHTML = bajo.length===0 ? '<tr><td>✅ Stock OK</td></tr>' : bajo.map(p => `<tr><td>${p['NOMBRE_PRODUCTO']}</td><td>${p['SKU']}</td><td>${p['STOCK_ACTUAL']}</td><td>${p['STOCK_MINIMO']}</td><td>⚠️</td></tr>`).join('');
}

window.onload = actualizarDashboard;