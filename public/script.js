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