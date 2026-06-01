
// 1. REEMPLAZA LO QUE ESTÁ ENTRE COMILLAS CON TU ENLACE DE SHEETDB
// Nota: Le agregamos "?sheet=CATÁLOGO_PRODUCTOS" al final para que lea esa pestaña exacta
const API_URL = 'https://sheetdb.io/api/v1/h8btkw6u20647?sheet=CATÁLOGO_PRODUCTOS'; 

// 2. Función principal que va a Google Sheets a traer los datos
async function cargarDatos() {
    try {
        // Pedimos los datos a SheetDB
        const respuesta = await fetch(API_URL);
        const datos = await respuesta.json();

        // 3. Hacemos los cálculos matemáticos automáticamente
        // Contamos cuántos productos dicen "Activo"
        const productosActivos = datos.filter(polo => polo.ESTADO === 'Activo').length;
        
        // Contamos cuántos productos tienen el Stock Actual menor o igual al Mínimo
        const alertasStock = datos.filter(polo => Number(polo.STOCK_ACTUAL) <= Number(polo.STOCK_MINIMO)).length;

        // Calculamos el valor de todo tu inventario (Stock * Costo)
        let valorInventario = 0;
        datos.forEach(polo => {
            if(polo.STOCK_ACTUAL && polo.COSTO_UNITARIO) {
                valorInventario += (Number(polo.STOCK_ACTUAL) * Number(polo.COSTO_UNITARIO));
            }
        });

        // 4. Inyectamos los resultados en tu página web
        document.getElementById('totalVentas').innerText = "S/. " + valorInventario.toFixed(2);
        document.getElementById('totalProductos').innerText = productosActivos;
        document.getElementById('alertasStock').innerText = alertasStock;

        // 5. Dibujamos el gráfico con el stock de tus productos
        dibujarGrafico(datos);

    } catch (error) {
        console.error("Hubo un error al conectar:", error);
    }
}

// Función para crear el gráfico
function dibujarGrafico(datos) {
    const ctx = document.getElementById('graficoVentas').getContext('2d');
    
    // Sacamos solo los nombres de los primeros 5 productos y su stock para el gráfico
    const primeros5 = datos.slice(0, 5);
    const nombres = primeros5.map(item => item.NOMBRE_PRODUCTO + ' (' + item.TALLA + ')');
    const cantidades = primeros5.map(item => Number(item.STOCK_ACTUAL));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: nombres,
            datasets: [{
                label: 'Unidades en Stock',
                data: cantidades,
                backgroundColor: '#DDA7A5', // Rosa Palo de Alma Prints
                borderColor: '#3E2723', // Marrón
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

// Ejecutamos todo al abrir la página
cargarDatos();