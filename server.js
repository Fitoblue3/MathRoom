const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Servir la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Memoria RAM de la sala actual (Para un solo profesor/sala)
let salaActual = {
    pin: "281007", // PIN por defecto
    preguntaActual: null,
    estudiantes: [], // Lista de alumnos conectados
    respuestas: []   // Historial de respuestas de la pregunta actual
};

// Conexiones en tiempo real con Socket.IO
io.on('connection', (socket) => {
    console.log(`Nuevo cliente conectado: ${socket.id}`);

    // --- AGREGADO: EL PROFESOR SE UNE A LA SALA ---
    socket.on('profe:iniciar', () => {
        socket.join(salaActual.pin);
        socket.emit('profe:actualizar-estudiantes', salaActual.estudiantes);
        socket.emit('profe:actualizar-respuestas', salaActual.respuestas);
    });

    // El profe lanza una nueva pregunta
    socket.on('profe:lanzar-pregunta', (datos) => {
        salaActual.preguntaActual = {
            texto: datos.texto,
            respuestaCorrecta: datos.respuestaCorrecta.toString().trim().toLowerCase()
        };
        salaActual.respuestas = []; // Reinicia respuestas para la nueva pregunta

        // Notifica a los estudiantes y al profe que la pregunta cambió
        io.to(salaActual.pin).emit('estudiante:nueva-pregunta', { texto: datos.texto });
        io.to(salaActual.pin).emit('profe:actualizar-respuestas', []);
    });

    // --- EVENTOS DEL ESTUDIANTE ---

    // El estudiante intenta unirse a la sala con su nombre y PIN
    socket.on('estudiante:unirse', (datos, callback) => {
        if (datos.pin !== salaActual.pin) {
            return callback({ exito: false, mensaje: "El PIN ingresado no existe." });
        }

        socket.join(salaActual.pin);
        socket.nombreEstudiante = datos.nombre;

        // Agregar a la lista de estudiantes si no está repetido
        const existe = salaActual.estudiantes.some(e => e.id === socket.id);
        if (!existe) {
            salaActual.estudiantes.push({ id: socket.id, nombre: datos.nombre });
        }

        // Avisar al profesor que hay un nuevo estudiante
        io.to(salaActual.pin).emit('profe:actualizar-estudiantes', salaActual.estudiantes);

        // Enviar al estudiante la pregunta actual si ya hay una activa
        const preguntaTexto = salaActual.preguntaActual ? salaActual.preguntaActual.texto : null;
        callback({ exito: true, preguntaActual: preguntaTexto });
    });

    // El estudiante envía su respuesta
    socket.on('estudiante:responder', (respuestaTexto, callback) => {
        if (!salaActual.preguntaActual) {
            return callback({ exito: false, mensaje: "No hay una pregunta activa." });
        }

        const respuestaLimpia = respuestaTexto.toString().trim().toLowerCase();
        const esCorrecto = (respuestaLimpia === salaActual.preguntaActual.respuestaCorrecta);

        const intencional = {
            nombre: socket.nombreEstudiante || "Anónimo",
            respuesta: respuestaTexto,
            esCorrecto: esCorrecto
        };

        // Guardar y notificar al profesor
        salaActual.respuestas.push(intencional);
        io.to(salaActual.pin).emit('profe:actualizar-respuestas', salaActual.respuestas);

        callback({ exito: true, esCorrecto: esCorrecto });
    });

    // Desconexión de un usuario
    socket.on('disconnect', () => {
        salaActual.estudiantes = salaActual.estudiantes.filter(e => e.id !== socket.id);
        io.to(salaActual.pin).emit('profe:actualizar-estudiantes', salaActual.estudiantes);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor de MathRoom activo en http://localhost:${PORT}`);
});