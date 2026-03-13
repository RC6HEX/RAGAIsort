interface TextChunk {
  text: string;
  bookName: string;
  chunkIndex: number;
  startPos: number;
  endPos: number;
}

const CHUNK_SIZE = 1000;
const OVERLAP_SIZE = 200;

export function splitIntoChunks(content: string, bookName: string): TextChunk[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let startPos = 0;
  let chunkIndex = 0;

  while (startPos < content.length) {
    const endPos = Math.min(startPos + CHUNK_SIZE, content.length);
    const chunkText = content.slice(startPos, endPos);

    if (chunkText.trim().length > 0) {
      chunks.push({
        text: chunkText,
        bookName,
        chunkIndex,
        startPos,
        endPos
      });
      chunkIndex++;
    }

    startPos += CHUNK_SIZE - OVERLAP_SIZE;
  }

  return chunks;
}

export function isFileEmpty(content: string): boolean {
  return !content || content.trim().length === 0;
}

export type { TextChunk };
