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

let pinActual = "";
let nombreActual = "";

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
});

// Enviar respuesta
btnEnviarRespuesta.addEventListener('click', () => {
    const respuestaTexto = respuestaEstudiante.value.trim();
    if (!respuestaTexto) {
        alert('Escribe una respuesta antes de enviar.');
        return;
    }

    socket.emit('estudiante:responder', respuestaTexto, (respuesta) => {
        if (respuesta.exito) {
            respuestaEstudiante.disabled = true;
            btnEnviarRespuesta.disabled = true;
            feedbackRespuesta.style.display = 'flex';
        } else {
            alert(respuesta.mensaje);
        }
    });
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