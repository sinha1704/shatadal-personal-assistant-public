type HistoryMessage = { role: 'user' | 'ai'; content: string };

export const fetchAIResponse = async (
  message: string, 
  history: HistoryMessage[] = []
): Promise<{ 
  reply: string; 
  isFallback?: boolean; 
  errorDetails?: string; 
}> => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};
