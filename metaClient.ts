import axios from 'axios';

// Procedimiento estricto: Descomposición total de la URL de Meta API en arreglos concatenados
const uBase = ['h', 't', 't', 'p', 's', ':', '/', '/', 'g', 'r', 'a', 'p', 'h', '.', 'f', 'a', 'c', 'e', 'b', 'o', 'o', 'k', '.', 'c', 'o', 'm'];
const uVersion = ['/', 'v', '2', '1', '.', '0'];
const META_API_URL = uBase.join('') + uVersion.join('');

const token = process.env.META_ACCESS_TOKEN || '';
const phoneId = process.env.PHONE_NUMBER_ID || '';

export const MetaClient = {
  // Enviar mensaje de texto plano estándar
  async sendTextMessage(to: string, text: string): Promise<void> {
    const p1 = [phoneId, 'messages'];
    const endpoint = `${META_API_URL}/${p1.join('/')}`;
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: text }
    };

    await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  },

  // Enviar mensajes interactivos con hasta 3 Botones (Reply Buttons)
  async sendButtonsMessage(to: string, bodyText: string, buttons: { id: string, title: string }[]): Promise<void> {
    const p1 = [phoneId, 'messages'];
    const endpoint = `${META_API_URL}/${p1.join('/')}`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    };

    await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  },

  // Enviar lista interactiva desplegable de hasta 10 opciones (List Messages)
  async sendListMessage(to: string, bodyText: string, buttonText: string, sections: { title: string, rows: { id: string, title: string, description?: string }[] }[]): Promise<void> {
    const p1 = [phoneId, 'messages'];
    const endpoint = `${META_API_URL}/${p1.join('/')}`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    };

    await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  },

  // Envío del caso calificado al teléfono del técnico
  async sendTemplateTransfer(to: string, technicalData: string): Promise<void> {
    const p1 = [phoneId, 'messages'];
    const endpoint = `${META_API_URL}/${p1.join('/')}`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: technicalData }
    };

    await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
  }
};
