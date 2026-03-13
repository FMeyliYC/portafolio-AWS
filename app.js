const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto'); // Nativo de Node.js (Soluciona el error de uuid)
const path = require('path');

const app = express();
const PORT = 3000; // Puerto interno para trabajar con Nginx

// CONFIGURACIÓN DE AWS (Región: São Paulo)
const REGION = "sa-east-1"; 
const BUCKET_NAME = "inventario-meyli"; 

const s3 = new S3Client({ region: REGION });
const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Multer para S3
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: BUCKET_NAME,
        acl: 'public-read',
        metadata: (req, file, cb) => { cb(null, { fieldName: file.fieldname }); },
        key: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    })
});

// RUTAS
app.get('/', (req, res) => { res.render('menu'); });
app.get('/tarea1', (req, res) => { res.render('tarea1'); });

app.get('/tarea2', async (req, res) => {
    try {
        const data = await docClient.send(new ScanCommand({ TableName: 'Equipos' }));
        res.render('tarea2', { equipos: data.Items || [] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al cargar datos de DynamoDB");
    }
});

app.post('/registrar-tarea2', upload.single('imagen'), async (req, res) => {
    if (!req.file) return res.status(400).send("Falta la imagen");
    const { nombre, categoria, descripcion } = req.body;
    const nuevoItem = {
        id: crypto.randomUUID(), 
        nombre, categoria, descripcion,
        fotoUrl: req.file.location,
        fecha: new Date().toISOString()
    };
    try {
        await docClient.send(new PutCommand({ TableName: 'Equipos', Item: nuevoItem }));
        res.redirect('/tarea2');
    } catch (err) {
        res.status(500).send("Error al guardar en BD");
    }
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));