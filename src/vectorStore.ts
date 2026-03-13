import { TextChunk } from './chunking';

interface StoredChunk extends TextChunk {
  embedding?: number[];
}

interface SearchResult {
  chunk: TextChunk;
  score: number;
}

class VectorStore {
  private chunks: StoredChunk[] = [];

  addChunks(chunks: TextChunk[]) {
    this.chunks.push(...chunks);
  }

  clearBook(bookName: string) {
    this.chunks = this.chunks.filter(c => c.bookName !== bookName);
  }

  clearAll() {
    this.chunks = [];
  }

  simpleSearch(query: string, topK: number = 5): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scored = this.chunks.map(chunk => {
      const textLower = chunk.text.toLowerCase();
      let score = 0;

      queryWords.forEach(word => {
        const count = (textLower.match(new RegExp(word, 'g')) || []).length;
        score += count;
      });

      const exactMatch = textLower.includes(queryLower);
      if (exactMatch) score += 10;

      return { chunk, score };
    });

    return scored
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  getAllChunks(): TextChunk[] {
    return this.chunks;
  }
}

export const vectorStore = new VectorStore();
export type { SearchResult };
