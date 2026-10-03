const socket = io();

// Elementos del DOM
const pasoPin = document.getElementById('pasoPin');
const pasoNombre = document.getElementById('pasoNombre');
const pasoEjercicio = document.getElementById('pasoEjercicio');

const inputPin = document.getElementById('inputPin');
const btnValidarPin = document.getElementById('btnValidarPin');

const inputNombre = document.getElementById('inputNombre');
const btnEntrarSala = document.getElementById('btnEntrarSala');

const lblPin = document.getElementById('lblPin');
const lblNombre = document.getElementById('lblNombre');

const textoPreguntaEstudiante = document.getElementById('textoPreguntaEstudiante');
const respuestaEstudiante = document.getElementById('respuestaEstudiante');
const btnEnviarRespuesta = document.getElementById('btnEnviarRespuesta');
const feedbackRespuesta = document.getElementById('feedbackRespuesta');

const feedbackContainer = document.getElementById('feedbackContainer');
const statusCompletadoBox = document.getElementById('statusCompletadoBox');
const comentariosBox = document.getElementById('comentariosBox');
const listaComentarios = document.getElementById('listaComentarios');

const inputFoto = document.getElementById('inputFoto');
const btnTomarFoto = document.getElementById('btnTomarFoto');
const btnEnviarFoto = document.getElementById('btnEnviarFoto');
const previewFotoContainer = document.getElementById('previewFotoContainer');
const imgPreview = document.getElementById('imgPreview');
const btnRemoverFoto = document.getElementById('btnRemoverFoto');

let pinActual = "";
let nombreActual = "";
let fotoBase64 = null;

// --- AUTO-RECONEXIÓN Y LECTURA DE QR ---
window.addEventListener('DOMContentLoaded', () => {
    const pinGuardado = sessionStorage.getItem('mathroom_pin');
    const nombreGuardado = sessionStorage.getItem('mathroom_nombre');

    if (pinGuardado && nombreGuardado) {
        intentarReconexion(pinGuardado, nombreGuardado);
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pinDesdeUrl = urlParams.get('pin');

    if (pinDesdeUrl && pinDesdeUrl.length === 6) {
        inputPin.value = pinDesdeUrl;
        pinActual = pinDesdeUrl;
        lblPin.textContent = pinDesdeUrl;
        pasoPin.style.display = 'none';
        pasoNombre.style.display = 'flex';
    }
});

function intentarReconexion(pin, nombre) {
    pinActual = pin;
    nombreActual = nombre;
    lblPin.textContent = pin;
    lblNombre.textContent = nombre;

    socket.emit('estudiante:unirse', { pin: pinActual, nombre: nombreActual }, (respuesta) => {
        if (!respuesta.exito) {
            limpiarSesionLocal();
            return;
        }

        pasoPin.style.display = 'none';
        pasoNombre.style.display = 'none';
        pasoEjercicio.style.display = 'flex';

        if (respuesta.preguntaActual) {
            textoPreguntaEstudiante.textContent = respuesta.preguntaActual;
        }
    });
}

// Validar PIN manual
btnValidarPin.addEventListener('click', () => {
    const pin = inputPin.value.trim();
    if (pin.length !== 6) {
        alert('Por favor ingresa un código PIN válido de 6 dígitos.');
        return;
    }

    pinActual = pin;
    lblPin.textContent = pin;
    pasoPin.style.display = 'none';
    pasoNombre.style.display = 'flex';
});

// Unirse a la sala
btnEntrarSala.addEventListener('click', () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) {
        alert('Por favor ingresa tu nombre.');
        return;
    }

    nombreActual = nombre;
    lblNombre.textContent = nombre;

    socket.emit('estudiante:unirse', { pin: pinActual, nombre: nombreActual }, (respuesta) => {
        if (!respuesta.exito) {
            alert(respuesta.mensaje);
            return;
        }

        sessionStorage.setItem('mathroom_pin', pinActual);
        sessionStorage.setItem('mathroom_nombre', nombreActual);

        pasoNombre.style.display = 'none';
        pasoEjercicio.style.display = 'flex';

        if (respuesta.preguntaActual) {
            textoPreguntaEstudiante.textContent = respuesta.preguntaActual;
        }
    });
});

// Receptor de nueva pregunta
socket.on('estudiante:nueva-pregunta', (datos) => {
    textoPreguntaEstudiante.textContent = datos.texto;
    respuestaEstudiante.value = '';
    respuestaEstudiante.disabled = false;
    btnEnviarRespuesta.disabled = false;
    feedbackRespuesta.style.display = 'none';

    // Limpiar foto
    fotoBase64 = null;
    inputFoto.value = '';
    previewFotoContainer.style.display = 'none';
    if (btnRemoverFoto) btnRemoverFoto.style.display = 'flex';
    limpiarFoto();
    btnTomarFoto.disabled = false;

    // Limpiar retroalimentación
    feedbackContainer.style.display = 'none';
    statusCompletadoBox.style.display = 'none';
    comentariosBox.style.display = 'none';
    listaComentarios.innerHTML = '';
});

// Enviar respuesta
btnEnviarRespuesta.addEventListener('click', () => {
    const respuestaTexto = respuestaEstudiante.value.trim();
    if (!respuestaTexto) {
        alert('Escribe una respuesta antes de enviar.');
        return;
    }

    socket.emit('estudiante:responder', { tipo: 'texto', contenido: respuestaTexto }, (respuesta) => {
        if (respuesta.exito) {
            respuestaEstudiante.disabled = true;
            btnEnviarRespuesta.disabled = true;

            feedbackRespuesta.className = 'feedback-box';

            if (respuesta.esCorrecto) {
                feedbackRespuesta.classList.add('feedback-correcto');
                feedbackRespuesta.innerHTML = `
                    <span class="material-symbols-outlined icon-feedback">check_circle</span>
                    <p><strong>¡Respuesta correcta!</strong> Espera a que el profe cambie la pregunta.</p>
                `;
            } else {
                feedbackRespuesta.classList.add('feedback-incorrecto');
                feedbackRespuesta.innerHTML = `
                    <span class="material-symbols-outlined icon-feedback">cancel</span>
                    <p><strong>Respuesta incorrecta.</strong> Revisa el procedimiento.</p>
                `;
            }

            feedbackRespuesta.style.display = 'flex';
        } else {
            alert(respuesta.mensaje || 'Error al enviar respuesta.');
        }
    });
});

btnTomarFoto.addEventListener('click', () => inputFoto.click());

inputFoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            fotoBase64 = event.target.result;
            imgPreview.src = fotoBase64;
            previewFotoContainer.style.display = 'inline-block';
            btnEnviarFoto.disabled = false; // Habilitar envío de foto
        };
        reader.readAsDataURL(file);
    }
});

btnRemoverFoto.addEventListener('click', () => {
    limpiarFoto();
});

function limpiarFoto() {
    fotoBase64 = null;
    inputFoto.value = '';
    previewFotoContainer.style.display = 'none';
    btnEnviarFoto.disabled = true;
}

btnEnviarFoto.addEventListener('click', () => {
    if (!fotoBase64) {
        alert('Selecciona una foto antes de enviar.');
        return;
    }

    socket.emit('estudiante:responder', { tipo: 'foto', contenido: fotoBase64 }, (respuesta) => {
        if (respuesta.exito) {
            btnEnviarFoto.disabled = true;
        } else {
            alert(respuesta.mensaje) || 'No se pudo enviar la foto.';
        }
    });
});

// Escuchar Retroalimentación del Profesor
socket.on('estudiante:recibir-retroalimentacion', ({ comentarios, completado }) => {
    feedbackContainer.style.display = 'block';

    if (completado) {
        statusCompletadoBox.style.display = 'flex';
        comentariosBox.style.display = 'none';
        respuestaEstudiante.disabled = true;
        btnTomarFoto.disabled = true;
        btnEnviarRespuesta.disabled = true;
    } else {
        statusCompletadoBox.style.display = 'none';
        
        // Habilitar para corregir y volver a enviar
        respuestaEstudiante.disabled = false;
        btnTomarFoto.disabled = false;
        btnEnviarRespuesta.disabled = false;

        if (comentarios && comentarios.length > 0) {
            comentariosBox.style.display = 'block';
            listaComentarios.innerHTML = '';
            comentarios.forEach(c => {
                const li = document.createElement('li');
                li.textContent = c;
                listaComentarios.appendChild(li);
            });
        }
    }
});

// Cierre de sala por el profesor
socket.on('estudiante:sala-cerrada', (datos) => {
    alert(datos.mensaje);
    limpiarSesionLocal();
});

function limpiarSesionLocal() {
    sessionStorage.removeItem('mathroom_pin');
    sessionStorage.removeItem('mathroom_nombre');

    pasoEjercicio.style.display = 'none';
    pasoNombre.style.display = 'none';
    pasoPin.style.display = 'flex';

    pinActual = "";
    nombreActual = "";
    inputPin.value = "";
    inputNombre.value = "";

    window.history.replaceState({}, document.title, window.location.pathname);
}