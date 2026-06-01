
// 1. Pega AQUÍ tu enlace de SheetDB para el CATÁLOGO
const URL_CATALOGO = 'https://sheetdb.io/api/v1/h8btkw6u20647?sheet=CATÁLOGO_PRODUCTOS';
// 2. Pega AQUÍ tu enlace de SheetDB para las SALIDAS
const URL_SALIDAS = 'https://sheetdb.io/api/v1/h8btkw6u20647?sheet=REGISTRO_SALIDAS';

function limpiar(valor) {
    if (!valor) return 0;
    // Elimina "S/.", comas y espacios, dejando solo números
    return parseFloat(String(valor).replace(/[^0-9.]/g, "")) || 0;
}

async function cargarDashboard() {
    try {
        // Obtenemos ambos datos a la vez
        const [resCat, resSal] = await Promise.all([fetch(URL_CATALOGO), fetch(URL_SALIDAS)]);
        const productos = await resCat.json();
        const ventas = await resSal.json();

        // Cálculo 1: Total Ventas (Suma de la columna TOTAL_SALIDA)
        let totalIngresos = 0;
        ventas.forEach(v => {
            if(v.TOTAL_SALIDA) totalIngresos += limpiar(v.TOTAL_SALIDA);
        });

        // Cálculo 2: Productos Activos
        const activos = productos.filter(p => p.ESTADO === "Activo").length;

        // Cálculo 3: Alertas de Stock
        const alertas = productos.filter(p => {
            let actual = limpiar(p.STOCK_ACTUAL);
            let min = limpiar(p.STOCK_MINIMO);
            return (actual <= min && min > 0);
        }).length;

        // Actualizar UI
        document.getElementById('totalVentas').innerText = "S/. " + totalIngresos.toFixed(2);
        document.getElementById('totalProductos').innerText = activos;
        document.getElementById('alertasStock').innerText = alertas;

        // Gráfico
        renderGrafico(productos);

    } catch (e) {
        console.error("Error al cargar datos:", e);
    }
}

function renderGrafico(productos) {
    const ctx = document.getElementById('graficoVentas').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: productos.map(p => p.NOMBRE_PRODUCTO),
            datasets: [{
                label: 'Stock',
                data: productos.map(p => limpiar(p.STOCK_ACTUAL)),
                backgroundColor: '#DDA7A5',
                borderColor: '#3E2723',
                borderWidth: 1
            }]
        }
    });
}

cargarDashboard();