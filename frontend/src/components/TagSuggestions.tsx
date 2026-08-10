import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Нативная автоподсказка тегов (datalist). Инпуту нужно задать list={id}.
export function TagSuggestions({ id }: { id: string }) {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    api
      .get<{ tag: string; count: number }[]>('/tags')
      .then((r) => setTags(r.data.map((t) => t.tag)))
      .catch(() => setTags([]));
  }, []);
  return (
    <datalist id={id}>
      {tags.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}
