// Conexión con el servidor Socket.IO
const socket = io();

// Elementos de los Pasos
const pasoPin = document.getElementById('pasoPin');
const pasoNombre = document.getElementById('pasoNombre');
const pasoEjercicio = document.getElementById('pasoEjercicio');

// Inputs y Botones
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

// AUTOMATIZACIÓN POR QR: Leer PIN en la URL (?pin=XXXXXX)
window.addEventListener('DOMContentLoaded', () => {
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

// Paso 1 -> Paso 2 (Validar PIN manual)
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

// Paso 2 -> Paso 3 (Unirse a la sala en el backend)
btnEntrarSala.addEventListener('click', () => {
    const nombre = inputNombre.value.trim();
    if (!nombre) {
        alert('Por favor ingresa tu nombre.');
        return;
    }

    nombreActual = nombre;
    lblNombre.textContent = nombre;

    // Emitir evento para unirse a la sala en el servidor
    socket.emit('estudiante:unirse', { pin: pinActual, nombre: nombreActual }, (respuesta) => {
        if (!respuesta.exito) {
            alert(respuesta.mensaje);
            return;
        }

        // Si se unió con éxito, pasamos al panel de ejercicios
        pasoNombre.style.display = 'none';
        pasoEjercicio.style.display = 'flex';

        if (respuesta.preguntaActual) {
            textoPreguntaEstudiante.textContent = respuesta.preguntaActual;
        }
    });
});

// --- RECEPTOR EN TIEMPO REAL: NUEVA PREGUNTA DEL PROFESOR ---
socket.on('estudiante:nueva-pregunta', (datos) => {
    textoPreguntaEstudiante.textContent = datos.texto;
    respuestaEstudiante.value = '';
    respuestaEstudiante.disabled = false;
    btnEnviarRespuesta.disabled = false;
    feedbackRespuesta.style.display = 'none';
});

// --- ENVIAR RESPUESTA AL PROFESOR ---
btnEnviarRespuesta.addEventListener('click', () => {
    const respuestaTexto = respuestaEstudiante.value.trim();

    if (!respuestaTexto) {
        alert('Escribe una respuesta antes de enviar.');
        return;
    }

    socket.emit('estudiante:responder', respuestaTexto, (respuesta) => {
        if (respuesta.exito) {
            // Deshabilitar input y mostrar mensaje de confirmación
            respuestaEstudiante.disabled = true;
            btnEnviarRespuesta.disabled = true;
            feedbackRespuesta.style.display = 'flex';
        } else {
            alert(respuesta.mensaje);
        }
    });
});