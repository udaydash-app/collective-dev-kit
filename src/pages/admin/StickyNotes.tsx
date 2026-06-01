import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Plus, Trash2, X, Save, StickyNote,
} from 'lucide-react';
import { toast } from 'sonner';

const NOTE_COLORS = [
  { name: 'Yellow', bg: 'bg-amber-200', border: 'border-amber-300', text: 'text-amber-900' },
  { name: 'Green', bg: 'bg-green-200', border: 'border-green-300', text: 'text-green-900' },
  { name: 'Blue', bg: 'bg-sky-200', border: 'border-sky-300', text: 'text-sky-900' },
  { name: 'Pink', bg: 'bg-pink-200', border: 'border-pink-300', text: 'text-pink-900' },
  { name: 'Orange', bg: 'bg-orange-200', border: 'border-orange-300', text: 'text-orange-900' },
  { name: 'Purple', bg: 'bg-violet-200', border: 'border-violet-300', text: 'text-violet-900' },
];

type Note = {
  id: string;
  content: string;
  color: string;
  author_name: string | null;
  created_at: string;
  updated_at: string;
};

function getColorStyle(colorName: string) {
  return NOTE_COLORS.find((c) => c.name.toLowerCase() === colorName.toLowerCase()) ?? NOTE_COLORS[0];
}

export default function StickyNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('Yellow');
  const [editAuthor, setEditAuthor] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const session = (() => {
    try {
      const raw = localStorage.getItem('offline_pos_session');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const currentUser = session?.full_name ?? 'Staff';

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pos_sticky_notes')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setNotes(data ?? []);
    } catch (err: any) {
      toast.error('Failed to load sticky notes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSave = async () => {
    const content = editContent.trim();
    if (!content) {
      toast.error('Note content is required');
      return;
    }
    try {
      if (editingId) {
        const { error } = await supabase
          .from('pos_sticky_notes')
          .update({ content, color: editColor, author_name: editAuthor || currentUser })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Note updated');
      } else {
        const { error } = await supabase
          .from('pos_sticky_notes')
          .insert({ content, color: editColor, author_name: editAuthor || currentUser });
        if (error) throw error;
        toast.success('Note added');
      }
      setEditingId(null);
      setIsAdding(false);
      setEditContent('');
      setEditAuthor('');
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save note');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('pos_sticky_notes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Note deleted');
      fetchNotes();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete note');
    }
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setEditContent('');
    setEditColor('Yellow');
    setEditAuthor(currentUser);
  };

  const startEdit = (note: Note) => {
    setIsAdding(false);
    setEditingId(note.id);
    setEditContent(note.content);
    setEditColor(note.color);
    setEditAuthor(note.author_name ?? currentUser);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditContent('');
    setEditAuthor('');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-amber-500" />
          <h1 className="text-lg font-semibold text-slate-800">Sticky Notes</h1>
          <span className="text-xs text-slate-400 ml-2">{notes.length} notes</span>
        </div>
        <Button size="sm" onClick={startAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>
        ) : notes.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
            <StickyNote className="h-12 w-12 opacity-30" />
            <p>No sticky notes yet</p>
            <Button variant="outline" size="sm" onClick={startAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add your first note
            </Button>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {/* Add new note card */}
            {(isAdding || editingId) && (
              <div className="break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    {editingId ? 'Edit Note' : 'New Note'}
                  </span>
                  <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write your note..."
                  className="mb-3 min-h-[100px] resize-none"
                  autoFocus
                />
                <Input
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  placeholder="Author name"
                  className="mb-3 text-sm"
                />
                <div className="flex items-center gap-2 mb-3">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setEditColor(c.name)}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${c.bg} ${c.border} ${
                        editColor === c.name ? 'ring-2 ring-slate-400 scale-110' : ''
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
                <Button size="sm" onClick={handleSave} className="w-full gap-1.5">
                  <Save className="h-4 w-4" />
                  {editingId ? 'Update' : 'Save'}
                </Button>
              </div>
            )}

            {/* Existing notes */}
            {notes.map((note) => {
              const style = getColorStyle(note.color);
              return (
                <div
                  key={note.id}
                  onClick={() => {
                    if (!editingId && !isAdding) startEdit(note);
                  }}
                  className={`break-inside-avoid rounded-xl border ${style.border} ${style.bg} p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow group relative`}
                >
                  <p className={`text-sm whitespace-pre-wrap leading-relaxed ${style.text}`}>
                    {note.content}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs font-medium opacity-70 ${style.text}`}>
                      {note.author_name ?? 'Anonymous'}
                    </span>
                    <span className={`text-xs opacity-50 ${style.text}`}>
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(note.id);
                    }}
                    className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 ${style.text}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
