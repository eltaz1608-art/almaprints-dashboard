
// Tu enlace oficial de SheetDB
const API_URL = 'https://sheetdb.io/api/v1/h8btkw6u20647?sheet=CATÁLOGO_PRODUCTOS'; 

// Función para limpiar texto y convertirlo en número (quita "S/.", comas, etc.)
function limpiarNum(valor) {
    if (!valor) return 0;
    const limpio = String(valor).replace(/[^0-9.-]+/g, "");
    return parseFloat(limpio) || 0;
}

async function cargarDatos() {
    try {
        const respuesta = await fetch(API_URL);
        const datosBrutos = await respuesta.json();

        // 1. FILTRO REAL: Solo tomamos filas que tengan un SKU escrito
        const datos = datosBrutos.filter(p => p.SKU && p.SKU.trim() !== "");

        // 2. Calcular Productos Activos
        const activos = datos.filter(p => p.ESTADO === 'Activo').length;
        
        // 3. Calcular Alertas de Stock (Solo productos con Stock <= Mínimo y Stock Mínimo > 0)
        const alertas = datos.filter(p => {
            let act = limpiarNum(p.STOCK_ACTUAL);
            let min = limpiarNum(p.STOCK_MINIMO);
            return (act <= min && min > 0);
        }).length;

        // 4. Calcular Valor Inventario (Stock * Costo)
        let totalValor = 0;
        datos.forEach(p => {
            totalValor += (limpiarNum(p.STOCK_ACTUAL) * limpiarNum(p.COSTO_UNITARIO));
        });

        // 5. Inyectar valores al HTML
        document.getElementById('totalVentas').innerText = "S/. " + totalValor.toFixed(2);
        document.getElementById('totalProductos').innerText = activos;
        document.getElementById('alertasStock').innerText = alertas;

        // 6. Dibujar gráfico
        dibujarGrafico(datos);

    } catch (error) {
        console.error("Error al conectar:", error);
    }
}

function dibujarGrafico(datos) {
    const ctx = document.getElementById('graficoVentas').getContext('2d');
    
    // Solo tomamos los datos reales para el gráfico
    const labels = datos.map(p => p.NOMBRE_PRODUCTO + ' (' + p.TALLA + ')');
    const valores = datos.map(p => limpiarNum(p.STOCK_ACTUAL));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Stock Actual',
                data: valores,
                backgroundColor: '#DDA7A5',
                borderColor: '#3E2723',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

cargarDatos();