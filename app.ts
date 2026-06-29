import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@bot-whatsapp/bot';
import BaileysProvider from '@bot-whatsapp/provider/baileys';
import MockAdapter from '@bot-whatsapp/database/mock';

// ==========================================
// 1. CASILLEROS PUROS (Diccionarios Estrictos)
// ==========================================

export const CIUDADES_CASILLEROS = {
    "asuncion": { id: "ASU", nombre: "Asunción", zona: "Central" },
    "luque": { id: "LUQ", nombre: "Luque", zona: "Central" },
    "san_lorenzo": { id: "SLO", nombre: "San Lorenzo", zona: "Central" },
    "ciudad_del_este": { id: "CDE", nombre: "Ciudad del Este", zona: "Alto Paraná" }
} as const;

export const FALLAS_CASILLEROS = {
    "sin_conexion": { id: "ERR_NET", ticket: "Internet Caído", prioridad: "Alta" },
    "lentitud": { id: "ERR_SLOW", ticket: "Navegación Lenta", prioridad: "Media" },
    "intermitencia": { id: "ERR_DROP", ticket: "Cortes Frecuentes", prioridad: "Alta" },
    "configuracion_router": { id: "ERR_RTR", ticket: "Cambio de Clave/WiFi", prioridad: "Baja" }
} as const;

export const FAQS_CASILLEROS = {
    "metodos_pago": "Aceptamos tarjetas de crédito, débito, bocas de cobranza (Aquí Pago, Pago Express) y transferencias bancarias.",
    "horarios_atencion": "Nuestro soporte técnico atiende de lunes a domingos de 06:00 a 23:00 hs.",
    "requisitos_contrato": "Para contratar necesitas foto de tu cédula de identidad y una factura de servicios públicos.",
    "mudanza_servicio": "El traslado de línea tiene un costo operativo y requiere agendamiento con 48 horas de anticipación."
} as const;

// ==========================================
// 2. TIPOS ESTRICTOS (Derivados de los Casilleros)
// ==========================================

export type CiudadKey = keyof typeof CIUDADES_CASILLEROS;
export type FallaKey = keyof typeof FALLAS_CASILLEROS;
export type FaqKey = keyof typeof FAQS_CASILLEROS;

// ==========================================
// 3. CAPA DE VALIDACIÓN (Blindaje Antierrores)
// ==========================================

export const BlindajeAI = {
    obtenerCiudad: (key: string) => {
        const limpia = key.trim().toLowerCase() as CiudadKey;
        return CIUDADES_CASILLEROS[limpia] || null;
    },
    obtenerFalla: (key: string) => {
        const limpia = key.trim().toLowerCase() as FallaKey;
        return FALLAS_CASILLEROS[limpia] || null;
    },
    obtenerFaq: (key: string) => {
        const limpia = key.trim().toLowerCase() as FaqKey;
        return FAQS_CASILLEROS[limpia] || null;
    }
};
// ==========================================
// 4. SERVICIO DE IA (Extracción y Blindaje)
// ==========================================

// Interfaz para la respuesta estructurada de la IA
interface AnalisisUsuario {
    intencion: 'soporte' | 'faq' | 'ventas' | 'desconocido';
    ciudadDetectada: CiudadKey | null;
    fallaDetectada: FallaKey | null;
    faqDetectada: FaqKey | null;
}

export const IA_Service = {
    /**
     * Analiza el mensaje del cliente y mapea los datos a los casilleros puros.
     */
    analizarMensaje: async (mensajeCliente: string): Promise<AnalisisUsuario> => {
        try {
            // Listas de llaves válidas para inyectar en el prompt como opciones únicas
            const ciudadesValidas = Object.keys(CIUDADES_CASILLEROS).join(', ');
            const fallasValidas = Object.keys(FALLAS_CASILLEROS).join(', ');
            const faqsValidas = Object.keys(FAQS_CASILLEROS).join(', ');

            const prompt = `
                Analiza el siguiente mensaje de un cliente de internet y clasifícalo.
                
                Mensaje: "${mensajeCliente}"

                Opciones válidas para "ciudadDetectada": [${ciudadesValidas}]
                Opciones válidas para "fallaDetectada": [${fallasValidas}]
                Opciones válidas para "faqDetectada": [${faqsValidas}]

                Debes responder ESTRICTAMENTE con un objeto JSON con el siguiente formato, sin texto adicional:
                {
                    "intencion": "soporte" | "faq" | "ventas" | "desconocido",
                    "ciudadDetectada": "una_de_las_opciones_de_ciudad_o_null",
                    "fallaDetectada": "una_de_las_opciones_de_falla_o_null",
                    "faqDetectada": "una_de_las_opciones_de_faq_o_null"
                }
            `;

            // LLAMADA SIMULADA A TU PROVEEDOR DE IA (OpenAI, Gemini, Groq, etc.)
            // Reemplaza esto con tu implementación real (ej: openai.chat.completions.create)
            const respuestaRawDeIA = await mockLlamadaIA(prompt, mensajeCliente); 
            
            // Parsear la respuesta de la IA
            const resultadoJson = JSON.parse(respuestaRawDeIA);

            // Aplicar la capa de blindaje antierrores usando las llaves validadas
            return {
                intencion: resultadoJson.intencion || 'desconocido',
                ciudadDetectada: BlindajeAI.obtenerCiudad(resultadoJson.ciudadDetectada) ? (resultadoJson.ciudadDetectada as CiudadKey) : null,
                fallaDetectada: BlindajeAI.obtenerFalla(resultadoJson.fallaDetectada) ? (resultadoJson.fallaDetectada as FallaKey) : null,
                faqDetectada: BlindajeAI.obtenerFaq(resultadoJson.faqDetectada) ? (resultadoJson.faqDetectada as FaqKey) : null
            };

        } catch (error) {
            console.error("Error analizando con IA, cayendo en modo seguro:", error);
            // Retorno seguro en caso de fallo de red o JSON inválido de la IA
            return { intencion: 'desconocido', ciudadDetectada: null, fallaDetectada: null, faqDetectada: null };
        }
    }
};

// ==========================================
// 5. MOCK DE IA (Para pruebas del sistema)
// ==========================================
async function mockLlamadaIA(prompt: string, mensaje: string): Promise<string> {
    const msg = mensaje.toLowerCase();
    
    if (msg.includes('no tengo internet') || msg.includes('wifi caido')) {
        return JSON.stringify({ intencion: "soporte", ciudadDetectada: "luque", fallaDetectada: "sin_conexion", faqDetectada: null });
    }
    if (msg.includes('pagar') || msg.includes('boca de cobranza')) {
        return JSON.stringify({ intencion: "faq", ciudadDetectada: null, fallaDetectada: null, faqDetectada: "metodos_pago" });
    }
    
    return JSON.stringify({ intencion: "desconocido", ciudadDetectada: null, fallaDetectada: null, faqDetectada: null });
}
// ==========================================
// 6. FLUJOS DE BOT-WHATSAPP (Consumo del Blindaje)
// ==========================================

/**
 * Flujo secundario: Gestión automatizada de Soporte Técnico
 * Utiliza los datos del casillero puro para confirmar la orden de trabajo.
 */
const flujoSoporte = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, state }) => {
        const miEstado = state.getMyState();
        const ciudadKey = miEstado.ciudadDetectada as CiudadKey;
        const fallaKey = miEstado.fallaDetectada as FallaKey;

        // Recuperamos la metadata limpia y blindada de los casilleros
        const datosCiudad = CIUDADES_CASILLEROS[ciudadKey];
        const datosFalla = FALLAS_CASILLEROS[fallaKey];

        await flowDynamic([
            `🛠️ *Reporte Técnico Generado*`,
            `• *Problema:* ${datosFalla.ticket}`,
            `• *Prioridad:* ${datosFalla.prioridad}`,
            `• *Ciudad:* ${datosCiudad.nombre} (${datosCiudad.zona})`,
            `\nUn técnico verificará la señal en tu zona dentro de la brevedad.`
        ]);
    });

/**
 * Flujo secundario: Respuestas Instantáneas a FAQs
 */
const flujoFaq = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { flowDynamic, state }) => {
        const miEstado = state.getMyState();
        const faqKey = miEstado.faqDetectada as FaqKey;

        // Extraemos la respuesta exacta mapeada en el casillero
        const respuestaFaq = FAQS_CASILLEROS[faqKey];

        await flowDynamic(`💡 ${respuestaFaq}`);
    });

/**
 * Flujo Principal: Enrutador Inteligente con Blindaje AI
 */
const flujoPrincipal = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx, { gotoFlow, state, flowDynamic }) => {
        const mensajeUsuario = ctx.body;
        
        // Pasamos el texto por el filtro e IA
        const analisis = await IA_Service.analizarMensaje(mensajeUsuario);

        // Guardamos los datos validados en el estado del bot
        await state.update({
            intencion: analisis.intencion,
            ciudadDetectada: analisis.ciudadDetectada,
            fallaDetectada: analisis.fallaDetectada,
            faqDetectada: analisis.faqDetectada
        });

        // Enrutamiento seguro basado en los casilleros
        if (analisis.intencion === 'soporte' && analisis.ciudadDetectada && analisis.fallaDetectada) {
            return gotoFlow(flujoSoporte);
        }

        if (analisis.intencion === 'faq' && analisis.faqDetectada) {
            return gotoFlow(flujoFaq);
        }

        if (analisis.intencion === 'ventas') {
            return await flowDynamic("🚀 ¡Hola! En breve un asesor comercial te enviará nuestros planes disponibles.");
        }

        // Caída segura si la IA no extrajo los datos mínimos requeridos
        return await flowDynamic("Disculpa, no logré comprender tu solicitud. ¿Podrías ser más específico con tu consulta o tu ubicación?");
    });

// ==========================================
// 7. INICIALIZACIÓN DEL BOT
// ==========================================
async function iniciarBot() {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flujoPrincipal, flujoSoporte, flujoFaq]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });
    
    console.log("🤖 Bot blindado y ejecutándose correctamente.");
}

iniciarBot();
