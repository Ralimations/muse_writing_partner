
import { GoogleGenAI, Type } from "@google/genai";
import { Attachment, WritingAction, WritingMode } from "../types";

// Always use a new instance to ensure the latest API key is used
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const simpleMdToHtml = (text: string): string => {
  // Convert basic markdown to HTML for the initial content
  let html = text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');
  
  // Wrap blocks in paragraphs if they aren't already structured
  const paragraphs = html.split('\n\n').map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h')) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
  });
  
  return paragraphs.join('');
};

const getSystemInstruction = (mode: WritingMode) => {
  switch (mode) {
    case WritingMode.ACADEMIC:
      return "You are an elite academic scholar. Focus on formal tone, precise vocabulary, objective analysis, and logical structure. Avoid contractions and colloquialisms.";
    case WritingMode.POEM:
      return "You are a master poet. Focus on evocative imagery, rhythm, metaphor, and emotional resonance. Prioritize the beauty and impact of language over literal meaning.";
    case WritingMode.LYRICS:
      return "You are a chart-topping songwriter. Focus on catchiness, rhyme schemes, lyrical flow, and song structure (verse, chorus, bridge). Think about how the words sound when sung.";
    default:
      return "You are a world-class creative writer and editor. Focus on clarity, engagement, and high-quality storytelling.";
  }
};

export const generateInitialDraft = async (prompt: string, attachments: Attachment[], mode: WritingMode = WritingMode.GENERAL): Promise<string> => {
  const ai = getAIClient();
  const system = getSystemInstruction(mode);
  
  const parts: any[] = [{ text: `${system} Based on the following prompt and context, generate a high-quality initial draft in ${mode.toUpperCase()} style. Use markdown for structure (headers, bold, italic). Prompt: ${prompt}` }];
  
  attachments.forEach(att => {
    if (att.type.startsWith('image/')) {
      parts.push({
        inlineData: {
          mimeType: att.type,
          data: att.content.split(',')[1] // Assuming data URL
        }
      });
    } else {
      parts.push({ text: `Attachment Content (${att.name}):\n${att.content}` });
    }
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      temperature: mode === WritingMode.ACADEMIC ? 0.4 : 0.8,
      topP: 0.95,
    }
  });

  const text = response.text || "Failed to generate draft.";
  return simpleMdToHtml(text);
};

export const iterateOnSelection = async (
  context: string,
  selection: string,
  instruction: string,
  mode: WritingMode = WritingMode.GENERAL
): Promise<string> => {
  const ai = getAIClient();
  const system = getSystemInstruction(mode);
  const prompt = `
    ${system}
    Context of the document: 
    ---
    ${context}
    ---
    The user has selected this specific part: "${selection}"
    
    Instruction: ${instruction}
    
    Rewrite ONLY the selected part to satisfy the instruction while strictly adhering to the ${mode.toUpperCase()} mode. Maintain flow with surrounding context.
    Return ONLY the rewritten text.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      temperature: 0.8,
    }
  });

  return response.text || selection;
};

export const getProactiveSuggestions = async (content: string, mode: WritingMode = WritingMode.GENERAL) => {
  const ai = getAIClient();
  const system = getSystemInstruction(mode);
  
  const modeSpecificContext = {
    [WritingMode.GENERAL]: "Focus on flow, impact, and general writing quality.",
    [WritingMode.ACADEMIC]: "Suggest improvements for formal tone, evidence-based phrasing, or structural clarity.",
    [WritingMode.POEM]: "Suggest more evocative imagery, better meter/rhythm, or poignant word choices.",
    [WritingMode.LYRICS]: "Suggest catchier hooks, better internal rhymes, or more singable phrasing.",
  }[mode];

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${system} Analyze this writing specifically for its ${mode.toUpperCase()} qualities. ${modeSpecificContext}
      Suggest 1-2 small improvements or creative additions. 
      Return the response in JSON format.
      Writing content: ${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalText: { type: Type.STRING, description: 'The specific phrase or sentence to change' },
                suggestedText: { type: Type.STRING, description: 'The new suggested version' },
                explanation: { type: Type.STRING, description: 'Why this is better in this specific writing mode' }
              },
              required: ['originalText', 'suggestedText', 'explanation']
            }
          }
        },
        required: ['suggestions']
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{"suggestions": []}');
    return data.suggestions;
  } catch (e) {
    return [];
  }
};

export const checkGrammar = async (content: string) => {
  const ai = getAIClient();
  
  const prompt = `Identify grammatical errors, spelling mistakes, and punctuation issues in the following text. 
    Provide the original incorrect part, the suggested correction, and a brief one-sentence explanation.
    Be precise. Do not invent errors. Focus on technical accuracy.
    Text: "${content}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          errors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalText: { type: Type.STRING },
                suggestedText: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ['originalText', 'suggestedText', 'explanation']
            }
          }
        },
        required: ['errors']
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{"errors": []}');
    return data.errors.map((e: any) => ({ ...e, isGrammar: true }));
  } catch (e) {
    return [];
  }
};

export const getGhostSuggestion = async (content: string, mode: WritingMode): Promise<string> => {
  const ai = getAIClient();
  const system = getSystemInstruction(mode);
  
  const prompt = `
    ${system}
    Continue the following text with a natural, high-quality completion of 3-8 words.
    Text: "${content.slice(-500)}"
    
    Return ONLY the completion text. Do not repeat the input. Do not add quotes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });
    return response.text?.trim() || "";
  } catch (e) {
    console.error("Ghost suggestion error", e);
    return "";
  }
};
