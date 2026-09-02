const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingTimeout: 2000,   // Espera solo 2 segundos de inactividad antes de considerar desconectado
    pingInterval: 1000   // Envía un "ping" de control cada 1 segundo
});

const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Objeto para almacenar múltiples salas activas en memoria
// Ejemplo: { "839201": { preguntaActual: null, estudiantes: [], respuestas: [] } }
const salas = {};

// Función para generar un PIN de 6 dígitos único entre las salas activas
function generarPinUnico() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    if (salas[pin]) {
        return generarPinUnico(); // Si ya existe, genera otro
    }
    return pin;
}

io.on('connection', (socket) => {
    console.log(`Nuevo cliente conectado: ${socket.id}`);

    // --- EVENTOS DEL PROFESOR ---

    // El profesor crea una nueva sala dinámicamente
    socket.on('profe:crear-sala', (callback) => {
        const nuevoPin = generarPinUnico();

        salas[nuevoPin] = {
            pin: nuevoPin,
            profeSocketId: socket.id,
            preguntaActual: null,
            estudiantes: [],
            respuestas: []
        };

        socket.join(nuevoPin);
        socket.pinSala = nuevoPin; // Guardamos el PIN en la sesión del socket

        console.log(`Sala creada con PIN: ${nuevoPin}`);

        callback({ exito: true, pin: nuevoPin });
    });

    // El profe lanza una nueva pregunta en su sala
    socket.on('profe:lanzar-pregunta', (datos) => {
        const pin = socket.pinSala;
        if (!pin || !salas[pin]) return;

        salas[pin].preguntaActual = {
            texto: datos.texto,
            respuestaCorrecta: datos.respuestaCorrecta.toString().trim().toLowerCase()
        };
        salas[pin].respuestas = [];

        io.to(pin).emit('estudiante:nueva-pregunta', { texto: datos.texto });
        io.to(pin).emit('profe:actualizar-respuestas', []);
    });

    // --- EVENTOS DEL ESTUDIANTE ---

    socket.on('estudiante:unirse', (datos, callback) => {
        const pin = datos.pin ? datos.pin.trim() : "";
        const sala = salas[pin];

        if (!sala) {
            return callback({ exito: false, mensaje: "El PIN ingresado no existe o la sala ya fue cerrada." });
        }

        socket.join(pin);
        socket.pinSala = pin;
        socket.nombreEstudiante = datos.nombre;

        const existe = sala.estudiantes.some(e => e.id === socket.id);
        if (!existe) {
            sala.estudiantes.push({ id: socket.id, nombre: datos.nombre });
        }

        // Notificar al profe de ESTA sala específica
        io.to(pin).emit('profe:actualizar-estudiantes', sala.estudiantes);

        const preguntaTexto = sala.preguntaActual ? sala.preguntaActual.texto : null;
        callback({ exito: true, preguntaActual: preguntaTexto });
    });

    socket.on('estudiante:responder', (respuestaTexto, callback) => {
        const pin = socket.pinSala;
        const sala = salas[pin];

        if (!sala || !sala.preguntaActual) {
            return callback({ exito: false, mensaje: "No hay una pregunta activa." });
        }

        const respuestaLimpia = respuestaTexto.toString().trim().toLowerCase();
        const esCorrecto = (respuestaLimpia === sala.preguntaActual.respuestaCorrecta);

        const intencional = {
            nombre: socket.nombreEstudiante || "Anónimo",
            respuesta: respuestaTexto,
            esCorrecto: esCorrecto
        };

        sala.respuestas.push(intencional);
        io.to(pin).emit('profe:actualizar-respuestas', sala.respuestas);

        callback({ exito: true, esCorrecto: esCorrecto });
    });

    // --- MANEJO DE DESCONEXIÓN ---
    socket.on('disconnect', () => {
        const pin = socket.pinSala;
        if (pin && salas[pin]) {
            if (socket.esProfe) {
                io.to(pin).emit('estudiante:sala-cerrada', { 
                    mensaje: "El profesor ha salido. La clase ha finalizado." 
                });
                delete salas[pin];
                console.log(`Sala ${pin} eliminada por desconexión del profesor.`);
            } else {
                salas[pin].estudiantes = salas[pin].estudiantes.filter(e => e.id !== socket.id);
                io.to(pin).emit('profe:actualizar-estudiantes', salas[pin].estudiantes);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor de MathRoom activo en http://localhost:${PORT}`);
});