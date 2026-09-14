const socket = io();

// Referencias del DOM
const modalQr = document.getElementById('modalQr');
const btnAbrirQr = document.getElementById('btnAbrirQr');
const modalLista = document.getElementById('modalLista');
const btnAbrirLista = document.getElementById('btnAbrirLista');

const codigoPinLabel = document.getElementById("codigoPin");

const inputPregunta = document.getElementById('pregunta');
const inputRespuesta = document.getElementById('respuesta');
const btnLanzar = document.getElementById('btnLanzar');

const boxPreguntaActiva = document.getElementById('boxPreguntaActiva');
const textoPreguntaActiva = document.getElementById('textoPreguntaActiva');
const respuestasGrid = document.getElementById('respuestasGrid');
const cantEstudiantes = document.getElementById('cantEstudiantes');
const listaEstudiantesContainer = document.getElementById('listaEstudiantesContainer');

let pinSalaActual = "";

// --- CONEXIÓN E INICIALIZACIÓN DE SALA ---
socket.on('connect', () => {
    const pinGuardado = sessionStorage.getItem('mathroom_profe_pin');

    socket.emit('profe:crear-sala', { pinReconexion: pinGuardado }, (respuesta) => {
        if (respuesta.exito) {
            pinSalaActual = respuesta.pin;
            sessionStorage.setItem('mathroom_profe_pin', pinSalaActual);

            if (codigoPinLabel) {
                codigoPinLabel.textContent = pinSalaActual;
            }
        }
    });
});

// --- EVENTOS DE MODALES ---
btnAbrirQr.addEventListener('click', () => {
    modalQr.classList.add('active');
    const contenedorQr = document.getElementById('qrcode');
    
    if (pinSalaActual) {
        contenedorQr.innerHTML = ''; 
        const urlEstudiante = `${window.location.origin}/estudiante.html?pin=${pinSalaActual}`;

        new QRCode(contenedorQr, {
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

modalQr.addEventListener('click', (e) => { if (e.target === modalQr) modalQr.classList.remove('active'); });
modalLista.addEventListener('click', (e) => { if (e.target === modalLista) modalLista.classList.remove('active'); });

// --- LANZAR PREGUNTA ---
btnLanzar.addEventListener('click', () => {
    const texto = inputPregunta.value.trim();
    const respuestaCorrecta = inputRespuesta.value.trim();

    if (!texto || !respuestaCorrecta) {
        alert('Por favor completa la pregunta y la respuesta correcta.');
        return;
    }

    socket.emit('profe:lanzar-pregunta', { texto, respuestaCorrecta });

    textoPreguntaActiva.textContent = texto;
    boxPreguntaActiva.style.display = 'flex';
    inputPregunta.value = '';
    inputRespuesta.value = '';
});

// --- LISTA DE ESTUDIANTES EN TIEMPO REAL ---
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

// --- RESPUESTAS EN TIEMPO REAL ---
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
