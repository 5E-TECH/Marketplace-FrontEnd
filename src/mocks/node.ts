import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Vitest: komponent va API testlari dev bilan bir xil mock javoblarni oladi. */
export const server = setupServer(...handlers);
