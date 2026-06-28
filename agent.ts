import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const token = process.env.OPENAI_API_KEY || '';
const openai = new OpenAI({ apiKey: token });

const SYSTEM_PROMPT = `Tu único objetivo es actuar como un motor cognitivo de extracción de hechos para un servicio técnico de televisores en Paraguay. Debes analizar de forma profunda el historial de conversación y el último mensaje del usuario para rellenar un objeto JSON estructurado con los datos reales que el cliente declare.

TOLERANCIA TOTAL A ERRORES ORTOGRÁFICOS Y MODISMOS:
Los clientes escriben con modismos o faltas graves (ej: "pantalla rrota", "rayas", "tynta", "se golpio", "caio", "nemby", "sanlo", "capiata", "luqe", "linpio"). Debes interpretar el significado real y mapearlo correctamente en las variables.

REGLAS DE EXTRACCIÓN DE HECHOS (CERO CONTRADICCIONES):
1. ciudad: Si el usuario menciona una localidad, colócala limpia (ej: "Luque", "Asunción"). Si no la ha dicho, déjala vacía "".
2. menciona_golpe_o_caida: Coloca true únicamente si el cliente declara explícitamente que el televisor sufrió una caída, choque, impacto físico o se golpeó.
3. sintoma_display: Coloca true si describe rayas, líneas verticales/horizontales, franjas, manchas de "tinta" derramada, pantalla que parpadea/tiembla, imagen doble, imagen congelada, o si la pantalla enciende mostrando una luz grisácea o blanca de fondo pero no da video.
4. sintoma_led: Coloca true si el cliente confirma que el televisor tiene sonido perfecto, tiene audio, reacciona al volumen, o si la pantalla se ve completamente oscura/apagada pero emite audio. También si se ve azulada/violeta, o si al alumbrar con linterna se ven siluetas al fondo.
5. sintoma_placa: Coloca true si el televisor está completamente muerto (standby apagado tras rayo/apagón), o si el standby enciende pero no responde al botón/control, o si se queda colgado en el logo de inicio en bucle, o si no abren las aplicaciones, o fallan los puertos HDMI/Wi-Fi.
6. marca_tamano: Coloca el texto con la marca y pulgadas del equipo si el cliente ya los proveyó (ej: "Samsung de 55"). Si no los sabe o faltan, déjala vacía "".
7. pregunto_faq: Coloca true únicamente si el cliente hizo una pregunta directa sobre garantía, métodos de pago, factura legal, o si cambiamos todos los LEDs individuales.

RESPUESTA OBLIGATORIA:
Debes responder ÚNICAMENTE con el objeto JSON crudo, sin textos, introducciones ni rellenos antes ni después. El formato debe ser estrictamente:
{
  "ciudad": string,
  "menciona_golpe_o_caida": boolean,
  "sintoma_display": boolean,
  "sintoma_led": boolean,
  "sintoma_placa": boolean,
  "marca_tamano": string,
  "pregunto_faq": boolean
}`;

export const AgentManager = {
  async processMessage(history: ChatCompletionMessageParam[], userMessage: string): Promise<{
    ciudad: string;
    menciona_golpe_o_caida: boolean;
    sintoma_display: boolean;
    sintoma_led: boolean;
    sintoma_placa: boolean;
    marca_tamano: string;
    pregunto_faq: boolean;
  }> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const reply = response.choices?.[0]?.message?.content || '{}';
    
    try {
      return JSON.parse(reply);
    } catch (e) {
      return {
        ciudad: '',
        menciona_golpe_o_caida: false,
        sintoma_display: false,
        sintoma_led: false,
        sintoma_placa: false,
        marca_tamano: '',
        pregunto_faq: false
      };
    }
  }
};
