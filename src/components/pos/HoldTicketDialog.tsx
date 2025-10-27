import { useState } from 'react';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

interface HeldTicket {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  timestamp: Date;
}

interface HoldTicketDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentCart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  currentTotal: number;
  onHoldTicket: (ticketName: string) => void;
  onRecallTicket: (ticket: HeldTicket) => void;
  onDeleteTicket: (ticketId: string) => void;
  heldTickets: HeldTicket[];
}

export const HoldTicketDialog = ({
  isOpen,
  onClose,
  currentCart,
  currentTotal,
  onHoldTicket,
  onRecallTicket,
  onDeleteTicket,
  heldTickets,
}: HoldTicketDialogProps) => {
  const [ticketName, setTicketName] = useState('');
  const [showHoldForm, setShowHoldForm] = useState(false);

  const handleHold = () => {
    if (!ticketName.trim()) {
      return;
    }
    onHoldTicket(ticketName);
    setTicketName('');
    setShowHoldForm(false);
  };

  const handleRecall = (ticket: HeldTicket) => {
    onRecallTicket(ticket);
    // Let parent handle dialog close
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Hold & Fire Tickets</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Cart Section */}
          {currentCart.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Current Cart</h3>
              <div className="space-y-2 mb-3">
                {currentCart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.name} x {item.quantity}
                    </span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(currentTotal)}</span>
              </div>
              
              {showHoldForm ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <Label htmlFor="ticketName">Ticket Name</Label>
                    <Input
                      id="ticketName"
                      placeholder="e.g., Table 5, Customer Name..."
                      value={ticketName}
                      onChange={(e) => setTicketName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHold()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowHoldForm(false);
                        setTicketName('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleHold}
                      disabled={!ticketName.trim()}
                      className="flex-1"
                    >
                      Hold Ticket
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowHoldForm(true)}
                  className="w-full mt-4"
                  variant="secondary"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Hold This Order
                </Button>
              )}
            </Card>
          )}

          {/* Held Tickets Section */}
          <div>
            <h3 className="font-semibold mb-3">
              Held Tickets ({heldTickets.length})
            </h3>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {heldTickets.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No held tickets
                  </p>
                ) : (
                  heldTickets.map((ticket) => (
                    <Card key={ticket.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold">{ticket.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ticket.timestamp), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRecall(ticket)}
                            className="h-8 w-8"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteTicket(ticket.id)}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        {ticket.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {item.name} x {item.quantity}
                            </span>
                            <span>{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        ))}
                        {ticket.items.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{ticket.items.length - 3} more items
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between font-semibold pt-2 mt-2 border-t">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(ticket.total)}</span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
