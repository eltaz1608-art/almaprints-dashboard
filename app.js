
// ==========================================
// ALMA PRINTS - DASHBOARD v2 (CON DEBUG)
// ==========================================

const CONFIG = {
    SHEET_ID: '1yDpg679-IZ-oJmn4MclEqOdp6czLfPdG5GMGbdqZTtk'
};

const getSheetURL = (sheetName) => 
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;

// ==========================================
// DEBUG: Ver qué columnas tiene tu Sheets
// ==========================================

async function fetchSheet(sheetName) {
    try {
        const url = getSheetURL(sheetName);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error: ' + response.status);
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error(`Error ${sheetName}:`, error);
        return [];
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    console.log('📋 Filas encontradas:', lines.length);
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📊 Encabezados:', headers);
    
    const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        return obj;
    });
    
    return data;
}

// ==========================================
// PRINCIPAL
// ==========================================

async function actualizarDashboard() {
    const btn = document.querySelector('.btn-refresh');
    btn.textContent = '⏳ Cargando...';
    btn.disabled = true;
    
    try {
        console.log('🔄 Descargando datos...');
        
        const catalogo = await fetchSheet('CATÁLOGO_PRODUCTOS');
        const ventas = await fetchSheet('REGISTRO_SALIDAS');
        
        console.log('📦 Productos:', catalogo.length);
        console.log('💰 Ventas:', ventas.length);
        
        // Si no hay datos, probar con nombres alternativos
        if (catalogo.length === 0) {
            console.log('⚠️ Probando hojas alternativas...');
        }
        
        calcularKPIs(catalogo, ventas);
        generarGraficos(ventas, catalogo);
        mostrarAlertas(catalogo);
        
        document.getElementById('last-update').textContent = new Date().toLocaleString('es-PE', {
            timeZone: 'America/Lima',
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        
    } catch (error) {
        console.error('Error completo:', error);
        alert('⚠️ Error: ' + error.message);
    }
    
    btn.textContent = '🔄 Actualizar Datos';
    btn.disabled = false;
}

// ==========================================
// KPIs ( Adaptable)
// ==========================================

function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, productosActivos = 0, stockBajo = 0;
    
    // Detectar nombres de columnas
    const ventaKeys = ventas[0] ? Object.keys(ventas[0]) : {};
    const productoKeys = catalogo[0] ? Object.keys(catalogo[0]) : {};
    
    console.log('🔑 Columnas Venta:', ventaKeys);
    console.log('🔑 Columnas Producto:', productoKeys);
    
    // Buscar columna de forma flexible
    const colTotalVenta = ventaKeys.find(k => k.includes('TOTAL')) || 'TOTAL_SALIDA';
    const colTipoVenta = ventaKeys.find(k => k.includes('TIPO')) || 'TIPO_SALIDA';
    const colCanal = ventaKeys.find(k => k.includes('CANAL')) || 'CANAL_VENTA';
    
    const colStock = productoKeys.find(k => k.includes('STOCK') && k.includes('ACTUAL')) || 'STOCK_ACTUAL';
    const colStockMin = productoKeys.find(k => k.includes('MIN')) || 'STOCK_MINIMO';
    const colEstado = productoKeys.find(k => k.includes('ESTADO')) || 'ESTADO';
    const colNombre = productoKeys.find(k => k.includes('NOMBRE')) || 'NOMBRE_PRODUCTO';
    const colSKU = productoKeys.find(k => k.includes('SKU')) || 'SKU';
    
    console.log('📌 Usando columnas:', {colTotalVenta, colTipoVenta, colStock, colStockMin, colEstado});
    
    // Calcular ventas
    ventas.forEach(v => {
        const total = parseFloat(v[colTotalVenta]) || 0;
        const tipo = v[colTipoVenta] || '';
        if ((tipo === 'Venta' || tipo === '') && total > 0) {
            ingresos += total;
            pedidos++;
        }
    });
    
    // Calcular inventario
    catalogo.forEach(p => {
        if (p[colEstado] === 'Activo' || p[colEstado] === 'activo' || p[colEstado] === '') {
            productosActivos++;
            const stock = parseFloat(p[colStock]) || 0;
            const min = parseFloat(p[colStockMin]) || 0;
            if (stock < min) stockBajo++;
        }
    });
    
    const beneficio = ingresos * 0.4;
    const ticket = pedidos > 0 ? ingresos / pedidos : 0;
    
    document.getElementById('kpi-ingresos').textContent = formatCurrency(ingresos);
    document.getElementById('kpi-beneficio').textContent = formatCurrency(beneficio);
    document.getElementById('kpi-ticket').textContent = formatCurrency(ticket);
    document.getElementById('kpi-pedidos').textContent = pedidos;
    document.getElementById('kpi-productos').textContent = productosActivos;
    document.getElementById('kpi-stock').textContent = stockBajo;
    
    console.log('✅ KPI Result:', {ingresos, pedidos, productosActivos, stockBajo});
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);
}

// ==========================================
// GRÁFICOS
// ==========================================

let chartCanales, chartCategorias;

function generarGraficos(ventas, catalogo) {
    const ventaKeys = Object.keys(ventas[0] || {});
    const productoKeys = Object.keys(catalogo[0] || {});
    
    const colCanal = ventaKeys.find(k => k.includes('CANAL')) || 'CANAL_VENTA';
    const colTotalVenta = ventaKeys.find(k => k.includes('TOTAL')) || 'TOTAL_SALIDA';
    const colTipoVenta = ventaKeys.find(k => k.includes('TIPO')) || 'TIPO_SALIDA';
    const colCategoria = productoKeys.find(k => k.includes('CATEGOR')) || 'CATEGORÍA';
    
    // Canales
    const canales = {};
    ventas.forEach(v => {
        const total = parseFloat(v[colTotalVenta]) || 0;
        const tipo = v[colTipoVenta] || '';
        if ((tipo === 'Venta' || tipo === '') && total > 0 && v[colCanal]) {
            canales[v[colCanal]] = (canales[v[colCanal]] || 0) + total;
        }
    });
    
    const ctxCanales = document.getElementById('chart-canales');
    if (chartCanales) chartCanales.destroy();
    chartCanales = new Chart(ctxCanales, {
        type: 'doughnut',
        data: {
            labels: Object.keys(canales),
            datasets: [{ data: Object.values(canales), backgroundColor: ['#E1306C', '#25D366', '#3b5998', '#FFD700', '#DDA7A5'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
    
    // Categorías
    const categorias = {};
    catalogo.forEach(p => {
        if (p[colCategoria]) categorias[p[colCategoria]] = (categorias[p[colCategoria]] || 0) + 1;
    });
    
    const ctxCategorias = document.getElementById('chart-categorias');
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(ctxCategorias, {
        type: 'bar',
        data: {
            labels: Object.keys(categorias),
            datasets: [{ label: 'Productos', data: Object.values(categorias), backgroundColor: '#DDA7A5', borderRadius: 8 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }
    });
}

// ==========================================
// ALERTAS
// ==========================================

function mostrarAlertas(catalogo) {
    const tbody = document.getElementById('alerts-body');
    let html = '';
    
    const productoKeys = Object.keys(catalogo[0] || {});
    const colStock = productoKeys.find(k => k.includes('STOCK') && k.includes('ACTUAL')) || 'STOCK_ACTUAL';
    const colStockMin = productoKeys.find(k => k.includes('MIN')) || 'STOCK_MINIMO';
    const colEstado = productoKeys.find(k => k.includes('ESTADO')) || 'ESTADO';
    const colNombre = productoKeys.find(k => k.includes('NOMBRE')) || 'NOMBRE_PRODUCTO';
    const colSKU = productoKeys.find(k => k.includes('SKU')) || 'SKU';
    
    const productosBajoStock = catalogo.filter(p => {
        const stock = parseFloat(p[colStock]) || 0;
        const min = parseFloat(p[colStockMin]) || 0;
        return (p[colEstado] === 'Activo' || p[colEstado] === 'activo' || p[colEstado] === '') && stock < min;
    });
    
    if (productosBajoStock.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center;padding:20px;">✅ Sin alertas - Stock OK</td></tr>';
    } else {
        productosBajoStock.forEach(p => {
            html += `<tr>
                <td>${p[colNombre]}</td>
                <td>${p[colSKU]}</td>
                <td>${p[colStock]}</td>
                <td>${p[colStockMin]}</td>
                <td><span class="alerta-badge">⚠️ BAJO</span></td>
            </tr>`;
        });
    }
    
    tbody.innerHTML = html;
}

window.onload = actualizarDashboard;