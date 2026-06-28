import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface UserSession {
  history: ChatCompletionMessageParam[];
  metadata: {
    ciudad?: string;
    sintoma?: string;
    marca?: string;
    tamano?: string;
    status: 'conversando' | 'calificado' | 'descalificado' | 'transferido';
  };
  lastInteraction: number;
}

const memoryStorage = new Map<string, UserSession>();

// Limpieza automática cada 60 minutos de sesiones inactivas para optimizar la RAM del servidor
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
          status: 'conversando'
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
    
    // Control de contexto ampliado a 40 mensajes para retener ciudad y síntomas en chats largos sin pérdidas
    if (session.history.length > 40) {
      session.history.shift();
    }
    session.lastInteraction = Date.now();
  },

  clearSession(phone: string): void {
    memoryStorage.delete(phone);
  }
};
