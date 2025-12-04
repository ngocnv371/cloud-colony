import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Pawn, SkillType } from "../types";

export const generateRandomPawn = async (): Promise<Partial<Pawn>> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("No API_KEY found in environment variables. Returning fallback pawn.");
    return createFallbackPawn();
  }

  const ai = new GoogleGenAI({ apiKey });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The name of the colonist" },
      backstory: { type: Type.STRING, description: "A short, one-sentence backstory" },
      skills: {
        type: Type.OBJECT,
        properties: {
          [SkillType.CONSTRUCTION]: { type: Type.INTEGER },
          [SkillType.COOKING]: { type: Type.INTEGER },
          [SkillType.PLANTS]: { type: Type.INTEGER },
          [SkillType.MINING]: { type: Type.INTEGER },
          [SkillType.SOCIAL]: { type: Type.INTEGER },
          [SkillType.INTELLECTUAL]: { type: Type.INTEGER },
          [SkillType.MELEE]: { type: Type.INTEGER },
        },
        required: [
            SkillType.CONSTRUCTION,
            SkillType.COOKING,
            SkillType.PLANTS,
            SkillType.MINING,
            SkillType.SOCIAL,
            SkillType.INTELLECTUAL,
            SkillType.MELEE
        ]
      },
    },
    required: ["name", "backstory", "skills"],
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate a unique sci-fi colony simulator pawn with a name, a short backstory, and skill levels (0-20).",
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const data = JSON.parse(response.text || "{}");
    
    // Validate bounds
    const safeSkills = { ...data.skills };
    Object.keys(safeSkills).forEach(k => {
        safeSkills[k] = Math.max(0, Math.min(20, safeSkills[k]));
    });

    return {
      name: data.name,
      backstory: data.backstory,
      skills: safeSkills,
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    return createFallbackPawn();
  }
};

const createFallbackPawn = (): Partial<Pawn> => {
  const names = ["Val", "Jeb", "Bill", "Bob", "Alice"];
  return {
    name: names[Math.floor(Math.random() * names.length)],
    backstory: "A wanderer who joined without saying much.",
    skills: {
      [SkillType.CONSTRUCTION]: Math.floor(Math.random() * 10),
      [SkillType.COOKING]: Math.floor(Math.random() * 10),
      [SkillType.PLANTS]: Math.floor(Math.random() * 10),
      [SkillType.MINING]: Math.floor(Math.random() * 10),
      [SkillType.SOCIAL]: Math.floor(Math.random() * 10),
      [SkillType.INTELLECTUAL]: Math.floor(Math.random() * 10),
      [SkillType.MELEE]: Math.floor(Math.random() * 10),
    }
  };
};