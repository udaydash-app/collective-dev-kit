import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { MessageCircle } from 'lucide-react';

export const ChatNotifications = () => {
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    console.log('🔔 ChatNotifications: Setting up realtime subscription');

    const channel = supabase
      .channel('chat_messages_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          console.log('🔔 ChatNotifications: Message received', payload);
          const message = payload.new as { 
            conversation_id: string; 
            sender_type: string; 
            message: string;
          };
          
          // Filter for customer messages only
          if (message.sender_type !== 'customer') {
            console.log('🔔 ChatNotifications: Ignoring non-customer message');
            return;
          }

          console.log('🔔 ChatNotifications: Processing customer message');
          
          const { data: conversation } = await supabase
            .from('chat_conversations')
            .select('customer_name, user_id')
            .eq('id', message.conversation_id)
            .single();

          console.log('🔔 ChatNotifications: Showing toast notification');

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
            audio.play().catch(() => {});
          } catch (e) {
            // Ignore audio errors
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 ChatNotifications: Subscription status:', status);
      });

    return () => {
      console.log('🔔 ChatNotifications: Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [isAdmin, toast, navigate]);

  return null;
};
