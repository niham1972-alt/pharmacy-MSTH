import { useRef, useState } from 'react';

const MAX_BYTES = 3_000_000; // ~3MB, stored as a data-URL (consistent with GRN/adjustment attachments)

/** Reads a receipt/invoice image or PDF into a data-URL for upload (spec §2.2/§5). */
export function ReceiptUploadZone({ value, onChange }: { value?: string; onChange: (dataUrl: string | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError('File is too large (max 3MB). Please use a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const isImage = value?.startsWith('data:image');

  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">
          {value ? 'Replace receipt' : 'Attach receipt / invoice'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="text-xs text-red-600 hover:underline">Remove</button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value && (
        <div className="mt-2">
          {isImage ? (
            <img src={value} alt="Receipt preview" className="max-h-32 rounded-md border border-gray-200 dark:border-gray-800" />
          ) : (
            <span className="text-xs text-gray-500">Attachment ready (non-image).</span>
          )}
        </div>
      )}
    </div>
  );
}
