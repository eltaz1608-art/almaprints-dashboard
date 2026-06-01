
// Tu enlace oficial de SheetDB conectado a la pestaña del catálogo
const API_URL = 'https://sheetdb.io/api/v1/h8btkw6u20647?sheet=CATÁLOGO_PRODUCTOS'; 

async function cargarDatos() {
    try {
        const respuesta = await fetch(API_URL);
        const datosBrutos = await respuesta.json();

        // 🔥 FILTRO MÁGICO 1: Eliminar las filas vacías de Google Sheets
        // Solo nos quedamos con los productos que tienen un SKU escrito
        const datos = datosBrutos.filter(polo => polo.SKU && polo.SKU.trim() !== "");

        // 1. Calcular Productos Activos
        const productosActivos = datos.filter(polo => polo.ESTADO === 'Activo').length;
        
        // 2. Calcular Alertas de Stock Reales
        const alertasStock = datos.filter(polo => {
            const stockAct = Number(polo.STOCK_ACTUAL) || 0;
            const stockMin = Number(polo.STOCK_MINIMO) || 0;
            // Solo avisa si el stock es menor/igual al mínimo, y descarta los que tienen 0 mínimo
            return stockAct <= stockMin && stockMin > 0; 
        }).length;

        // 3. Calcular Valor del Inventario (Reparando el error NaN)
        let valorInventario = 0;
        datos.forEach(polo => {
            // 🔥 FILTRO MÁGICO 2: Limpiamos el "S/." para convertirlo en un número puro
            let costoLimpio = polo.COSTO_UNITARIO ? String(polo.COSTO_UNITARIO).replace(/[^0-9.-]+/g,"") : "0";
            let stockLimpio = polo.STOCK_ACTUAL ? String(polo.STOCK_ACTUAL).replace(/[^0-9.-]+/g,"") : "0";
            
            let costoNum = parseFloat(costoLimpio) || 0;
            let stockNum = parseFloat(stockLimpio) || 0;

            valorInventario += (stockNum * costoNum);
        });

        // 4. Inyectar los números limpios y correctos en la web
        document.getElementById('totalVentas').innerText = "S/. " + valorInventario.toFixed(2);
        document.getElementById('totalProductos').innerText = productosActivos;
        document.getElementById('alertasStock').innerText = alertasStock;

        // 5. Dibujar el gráfico solo con los datos reales
        dibujarGrafico(datos);

    } catch (error) {
        console.error("Hubo un error al conectar con Google Sheets:", error);
    }
}

// Función para crear el gráfico
function dibujarGrafico(datos) {
    const ctx = document.getElementById('graficoVentas').getContext('2d');
    
    // Extraemos los nombres (ej: "Mamá Residency (S)")
    const nombres = datos.map(item => item.NOMBRE_PRODUCTO + ' (' + item.TALLA + ')');
    
    // Extraemos y limpiamos el stock
    const cantidades = datos.map(item => {
        let stockLimpio = item.STOCK_ACTUAL ? String(item.STOCK_ACTUAL).replace(/[^0-9.-]+/g,"") : "0";
        return parseFloat(stockLimpio) || 0;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombres,
            datasets: [{
                label: 'Unidades en Stock',
                data: cantidades,
                backgroundColor: '#DDA7A5', // Color Rosa Palo de Alma Prints
                borderColor: '#3E2723', // Color Marrón de Alma Prints
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Iniciar todo al abrir la página
cargarDatos();