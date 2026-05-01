import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'admin';
  sender_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: 'open' | 'closed';
  last_message_at: string;
  created_at: string;
}

export const useChatMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const previousIdsRef = new Set<string>();

    const applyMessages = (incoming: ChatMessage[]) => {
      if (cancelled) return;
      // Detect new admin messages for notification sound
      const newAdminMsg = incoming.find(
        (m) => m.sender_type === 'admin' && !previousIdsRef.has(m.id)
      );
      incoming.forEach((m) => previousIdsRef.add(m.id));
      setMessages(incoming);
      if (newAdminMsg && previousIdsRef.size > incoming.length - 1) {
        const audio = new Audio('/notification.mp3');
        audio.play().catch((e) => console.log('Audio play failed:', e));
      }
    };

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Authenticated: direct query + realtime
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          toast({ title: 'Error', description: 'Failed to load messages', variant: 'destructive' });
        } else {
          applyMessages((data || []) as ChatMessage[]);
        }
        setLoading(false);

        channel = supabase
          .channel(`chat_messages:${conversationId}:${Date.now()}:${Math.random().toString(36).slice(2)}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              const newMessage = payload.new as ChatMessage;
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
              });
              if (newMessage.sender_type === 'admin') {
                const audio = new Audio('/notification.mp3');
                audio.play().catch((e) => console.log('Audio play failed:', e));
              }
            }
          )
          .subscribe();
      } else {
        // Guest: use SECURITY DEFINER RPC + polling (anon has no SELECT on chat_messages)
        const sessionToken = localStorage.getItem('anonymous_chat_session_token');
        if (!sessionToken) {
          setLoading(false);
          return;
        }

        const fetchGuest = async () => {
          const { data, error } = await supabase.rpc('get_guest_messages', {
            p_conversation_id: conversationId,
            p_session_token: sessionToken,
          });
          if (error) {
            console.error('Error fetching guest messages:', error);
          } else {
            applyMessages((data || []) as ChatMessage[]);
          }
        };

        await fetchGuest();
        setLoading(false);
        pollInterval = setInterval(fetchGuest, 4000);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, toast]);

  return { messages, loading };
};

export const useChatConversations = (isAdmin: boolean = false) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { toast } = useToast();

  const refetch = () => setRefetchTrigger(prev => prev + 1);

  useEffect(() => {
    const fetchConversations = async () => {
      let query = supabase
        .from('chat_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq('user_id', user.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching conversations:', error);
        toast({
          title: "Error",
          description: "Failed to load conversations",
          variant: "destructive"
        });
      } else {
        setConversations((data || []) as ChatConversation[]);
      }
      setLoading(false);
    };

    fetchConversations();

    // Subscribe to conversation updates
    const channel = supabase
      .channel(`chat_conversations-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, toast, refetchTrigger]);

  return { conversations, loading, refetch };
};
