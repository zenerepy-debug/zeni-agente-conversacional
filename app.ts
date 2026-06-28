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

// 1. Verificación obligatoria del Webhook de Meta (GET)
app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});
// 2. Recepción y Control del Webhook de WhatsApp (POST)
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

    // BYPASS SEGURO DE DESARROLLO (Borrado absoluto de caché de pruebas)
    if (lowerMessage === 'reiniciar' && customerPhone === DEV_CLIENT_PHONE) {
      MemoryManager.clearSession(customerPhone);
      MemoryManager.getOrCreateSession(customerPhone);
      const openMessage = '¡Hola! Te saluda ZENI de Zener Servicio Técnico. ¿En qué ciudad te encuentras?';
      MemoryManager.addMessage(customerPhone, { role: 'assistant', content: openMessage });
      await MetaClient.sendTextMessage(customerPhone, openMessage);
      return res.status(200).send('OK');
    }

    // COMANDO INICIO ESTÁNDAR (Canal abierto únicamente tras Falla de Display)
    if (lowerMessage === 'inicio' && session.metadata.status === 'conversando') {
      MemoryManager.clearSession(customerPhone);
      MemoryManager.getOrCreateSession(customerPhone);
      const openMessage = '¡Hola! Te saluda ZENI de Zener Servicio Técnico. ¿En qué ciudad te encuentras?';
      MemoryManager.addMessage(customerPhone, { role: 'assistant', content: openMessage });
      await MetaClient.sendTextMessage(customerPhone, openMessage);
      return res.status(200).send('OK');
    }

    // BLOQUEO PREVENTIVO ABSOLUTO: Si ya fue transferido o descalificado, el bot se apaga
    if (session.metadata.status === 'transferido' || session.metadata.status === 'descalificado') {
      return res.status(200).send('OK');
    }

    // Registrar en memoria y llamar al transcriptor cognitivo de hechos
    MemoryManager.addMessage(customerPhone, { role: 'user', content: userMessage });
    const datos = await AgentManager.processMessage(session.history, userMessage);

    // =====================================================================
    // FILTRO 1: LOGÍSTICA DE COBERTURA GEOGRÁFICA (DETERMINISTA POR CÓDIGO)
    // =====================================================================
    if (!session.metadata.ciudad) {
      if (datos.ciudad) {
        const ciudadLimpia = datos.ciudad.toLowerCase();
        const esValida = CIUDADES_COBERTURA.some(c => ciudadLimpia.includes(c));

        if (esValida) {
          session.metadata.ciudad = datos.ciudad;
          const nextMsg = `¡Buenísimo! ${datos.ciudad} está dentro de nuestra zona de cobertura a domicilio. ¿Cuál es el síntoma o problema que presenta tu televisor?`;
          MemoryManager.addMessage(customerPhone, { role: 'assistant', content: nextMsg });
          await MetaClient.sendTextMessage(customerPhone, nextMsg);
          return res.status(200).send('OK');
        } else {
          session.metadata.status = 'descalificado';
          const outZona = `Lamentablemente, por el momento no contamos con cobertura en ${datos.ciudad} y tampoco recibimos televisores por encomienda desde el interior. ¡Gracias por tu comprensión!`;
          MemoryManager.addMessage(customerPhone, { role: 'assistant', content: outZona });
          await MetaClient.sendTextMessage(customerPhone, outZona);
          return res.status(200).send('OK');
        }
      } else {
        const pedirCiudad = '¿En qué ciudad te encuentras?';
        await MetaClient.sendTextMessage(customerPhone, pedirCiudad);
        return res.status(200).send('OK');
      }
    }
    // =====================================================================
    // INTERCEPCIÓN DE RESPUESTAS REACTIVAS (FAQs NATIVAS POR CÓDIGO)
    // =====================================================================
    if (datos.pregunto_faq) {
      if (lowerMessage.includes('garantia') || lowerMessage.includes('garantía')) {
        const msgGarantia = 'Todas las reparaciones cuentan con 6 meses de garantía escrita, la cual cubre tanto la mano de obra como el repuesto cambiado.';
        await MetaClient.sendTextMessage(customerPhone, msgGarantia);
        return res.status(200).send('OK');
      }
      if (lowerMessage.includes('todos los led') || lowerMessage.includes('cambian todos')) {
        const msgLeds = 'Sí, nuestra política de calidad es realizar el cambio completo de todos los LED de forma individual para garantizar un trabajo de fábrica.';
        await MetaClient.sendTextMessage(customerPhone, msgLeds);
        return res.status(200).send('OK');
      }
      if (lowerMessage.includes('precio') || lowerMessage.includes('cuanto') || lowerMessage.includes('costo') || lowerMessage.includes('presupuesto')) {
        const msgPresupuesto = 'Con gusto, el servicio técnico se encargará de darte el presupuesto final y coordinar el día y horario de la visita en un momento.';
        await MetaClient.sendTextMessage(customerPhone, msgPresupuesto);
        return res.status(200).send('OK');
      }
    }

    // =====================================================================
    // FILTRO 2: EVALUACIÓN DE SÍNTOMAS Y PRE-VERIFICACIÓN (SOFTWARE SOBERANO)
    // =====================================================================
    if (!session.metadata.sintoma) {
      // 1. PRIORIDAD MÁXIMA GOLPES/DISPLAY: Aborta en el acto sin pasos innecesarios
      if (datos.menciona_golpe_o_caida || datos.sintoma_display) {
        session.metadata.sintoma = 'display';
        const msgDisplay = 'El síntoma que indicas corresponde a una falla de display. Lamentablemente, en Zener no reparamos ni cambiamos pantallas. Te comentamos que el costo de un panel original de repuesto supera el 80% o 90% del valor de un televisor nuevo de paquete, haciendo inviable la inversión. Si deseas consultar por un equipo diferente, puedes escribir la palabra "Inicio" para comenzar de nuevo.';
        MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgDisplay });
        await MetaClient.sendTextMessage(customerPhone, msgDisplay);
        return res.status(200).send('OK');
      }

      // 2. PRIORIDAD MEDIA ILUMINACIÓN LED: Frena y obliga a verificar el estado físico antes de calificar
      if (datos.sintoma_led) {
        const yaVerificoTexto = lowerMessage.includes('oscura') || lowerMessage.includes('apagada') || lowerMessage.includes('fondo') || lowerMessage.includes('muerto') || lowerMessage.includes('linterna');
        
        if (!yaVerificoTexto) {
          const msgVerificar = '¿La pantalla está totalmente oscura/apagada o tiene alguna iluminación grisácea, parpadeo o rayas?';
          MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgVerificar });
          await MetaClient.sendTextMessage(customerPhone, msgVerificar);
          return res.status(200).send('OK');
        } else {
          session.metadata.sintoma = 'led';
          const msgLed = 'El síntoma que indicas corresponde a una falla en los LED. ¿Cuál es la marca de tu televisor?';
          MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgLed });
          await MetaClient.sendTextMessage(customerPhone, msgLed);
          return res.status(200).send('OK');
        }
      }

      // 3. PRIORIDAD BAJA PLACA ELECTRONICA (FUENTE O MAIN)
      if (datos.sintoma_placa) {
        session.metadata.sintoma = 'placa';
        const msgPlaca = 'El síntoma que indicas corresponde a una falla de placa. ¿Cuál es la marca de tu televisor?';
        MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgPlaca });
        await MetaClient.sendTextMessage(customerPhone, msgPlaca);
        return res.status(200).send('OK');
      }

      // Pregunta de escape fija en caso de desvíos extremos o ambigüedad
      const msgDuda = '¿Me podrías precisar un detalle? ¿El televisor emite sonido de fondo, se queda completamente muerto sin dar luces ni piloto, o presenta alguna línea o raya en la pantalla?';
      await MetaClient.sendTextMessage(customerPhone, msgDuda);
      return res.status(200).send('OK');
    }

    // =====================================================================
    // FILTROS 3 Y 4: LOGÍSTICA CRONOLÓGICA DE MARCA Y TAMAÑO
    // =====================================================================
    if (session.metadata.sintoma === 'led' || session.metadata.sintoma === 'placa') {
      // Si ya tenemos la marca guardada en metadata, el mensaje actual corresponde al tamaño
      if (session.metadata.marca) {
        const tipoFalla = session.metadata.sintoma === 'led' ? 'en los LED' : 'de placa';
        const textSuccess = `Excelente, el síntoma que indicas corresponde a una falla ${tipoFalla}, un técnico asignado a tu caso te escribirá directamente desde su número para darte un presupuesto.`;
        
        session.metadata.status = 'transferido';
        MemoryManager.addMessage(customerPhone, { role: 'assistant', content: textSuccess });
        await MetaClient.sendTextMessage(customerPhone, textSuccess);

        // PROCEDIMIENTO ESTRICTO DE OFUSCACIÓN: Descomposición de la URL base wa.me en caracteres individuales
        const linkParts = ['w', 'a', '.', 'm', 'e', '/'];
        const waLink = linkParts.join('') + customerPhone;
        const resumenSintoma = session.metadata.sintoma === 'led' ? 'Sistema de iluminación LED quemado' : 'Falla electrónica en Placa (Fuente/Main)';

        const dataPayload = [
          `*NUEVO CLIENTE CALIFICADO*`,
          `📱 *Contacto*: ${waLink}`,
          `📍 *Ciudad*: ${session.metadata.ciudad}`,
          `📺 *Equipo*: ${session.metadata.marca} de ${userMessage}`,
          `🛠️ *Síntoma*: ${resumenSintoma}`
        ].join('\n');

        // Ejecutar despacho de transferencia física al WhatsApp del técnico sin errores de tipado
        await MetaClient.sendTemplateTransfer(TECHNICAL_PHONE, dataPayload);
        return res.status(200).send('OK');
      } else {
        // Guardamos la marca y avanzamos estrictamente al tamaño
        if (datos.marca || userMessage.length > 2) {
          session.metadata.marca = datos.marca || userMessage;
          const pedirPulgadas = '¿Y de cuántas pulgadas sería?';
          MemoryManager.addMessage(customerPhone, { role: 'assistant', content: pedirPulgadas });
          await MetaClient.sendTextMessage(customerPhone, pedirPulgadas);
          return res.status(200).send('OK');
        } else {
          const pedirMarca = '¿De qué marca es tu televisor? Si no la sabes, puedes enviarme una foto de la etiqueta trasera.';
          await MetaClient.sendTextMessage(customerPhone, pedirMarca);
          return res.status(200).send('OK');
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    return res.status(200).send('OK');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
});
