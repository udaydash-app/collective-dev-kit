import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { MessageCircle } from 'lucide-react';

console.log('🔔 ChatNotifications MODULE LOADED - v2');

export const ChatNotifications = () => {
  console.log('🔔 ChatNotifications RENDERED - v2');
  
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  console.log('🔔 ChatNotifications hook values:', { isAdmin });

  useEffect(() => {
    if (!isAdmin) {
      console.log('🔔 Not admin, skipping');
      return;
    }

    console.log('🔔 Setting up realtime subscription for chat messages');

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
          console.log('🔔 New message received!', payload);
          const message = payload.new;
          
          const { data: conversation } = await supabase
            .from('chat_conversations')
            .select('customer_name, user_id')
            .eq('id', message.conversation_id)
            .single();

          console.log('🔔 Conversation data:', conversation);
          console.log('🔔 Showing toast notification');

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

          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {});
          } catch (e) {}
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
      });

    return () => {
      console.log('🔔 Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [isAdmin, toast, navigate]);

  return null;
};
