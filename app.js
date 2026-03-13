const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto'); // Nativo de Node.js: evita errores de módulos (ESM)
const path = require('path');

const app = express();
const PORT = 3000; // Puerto óptimo para trabajar con Nginx como Proxy Inverso

// CONFIGURACIÓN DE AWS
// Nota: No incluimos llaves aquí. La EC2 usará automáticamente su IAM Role.
const REGION = "sa-east-1"; 
const BUCKET_NAME = "inventario-meyli"; 

const awsConfig = { region: REGION };
const s3 = new S3Client(awsConfig);
const ddbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuración de subida a S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: BUCKET_NAME,
        acl: 'public-read',
        metadata: (req, file, cb) => { cb(null, { fieldName: file.fieldname }); },
        key: (req, file, cb) => {
            // Nombre de archivo único basado en tiempo y nombre original
            cb(null, Date.now().toString() + "-" + file.originalname);
        }
    })
});

// ================= RUTAS DE LA APLICACIÓN =================

// RUTA PRINCIPAL: El Menú
app.get('/', (req, res) => {
    res.render('menu');
});

// RUTA TAREA 1: Placeholder
app.get('/tarea1', (req, res) => {
    // Puedes crear una vista tarea1.ejs después
    res.send('<h2>Tarea 1: Conceptos Cloud</h2><p>Documentación en proceso...</p><a href="/">Volver</a>');
});

// RUTA TAREA 2: El Inventario (Carga de DynamoDB)
app.get('/tarea2', async (req, res) => {
    try {
        const data = await docClient.send(new ScanCommand({ TableName: 'Equipos' }));
        res.render('tarea2', { equipos: data.Items || [] });
    } catch (err) {
        console.error("Error al obtener datos:", err);
        res.status(500).send("Error conectando a la base de datos.");
    }
});

// RUTA POST: Guardar el activo de la Tarea 2
app.post('/registrar-tarea2', upload.single('imagen'), async (req, res) => {
    if (!req.file) return res.status(400).send("No se subió ninguna imagen.");

    const { nombre, categoria, descripcion } = req.body;
    
    const nuevoEquipo = {
        id: crypto.randomUUID(), // Generación de ID único sin librerías externas
        nombre,
        categoria,
        descripcion,
        fotoUrl: req.file.location, // URL pública generada por S3
        fechaRegistro: new Date().toISOString()
    };

    try {
        await docClient.send(new PutCommand({ TableName: 'Equipos', Item: nuevoEquipo }));
        res.redirect('/tarea2');
    } catch (err) {
        console.error("Error al guardar:", err);
        res.status(500).send("Error al registrar el equipo.");
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de Innovación corriendo en puerto ${PORT}`);
});