// src/app/api/genkit/[...slug]/route.ts
import appRoute from '@genkit-ai/next';
import '@/ai/dev'; // Ensure flows are loaded
import { answerMedicalQuestionsFlow } from '@/ai/flows/answer-medical-questions';

// Use the Genkit API route handler
const routeHandler = appRoute(answerMedicalQuestionsFlow);
export { routeHandler as GET, routeHandler as POST };
