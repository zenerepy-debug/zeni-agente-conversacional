import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface UserSession {
  history: ChatCompletionMessageParam[];
  metadata: {
    // Control secuencial rígido del formulario interno
    estado_actual: 'esperando_ciudad_1' | 'esperando_ciudad_2' | 'esperando_categoria_falla' | 'esperando_subfalla_display_1' | 'esperando_subfalla_display_2' | 'esperando_subfalla_display_3' | 'esperando_subfalla_led_1' | 'esperando_subfalla_led_2' | 'esperando_subfalla_led_3' | 'esperando_subfalla_placa_1' | 'esperando_subfalla_placa_2' | 'esperando_marca' | 'esperando_tamano_1' | 'esperando_tamano_2';
    ciudad?: string;
    sintoma?: 'display' | 'led' | 'placa';
    falla_especifica?: string;
    marca?: string;
    tamano?: string;
    status: 'conversando' | 'calificado' | 'descalificado' | 'transferido';
  };
  lastInteraction: number;
}

const memoryStorage = new Map<string, UserSession>();

// Limpieza automática cada 60 minutos de sesiones inactivas para optimizar la RAM
setInterval(() => {
  const now = Date.now();
  const expirationTime = 60 * 60 * 1000;
  for (const [phone, session] of memoryStorage.entries()) {
    if (now - session.lastInteraction > expirationTime) {
      memoryStorage.delete(phone);
    }
  }
}, 15 * 60 * 1000);

export const MemoryManager = {
  getOrCreateSession(phone: string): UserSession {
    if (!memoryStorage.has(phone)) {
      memoryStorage.set(phone, {
        history: [],
        metadata: {
          estado_actual: 'esperando_ciudad_1',
          status: 'conversando',
          ciudad: '',
          sintoma: undefined,
          falla_especifica: '',
          marca: '',
          tamano: ''
        },
        lastInteraction: Date.now()
      });
    }
    const session = memoryStorage.get(phone)!;
    session.lastInteraction = Date.now();
    return session;
  },

  updateMetadata(phone: string, data: Partial<UserSession['metadata']>): void {
    const session = this.getOrCreateSession(phone);
    session.metadata = { ...session.metadata, ...data };
    session.lastInteraction = Date.now();
  },

  addMessage(phone: string, message: ChatCompletionMessageParam): void {
    const session = this.getOrCreateSession(phone);
    session.history.push(message);
    if (session.history.length > 40) {
      session.history.shift();
    }
    session.lastInteraction = Date.now();
  },

  clearSession(phone: string): void {
    memoryStorage.delete(phone);
  }
};
