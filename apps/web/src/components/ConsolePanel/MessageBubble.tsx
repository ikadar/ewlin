/**
 * One row in the console message stream.
 *
 * Three roles, three styles:
 *  - user      : right-aligned, primary background
 *  - assistant : left-aligned, muted background, narration of what the LLM proposes/asks
 *  - result    : full-width, neutral, summary of what actually happened on apply
 */

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'result';
  text: string;
}

export function MessageBubble({ role, text }: MessageBubbleProps) {
  if (role === 'result') {
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-200 whitespace-pre-wrap">
        {text}
      </div>
    );
  }

  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-800 text-zinc-100'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
