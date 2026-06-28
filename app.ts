import express, { Request, Response } from 'express';
import { MemoryManager } from './memory';
import { MetaClient } from './metaClient';
import { AgentManager } from './agent';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'zener_secret_token_2026';
const TECHNICAL_PHONE = '595981121588';

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

    if (userMessage.toLowerCase() === 'inicio' && session.metadata.status === 'conversando') {
      MemoryManager.clearSession(customerPhone);
      const initialSession = MemoryManager.getOrCreateSession(customerPhone);
      
      MemoryManager.addMessage(customerPhone, { role: 'user', content: userMessage });
      const agentResponse = await AgentManager.processMessage(initialSession.history, userMessage);
      MemoryManager.addMessage(customerPhone, { role: 'assistant', content: agentResponse.text });
      
      await MetaClient.sendTextMessage(customerPhone, agentResponse.text);
      return res.status(200).send('OK');
    }

    if (session.metadata.status === 'transferido' || session.metadata.status === 'descalificado') {
      return res.status(200).send('OK');
    }

    MemoryManager.addMessage(customerPhone, { role: 'user', content: userMessage });

    const result = await AgentManager.processMessage(session.history, userMessage);

    MemoryManager.addMessage(customerPhone, { role: 'assistant', content: result.text });

    await MetaClient.sendTextMessage(customerPhone, result.text);

    if (result.action === 'transferir' && result.metadata) {
      MemoryManager.updateMetadata(customerPhone, { status: 'transferido' });

      const linkParts = ['w', 'a', '.', 'm', 'e', '/'];
      const waLink = linkParts.join('') + customerPhone;

      const dataPayload = [
        `*NUEVO CLIENTE CALIFICADO*`,
        `📱 *Contacto*: ${waLink}`,
        `📍 *Ciudad*: ${result.metadata.ciudad || 'No especificada'}`,
        `📺 *Equipo*: ${result.metadata.marca || 'Falta'} - ${result.metadata.tamano || 'Falta'}`,
        `🛠️ *Síntoma*: ${result.metadata.sintoma || 'Falla bajo diagnóstico'}`
      ].join('\n');

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
