import { Note } from '../lib/storage';

interface NoteGridProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
}

export const NoteGrid = ({ notes, onSelectNote, onDeleteNote }: NoteGridProps) => {
  if (notes.length === 0) {
    return (
      <div className="min-h-[200px] flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-500">No notes yet. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4">
      {notes.map((note) => (
        <div
          key={note.id}
          className={`relative bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer ${note.color && `bg-${note.color}-50`}`}
          onClick={() => onSelectNote(note)}
        >
          {/* Color indicator dot */}
          {note.color && (
            <div className="absolute top-2 left-2 w-2 h-2 rounded-full" style={{ backgroundColor: note.color }}></div>
          )}
          <div className="mt-2">
            <h3 className="text-lg font-medium text-gray-900 line-clamp-2">{note.title || 'Untitled'</h3>
            <p className="mt-1 text-sm text-gray-500 line-clamp-3">{note.content.replace(/\n/g, ' ').slice(0, 100)}{note.content.length > 100 ? '...' : ''}</p>
            <div className="mt-2 flex items-center text-xs text-gray-400">
              <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNote(note.id);
            }}
            className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Delete note"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h10a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.347A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 01-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};