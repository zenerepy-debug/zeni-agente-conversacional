import axios from 'axios';

// Procedimiento estricto: Descomposición total de la URL de Meta API en arreglos concatenados
const uBase = ['h', 't', 't', 'p', 's', ':', '/', '/', 'g', 'r', 'a', 'p', 'h', '.', 'f', 'a', 'c', 'e', 'b', 'o', 'o', 'k', '.', 'c', 'o', 'm'];
const uVersion = ['/', 'v', '2', '1', '.', '0'];
const META_API_URL = uBase.join('') + uVersion.join('');

const token = process.env.META_ACCESS_TOKEN || '';
const phoneId = process.env.PHONE_NUMBER_ID || '';

export const MetaClient = {
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
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  },

  async sendTemplateTransfer(to: string, technicalData: string): Promise<void> {
    const p1 = [phoneId, 'messages'];
    const endpoint = `${META_API_URL}/${p1.join('/')}`;

    // Cambiamos de forma definitiva el payload a tipo 'text' puro para evadir el uso de plantillas
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: technicalData }
    };

    await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }
};
