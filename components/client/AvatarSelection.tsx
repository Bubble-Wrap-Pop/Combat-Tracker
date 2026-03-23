'use client';

import { useState, useRef } from 'react';

export function AvatarInput({ existingAvatarUrl }: { existingAvatarUrl?: string | null }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingAvatarUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRemoved, setIsRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousFileRef = useRef<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;

    if (fileList && fileList.length > 0) {
      const file = fileList[0];
      previousFileRef.current = file;
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsRemoved(false);
    } 
    else if (previousFileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(previousFileRef.current);
      e.target.files = dt.files;
    }
  };

  const handleClearSelection = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    previousFileRef.current = null;
    setSelectedFile(null);
    setPreviewUrl(isRemoved ? null : (existingAvatarUrl || null));
  };

  const handleRemoveCompletely = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    previousFileRef.current = null;
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsRemoved(true);
  };

  return (
    <div className="flex flex-col gap-3">
      {previewUrl ? (
        <div className="relative w-max">
          <img
            src={previewUrl}
            alt="Profile Preview"
            className="w-24 h-24 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={handleRemoveCompletely}
            className="absolute -top-1 -right-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full p-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
            aria-label="Remove image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      ) : (
        <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 dark:text-zinc-500 border border-zinc-300 dark:border-zinc-700 text-sm">
          No Image
        </div>
      )}

      <input type="hidden" name="existing_avatar_url" value={isRemoved ? '' : (existingAvatarUrl || '')} />
      {isRemoved && (
        <input type="hidden" name="remove_avatar" value="true" />
      )}

      <div className="relative flex items-center">
        <input
          ref={fileInputRef}
          type="file"
          id="avatar_file"
          name="avatar_file"
          accept="image/*"
          onChange={handleChange}
          className="w-full cursor-pointer rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-10 text-sm text-zinc-600 transition-all file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-zinc-100 file:px-4 file:py-1 file:text-sm file:font-semibold file:text-zinc-900 hover:file:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-white dark:hover:file:bg-zinc-700"
        />
        {selectedFile && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="absolute right-3 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
            aria-label="Cancel new selection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}