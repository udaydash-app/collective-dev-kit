import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useChatConversations } from '@/hooks/useChatMessages';

export const FloatingChatButton = () => {
  const navigate = useNavigate();
  const { conversations } = useChatConversations(true);
  const unreadCount = conversations.filter(c => c.status === 'open').length;

  return (
    <Button
      onClick={() => navigate('/admin/live-chat')}
      className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 z-50"
      size="icon"
    >
      <MessageCircle className="h-6 w-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
};
