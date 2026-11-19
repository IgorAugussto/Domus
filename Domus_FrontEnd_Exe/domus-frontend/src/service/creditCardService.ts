import api from '../lib/api';

export interface CreditCard {
  id: number;
  brand: string;
  lastFourDigits: string;
  nickname?: string;
  active: boolean;
}

export interface CreditCardCreateInput {
  brand: string;
  lastFourDigits: string;
  nickname?: string;
}

export const creditCardService = {
  getAll: async (): Promise<CreditCard[]> => {
    const response = await api.get('/credit-cards');
    return response.data;
  },

  create: async (data: CreditCardCreateInput): Promise<CreditCard> => {
    const response = await api.post('/credit-cards', data);
    return response.data;
  },

  deactivate: async (id: number): Promise<void> => {
    await api.delete(`/credit-cards/${id}`);
  },
};
