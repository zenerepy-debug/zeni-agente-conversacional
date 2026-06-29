import express, { Request, Response } from 'express';
import { MemoryManager } from './memory';
import { MetaClient } from './metaClient';
import { AgentManager } from './agent';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'zener_secret_token_2026';
const TECHNICAL_PHONE = '595981121588';
const DEV_CLIENT_PHONE = '595982545922';

// Lista rígida de ciudades de cobertura para validación de casilleros en el servidor
const CIUDADES_COBERTURA = [
  'asuncion', 'lambare', 'villa elisa', 'nemby', 'san antonio', 
  'fernando de la mora', 'capiata', 'san lorenzo', 'aregua', 'luque', 
  'limpio', 'mariano roque alonso'
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

    if (!body || !body.object || !body.entry?.?[0]?.changes?.?[0]?.value?.messages?.[0]) {
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

    // BLOQUEO PREVENTIVO ABSOLUTO: Si ya fue transferido o descalificado, el bot se apaga por completo
    if (session.metadata.status === 'transferido' || session.metadata.status === 'descalificado') {
      return res.status(200).send('OK');
    }

    // Registrar mensaje en la memoria RAM e invocar al extractor cognitivo de la IA
    MemoryManager.addMessage(customerPhone, { role: 'user', content: userMessage });
    const datos = await AgentManager.processMessage(session.history, userMessage);

    // =====================================================================
    // FILTRO 1: LOGÍSTICA DE COBERTURA GEOGRÁFICA (DETERMINISTA POR CASILLERO)
    // =====================================================================
    if (!session.metadata.ciudad) {
      if (datos.ciudad) {
        // Se limpia de acentos y tildes la respuesta estructurada de la IA para un cruce exacto
        const ciudadLimpiaIA = datos.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const esValida = CIUDADES_COBERTURA.some(c => {
          const ciudadListaLimpia = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return ciudadLimpiaIA === ciudadListaLimpia || ciudadLimpiaIA.includes(ciudadListaLimpia);
        });

        if (esValida) {
          session.metadata.ciudad = datos.ciudad; // Guarda el nombre de ciudad limpio de la IA
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
    // INTERCEPCIÓN DE RESPUESTAS REACTIVAS (FAQs COGNITIVAS POR CASILLERO)
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
    // FILTRO 2: MATRIZ DE SÍNTOMAS JERÁRQUICA GUIADA POR SOFTWARE
    // =====================================================================
    if (!session.metadata.sintoma) {
      // 1. PRIORIDAD MÁXIMA PANTALLAS ROTAS/DISPLAY: Aborta de forma fulminante por casillero
      if (datos.menciona_golpe_o_caida || datos.sintoma_display) {
        session.metadata.sintoma = 'display';
        const msgDisplay = 'El síntoma que indicas corresponds a una falla de display. Lamentablemente, en Zener no reparamos ni cambiamos pantallas. Te comentamos que el costo de un panel original de repuesto supera el 80% o 90% del valor de un televisor nuevo de paquete, haciendo inviable la inversión. Si deseas consultar por un equipo diferente, puedes escribir la palabra "Inicio" para comenzar de nuevo.';
        MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgDisplay });
        await MetaClient.sendTextMessage(customerPhone, msgDisplay);
        return res.status(200).send('OK');
      }

      // 2. PRIORIDAD MEDIA ILUMINACIÓN LED: El software fuerza la repregunta de control humana
      if (datos.sintoma_led) {
        // En lugar de leer el chat sucio, validamos si la propia IA ya extrajo confirmación física o si es el primer mensaje ambiguo
        if (!lowerMessage.includes('oscura') && !lowerMessage.includes('apagada') && !lowerMessage.includes('fondo') && !lowerMessage.includes('muerto') && !lowerMessage.includes('linterna')) {
          const msgVerificar = '¿La pantalla está totalmente oscura/apagada o tiene alguna iluminación grisácea, parpadeo o rayas?';
          MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgVerificar });
          await MetaClient.sendTextMessage(customerPhone, msgVerificar);
          return res.status(200).send('OK');
        } else {
          session.metadata.sintoma = 'led';
          const msgLed = 'El síntoma que indicas corresponde a una falla en los LED. ¿Cuál es la marca y el tamaño en pulgadas de tu televisor? (Ejemplo: Samsung de 55)';
          MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgLed });
          await MetaClient.sendTextMessage(customerPhone, msgLed);
          return res.status(200).send('OK');
        }
      }

      // 3. PRIORIDAD BAJA PLACA ELECTRÓNICA
      if (datos.sintoma_placa) {
        session.metadata.sintoma = 'placa';
        const msgPlaca = 'El síntoma que indicas corresponde a una falla de placa. ¿Cuál es la marca y el tamaño en pulgadas de tu televisor? (Ejemplo: LG de 43)';
        MemoryManager.addMessage(customerPhone, { role: 'assistant', content: msgPlaca });
        await MetaClient.sendTextMessage(customerPhone, msgPlaca);
        return res.status(200).send('OK');
      }

      // Pregunta fija de escape si el casillero de la IA no encuentra coincidencias seguras
      const msgDuda = '¿Me podrías precisar un detalle? ¿El televisor emite sonido de fondo, se queda completamente muerto sin dar luces ni piloto, o presenta alguna línea o raya en la pantalla?';
      await MetaClient.sendTextMessage(customerPhone, msgDuda);
      return res.status(200).send('OK');
    }
    // =====================================================================
    // FILTROS 3 Y 4: LOGÍSTICA DE RECOPILACIÓN UNIFICADA Y TRANSFERENCIA
    // =====================================================================
    if (session.metadata.sintoma === 'led' || session.metadata.sintoma === 'placa') {
      // Evaluamos el casillero o la longitud del mensaje para recolectar marca y tamaño en un solo paso
      if (datos.marca || datos.tamano || userMessage.length > 3) {
        const tipoFalla = session.metadata.sintoma === 'led' ? 'en los LED' : 'de placa';
        const textSuccess = `Excelente, el síntoma que indicas corresponde a una falla ${tipoFalla}, un técnico asignado a tu caso te escribirá directamente desde su número para darte un presupuesto.`;
        
        session.metadata.status = 'transferido';
        MemoryManager.addMessage(customerPhone, { role: 'assistant', content: textSuccess });
        await MetaClient.sendTextMessage(customerPhone, textSuccess);

        // Procedimiento Estricto: Descomposición de la URL base wa.me en caracteres individuales
        const linkParts = ['w', 'a', '.', 'm', 'e', '/'];
        const waLink = linkParts.join('') + customerPhone;
        const resumenSintoma = session.metadata.sintoma === 'led' ? 'Sistema de iluminación LED quemado' : 'Falla electrónica en Placa (Fuente/Main)';

        const dataPayload = [
          `*NUEVO CLIENTE CALIFICADO*`,
          `📱 *Contacto*: ${waLink}`,
          `📍 *Ciudad*: ${session.metadata.ciudad}`,
          `📺 *Equipo*: ${userMessage}`,
          `🛠️ *Síntoma*: ${resumenSintoma}`
        ].join('\n');

        // Despacho directo por red mediante mensaje de texto plano nativo al WhatsApp del técnico
        await MetaClient.sendTemplateTransfer(TECHNICAL_PHONE, dataPayload);
        return res.status(200).send('OK');
      } else {
        const pedirDatos = '¿Me confirmarías la marca y el tamaño en pulgadas de tu televisor?';
        await MetaClient.sendTextMessage(customerPhone, pedirDatos);
        return res.status(200).send('OK');
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
