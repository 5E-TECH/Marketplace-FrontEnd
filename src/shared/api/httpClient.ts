import axios from 'axios';

const DEFAULT_API_URL = '/api';

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? DEFAULT_API_URL,
  timeout: 10_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});
