import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useChatConversations, useChatMessages } from '@/hooks/useChatMessages';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AdminRoute } from '@/components/auth/AdminRoute';

const LiveChatPage = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { conversations, loading: conversationsLoading } = useChatConversations(true);
  const { messages, loading: messagesLoading } = useChatMessages(selectedConversationId);
  const { toast } = useToast();

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const unreadCount = conversations.filter(c => c.status === 'open').length;

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversationId || sending) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: selectedConversationId,
          sender_type: 'admin',
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

  const handleCloseConversation = async () => {
    if (!selectedConversationId) return;

    const { error } = await supabase
      .from('chat_conversations')
      .update({ status: 'closed' })
      .eq('id', selectedConversationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to close conversation",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Conversation closed"
      });
      setSelectedConversationId(null);
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Live Chat Support</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 && `${unreadCount} open conversation${unreadCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 h-[calc(100%-5rem)]">
          {/* Conversations List */}
          <Card className="col-span-4 p-4">
            <h2 className="font-semibold mb-4">Conversations</h2>
            <ScrollArea className="h-[calc(100%-3rem)]">
              {conversationsLoading ? (
                <p className="text-muted-foreground text-center">Loading...</p>
              ) : conversations.length === 0 ? (
                <p className="text-muted-foreground text-center">No conversations yet</p>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <Button
                      key={conv.id}
                      variant={selectedConversationId === conv.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedConversationId(conv.id)}
                    >
                      <div className="flex flex-col items-start w-full">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">
                            {conv.customer_name || 'Anonymous User'}
                          </span>
                          {conv.status === 'open' && (
                            <span className="h-2 w-2 bg-green-500 rounded-full" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.last_message_at).toLocaleString()}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* Chat Messages */}
          <Card className="col-span-8 flex flex-col">
            {selectedConversationId ? (
              <>
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedConversation?.customer_name || 'Anonymous User'}
                    </h3>
                    {selectedConversation?.customer_email && (
                      <p className="text-sm text-muted-foreground">
                        {selectedConversation.customer_email}
                      </p>
                    )}
                  </div>
                  {selectedConversation?.status === 'open' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseConversation}
                    >
                      Close Conversation
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messagesLoading ? (
                    <p className="text-muted-foreground text-center">Loading messages...</p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.sender_type === 'admin' ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] rounded-lg p-3",
                              msg.sender_type === 'admin'
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {new Date(msg.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                {selectedConversation?.status === 'open' && (
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your reply..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
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
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a conversation to start chatting
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default LiveChatPage;
