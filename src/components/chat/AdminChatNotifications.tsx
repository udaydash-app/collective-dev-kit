import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AdminChatNotifications = () => {
  console.log('🔔 AdminChatNotifications component rendered');
  
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  console.log('🔔 AdminChatNotifications hook values:', { isAdmin });

  useEffect(() => {
    // Only enable notifications for authenticated admin users
    if (!isAdmin) {
      console.log('AdminChatNotifications: Not admin, skipping');
      return;
    }

    console.log('AdminChatNotifications: Setting up realtime subscription for chat messages');

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
          console.log('AdminChatNotifications: New message received!', payload);
          const message = payload.new;
          
          // Fetch conversation details to show customer name
          const { data: conversation } = await supabase
            .from('chat_conversations')
            .select('customer_name, user_id')
            .eq('id', message.conversation_id)
            .single();

          console.log('AdminChatNotifications: Conversation data:', conversation);
          console.log('AdminChatNotifications: Showing toast notification');

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
      .subscribe((status) => {
        console.log('AdminChatNotifications: Subscription status:', status);
      });

    return () => {
      console.log('AdminChatNotifications: Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [isAdmin, toast, navigate]);

  return null;
};
