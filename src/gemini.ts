const API_KEY = '';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface Citation {
  text: string;
  source: string;
}

export async function generateQuestions(bookContent: string, bookName: string): Promise<string[]> {
  try {
    const prompt = `Проанализируй содержание книги "${bookName}" и составь 4 интересных вопроса, на которые можно ответить на основе этого текста. Вопросы должны быть конкретными и относиться к содержанию книги. Верни только вопросы, каждый с новой строки, без нумерации.

Содержание книги:
${bookContent.slice(0, 8000)}`;

    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      return [];
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates[0]?.content?.parts[0]?.text || '';
    const questions = text.split('\n').filter(q => q.trim().length > 0).slice(0, 4);
    
    return questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    return [];
  }
}

export async function searchMode(query: string, contexts: Array<{text: string, source: string}>): Promise<string> {
  if (contexts.length === 0) {
    return 'Не найдено релевантных фрагментов в загруженных книгах.';
  }

  let result = '**Найденные фрагменты:**\n\n';
  
  contexts.forEach((ctx, idx) => {
    result += `**Фрагмент ${idx + 1}:**\n`;
    result += `${ctx.text.trim()}\n\n`;
    result += `*Источник: ${ctx.source}*\n\n`;
    result += '---\n\n';
  });

  return result;
}

export async function answerMode(
  question: string, 
  contexts: Array<{text: string, source: string}>, 
  userName: string
): Promise<{answer: string, citations: Citation[]}> {
  try {
    const greeting = userName ? userName : 'пользователь';
    
    if (contexts.length === 0) {
      return {
        answer: `${greeting}, к сожалению, в загруженных книгах нет информации для ответа на этот вопрос.`,
        citations: []
      };
    }

    const contextText = contexts.map((ctx, idx) => 
      `[Фрагмент ${idx + 1} из ${ctx.source}]\n${ctx.text}`
    ).join('\n\n---\n\n');

    const prompt = `Ты - AI ассистент. Ответь на вопрос пользователя, используя ТОЛЬКО информацию из предоставленных фрагментов текста.

Вопрос: ${question}

Доступные фрагменты:
${contextText}

ВАЖНО:
1. Начни ответ с обращения "${greeting},"
2. Используй только информацию из фрагментов
3. Если в текстах нет ответа, честно скажи об этом
4. В конце ответа добавь раздел "**Цитаты:**" и перечисли прямые цитаты из текста, на которых основан ответ, указывая источник каждой цитаты`;

    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(`API Error: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();
    const fullAnswer = data.candidates[0]?.content?.parts[0]?.text || 'Не удалось получить ответ.';
    
    const citations: Citation[] = contexts.map(ctx => ({
      text: ctx.text.slice(0, 200) + '...',
      source: ctx.source
    }));

    return { answer: fullAnswer, citations };
  } catch (error) {
    console.error('Error in answer mode:', error);
    return {
      answer: 'Произошла ошибка при обработке вашего вопроса.',
      citations: []
    };
  }
}

export type { Citation };

