import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const token = process.env.OPENAI_API_KEY || '';
const openai = new OpenAI({ apiKey: token });

const SYSTEM_PROMPT = `Tu único objetivo es actuar como un motor cognitivo de extracción de hechos para un servicio técnico de televisores en Paraguay. Debes analizar el historial de conversación y el último mensaje del usuario para rellenar un objeto JSON estructurado con los datos reales que el cliente declare. Tienes strictly prohibido responder de forma directa al cliente, inventar diagnósticos o asumir fallas sin evidencia contundente.

TOLERANCIA TOTAL A ERRORES ORTOGRÁFICOS Y MODISMOS PARAGUAYOS:
Los clientes escriben apurados o con faltas de ortografía. Debes interpretar el significado real y mapearlo en las variables limpias del formulario interno.

DICCIONARIO DE CIUDADES (MAPEO OBLIGATORIO):
- "Asunción" si menciona: asuncion, asun, capital, sajonia, centro, dpc, barrio obrero, villamorra.
- "Lambaré" si menciona: lambare, lambar, yati, centro lambare, itati.
- "Villa Elisa" si menciona: villa elisa, v. elisa, villa eliza, elisa.
- "Ñemby" si menciona: ñemby, nemby, ñembi, nembi.
- "San Antonio" si menciona: san antonio, s. antonio, san antonio py.
- "Fernando de la Mora" si menciona: fernando, fdo, fdo de la mora, fernando zona norte, fernando zona sur.
- "Capiatá" si menciona: capiata, kapiata, ruta 1, ruta 2.
- "San Lorenzo" si menciona: san lorenzo, s. lorenzo, sanlo, mcal lópez.
- "Areguá" si menciona: aregua, centro aregua, estación, playa aregua.
- "Luque" si menciona: luque, luqe, centro luque, rincón, cañada, canada.
- "Limpio" si menciona: limpio, linpio, abasto norte.
- "Mariano Roque Alonso" si menciona: mariano, mra, roque alonso, shopping mariano.

REGLAS DE EXTRACCIÓN LÓGICA DE INTENCIONES:

1. ciudad: Si el usuario menciona un término del diccionario de ciudades, escribe el nombre oficial limpio y con su tilde. Si no la ha dicho, déjala vacía "".

2. menciona_golpe_o_caida: Coloca true únicamente si el cliente declara explícitamente un impacto físico: vidrio estrellado, fisura interna, punto de impacto, caída desde altura, impacto por objeto, presión excesiva o humedad en el borde inferior.

3. sintoma_display (DESCALIFICACIÓN FULMINANTE):
Coloca true únicamente si el cliente describe de forma contundente problemas de panel: rayas verticales de colores, rayas horizontales, franja gruesa negra, franja blanca fija, mancha de tinta, pantalla chorreada, imagen que tiembla, efecto estroboscópico, imagen doble, imagen congelada, pantalla en blanco uniforme, pantalla partida a la mitad o líneas que cambian al presionar el marco.
PROHIBICIÓN CRÍTICA: Frases ambiguas como "no se ve", "no da imagen" o "pantalla negra" NO pertenecen a esta variable, ya que la mayoría de las veces son fallas de LED. Solo marcarás true aquí si hay distorsión visual directa en el panel (rayas, manchas, golpes, temblores).`;
const SYSTEM_PROMPT_PART2 = `
4. sintoma_led (CALIFICACIÓN LED):
Coloca true si describe síntomas exactos de iluminación: pantalla totalmente oscura, pantalla sin nada de luz, sonido activo con pantalla oscura, control de volumen operativo, respuesta al control remoto (parpadeo de standby pero pantalla negra), imagen se ve apenitas/de fondo, siluetas con linterna (prueba de fondo), letras del menú al fondo con linterna, efecto pantalla azulada/violeta/morada, parpadeo inicial de luz (flash instantáneo), logotipo por un segundo y luego se apaga el video pero sigue el sonido, o si la luz de fondo se apaga al rato pero el audio continúa.
PROHIBICIÓN: Si el mensaje es únicamente una frase ambigua como "no se ve" o "se quedó negro" SIN mencionar que tiene sonido, reacciona al control o da destellos, DEBES dejar esta variable en false para que el sistema del servidor active la pregunta de escape.

5. sintoma_placa (CALIFICACIÓN PLACA):
Coloca true si describe fallas electrónicas: televisor totalmente muerto, luz de standby apagada por completo, fallo tras descarga por rayo, fallo tras corte de luz/bajón de tensión, standby fijo sin respuesta, standby intermitente infinito sin encender, bucle de reinicio infinito en el logo, congelado en el logo, smart tv colgado (carga de Android tildada), aplicaciones bloqueadas/tildadas, puertos HDMI sin señal, fallo de conexión Wi-Fi/Bluetooth, televisor mudo con imagen normal, sonido con lluvia o ruido extraño, apagado aleatorio (fallo térmico), no guarda configuraciones, prende solo, no responde a botones físicos u olor a quemado/chispazo.

6. marca (MAPEO OBLIGATORIO):
Mapea los modismos a su nombre comercial limpio ("Samsung", "LG", "Sony", "Philips", "AOC", "Hisense", "Tokyo", "Fama", "Midas", "Win", "Electrostar", "RDC", "Vack", "JVC", "Toshiba", "Hyundai", "Matsui", "TCL", "Panasonic", "Xiaomi", "Visivo", "Jam", "James", "Telefunken", "Diplomatic", "Skyworth", "RCA", "Sanyo", "Hitachi", "Daewoo", "Pioneer", "Aiwa", "Vizio"). 
Si menciona un supermercado o marca ultra extraña que no está aquí, escribe estrictamente "Marca Genérica". Si no ha mencionado ninguna marca aún, déjala vacía "".

7. tamano (MAPEO NUMÉRICO):
Extrae y escribe únicamente el número limpio de las pulgadas (ej: "32", "39", "40", "42", "43", "46", "47", "48", "49", "50", "55", "58", "60", "65", "70", "75"). Si el cliente escribe palabras como "treinta y dos" o usa letras como "32p", conviértelo a su cadena numérica "32". Si no dice el tamaño, déjalo vacío "".

8. pregunto_faq:
Coloca true únicamente si el cliente hace una pregunta directa sobre garantía, métodos de pago, costos de visita/presupuesto, o si cambiamos todos los LEDs individuales de forma completa.

RESPUESTA OBLIGATORIA:
Debes responder ÚNICAMENTE con el objeto JSON crudo, sin textos, comentarios ni bloques markdown antes ni después. El formato debe ser estrictamente:
{
  "ciudad": string,
  "menciona_golpe_o_caida": boolean,
  "sintoma_display": boolean,
  "sintoma_led": boolean,
  "sintoma_placa": boolean,
  "marca": string,
  "tamano": string,
  "pregunto_faq": boolean
}`;

export const AgentManager = {
  async processMessage(history: ChatCompletionMessageParam[], userMessage: string): Promise<{
    ciudad: string;
    menciona_golpe_o_caida: boolean;
    sintoma_display: boolean;
    sintoma_led: boolean;
    sintoma_placa: boolean;
    marca: string;
    tamano: string;
    pregunto_faq: boolean;
  }> {
    const fullPrompt = SYSTEM_PROMPT + SYSTEM_PROMPT_PART2;
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: fullPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ];

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const reply = response.choices[0]?.message?.content || '{}';
      return JSON.parse(reply.trim());
    } catch (error) {
      return {
        ciudad: '',
        menciona_golpe_o_caida: false,
        sintoma_display: false,
        sintoma_led: false,
        sintoma_placa: false,
        marca: '',
        tamano: '',
        pregunto_faq: false
      };
    }
  }
};
