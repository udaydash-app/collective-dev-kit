import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ListTodo, Plus, Trash2, Bell, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function POSTodoList() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [remindAt, setRemindAt] = useState<Date | undefined>(undefined);
  const [remindTime, setRemindTime] = useState('09:00');

  const { data: todos, isLoading } = useQuery({
    queryKey: ['pos-todos'],
    queryFn: async () => {
      // Fetch all pending + tasks completed today (so they stay struck for the day, gone tomorrow)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('pos_todos')
        .select('*')
        .or(`is_completed.eq.false,completed_at.gte.${startOfToday.toISOString()}`)
        .order('remind_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;

    let remindIso: string | null = null;
    if (remindAt) {
      const [h, m] = remindTime.split(':').map(Number);
      const d = new Date(remindAt);
      d.setHours(h || 0, m || 0, 0, 0);
      remindIso = d.toISOString();
    }

    const { error } = await supabase.from('pos_todos').insert({
      title,
      remind_at: remindIso,
    });
    if (error) {
      toast.error('Failed to add: ' + error.message);
      return;
    }
    setNewTitle('');
    setRemindAt(undefined);
    setRemindTime('09:00');
    queryClient.invalidateQueries({ queryKey: ['pos-todos'] });
  };

  const handleToggle = async (id: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from('pos_todos')
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', id);
    if (error) {
      toast.error('Failed: ' + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['pos-todos'] });
    if (isCompleted) toast.success('Task completed');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('pos_todos').delete().eq('id', id);
    if (error) {
      toast.error('Failed: ' + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['pos-todos'] });
  };

  const now = new Date();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">To-Do & Reminders</h3>
        {todos && todos.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {todos.length} pending
          </span>
        )}
      </div>

      {/* Add new */}
      <Card className="p-2 space-y-2">
        <div className="flex gap-1.5">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add a task or reminder..."
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()} className="h-8 px-2">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-1.5 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('h-7 text-xs flex-1 justify-start', !remindAt && 'text-muted-foreground')}
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                {remindAt ? format(remindAt, 'dd/MM/yyyy') : 'No reminder'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={remindAt}
                onSelect={setRemindAt}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          {remindAt && (
            <>
              <Input
                type="time"
                value={remindTime}
                onChange={(e) => setRemindTime(e.target.value)}
                className="h-7 text-xs w-24"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs"
                onClick={() => setRemindAt(undefined)}
              >
                Clear
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
      ) : todos && todos.length > 0 ? (
        <div className="space-y-1.5">
          {todos.map((t: any) => {
            const remind = t.remind_at ? new Date(t.remind_at) : null;
            const overdue = remind && remind < now && !t.is_completed;
            const completed = !!t.is_completed;
            return (
              <Card
                key={t.id}
                className={cn(
                  'p-2 transition-colors',
                  !completed && 'border-red-400 bg-red-50 dark:bg-red-950/30',
                  completed && 'border-green-400 bg-green-50 dark:bg-green-950/30'
                )}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={t.is_completed}
                    onCheckedChange={(v) => handleToggle(t.id, !!v)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-xs font-medium break-words',
                        completed
                          ? 'line-through text-green-700 dark:text-green-400'
                          : 'text-red-700 dark:text-red-400'
                      )}
                    >
                      {t.title}
                    </p>
                    {remind && (
                      <div
                        className={cn(
                          'flex items-center gap-1 mt-0.5 text-[10px]',
                          completed
                            ? 'text-green-600 line-through'
                            : overdue
                            ? 'text-red-600 font-semibold'
                            : 'text-red-500'
                        )}
                      >
                        {overdue ? <Bell className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        <span>{format(remind, 'dd/MM/yyyy HH:mm')}</span>
                        {overdue && <span>· Overdue</span>}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-4 text-center">
          <ListTodo className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No pending tasks</p>
          <p className="text-xs text-muted-foreground mt-0.5">Add a task above to get started</p>
        </Card>
      )}
    </div>
  );
}