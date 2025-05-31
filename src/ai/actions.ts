import { ai } from "@/ai/ai-instance";
import { AnswerMedicalQuestionsInputSchema, AnswerMedicalQuestionsOutputSchema, AnswerMedicalQuestionsInput, AnswerMedicalQuestionsOutput, answerMedicalQuestions } from "@/ai/flows/answer-medical-questions";
import { defineAction } from "genkit";

export const answerMedicalQuestionsAction = defineAction({
  name: "answerMedicalQuestions",
  inputSchema: AnswerMedicalQuestionsInputSchema,
  outputSchema: AnswerMedicalQuestionsOutputSchema,
},
async (input: AnswerMedicalQuestionsInput): Promise<AnswerMedicalQuestionsOutput> => {
  return answerMedicalQuestions(input);
});
