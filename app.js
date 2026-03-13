require('dotenv').config(); // Carga las variables del archivo .env
const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 80; // Usa 3000 si pruebas en tu laptop, 80 para la EC2

// 1. CONFIGURACIÓN DE AWS CON CREDENCIALES EXPLÍCITAS
const awsConfig = {
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
    }
};

const s3 = new S3Client(awsConfig);
const ddbClient = new DynamoDBClient(awsConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Configuración de subida a S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.BUCKET_NAME,
    acl: 'public-read',
    metadata: (req, file, cb) => { cb(null, { fieldName: file.fieldname }); },
    key: (req, file, cb) => {
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
    res.send('<h2>Tarea 1: En construcción...</h2><a href="/">Volver</a>');
});

// RUTA TAREA 2: El Inventario (Carga de DynamoDB)
app.get('/tarea2', async (req, res) => {
  try {
    const data = await docClient.send(new ScanCommand({ TableName: 'Equipos' }));
    res.render('tarea2', { equipos: data.Items || [] });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error conectando a DynamoDB. Revisa tus credenciales.");
  }
});

// RUTA POST: Guardar el activo de la Tarea 2
app.post('/registrar-tarea2', upload.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).send("Falta la imagen.");

  const { nombre, categoria, descripcion } = req.body;
  const nuevoEquipo = {
    id: uuidv4(), nombre, categoria, descripcion,
    fotoUrl: req.file.location,
    fechaRegistro: new Date().toISOString()
  };

  try {
    await docClient.send(new PutCommand({ TableName: 'Equipos', Item: nuevoEquipo }));
    res.redirect('/tarea2');
  } catch (err) {
    res.status(500).send("Error al guardar en BD");
  }
});

app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));