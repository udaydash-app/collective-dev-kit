import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

export const ChatWidget = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const { messages, loading } = useChatMessages(conversationId);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasUnread, setHasUnread] = useState(false);

  // Don't show on admin pages - admins use FloatingChatButton instead
  const isAdminPage = location.pathname.startsWith('/admin') || location.pathname === '/pos-login';

  useEffect(() => {
    if (isAdminPage) return;
    
    const initConversation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check for existing conversation
        const { data: existingConversation } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .single();

        if (existingConversation) {
          setConversationId(existingConversation.id);
        }
      } else {
        // Check for anonymous conversation in localStorage
        const storedConversationId = localStorage.getItem('anonymous_chat_conversation_id');
        if (storedConversationId) {
          const { data: existingConversation } = await supabase
            .from('chat_conversations')
            .select('id')
            .eq('id', storedConversationId)
            .eq('status', 'open')
            .single();
          
          if (existingConversation) {
            setConversationId(storedConversationId);
          } else {
            localStorage.removeItem('anonymous_chat_conversation_id');
          }
        }
      }
    };

    initConversation();
  }, [isAdminPage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender_type === 'admin' && !lastMessage.is_read) {
        setHasUnread(true);
      }
    } else if (isOpen) {
      setHasUnread(false);
      markMessagesAsRead();
    }
  }, [messages, isOpen]);

  const markMessagesAsRead = async () => {
    if (!conversationId) return;
    
    const unreadMessages = messages.filter(m => m.sender_type === 'admin' && !m.is_read);
    for (const msg of unreadMessages) {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', msg.id);
    }
  };

  const createConversation = async (isGuest: boolean = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user && !isGuest) {
      setShowGuestForm(true);
      return null;
    }

    let conversationData: any = {
      status: 'open',
    };

    if (user) {
      conversationData = {
        ...conversationData,
        user_id: user.id,
      };
    } else {
      // Guest user
      conversationData = {
        ...conversationData,
        user_id: null,
        customer_name: guestName,
        customer_phone: guestPhone,
      };
    }

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive"
      });
      return null;
    }

    // For anonymous users, store conversation ID in localStorage
    if (!user) {
      localStorage.setItem('anonymous_chat_conversation_id', data.id);
    }

    return data.id;
  };

  const handleGuestFormSubmit = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast({
        title: "Required fields",
        description: "Please enter your name and phone number",
        variant: "destructive"
      });
      return;
    }

    const newConversationId = await createConversation(true);
    if (newConversationId) {
      setConversationId(newConversationId);
      setShowGuestForm(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      let currentConversationId = conversationId;

      if (!currentConversationId) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setShowGuestForm(true);
          setSending(false);
          return;
        }

        currentConversationId = await createConversation(false);
        if (!currentConversationId) {
          setSending(false);
          return;
        }
        setConversationId(currentConversationId);
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: currentConversationId,
          sender_type: 'customer',
          sender_id: user?.id || null,
          message: message.trim()
        });

      if (error) throw error;

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Don't render on admin pages
  if (isAdminPage) {
    return null;
  }

  return (
    <>
      {/* Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full animate-pulse" />
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-background border border-border rounded-lg shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
            <h3 className="font-semibold">Chat Support</h3>
            <p className="text-sm opacity-90">We're here to help</p>
          </div>

          {/* Messages or Guest Form */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {showGuestForm ? (
              <div className="space-y-4 p-4">
                <div className="text-center mb-4">
                  <h4 className="font-semibold mb-2">Welcome!</h4>
                  <p className="text-sm text-muted-foreground">Please enter your details to start chatting</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-name">Name</Label>
                  <Input
                    id="guest-name"
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-phone">Phone Number</Label>
                  <Input
                    id="guest-phone"
                    placeholder="Enter your phone number"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleGuestFormSubmit}
                  className="w-full"
                >
                  Start Chat
                </Button>
              </div>
            ) : loading ? (
              <div className="flex justify-center items-center h-full">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Start a conversation</p>
                <p className="text-sm text-muted-foreground">Send us a message and we'll get back to you</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.sender_type === 'customer' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg p-3",
                        msg.sender_type === 'customer'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          {!showGuestForm && (
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={sending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sending}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
