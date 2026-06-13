import { useState } from 'react';
import { Note } from '../lib/storage';

interface SidebarProps {
  notes: Note[];
  onSelectNote: (note: Note | null) => void;
  onCreateNote: () => void;
}

export const Sidebar = ({ notes, onSelectNote, onCreateNote }: SidebarProps) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const handleSelectNote = (note: Note) => {
    setSelectedNoteId(note.id);
    onSelectNote(note);
  };

  const handleCreateNote = () => {
    setSelectedNoteId(null);
    onSelectNote(null);
    onCreateNote();
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-800">Notes</h2>
        <button
          onClick={handleCreateNote}
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-500"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      <nav className="mt-2 space-y-1">
        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => handleSelectNote(note)}
            className={`flex w-full items-center px-3 py-2 text-left text-sm font-medium transition-colors ${selectedNoteId === note.id ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className="flex-1 truncate">{note.title || 'Untitled'}</div>
            <span className="ml-3 text-xs text-gray-400">
              {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
};