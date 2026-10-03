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

const fotosGrid = document.getElementById('fotosGrid');

let pinSalaActual = "";

// --- FUNCIONES GLOBALES DE ACCIÓN (Definidas al inicio) ---
window.enviarComentario = function(estudianteId) {
    const input = document.getElementById(`inputComentario_${estudianteId}`);
    const comentario = input ? input.value.trim() : "";

    if (!comentario) {
        alert('Escribe un comentario antes de enviar.');
        return;
    }

    socket.emit('profe:enviar-comentario', { estudianteId, comentario }, (res) => {
        if (res && res.exito && input) input.value = '';
    });
};

window.marcarCompletado = function(estudianteId) {
    socket.emit('profe:marcar-completado', { estudianteId });
};

window.abrirZoom = function(src) {
    const modal = document.getElementById('modalZoom');
    const imgZoomed = document.getElementById('imgZoomed');
    if (modal && imgZoomed) {
        imgZoomed.src = src;
        modal.style.display = 'flex';
    }
};

// --- CONEXIÓN E INICIALIZACIÓN DE SALA ---
socket.on('connect', () => {
    const pinGuardado = sessionStorage.getItem('mathroom_profe_pin');

    socket.emit('profe:crear-sala', { pinReconexion: pinGuardado }, (respuesta) => {
        if (respuesta && respuesta.exito) {
            pinSalaActual = respuesta.pin;
            sessionStorage.setItem('mathroom_profe_pin', pinSalaActual);

            if (codigoPinLabel) {
                codigoPinLabel.textContent = pinSalaActual;
            }
        }
    });
});

// --- EVENTOS DE MODALES ---
btnAbrirQr?.addEventListener('click', () => {
    modalQr.classList.add('active');
    const contenedorQr = document.getElementById('qrcode');
    
    if (pinSalaActual && contenedorQr) {
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

btnAbrirLista?.addEventListener('click', () => modalLista?.classList.add('active'));

modalQr?.addEventListener('click', (e) => { if (e.target === modalQr) modalQr.classList.remove('active'); });
modalLista?.addEventListener('click', (e) => { if (e.target === modalLista) modalLista.classList.remove('active'); });

// --- LANZAR PREGUNTA ---
btnLanzar?.addEventListener('click', () => {
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
    if (!cantEstudiantes || !listaEstudiantesContainer) return;
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

// --- RENDERIZAR RESPUESTAS Y FOTOS EN EL GRID DEL PROFESOR ---
socket.on('profe:actualizar-respuestas', (respuestas) => {
    if (!respuestasGrid || !fotosGrid) return;
    respuestasGrid.innerHTML = '';
    fotosGrid.innerHTML = '';

    let hayTexto = false;
    let hayFotos = false;

    respuestas.forEach(resp => {
        // A. RESPUESTAS DE TEXTO
        if (resp.texto !== undefined && resp.texto !== null && resp.texto !== '') {
            hayTexto = true;
            const div = document.createElement('div');
            div.className = `respuesta-card ${resp.esCorrecto ? 'correcto' : 'incorrecto'}`;
            div.innerHTML = `
                <div class="estudiante-info">
                    <span class="nombre">${resp.nombre}</span>
                    <span class="respuesta-texto">Respondió: ${resp.texto}</span>
                </div>
                <span class="estado-badge">
                    <span class="material-symbols-outlined">${resp.esCorrecto ? 'check_circle' : 'cancel'}</span>
                    ${resp.esCorrecto ? 'Correcto' : 'Incorrecto'}
                </span>
            `;
            respuestasGrid.appendChild(div);
        }

        // B. EVIDENCIAS EN FOTO
        if (resp.foto) {
            hayFotos = true;
            const cardFoto = document.createElement('div');
            cardFoto.className = `estudiante-profe-card foto-card ${resp.completado ? 'card-completado' : ''}`;

            cardFoto.innerHTML = `
                <div class="card-header-estudiante">
                    <div class="info-user">
                        <span class="material-symbols-outlined">image</span>
                        <strong>${resp.nombre}</strong>
                    </div>
                    ${resp.completado ? '<span class="badge-status completado"><span class="material-symbols-outlined">check_circle</span> Completado</span>' : ''}
                </div>
                <div class="card-body-estudiante">
                    <div class="res-foto-box">
                        <!-- Se le agrega la clase 'img-evidencia' y se remueve el onclick inline -->
                        <img src="${resp.foto}" class="img-evidencia" alt="Procedimiento de ${resp.nombre}">
                    </div>
                    ${renderAccionesFoto(resp)}
                </div>
            `;
            fotosGrid.appendChild(cardFoto);
        }
    });

    if (!hayTexto) {
        respuestasGrid.innerHTML = '<p class="empty-state">No hay respuestas de texto aún.</p>';
    }
    if (!hayFotos) {
        fotosGrid.innerHTML = '<p class="empty-state">No se han recibido fotos de procedimiento.</p>';
    }
});

// Función auxiliar para renderizar los controles de fotos
function renderAccionesFoto(resp) {
    return `
        ${resp.comentarios && resp.comentarios.length > 0 ? `
            <div class="historial-comentarios">
                <small>Comentarios enviados:</small>
                <ul>${resp.comentarios.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>
        ` : ''}

        ${!resp.completado ? `
            <div class="acciones-profe">
                <div class="input-comentario-group">
                    <input type="text" maxlength="30" id="inputComentario_${resp.id}" placeholder="Escribe una corrección...">
                    <button class="btn btn-comentar" onclick="enviarComentario('${resp.id}')">
                        <span class="material-symbols-outlined">send</span>
                    </button>
                </div>
                <button class="btn btn-marcar-completado" onclick="marcarCompletado('${resp.id}')">
                    <span class="material-symbols-outlined">check</span> Marcar como Completado
                </button>
            </div>
        ` : ''}
    `;
}

// Delegación de eventos para abrir el modal al hacer clic en la foto o en su contenedor
if (fotosGrid) {
    fotosGrid.addEventListener('click', (e) => {
        // Busca si se hizo clic en la imagen (.img-evidencia) o en la caja contenedora (.res-foto-box)
        const targetImg = e.target.closest('.res-foto-box')?.querySelector('img') || (e.target.classList.contains('img-evidencia') ? e.target : null);

        if (targetImg) {
            e.stopPropagation(); // Evita que el clic viaje al document y cierre el modal inmediatamente
            const modalZoom = document.getElementById('modalZoom');
            const imgZoomed = document.getElementById('imgZoomed');

            if (modalZoom && imgZoomed) {
                imgZoomed.src = targetImg.src;
                modalZoom.style.display = 'flex';
                modalZoom.classList.add('active'); // Activa la visibilidad y eventos de puntero del CSS
            }
        }
    });
}

// Cierre del modal de zoom
document.addEventListener('DOMContentLoaded', () => {
    const modalZoom = document.getElementById('modalZoom');

    if (modalZoom) {
        modalZoom.addEventListener('click', () => {
            modalZoom.style.display = 'none';
            modalZoom.classList.remove('active');
        });
    }
});

document.addEventListener('keydown', (e) => {
    const modalZoom = document.getElementById('modalZoom');
    if (e.key === 'Escape' && modalZoom && modalZoom.classList.contains('active')) {
        modalZoom.style.display = 'none';
        modalZoom.classList.remove('active');
    }
});