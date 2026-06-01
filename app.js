
// ==========================================
// ALMA PRINTS - DASHBOARD v3 (CORREGIDO)
// ==========================================

const CONFIG = {
    SHEET_ID: '1yDpg679-IZ-oJmn4MclEqOdp6czLfPdG5GMGbdqZTtk'
};

// URLs - NOTA: Los nombres van SIN acentos en la URL
const getSheetURL = (sheetName) => 
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;

// ==========================================
// PRINCIPAL
// ==========================================

async function fetchSheet(sheetName) {
    try {
        const url = getSheetURL(sheetName);
        console.log('📥 Obteniendo:', sheetName, 'desde:', url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error: ' + response.status);
        
        const csvText = await response.text();
        console.log('📄 Raw CSV (primeros 200 chars):', csvText.substring(0, 200));
        
        return parseCSV(csvText);
    } catch (error) {
        console.error(`Error ${sheetName}:`, error);
        return [];
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    console.log('📋 Total filas:', lines.length);
    
    // Los encabezados pueden tener acentos
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📊 Encabezados:', headers);
    
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
        console.log('=== 🔄 INICIANDO DASHBOARD ===');
        
        // NOTA: Los nombres van SIN acentos en la URL
        const [catalogo, ventas] = await Promise.all([
            fetchSheet('CATÁLOGO_PRODUCTOS'),
            fetchSheet('REGISTRO_SALIDAS')
        ]);
        
        console.log('📦 Productos obtenidos:', catalogo.length);
        console.log('💰 Ventas obtenidas:', ventas.length);
        
        if (catalogo.length > 0) {
            console.log('👀 Primer producto:', catalogo[0]);
        }
        if (ventas.length > 0) {
            console.log('👀 Primera venta:', ventas[0]);
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
// KPIs - Adaptado a tus columnas CON acentos
// ==========================================

function calcularKPIs(catalogo, ventas) {
    let ingresos = 0, pedidos = 0, productosActivos = 0, stockBajo = 0;
    
    // Tus columnas exactas (del Apps Script):
    // SKU | NOMBRE_PRODUCTO | CATEGORÍA | DESCRIPCIÓN | TALLA | COLOR | MATERIAL | PROVEEDOR | COSTO_UNITARIO | PRECIO_VENTA | MARGEN_BENEFICIO | STOCK_ACTUAL | STOCK_MINIMO | ESTADO | FECHA_ALTA | ULTIMA_ENTRADA | ULTIMA_SALIDA | ROTACIÓN | PROVEEDOR_CONTACTO | NOTAS
    
    // Columnas de VENTAS:
    // ID_SALIDA | FECHA | NÚMERO_PEDIDO | CLIENTE | CANAL_VENTA | SKU | PRODUCTO | TALLA | CANTIDAD | PRECIO_UNITARIO | TOTAL_SALIDA | TIPO_SALIDA | ESTADO_PEDIDO | MÉTODO_PAGO | FECHA_ENTREGA | UBICACIÓN | NOTAS
    
    console.log('🔍 Procesando ventas...');
    
    ventas.forEach((v, i) => {
        console.log(`Venta ${i}:`, v);
        
        const total = parseFloat(v['TOTAL_SALIDA']) || 0;
        const tipo = v['TIPO_SALIDA'] || '';
        
        console.log(`  Total: ${total}, Tipo: ${tipo}`);
        
        // Aceptar ventas sin tipo específicoTambién o con "Venta"
        if ((tipo === '' || tipo === 'Venta') && total > 0) {
            ingresos += total;
            pedidos++;
        }
    });
    
    console.log('🔍 Procesando catálogo...');
    
    catalogo.forEach((p, i) => {
        console.log(`Producto ${i}:`, p);
        
        const stock = parseFloat(p['STOCK_ACTUAL']) || 0;
        const min = parseFloat(p['STOCK_MINIMO']) || 0;
        const estado = p['ESTADO'] || '';
        
        console.log(`  Stock: ${stock}, Min: ${min}, Estado: ${estado}`);
        
        if (estado === 'Activo') {
            productosActivos++;
            if (stock < min) {
                stockBajo++;
            }
        }
    });
    
    const beneficio = ingresos * 0.4; // 40% margen estimado
    const ticket = pedidos > 0 ? ingresos / pedidos : 0;
    
    console.log('=== RESULTADOS ===');
    console.log('Ingresos:', ingresos);
    console.log('Pedidos:', pedidos);
    console.log('Productos activos:', productosActivos);
    console.log('Stock bajo:', stockBajo);
    
    // Actualizar HTML
    document.getElementById('kpi-ingresos').textContent = formatCurrency(ingresos);
    document.getElementById('kpi-beneficio').textContent = formatCurrency(beneficio);
    document.getElementById('kpi-ticket').textContent = formatCurrency(ticket);
    document.getElementById('kpi-pedidos').textContent = pedidos;
    document.getElementById('kpi-productos').textContent = productosActivos;
    document.getElementById('kpi-stock').textContent = stockBajo;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-PE', { 
        style: 'currency', 
        currency: 'PEN' 
    }).format(amount);
}

// ==========================================
// GRÁFICOS
// ==========================================

let chartCanales, chartCategorias;

function generarGraficos(ventas, catalogo) {
    console.log('📈 Generando gráficos...');
    
    // Canales de venta
    const canales = {};
    ventas.forEach(v => {
        const total = parseFloat(v['TOTAL_SALIDA']) || 0;
        const tipo = v['TIPO_SALIDA'] || '';
        const canal = v['CANAL_VENTA'] || 'Otro';
        
        if ((tipo === '' || tipo === 'Venta') && total > 0) {
            canales[canal] = (canales[canal] || 0) + total;
        }
    });
    
    console.log('Canales:', canales);
    
    const ctxCanales = document.getElementById('chart-canales');
    if (chartCanales) chartCanales.destroy();
    chartCanales = new Chart(ctxCanales, {
        type: 'doughnut',
        data: {
            labels: Object.keys(canales).length ? Object.keys(canales) : ['Sin datos'],
            datasets: [{ 
                data: Object.values(canales).length ? Object.values(canales) : [1], 
                backgroundColor: ['#E1306C', '#25D366', '#3b5998', '#FFD700', '#DDA7A5'], 
                borderWidth: 0 
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
    
    // Categorías
    const categorias = {};
    catalogo.forEach(p => {
        const cat = p['CATEGORÍA'] || 'Sin categoría';
        categorias[cat] = (categorias[cat] || 0) + 1;
    });
    
    console.log('Categorías:', categorias);
    
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
        const stock = parseFloat(p['STOCK_ACTUAL']) || 0;
        const min = parseFloat(p['STOCK_MINIMO']) || 0;
        return p['ESTADO'] === 'Activo' && stock < min;
    });
    
    console.log('⚠️ Productos bajo stock:', productosBajoStock.length);
    
    if (productosBajoStock.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center;padding:20px;">✅ Sin alertas - Stock OK</td></tr>';
    } else {
        productosBajoStock.forEach(p => {
            html += `<tr>
                <td>${p['NOMBRE_PRODUCTO']}</td>
                <td>${p['SKU']}</td>
                <td>${p['STOCK_ACTUAL']}</td>
                <td>${p['STOCK_MINIMO']}</td>
                <td><span class="alerta-badge">⚠️ BAJO</span></td>
            </tr>`;
        });
    }
    
    tbody.innerHTML = html;
}

// Iniciar
window.onload = actualizarDashboard;