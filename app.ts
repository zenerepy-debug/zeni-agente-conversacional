import express, { Request, Response } from 'express';
import { MemoryManager } from './memory';
import { MetaClient } from './metaClient';
import { AgentManager } from './agent';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'zener_secret_token_2026';
const TECHNICAL_PHONE = '595981121588';
const DEV_CLIENT_PHONE = '595982545922';

const CIUDADES_COBERTURA = [
  'asuncion', 'lambare', 'villa elisa', 'nemby', 'ñemby', 'san antonio', 
  'fernando', 'fdo', 'capiata', 'kapiata', 'san lorenzo', 'sanlo', 
  'aregua', 'luque', 'luqe', 'limpio', 'mariano', 'roque alonso'
];

app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body || !body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      return res.status(200).send('OK');
    }

    const messageData = body.entry[0].changes[0].value.messages[0];
    const customerPhone = messageData.from;

    if (messageData.type !== 'text' || !messageData.text?.body) {
      return res.status(200).send('OK');
    }

    const userMessage = messageData.text.body.trim();
    const session = MemoryManager.getOrCreateSession(customerPhone);
    const lowerMessage = userMessage.toLowerCase();

    // BYPASS SEGURO DE PRUEBAS PARA EL CLIENTE SIMULADO
    if (lowerMessage === 'reiniciar' && customerPhone === DEV_CLIENT_PHONE) {
      MemoryManager.clearSession(customerPhone);
      const cleanSession = MemoryManager.getOrCreateSession(customerPhone);
      MemoryManager.addMessage(customerPhone, { role: 'user', content: 'Hola' });
      const agentResponse = await AgentManager.processMessage(cleanSession.history, 'Hola');
      MemoryManager.addMessage(customerPhone, { role: 'assistant', content: agentResponse.text });
      await MetaClient.sendTextMessage(customerPhone, agentResponse.text);
      return res.status(200).send('OK');
    }

    // CONTROL DE REINICIO ESTÁNDAR TRAS DISPLAY
    if (lowerMessage === 'inicio' && session.metadata.status === 'conversando') {
      MemoryManager.clearSession(customerPhone);
      MemoryManager.addMessage(customerPhone, { role: 'user', content: 'Hola' });
      const initialSession = MemoryManager.getOrCreateSession(customerPhone);
      const agentResponse = await AgentManager.processMessage(initialSession.history, 'Hola');
      MemoryManager.addMessage(customerPhone, { role: 'assistant', content: agentResponse.text });
      await MetaClient.sendTextMessage(customerPhone, agentResponse.text);
      return res.status(200).send('OK');
    }

    // BLOQUEO ABSOLUTO EN PRODUCCIÓN
    if (session.metadata.status === 'transferido' || session.metadata.status === 'descalificado') {
      return res.status(200).send('OK');
    }

    const esCiudadValida = CIUDADES_COBERTURA.some(ciudad => lowerMessage.includes(ciudad));

    MemoryManager.addMessage(customerPhone, { role: 'user', content: userMessage });
    const result = await AgentManager.processMessage(session.history, userMessage);

    // INTERCEPCIÓN NATIVA DE CIUDADES EN COBERTURA
    if (result.action === 'descalificar' && esCiudadValida) {
      const overrideText = `¡Buenísimo! ${userMessage} está dentro de nuestra zona de cobertura a domicilio. ¿Cuál es el síntoma o problema que presenta tu televisor?`;
      MemoryManager.addMessage(customerPhone, { role: 'assistant', content: overrideText });
      await MetaClient.sendTextMessage(customerPhone, overrideText);
      MemoryManager.updateMetadata(customerPhone, { status: 'conversando' });
      return res.status(200).send('OK');
    }

    // Enviar la respuesta limpia al cliente
    MemoryManager.addMessage(customerPhone, { role: 'assistant', content: result.text });
    await MetaClient.sendTextMessage(customerPhone, result.text);

    // GESTIÓN DE ACCIONES Y TRANSFERENCIA AL TÉCNICO
    if (result.action === 'transferir') {
      MemoryManager.updateMetadata(customerPhone, { status: 'transferido' });

      // Procedimiento Estricto: Descomposición de la URL base wa.me en caracteres individuales concatenados
      const linkParts = ['w', 'a', '.', 'm', 'e', '/'];
      const waLink = linkParts.join('') + customerPhone;

      // Extracción limpia de metadatos desde el historial real para el resumen del técnico
      const findMetadata = (role: 'user' | 'assistant', keywords: string[]) => {
        const msg = session.history.find(h => h.role === role && keywords.some(k => String(h.content).toLowerCase().includes(k)));
        return msg ? String(msg.content) : '';
      };

      const ciudadResumen = findMetadata('user', CIUDADES_COBERTURA) || 'Verificar en chat';
      const sintomaResumen = result.category === 'led' ? 'Sistema de iluminación LED quemado' : 'Falla electrónica en Placa (Fuente/Main)';

      const dataPayload = [
        `*NUEVO CLIENTE CALIFICADO*`,
        `📱 *Contacto*: ${waLink}`,
        `📍 *Ciudad*: ${ciudadResumen}`,
        `📺 *Equipo*: ${userMessage}`,
        `🛠️ *Síntoma*: ${sintomaResumen}`
      ].join('\n');

      // Envío de la transferencia física a tu número a través del cliente Meta
      await MetaClient.sendTemplateTransfer(TECHNICAL_PHONE, dataPayload);

    } else if (result.action === 'descalificar') {
      MemoryManager.updateMetadata(customerPhone, { status: 'descalificado' });
      
    } else if (result.action === 'display_out') {
      MemoryManager.updateMetadata(customerPhone, { status: 'conversando' });
    }

    return res.status(200).send('OK');
  } catch (error) {
    return res.status(200).send('OK');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
});
