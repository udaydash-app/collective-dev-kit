import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminChatNotifications = () => {
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin_chat_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'sender_type=eq.customer'
        },
        async (payload) => {
          const message = payload.new;
          
          // Fetch conversation details to show customer name
          const { data: conversation } = await supabase
            .from('chat_conversations')
            .select('customer_name, user_id')
            .eq('id', message.conversation_id)
            .single();

          toast({
            title: "New Chat Message",
            description: `${conversation?.customer_name || 'A customer'} sent a message`,
            action: (
              <button
                onClick={() => navigate('/admin/live-chat')}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" />
                View
              </button>
            ),
          });

          // Play notification sound
          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {
              // Silently fail if audio can't play
            });
          } catch (e) {
            // Silently fail if audio file doesn't exist
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, toast, navigate]);

  return null;
};
