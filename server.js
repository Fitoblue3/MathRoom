const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7, // 10 MB para imágenes
    pingTimeout: 5000,   // Espera solo 2 segundos de inactividad antes de considerar desconectado
    pingInterval: 10000   // Envía un "ping" de control cada 1 segundo
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
socket.on('profe:crear-sala', (datos, callback) => {
        let pinUsar = (datos && datos.pinReconexion && salas[datos.pinReconexion]) 
            ? datos.pinReconexion 
            : generarPinUnico();

        if (!salas[pinUsar]) {
            salas[pinUsar] = {
                pin: pinUsar,
                profeSocketId: socket.id,
                preguntaActual: null,
                estudiantes: [],
                respuestas: []
            };
        } else {
            salas[pinUsar].profeSocketId = socket.id;
        }

        socket.join(pinUsar);
        socket.pinSala = pinUsar;
        socket.esProfe = true;

        console.log(`Sala activa con PIN: ${pinUsar}`);
        if (typeof callback === 'function') callback({ exito: true, pin: pinUsar });
    });

    // El profe lanza una nueva pregunta en su sala
    socket.on('profe:lanzar-pregunta', (datos) => {
        const pin = socket.pinSala;
        if (!pin || !salas[pin]) return;

        salas[pin].preguntaActual = { 
            texto: datos.texto,
            respuestaCorrecta: datos.respuestaCorrecta 
        };
        salas[pin].respuestas = {}; // Reiniciar respuestas para la nueva pregunta

        io.to(pin).emit('estudiante:nueva-pregunta', { texto: datos.texto });
        io.to(pin).emit('profe:actualizar-respuestas', []);
    });

    // Profesor envía un comentario a un estudiante
    socket.on('profe:enviar-comentario', ({ estudianteId, comentario }, callback) => {
        const pin = socket.pinSala;
        const sala = salas[pin];
        if (!sala || !sala.respuestas[estudianteId]) return;

        sala.respuestas[estudianteId].comentarios.push(comentario);
        sala.respuestas[estudianteId].completado = false;

        // Notificar al estudiante específico
        io.to(estudianteId).emit('estudiante:recibir-retroalimentacion', {
            comentarios: sala.respuestas[estudianteId].comentarios,
            completado: false
        });

        // Actualizar grid del profe
        io.to(pin).emit('profe:actualizar-respuestas', Object.values(sala.respuestas));
        if (typeof callback === 'function') callback({ exito: true });
    });

    // Profesor marca como completado el ejercicio de un estudiante
    socket.on('profe:marcar-completado', ({ estudianteId }, callback) => {
        const pin = socket.pinSala;
        const sala = salas[pin];
        if (!sala || !sala.respuestas[estudianteId]) return;

        sala.respuestas[estudianteId].completado = true;

        // Notificar al estudiante específico
        io.to(estudianteId).emit('estudiante:recibir-retroalimentacion', {
            comentarios: sala.respuestas[estudianteId].comentarios,
            completado: true
        });

        // Actualizar grid del profe
        io.to(pin).emit('profe:actualizar-respuestas', Object.values(sala.respuestas));
        if (typeof callback === 'function') callback({ exito: true });
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

   socket.on('estudiante:responder', (datosPayload, callback) => {
        if (typeof callback !== 'function') callback = () => {};
        const pin = socket.pinSala;
        const sala = salas[pin];

        if (!sala || !sala.preguntaActual) {
            return callback({ exito: false, mensaje: "No hay una pregunta activa." });
        }

        const tipo = datosPayload?.tipo; // 'texto' o 'foto'
        const contenido = datosPayload?.contenido;
        
        // Recuperar registro anterior o inicializar uno nuevo
        const registroPrevio = sala.respuestas[socket.id] || { 
            texto: "", 
            esCorrecto: false, 
            foto: null, 
            comentarios: [], 
            completado: false 
        };

        let esCorrectoResult = registroPrevio.esCorrecto;

        if (tipo === 'texto') {
            registroPrevio.texto = contenido;
            
            // Comparación limpia sin espacios ni mayúsculas
            const respUsuario = String(contenido || '').trim().toLowerCase();
            const respCorrecta = String(sala.preguntaActual.respuestaCorrecta || '').trim().toLowerCase();
            
            esCorrectoResult = (respUsuario === respCorrecta);
            registroPrevio.esCorrecto = esCorrectoResult;
        } else if (tipo === 'foto') {
            registroPrevio.foto = contenido;
        }

        sala.respuestas[socket.id] = {
            id: socket.id,
            nombre: socket.nombreEstudiante || "Anónimo",
            texto: registroPrevio.texto,
            esCorrecto: registroPrevio.esCorrecto,
            foto: registroPrevio.foto,
            comentarios: registroPrevio.comentarios,
            completado: registroPrevio.completado
        };

        // Notificar al profesor con la lista de respuestas actualizada
        io.to(pin).emit('profe:actualizar-respuestas', Object.values(sala.respuestas));
        
        callback({ exito: true, esCorrecto: esCorrectoResult });
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