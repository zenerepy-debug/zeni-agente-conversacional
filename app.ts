import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'zener_secret_token_2026';

// Ruta base de prueba de estado
app.get('/', (req: Request, res: Response) => {
    res.status(200).send('Servidor ZENI Activo');
});

// Validación del Webhook requerida por el panel de desarrolladores de Meta
app.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook validado con éxito ante Meta.');
            res.status(200).send(challenge);
            return;
        }
        res.sendStatus(403);
        return;
    }
    res.sendStatus(400);
});

// Receptor de mensajes de WhatsApp
app.post('/webhook', (req: Request, res: Response) => {
    const body = req.body;
    console.log('Evento entrante de Meta recibido:', JSON.stringify(body, null, 2));
    res.status(200).send('EVENT_RECEIVED');
});

app.listen(PORT, () => {
    console.log(`Servidor ZENI ejecutándose en el puerto ${PORT}`);
});
