const modal = document.getElementById('modalQr');
const btnAbrir = document.getElementById('btnAbrirQr');

// Abrir el modal al presionar el botón
btnAbrir.addEventListener('click', () => {
modal.classList.add('active');
});

// Cerrar el modal al presionar fuera del contenedor (modal-card)
modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.classList.remove('active');
    }
});

// Referencias para el modal de Lista de Estudiantes
const modalLista = document.getElementById('modalLista');
const btnAbrirLista = document.getElementById('btnAbrirLista');

// Abrir el modal al presionar "Mostrar lista de estudiantes"
btnAbrirLista.addEventListener('click', () => {
    modalLista.classList.add('active');
});

// Cerrar el modal al hacer clic en el fondo oscuro
modalLista.addEventListener('click', (event) => {
    if (event.target === modalLista) {
        modalLista.classList.remove('active');
    }
})