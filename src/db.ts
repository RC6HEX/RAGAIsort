import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  progress?: number;
  message?: string;
  uploadTime?: string;
  content?: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  text: string;
  sources?: any[];
  isHonest?: boolean;
  confidence?: number;
  timestamp?: number;
}

interface UserSettings {
  userName: string;
  themeColor: 'indigo' | 'emerald' | 'rose' | 'cyan';
  isOverclocked: boolean;
}

interface NeuralLibraryDB extends DBSchema {
  files: {
    key: string;
    value: UploadedFile;
  };
  messages: {
    key: string;
    value: Message;
    indexes: { 'by-timestamp': number };
  };
  settings: {
    key: string;
    value: UserSettings;
  };
}

class Database {
  private db: IDBPDatabase<NeuralLibraryDB> | null = null;

  async init() {
    this.db = await openDB<NeuralLibraryDB>('neural-library', 1, {
      upgrade(db) {
        // Создаем хранилище для файлов
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }

        // Создаем хранилище для сообщений
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-timestamp', 'timestamp');
        }

        // Создаем хранилище для настроек
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }

  // Файлы
  async saveFile(file: UploadedFile) {
    if (!this.db) await this.init();
    await this.db!.put('files', file);
  }

  async getFiles(): Promise<UploadedFile[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('files');
  }

  async deleteFile(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('files', id);
  }

  async clearFiles() {
    if (!this.db) await this.init();
    await this.db!.clear('files');
  }

  // Сообщения
  async saveMessage(message: Message) {
    if (!this.db) await this.init();
    const messageWithTimestamp = { ...message, timestamp: Date.now() };
    await this.db!.put('messages', messageWithTimestamp);
  }

  async getMessages(): Promise<Message[]> {
    if (!this.db) await this.init();
    return await this.db!.getAll('messages');
  }

  async clearMessages() {
    if (!this.db) await this.init();
    await this.db!.clear('messages');
  }

  // Настройки
  async saveSettings(settings: UserSettings) {
    if (!this.db) await this.init();
    await this.db!.put('settings', settings, 'user-settings');
  }

  async getSettings(): Promise<UserSettings | undefined> {
    if (!this.db) await this.init();
    return await this.db!.get('settings', 'user-settings');
  }
}

export const db = new Database();
export type { UploadedFile, Message, UserSettings };
