
// ==========================================
// ALMA PRINTS - DASHBOARD
// ==========================================

// 📋 TU SHEET ID - CONFIGURADO ✅
const CONFIG = {
    SHEET_ID: '1yDpg679-IZ-oJmn4MclEqOdp6czLfPdG5GMGbdqZTtk'
};

// URLs dinâmicas
const getSheetURL = (sheetName) => 
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;

// ==========================================
// PRINCIPAL
// ==========================================

async function fetchSheet(sheetName) {
    try {
        const url = getSheetURL(sheetName);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network error');
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        return obj;
    });
}

async function actualizarDashboard() {
    const btn = document.querySelector('.btn-refresh');
    btn.textContent = '⏳ Cargando...';
    btn.disabled = true;
    
    try {
        const [catalogo, ventas] = await Promise.all([
            fetchSheet('CATÁLOGO_PRODUCTOS'),
            fetchSheet('REGISTRO_SALIDAS')
        ]);
        
        calcularKPIs(catalogo, ventas);
        generarGraficos(ventas, catalogo);
        mostrarAlertas(catalogo);
        
        document.getElementById('last-update').textContent = new Date().toLocaleString('es-PE', {
            timeZone: 'America/Lima',
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    } catch (error) {
        alert('⚠️ Error al cargar. Verifica que el Sheets esté PÚBLICO.');
    }
    
    btn.textContent = '🔄 Actualizar Datos';
    btn.disabled = false;
}

// ==========================================
// KPIs
// ==========================================

function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, productosActivos = 0, stockBajo = 0;
    
    ventas.forEach(v => {
        if (v.TIPO_SALIDA === 'Venta' && v.TOTAL_SALIDA) {
            ingresos += parseFloat(v.TOTAL_SALIDA) || 0;
            pedidos++;
        }
    });
    
    catalogo.forEach(p => {
        if (p.ESTADO === 'Activo') {
            productosActivos++;
            const stock = parseFloat(p.STOCK_ACTUAL) || 0;
            const min = parseFloat(p.STOCK_MINIMO) || 0;
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
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);
}

// ==========================================
// GRÁFICOS
// ==========================================

let chartCanales, chartCategorias;

function generarGraficos(ventas, catalogo) {
    // Canales
    const canales = {};
    ventas.forEach(v => {
        if (v.TIPO_SALIDA === 'Venta' && v.CANAL_VENTA) {
            canales[v.CANAL_VENTA] = (canales[v.CANAL_VENTA] || 0) + (parseFloat(v.TOTAL_SALIDA) || 0);
        }
    });
    
    const ctxCanales = document.getElementById('chart-canales');
    if (chartCanales) chartCanales.destroy();
    chartCanales = new Chart(ctxCanales, {
        type: 'doughnut',
        data: {
            labels: Object.keys(canales),
            datasets: [{ data: Object.values(canales), backgroundColor: ['#E1306C', '#25D366', '#3b5998', '#FFD700'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
    
    // Categorías
    const categorias = {};
    catalogo.forEach(p => {
        if (p.CATEGORÍA) categorias[p.CATEGORÍA] = (categorias[p.CATEGORÍA] || 0) + 1;
    });
    
    const ctxCategorias = document.getElementById('chart-categorias');
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(ctxCategorias, {
        type: 'bar',
        data: {
            labels: Object.keys(categorias),
            datasets: [{ label: 'Productos', data: Object.values(categorias), backgroundColor: '#DDA7A5', borderRadius: 8 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

// ==========================================
// ALERTAS
// ==========================================

function mostrarAlertas(catalogo) {
    const tbody = document.getElementById('alerts-body');
    let html = '';
    
    const productosBajoStock = catalogo.filter(p => {
        const stock = parseFloat(p.STOCK_ACTUAL) || 0;
        const min = parseFloat(p.STOCK_MINIMO) || 0;
        return p.ESTADO === 'Activo' && stock < min;
    });
    
    if (productosBajoStock.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center;padding:20px;">✅ Sin alertas - Stock OK</td></tr>';
    } else {
        productosBajoStock.forEach(p => {
            html += `<tr>
                <td>${p.NOMBRE_PRODUCTO}</td>
                <td>${p.SKU}</td>
                <td>${p.STOCK_ACTUAL}</td>
                <td>${p.STOCK_MINIMO}</td>
                <td><span class="alerta-badge">⚠️ BAJO</span></td>
            </tr>`;
        });
    }
    
    tbody.innerHTML = html;
}

// Iniciar automáticamente
window.onload = actualizarDashboard;