import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  author_name: string | null;
  message: string;
  created_at: string;
}

const getAuthor = (): string => {
  try {
    const s = localStorage.getItem('offline_pos_session');
    if (s) return JSON.parse(s).full_name || 'Anonymous';
  } catch {}
  return 'Anonymous';
};

let sharedCtx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch { return null; }
};

const unlockAudio = () => { getCtx(); };
if (typeof window !== 'undefined') {
  const onFirst = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', onFirst);
    window.removeEventListener('keydown', onFirst);
    window.removeEventListener('touchstart', onFirst);
  };
  window.addEventListener('pointerdown', onFirst);
  window.addEventListener('keydown', onFirst);
  window.addEventListener('touchstart', onFirst);
}

const scheduleBeep = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  });
};

const playChatBeep = () => {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => scheduleBeep(ctx)).catch((e) => console.error('Resume failed:', e));
    } else {
      scheduleBeep(ctx);
    }
  } catch (e) {
    console.error('Chat beep failed:', e);
  }
};

export function POSChatRoom() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const localIdsRef = useRef<Set<string>>(new Set());
  const initRef = useRef(true);
  const openRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const author = useRef(getAuthor());

  const load = async () => {
    const { data } = await supabase
      .from('pos_chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data as ChatMsg[]) || []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('pos_chat_messages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pos_chat_messages' }, (payload) => {
        const row = payload.new as ChatMsg;
        const isLocal = localIdsRef.current.has(row.id);
        if (isLocal) localIdsRef.current.delete(row.id);
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        if (!isLocal && !initRef.current) {
          playChatBeep();
          if (!openRef.current) {
            setUnread((n) => n + 1);
            toast.info(`${row.author_name || 'Someone'}: ${row.message.slice(0, 60)}`);
          }
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pos_chat_messages' }, (payload) => {
        const row = payload.old as ChatMsg;
        setMessages((prev) => prev.filter((m) => m.id !== row.id));
      })
      .subscribe();
    initRef.current = false;
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      setUnread(0);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }
  }, [open, messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const { data, error } = await supabase
      .from('pos_chat_messages')
      .insert({ message: text, author_name: author.current })
      .select()
      .single();
    if (error) {
      toast.error('Failed to send');
      setInput(text);
    } else if (data?.id) {
      localIdsRef.current.add(data.id);
    }
  };

  const remove = async (id: string) => {
    localIdsRef.current.add(id);
    await supabase.from('pos_chat_messages').delete().eq('id', id);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 relative">
        <MessageCircle className="h-4 w-4" />
        Chat
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
            {unread}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg h-[600px] flex flex-col p-0">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" /> POS Chat Room
            </DialogTitle>
          </DialogHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">No messages yet. Say hello!</div>
            ) : (
              messages.map((m) => {
                const mine = m.author_name === author.current;
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn('group max-w-[80%] rounded-lg px-3 py-2 relative', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      {!mine && <div className="text-xs font-semibold opacity-80 mb-0.5">{m.author_name || 'Anonymous'}</div>}
                      <div className="text-sm whitespace-pre-wrap break-words">{m.message}</div>
                      <div className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      {mine && (
                        <button onClick={() => remove(m.id)} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-background border rounded-full p-1 transition">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t flex gap-2 shrink-0">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  setInput((v) => v + '\n');
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message as ${author.current}... (Ctrl+Enter for new line)`}
              className="flex-1 min-h-[40px] max-h-32 resize-none"
              rows={1}
            />
            <Button onClick={send} size="icon" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
