// src/app/api/genkit/[...slug]/route.ts
import genkitApi from '@genkit-ai/next';
import '@/ai/dev'; // Ensure flows are loaded

// Use the Genkit API route handler
const routeHandler = genkitApi();
export { routeHandler as GET, routeHandler as POST };
