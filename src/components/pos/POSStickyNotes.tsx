import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StickyNote, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StickyNoteRow {
  id: string;
  content: string;
  color: string;
  author_name: string | null;
  updated_at: string;
}

const COLORS: Record<string, string> = {
  yellow: 'bg-yellow-200 dark:bg-yellow-900/60 border-yellow-400',
  pink: 'bg-pink-200 dark:bg-pink-900/60 border-pink-400',
  blue: 'bg-blue-200 dark:bg-blue-900/60 border-blue-400',
  green: 'bg-green-200 dark:bg-green-900/60 border-green-400',
  orange: 'bg-orange-200 dark:bg-orange-900/60 border-orange-400',
};
const COLOR_KEYS = Object.keys(COLORS);

export function POSStickyNotes() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<StickyNoteRow[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from('pos_sticky_notes')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setNotes((data as StickyNoteRow[]) || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('pos_sticky_notes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_sticky_notes' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addNote = async () => {
    const author = (() => {
      try {
        const s = localStorage.getItem('offline_pos_session');
        return s ? JSON.parse(s).full_name || null : null;
      } catch {
        return null;
      }
    })();
    const color = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
    const { error } = await supabase
      .from('pos_sticky_notes')
      .insert({ content: '', color, author_name: author });
    if (error) {
      toast.error('Failed to add note');
    }
  };

  const updateNote = async (id: string, content: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
    await supabase.from('pos_sticky_notes').update({ content }).eq('id', id);
  };

  const cycleColor = async (note: StickyNoteRow) => {
    const idx = COLOR_KEYS.indexOf(note.color);
    const next = COLOR_KEYS[(idx + 1) % COLOR_KEYS.length];
    await supabase.from('pos_sticky_notes').update({ color: next }).eq('id', note.id);
  };

  const deleteNote = async (id: string) => {
    await supabase.from('pos_sticky_notes').delete().eq('id', id);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 relative"
      >
        <StickyNote className="h-4 w-4" />
        Notes
        {notes.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
            {notes.length}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" /> Sticky Notes
              </span>
              <Button size="sm" onClick={addNote} className="gap-1 mr-8">
                <Plus className="h-4 w-4" /> New Note
              </Button>
            </DialogTitle>
          </DialogHeader>

          {notes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No notes yet. Click "New Note" to add one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    'relative rounded-lg border-2 p-3 shadow-md transition-transform hover:rotate-0 hover:scale-[1.02]',
                    COLORS[note.color] || COLORS.yellow,
                  )}
                  style={{ transform: `rotate(${(note.id.charCodeAt(0) % 5) - 2}deg)` }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <button
                      onClick={() => cycleColor(note)}
                      className="text-xs font-medium opacity-70 hover:opacity-100"
                      title="Change color"
                    >
                      {note.author_name || 'Anonymous'}
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="opacity-60 hover:opacity-100 hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    value={note.content}
                    onChange={(e) => updateNote(note.id, e.target.value)}
                    placeholder="Write a message..."
                    className="min-h-[140px] bg-transparent border-none focus-visible:ring-0 resize-none p-0 text-foreground placeholder:text-foreground/50"
                  />
                  <div className="text-[10px] opacity-50 mt-2">
                    {new Date(note.updated_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}