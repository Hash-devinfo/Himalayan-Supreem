import { api } from './client';
import type { Province } from '../lib/pakistan';

export interface CityOption {
  _id: string;
  name: string;
  province: Province;
}

export const deliveryApi = {
  // Cities customers can choose (blocked cities left out). The server lets browsers cache it for 10 minutes.
  publicCities: () => api.get<{ success: true; cities: CityOption[] }>('/delivery/cities'),
};