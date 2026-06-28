import express, { Request, Response } from 'express';
import { MemoryManager } from './memory';
import { MetaClient } from './metaClient';
import { AgentManager } from './agent';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'zener_secret_token_2026';
const TECHNICAL_PHONE = '595981121588'; // Número del Técnico asignado

// 1. Verificación del Webhook de Meta (GET)
app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Recepción de Tráfico y Mensajes de WhatsApp (POST)
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      return res.sendStatus(200);
    }

    const messageData = body.entry[0].changes[0].value.messages[0];
    const customerPhone = messageData.from; // Identificador/Número del cliente

    // Ignorar si no es un mensaje de texto plano
    if (messageData.type !== 'text' || !messageData.text?.body) {
      return res.sendStatus(200);
    }

    const userMessage = messageData.text.body.trim();
    const session = MemoryManager.getOrCreateSession(customerPhone);

    // Si el cliente escribe "Inicio" en un estado apto, se resetea la memoria
    if (userMessage.toLowerCase() === 'inicio' && (session.metadata.status === 'conversando' || session.metadata.status === 'descalificado')) {
      MemoryManager.clearSession(customerPhone);
      const initialSession = MemoryManager.getOrCreateSession(customerPhone);
      const agentResponse = await AgentManager.processMessage(initialSession.history, userMessage);
      MemoryManager.addMessage(customerPhone, { role: 'user', content: userMessage });
      MemoryManager.addMessage(customerPhone, { role: 'assistant', content: agentResponse.text });
      await MetaClient.sendTextMessage(customerPhone, agentResponse.text);
      return res.sendStatus(200);
    }

    // Si la sesión ya fue transferida de forma definitiva, se ignora para no interrumpir al técnico
    if (session.metadata.status === 'transferido') {
      return res.sendStatus(200);
    }

    // Almacenar el mensaje entrante del usuario en su historial cognitivo
    MemoryManager.addMessage(customerPhone, { role: 'user', content: userMessage });

    // Procesar respuesta con el Agente de IA
    const result = await AgentManager.processMessage(session.history, userMessage);

    // Guardar la respuesta del asistente en la memoria
    MemoryManager.addMessage(customerPhone, { role: 'assistant', content: result.text });

    // Enviar la respuesta textual directa al cliente vía WhatsApp
    await MetaClient.sendTextMessage(customerPhone, result.text);

    // Evaluar acciones resultantes según las directrices de filtrado
    if (result.action === 'transferir' && result.metadata) {
      // Modificar estado para congelar el bot frente a este cliente calificado
      MemoryManager.updateMetadata(customerPhone, { status: 'transferido' });

      // Procedimiento Estricto: Construcción del enlace wa.me sin URLs continuas en código
      const linkParts = ['w', 'a', '.', 'm', 'e', '/'];
      const waLink = linkParts.join('') + customerPhone;

      // Estructuración rigurosa de los datos requeridos para el técnico
      const dataPayload = [
        `*NUEVO CLIENTE CALIFICADO*`,
        `📱 *Contacto*: ${waLink}`,
        `📍 *Ciudad*: ${result.metadata.ciudad || 'No especificada'}`,
        `📺 *Equipo*: ${result.metadata.marca || 'Falta'} - ${result.metadata.tamano || 'Falta'}`,
        `🛠️ *Síntoma*: ${result.metadata.sintoma || 'Falla bajo diagnóstico'}`
      ].join('\n');

      // Notificar de manera inmediata al técnico asignado de Zener mediante plantilla
      await MetaClient.sendTemplateTransfer(TECHNICAL_PHONE, dataPayload);

    } else if (result.action === 'descalificar') {
      // Fuera de cobertura: Se congela la sesión de forma definitiva para evitar reintentos de "Inicio"
      MemoryManager.updateMetadata(customerPhone, { status: 'transferido' });
      
    } else if (result.action === 'display_out') {
      // Falla de display: Mantiene estado conversando para dejar el canal abierto y procesar la palabra "Inicio"
      MemoryManager.updateMetadata(customerPhone, { status: 'conversando' });
    }

    return res.sendStatus(200);
  } catch (error) {
    // Retorno limpio a Meta para evitar retomas de reintentos infinitos por error 500
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // Inicialización exitosa del servidor Express
});
