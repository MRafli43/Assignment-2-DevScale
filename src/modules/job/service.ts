import z from "zod";
import { generateCompletion } from "@anvia/core";
import { getModel } from "../../llm/models";

const CopyWriterSchema = z.object({
    title: z.string(),
    description: z.string(),
    cost: z.string(),
});

const IdeaListSchema = z.object({
    idea: z.array(CopyWriterSchema),
});

const SYSTEM_INSTRUCTIONS = "You are a William Shakespeare. Your job is to generate advertising copywriting with title, description, and cost in JSON format."

export async function generateAdsIdea(
    product: string,
    media: string,
    category: string,
) {
    const PROMPT = `Generate a list of 2 adverstising copywriting ideas with title, description, and cost in JSON format. The idea should be based on the following information: ${product}, ${media}, and ${category}.`;

    const res = await generateCompletion({
        model: getModel(),
        prompt: PROMPT,
        instructions: SYSTEM_INSTRUCTIONS,
        outputSchema: IdeaListSchema,
    });

    return res.output;
}