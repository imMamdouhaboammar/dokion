export type MemoryTier = 'scratch' | 'episodic' | 'durable' | 'retrieved';

export interface MemoryContextItem {
  id: string;
  tier: MemoryTier;
  content: string;
  confidenceTag?: 'observed' | 'decided' | 'hypothesis';
  owner?: string;
  timestamp: string;
}

export interface MemoryContextPack {
  scratchItems: MemoryContextItem[];
  episodicItems: MemoryContextItem[];
  durableItems: MemoryContextItem[];
  totalTokens: number;
  formattedPromptContext: string;
}

export function packMemoryContext(
  items: MemoryContextItem[],
  maxTokens: number = 2000,
): MemoryContextPack {
  const scratchItems = items.filter((i) => i.tier === 'scratch');
  const episodicItems = items.filter((i) => i.tier === 'episodic');
  const durableItems = items.filter((i) => i.tier === 'durable');

  let formattedPromptContext = '### Active Agent Memory\n\n';

  if (durableItems.length > 0) {
    formattedPromptContext += '#### Durable Facts\n';
    for (const item of durableItems) {
      const tag = item.confidenceTag ? `[${item.confidenceTag}] ` : '';
      formattedPromptContext += `- ${tag}${item.content}\n`;
    }
    formattedPromptContext += '\n';
  }

  if (episodicItems.length > 0) {
    formattedPromptContext += '#### Episodic Log\n';
    for (const item of episodicItems) {
      const tag = item.confidenceTag ? `[${item.confidenceTag}] ` : '';
      formattedPromptContext += `- ${tag}${item.content}\n`;
    }
    formattedPromptContext += '\n';
  }

  if (scratchItems.length > 0) {
    formattedPromptContext += '#### Working Scratchpad\n';
    for (const item of scratchItems) {
      const tag = item.confidenceTag ? `[${item.confidenceTag}] ` : '';
      formattedPromptContext += `- ${tag}${item.content}\n`;
    }
  }

  // Rough estimation: 1 word ~ 1.3 tokens
  const wordCount = formattedPromptContext.split(/\s+/).filter(Boolean).length;
  const totalTokens = Math.ceil(wordCount * 1.3);

  return {
    scratchItems,
    episodicItems,
    durableItems,
    totalTokens,
    formattedPromptContext,
  };
}
