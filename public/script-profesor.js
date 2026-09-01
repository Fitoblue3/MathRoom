// Conexión con el servidor Socket.IO
const socket = io();

// Referencias del DOM
const modalQr = document.getElementById('modalQr');
const btnAbrirQr = document.getElementById('btnAbrirQr');
const modalLista = document.getElementById('modalLista');
const btnAbrirLista = document.getElementById('btnAbrirLista');

const inputPregunta = document.getElementById('pregunta');
const inputRespuesta = document.getElementById('respuesta');
const btnLanzar = document.getElementById('btnLanzar');

const boxPreguntaActiva = document.getElementById('boxPreguntaActiva');
const textoPreguntaActiva = document.getElementById('textoPreguntaActiva');
const respuestasGrid = document.getElementById('respuestasGrid');
const cantEstudiantes = document.getElementById('cantEstudiantes');
const listaEstudiantesContainer = document.getElementById('listaEstudiantesContainer');

let qrGenerado = null;

// --- EVENTOS DE MODALES ---

// Evento para abrir el Modal y generar el QR
btnAbrirQr.addEventListener('click', () => {
    modalQr.classList.add('active');

    const contenedorQr = document.getElementById('qrcode');
    
    // Si aún no se ha generado el QR, crearlo
    if (!qrGenerado) {
        contenedorQr.innerHTML = ''; 

        const ipLocal = "172.16.70.2";
        const urlEstudiante = `http://${ipLocal}:3000/estudiante.html?pin=281007`;

        qrGenerado = new QRCode(contenedorQr, {
            text: urlEstudiante,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
});

btnAbrirLista.addEventListener('click', () => modalLista.classList.add('active'));

// Cierre de modales al hacer clic afuera
modalQr.addEventListener('click', (e) => { if (e.target === modalQr) modalQr.classList.remove('active'); });
modalLista.addEventListener('click', (e) => { if (e.target === modalLista) modalLista.classList.remove('active'); });

// --- CONEXIÓN INICIAL ---
socket.on('connect', () => {
    socket.emit('profe:iniciar');
});

// --- LANZAR PREGUNTA ---
btnLanzar.addEventListener('click', () => {
    const texto = inputPregunta.value.trim();
    const respuestaCorrecta = inputRespuesta.value.trim();

    if (!texto || !respuestaCorrecta) {
        alert('Por favor completa la pregunta y la respuesta correcta.');
        return;
    }

    // Emitir la pregunta al servidor
    socket.emit('profe:lanzar-pregunta', { texto, respuestaCorrecta });

    // Actualizar interfaz del profesor
    textoPreguntaActiva.textContent = texto;
    boxPreguntaActiva.style.display = 'flex';
    inputPregunta.value = '';
    inputRespuesta.value = '';
});

// --- RECEPTOR EN TIEMPO REAL: LISTA DE ESTUDIANTES ---
socket.on('profe:actualizar-estudiantes', (estudiantes) => {
    cantEstudiantes.textContent = estudiantes.length;
    listaEstudiantesContainer.innerHTML = '';

    estudiantes.forEach(est => {
        const li = document.createElement('li');
        li.className = 'estudiante-item';
        li.innerHTML = `
            <div class="estudiante-user">
                <span class="material-symbols-outlined icon-user">account_circle</span>
                <span>${est.nombre}</span>
            </div>
            <span class="badge-conectado">En línea</span>
        `;
        listaEstudiantesContainer.appendChild(li);
    });
});

// --- RECEPTOR EN TIEMPO REAL: RESPUESTAS DE ALUMNOS ---
socket.on('profe:actualizar-respuestas', (respuestas) => {
    respuestasGrid.innerHTML = '';

    respuestas.forEach(resp => {
        const div = document.createElement('div');
        div.className = `respuesta-card ${resp.esCorrecto ? 'correcto' : 'incorrecto'}`;
        div.innerHTML = `
            <div class="estudiante-info">
                <span class="nombre">${resp.nombre}</span>
                <span class="respuesta-texto">Respondió: ${resp.respuesta}</span>
            </div>
            <span class="estado-badge">
                <span class="material-symbols-outlined">${resp.esCorrecto ? 'check_circle' : 'cancel'}</span>
                ${resp.esCorrecto ? 'Correcto' : 'Incorrecto'}
            </span>
        `;
        respuestasGrid.appendChild(div);
    });
});