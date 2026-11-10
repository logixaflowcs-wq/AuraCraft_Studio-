import { useEffect, useState } from 'react';

// FIX(audit-3-A): create Blob URLs lazily and revoke them when the source changes or component unmounts.
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return objectUrl;
}
