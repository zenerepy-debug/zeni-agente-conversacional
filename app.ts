import express, { Request, Response } from 'express';
import { MemoryManager } from './memory';
import { MetaClient } from './metaClient';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'zener_secret_token_2026';
const TECHNICAL_PHONE = '595981121588';
const DEV_CLIENT_PHONE = '595982545922';

// =====================================================================
// DICCIONARIOS DE DATOS RÍGIDOS SIN SOBREPASAR LOS LÍMITES DE META API
// =====================================================================

const LISTA_CIUDADES_1 = [
  { id: 'c_asuncion', title: 'Asunción', description: 'Capital y barrios' },
  { id: 'c_lambare', title: 'Lambaré', description: 'Zonas de cobertura' },
  { id: 'c_villa_elisa', title: 'Villa Elisa', description: 'Zonas de cobertura' },
  { id: 'c_nemby', title: 'Ñemby', description: 'Zonas de cobertura' },
  { id: 'c_san_antonio', title: 'San Antonio', description: 'Zonas de cobertura' },
  { id: 'c_fdo_mora', title: 'Fernando de la Mora', description: 'Zona Norte y Sur' },
  { id: 'c_sig_1', title: 'Siguiente Lista ➡️', description: 'Ver más ciudades de cobertura' }
];

const LISTA_CIUDADES_2 = [
  { id: 'c_capiata', title: 'Capiatá', description: 'Ruta 1 y Ruta 2' },
  { id: 'c_san_lorenzo', title: 'San Lorenzo', description: 'Zonas de cobertura' },
  { id: 'c_aregua', title: 'Areguá', description: 'Zonas de cobertura' },
  { id: 'c_luque', title: 'Luque', description: 'Zonas de cobertura' },
  { id: 'c_limpio', title: 'Limpio', description: 'Zonas de cobertura' },
  { id: 'c_mra', title: 'Mariano Roque Alonso', description: 'Zonas de cobertura' },
  { id: 'c_descalificar', title: 'Otra ciudad/Interior', description: 'Fuera de zona de cobertura' }
];

const BOTONES_CATEGORIAS = [
  { id: 'cat_display', title: 'Falla de Display' },
  { id: 'cat_led', title: 'Falla de LEDs' },
  { id: 'cat_placa', title: 'Falla de Placa' }
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
const LISTA_DISPLAY = [
  { id: 'd_vidrio', title: 'Vidrio roto por golpe', description: 'Grietas por fuera, rajaduras internas o marcas de impactos' },
  { id: 'd_ilumina', title: 'Se ilumina sin imagen', description: 'La pantalla prende o da una luz clara pero no muestra letras' },
  { id: 'd_rayas_v', title: 'Rayas verticales', description: 'Líneas finas continuas de color verde, rojo o azul' },
  { id: 'd_rayas_h', title: 'Rayas horizontales', description: 'Líneas negras o de colores que cruzan de costado a costado' },
  { id: 'd_franja', title: 'Franja gruesa que tapa', description: 'Una barra oscura o blanca ancha bloquea un pedazo grande' },
  { id: 'd_mancha', title: 'Mancha de tinta', description: 'Manchas negras amorfas que parecen líquido derramado' },
  { id: 'd_tiembla', title: 'Imagen tiembla o salta', description: 'La imagen vibra, parpadea rápido o salta constantemente' },
  { id: 'd_doble', title: 'Imagen doble/congelada', description: 'Siluetas superpuestas o la imagen se queda pegada fija' },
  { id: 'd_partida', title: 'Imagen partida mitad', description: 'Un lado se ve perfecto y la otra mitad blanca o negra' },
  { id: 'd_cayo', title: 'La pantalla se cayó', description: 'El televisor se soltó del soporte o vino abajo del mueble' }
];

const LISTA_LED = [
  { id: 'l_oscura', title: 'Imagen muy oscura', description: 'Se escucha el sonido perfecto pero la imagen se quedó oscura' },
  { id: 'l_apagada', title: 'Imagen apagada', description: 'El volumen funciona bien pero la imagen está apagada' },
  { id: 'l_sin_luz', title: 'Imagen sin luz', description: 'Se nota que la tele prende por el audio pero no tiene luz' },
  { id: 'l_nada_luz', title: 'Imagen sin nada de luz', description: 'Se escucha la novela o el partido pero está sin nada de luz' },
  { id: 'l_bajo_b', title: 'Imagen con bajo brillo', description: 'La imagen se ve muy opaca y con un bajo brillo extremo' },
  { id: 'l_azul', title: 'Imagen azulada', description: 'La tele prende normal pero la imagen se ve azulada o celeste' },
  { id: 'l_puntos', title: 'Puntos brillantes fondo', description: 'La imagen da luz pero aparecen círculos brillantes fijos' },
  { id: 'l_flash', title: 'Flash de luz al prender', description: 'Da un destello rápido de luz y se vuelve a quedar apagada' },
  { id: 'l_rato', title: 'Sin luz al rato', description: 'La tele arranca bien pero a los minutos la imagen se apaga' },
  { id: 'l_parpadea', title: 'Brillo parpadea', description: 'La intensidad del brillo cambia y parpadea todo el tiempo' }
];
const LISTA_PLACA = [
  { id: 'p_muerto', title: 'Muerto sin luz', description: 'El equipo no enciende absolutamente nada, la luz roja está apagada' },
  { id: 'p_stby_f', title: 'Luz fija sin reaccionar', description: 'El standby enciende pero la tele no obedece al control' },
  { id: 'p_stby_i', title: 'Luz parpadea no prende', description: 'El piloto del frente parpadea infinito pero el TV nunca arranca' },
  { id: 'p_bucle', title: 'Bucle de reinicio', description: 'Muestra el logotipo unos segundos, se apaga solo y repite' },
  { id: 'p_congelado', title: 'Congelado en el logo', description: 'Se queda clavado en la pantalla de inicio con la marca' },
  { id: 'p_smart_c', title: 'Smart TV / Apps colgado', description: 'Pantalla colgada cargando el sistema o Netflix se cierra solo' },
  { id: 'p_hdmi', title: 'HDMI sin señal', description: 'Da video normal pero no reconoce decos, PCs o PlayStation' },
  { id: 'p_mudo', title: 'Mudo con imagen normal', description: 'Muestra canales y apps perfecto pero no emite ningún sonido' },
  { id: 'p_lluvia', title: 'Audio con ruido/lluvia', description: 'Por los parlantes sale un siseo fuerte o zumbido constante' },
  { id: 'p_rayo', title: 'Fallo por rayo o apagon', description: 'Dejó de funcionar tras tormenta o corta por calor tras minutos' }
];

const LISTA_MARCAS = [
  { id: 'm_samsung', title: 'Samsung', description: 'Incluye Sansung, Samzung, Sanzun' },
  { id: 'm_lg', title: 'LG', description: 'Incluye Elyi, Elgi, L.G' },
  { id: 'm_tokyo', title: 'Tokyo', description: 'Incluye Tokio, Toquio' },
  { id: 'm_tcl', title: 'TCL', description: 'Incluye Tecel, T.C.L' },
  { id: 'm_sony', title: 'Sony', description: 'Incluye Soni, Bravia' },
  { id: 'm_philips', title: 'Philips', description: 'Incluye Philip, Filis' },
  { id: 'm_aoc', title: 'AOC', description: 'Incluye A.O.C' },
  { id: 'm_hisense', title: 'Hisense', description: 'Incluye Haisens, Hisen' },
  { id: 'm_fama', title: 'Fama', description: 'Incluye Famatv' },
  { id: 'm_generica', title: 'Marca Genérica', description: 'Midas, Win, JVC, Jam, James, etc.' }
];

const LISTA_TAMANOS_1 = [
  { id: 't_32', title: '32 Pulgadas', description: 'Modelos de 32", 32p o treinta y dos' },
  { id: 't_39', title: '39 Pulgadas', description: 'Modelos de 39", 39p' },
  { id: 't_40', title: '40 Pulgadas', description: 'Modelos de 40", 40p o cuarenta' },
  { id: 't_42', title: '42 Pulgadas', description: 'Modelos de 42", 42p' },
  { id: 't_43', title: '43 Pulgadas', description: 'Modelos de 43", 43p o cuarenta y tres' },
  { id: 't_46', title: '46 Pulgadas', description: 'Modelos de 46", 46p' },
  { id: 't_47', title: '47 Pulgadas', description: 'Modelos de 47", 47p' },
  { id: 't_48', title: '48 Pulgadas', description: 'Modelos de 48", 48p' },
  { id: 't_49', title: '49 Pulgadas', description: 'Modelos de 49", 49p' },
  { id: 't_sig_1', title: 'Siguiente Lista ➡️', description: 'Ver pulgadas más grandes' }
];

const LISTA_TAMANOS_2 = [
  { id: 't_50', title: '50 Pulgadas', description: 'Modelos de 50", 50p o cincuenta' },
  { id: 't_55', title: '55 Pulgadas', description: 'Modelos de 55", 55p o cincuenta y cinco' },
  { id: 't_58', title: '58 Pulgadas', description: 'Modelos de 58", 58p' },
  { id: 't_60', title: '60 Pulgadas', description: 'Modelos de 60", 60p o sesenta' },
  { id: 't_65', title: '65 Pulgadas', description: 'Modelos de 65", 65p o sesenta y cinco' },
  { id: 't_70', title: '70 Pulgadas', description: 'Modelos de 70", 70p o setenta' },
  { id: 't_75', title: '75 Pulgadas', description: 'Modelos de 75", 75p o setenta y cinco' }
];
// 2. Recepción y Control del Webhook de WhatsApp (POST)
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body || !body.object || !body.entry || !body.entry[0] || !body.entry[0].changes || !body.entry[0].changes[0] || !body.entry[0].changes[0].value || !body.entry[0].changes[0].value.messages) {
      return res.status(200).send('OK');
    }

    const messageData = body.entry[0].changes[0].value.messages[0];
    const customerPhone = messageData.from;
    const session = MemoryManager.getOrCreateSession(customerPhone);

    let userMessage = '';
    let interactiveId = '';

    if (messageData.type === 'text' && messageData.text) {
      userMessage = messageData.text.body.trim();
    } else if (messageData.type === 'interactive' && messageData.interactive) {
      if (messageData.interactive.type === 'button_reply' && messageData.interactive.button_reply) {
        interactiveId = messageData.interactive.button_reply.id;
        userMessage = messageData.interactive.button_reply.title;
      } else if (messageData.interactive.type === 'list_reply' && messageData.interactive.list_reply) {
        interactiveId = messageData.interactive.list_reply.id;
        userMessage = messageData.interactive.list_reply.title;
      }
    }

    if (!userMessage && !interactiveId) {
      return res.status(200).send('OK');
    }

    const lowerMessage = userMessage.toLowerCase();

    // BYPASS SEGURO DE DESARROLLO (Borrado absoluto de caché de pruebas)
    if (lowerMessage === 'reiniciar' && customerPhone === DEV_CLIENT_PHONE) {
      MemoryManager.clearSession(customerPhone);
      const newSession = MemoryManager.getOrCreateSession(customerPhone);
      newSession.metadata.estado_actual = 'esperando_ciudad_1';
      
      await MetaClient.sendListMessage(customerPhone, '¡Hola! Te saluda ZENI de Zener Servicio Técnico. Para iniciar tu solicitud de asistencia a domicilio, por favor selecciona tu ciudad de residencia:', 'Zonas de Cobertura', [{ title: 'Ciudades Parte 1', rows: LISTA_CIUDADES_1 }]);
      return res.status(200).send('OK');
    }

    // COMANDO INICIO ESTÁNDAR: Habilitado para reabrir casos cerrados por display
    if (lowerMessage === 'inicio') {
      MemoryManager.clearSession(customerPhone);
      const newSession = MemoryManager.getOrCreateSession(customerPhone);
      newSession.metadata.estado_actual = 'esperando_ciudad_1';

      await MetaClient.sendListMessage(customerPhone, '¡Hola! Te saluda ZENI de Zener Servicio Técnico. Para iniciar tu solicitud de asistencia a domicilio, por favor selecciona tu ciudad de residencia:', 'Zonas de Cobertura', [{ title: 'Ciudades Parte 1', rows: LISTA_CIUDADES_1 }]);
      return res.status(200).send('OK');
    }

    if (session.metadata.status === 'transferido' || session.metadata.status === 'descalificado') {
      return res.status(200).send('OK');
    }
    // =====================================================================
    // MAQUINA DE ESTADOS SECUENCIAL RÍGIDA - FILTRO 1: CIUDADES
    // =====================================================================
    if (session.metadata.estado_actual === 'esperando_ciudad_1' || session.metadata.estado_actual === 'esperando_ciudad_2') {
      
      if (interactiveId === 'c_sig_1') {
        session.metadata.estado_actual = 'esperando_ciudad_2';
        await MetaClient.sendListMessage(customerPhone, 'Selecciona tu ciudad en esta segunda lista de cobertura disponible:', 'Zonas de Cobertura', [{ title: 'Ciudades Parte 2', rows: LISTA_CIUDADES_2 }]);
        return res.status(200).send('OK');
      }

      if (interactiveId === 'c_descalificar') {
        session.metadata.status = 'descalificado';
        const outZona = 'Lamentablemente, por el momento no contamos con cobertura en tu zona y tampoco recibimos televisores por encomienda desde el interior. ¡Gracias por tu comprensión!';
        await MetaClient.sendTextMessage(customerPhone, outZona);
        return res.status(200).send('OK');
      }

      if (interactiveId.startsWith('c_')) {
        session.metadata.ciudad = userMessage;
        session.metadata.estado_actual = 'esperando_categoria_falla';
        
        const msgCat = `¡Buenísimo! ${userMessage} está dentro de nuestra zona de cobertura a domicilio. Selecciona la categoría general de la falla de tu televisor:`;
        await MetaClient.sendButtonsMessage(customerPhone, msgCat, BOTONES_CATEGORIAS);
        return res.status(200).send('OK');
      }

      await MetaClient.sendListMessage(customerPhone, 'Por favor, debes seleccionar una opción válida desplegando la lista de zonas de cobertura para poder continuar:', 'Zonas de Cobertura', [{ title: 'Ciudades Parte 1', rows: LISTA_CIUDADES_1 }]);
      return res.status(200).send('OK');
    }

    // =====================================================================
    // FILTRO 2: EVALUACIÓN Y ENRUTAMIENTO GENERAL DE LA FALLA
    // =====================================================================
    if (session.metadata.estado_actual === 'esperando_categoria_falla') {
      
      if (interactiveId === 'cat_display') {
        session.metadata.sintoma = 'display';
        session.metadata.estado_actual = 'esperando_subfalla_display_1';
        await MetaClient.sendListMessage(customerPhone, 'Selecciona el síntoma o daño exacto relacionado con tu pantalla:', 'Síntomas Display', [{ title: 'Fallas de Display', rows: LISTA_DISPLAY }]);
        return res.status(200).send('OK');
      }

      if (interactiveId === 'cat_led') {
        session.metadata.sintoma = 'led';
        session.metadata.estado_actual = 'esperando_subfalla_led_1';
        await MetaClient.sendListMessage(customerPhone, 'Selecciona el síntoma exacto relacionado con la iluminación interna de tu televisor:', 'Síntomas LED', [{ title: 'Fallas de LEDs', rows: LISTA_LED }]);
        return res.status(200).send('OK');
      }

      if (interactiveId === 'cat_placa') {
        session.metadata.sintoma = 'placa';
        session.metadata.estado_actual = 'esperando_subfalla_placa_1';
        await MetaClient.sendListMessage(customerPhone, 'Selecciona el síntoma exacto relacionado con los componentes de la placa:', 'Síntomas Placa', [{ title: 'Fallas de Placa', rows: LISTA_PLACA }]);
        return res.status(200).send('OK');
      }

      await MetaClient.sendButtonsMessage(customerPhone, 'Por favor, selecciona una de las 3 opciones generales presionando un botón de la lista:', BOTONES_CATEGORIAS);
      return res.status(200).send('OK');
    }
    // =====================================================================
    // SUBMENÚS INTERACTIVOS - ANÁLISIS DE FALLAS ESPECÍFICAS COMPACTADAS
    // =====================================================================

    // --- GRUPO 1: SUBFALLAS DE DISPLAY (DESCALIFICACIÓN CASO CERRADO / CHAT ABIERTO) ---
    if (session.metadata.estado_actual === 'esperando_subfalla_display_1') {
      if (interactiveId.startsWith('d_')) {
        const msgDisplay = 'El síntoma que indicas corresponde a una falla de display. Lamentablemente, en Zener no reparamos ni cambiamos pantallas. Te comentamos que el costo de un panel original de repuesto supera el 80% o 90% del valor de un televisor nuevo de paquete, haciendo inviable la inversión. Si deseas consultar por un equipo diferente, puedes escribir la palabra "Inicio" para comenzar de nuevo.';
        await MetaClient.sendTextMessage(customerPhone, msgDisplay);
        return res.status(200).send('OK');
      }
    }

    // --- GRUPO 2: SUBFALLAS DE LED (CALIFICACIÓN) ---
    if (session.metadata.estado_actual === 'esperando_subfalla_led_1') {
      if (interactiveId.startsWith('l_')) {
        session.metadata.falla_especifica = userMessage;
        session.metadata.estado_actual = 'esperando_marca';
        await MetaClient.sendListMessage(customerPhone, 'El síntoma que indicas corresponde a una falla en los LED. ¿Cuál es la marca de tu televisor?', 'Marcas de TV', [{ title: 'Marcas Principales', rows: LISTA_MARCAS }]);
        return res.status(200).send('OK');
      }
    }

    // --- GRUPO 3: SUBFALLAS DE PLACA (CALIFICACIÓN) ---
    if (session.metadata.estado_actual === 'esperando_subfalla_placa_1') {
      if (interactiveId.startsWith('p_')) {
        session.metadata.falla_especifica = userMessage;
        session.metadata.estado_actual = 'esperando_marca';
        await MetaClient.sendListMessage(customerPhone, 'El síntoma que indicas corresponde a una falla de placa. ¿Cuál es la marca de tu televisor?', 'Marcas de TV', [{ title: 'Marcas Principales', rows: LISTA_MARCAS }]);
        return res.status(200).send('OK');
      }
    }

    // =====================================================================
    // FILTROS 3 Y 4: LOGÍSTICA DE RECOPILACIÓN DE MARCA Y TAMAÑO
    // =====================================================================

    // --- RECOPILACIÓN RÍGIDA DE MARCA ---
    if (session.metadata.estado_actual === 'esperando_marca') {
      if (interactiveId.startsWith('m_')) {
        session.metadata.marca = userMessage;
        session.metadata.estado_actual = 'esperando_tamano_1';
        
        await MetaClient.sendListMessage(customerPhone, `Registrado: ${userMessage}. Ahora selecciona las pulgadas numéricas exactas o el tamaño de tu televisor:`, 'Tamaños de TV', [{ title: 'Tamaños Parte 1', rows: LISTA_TAMANOS_1 }]);
        return res.status(200).send('OK');
      }
      
      await MetaClient.sendListMessage(customerPhone, 'Por favor, selecciona una marca de la lista desplegable para poder continuar:', 'Marcas de TV', [{ title: 'Marcas Principales', rows: LISTA_MARCAS }]);
      return res.status(200).send('OK');
    }

    // --- RECOPILACIÓN RÍGIDA DE TAMAÑO CON CONTINUIDAD Y DESPACHO FINAL ---
    if (session.metadata.estado_actual === 'esperando_tamano_1' || session.metadata.estado_actual === 'esperando_tamano_2') {
      
      if (interactiveId === 't_sig_1') {
        session.metadata.estado_actual = 'esperando_tamano_2';
        await MetaClient.sendListMessage(customerPhone, 'Selecciona el tamaño exacto en esta lista de pulgadas grandes:', 'Tamaños de TV', [{ title: 'Tamaños Parte 2', rows: LISTA_TAMANOS_2 }]);
        return res.status(200).send('OK');
      }

      if (interactiveId.startsWith('t_')) {
        session.metadata.tamano = userMessage;
        session.metadata.status = 'transferido';

        const tipoFalla = session.metadata.sintoma === 'led' ? 'en los LED' : 'de placa';
        const textSuccess = `Excelente, el síntoma que indicas corresponde a una falla ${tipoFalla}, un técnico asignado a tu caso te escribirá directamente desde su número para darte un presupuesto.`;
        
        await MetaClient.sendTextMessage(customerPhone, textSuccess);

        // PROCEDIMIENTO ESTRICTO: Descomposición de la URL base en caracteres individuales concatenados
        const linkParts = ['w', 'a', '.', 'm', 'e', '/'];
        const waLink = linkParts.join('') + customerPhone;
        
        const resumenSintoma = session.metadata.sintoma === 'led' 
          ? `Sistema de iluminación LED quemado (${session.metadata.falla_especifica})` 
          : `Falla electrónica en Placa (${session.metadata.falla_especifica})`;

        const dataPayload = [
          `*NUEVO CLIENTE CALIFICADO*`,
          `📱 *Contacto*: ${waLink}`,
          `📍 *Ciudad*: ${session.metadata.ciudad}`,
          `📺 *Equipo*: ${session.metadata.marca} de ${session.metadata.tamano}`,
          `🛠️ *Síntoma*: ${resumenSintoma}`
        ].join('\n');

        await MetaClient.sendTemplateTransfer(TECHNICAL_PHONE, dataPayload);
        return res.status(200).send('OK');
      }

      await MetaClient.sendListMessage(customerPhone, 'Por favor, selecciona un tamaño de la lista de pulgadas para finalizar tu solicitud:', 'Tamaños de TV', [{ title: 'Tamaños Parte 1', rows: LISTA_TAMANOS_1 }]);
      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  } catch (error) {
    return res.status(200).send('OK');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
});
