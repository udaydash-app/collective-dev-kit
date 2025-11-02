import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NumericKeypadProps {
  onNumberClick: (value: string) => void;
  onQtyClick: () => void;
  onDiscountClick: () => void;
  onPriceClick: () => void;
  onClear: () => void;
  onEnter: () => void;
  disabled?: boolean;
  activeMode?: 'qty' | 'discount' | 'price' | null;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onNumberClick,
  onQtyClick,
  onDiscountClick,
  onPriceClick,
  onClear,
  onEnter,
  disabled = false,
  activeMode = null
}) => {
  const numberButtons = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '00'];
  
  return (
    <div className="grid grid-cols-4 gap-1.5 p-2 bg-card border rounded-lg">
      {/* Function buttons */}
      <Button
        onClick={onQtyClick}
        disabled={disabled}
        variant={activeMode === 'qty' ? 'default' : 'outline'}
        className="h-12 text-xs font-semibold"
      >
        QTY
      </Button>
      <Button
        onClick={onDiscountClick}
        disabled={disabled}
        variant={activeMode === 'discount' ? 'default' : 'outline'}
        className="h-12 text-xs font-semibold"
      >
        DISC
      </Button>
      <Button
        onClick={onPriceClick}
        disabled={disabled}
        variant={activeMode === 'price' ? 'default' : 'outline'}
        className="h-12 text-xs font-semibold"
      >
        PRICE
      </Button>
      <Button
        onClick={onClear}
        disabled={disabled}
        variant="destructive"
        className="h-12 text-xs font-semibold"
      >
        CLEAR
      </Button>
      
      {/* Number buttons */}
      {numberButtons.map((num) => (
        <Button
          key={num}
          onClick={() => onNumberClick(num)}
          disabled={disabled}
          variant="secondary"
          className="h-14 text-lg font-semibold"
        >
          {num}
        </Button>
      ))}
      
      {/* Enter button - spans 2 columns */}
      <Button
        onClick={onEnter}
        disabled={disabled}
        variant="default"
        className="h-14 col-span-2 text-sm font-semibold bg-primary"
      >
        ENTER
      </Button>
    </div>
  );
};
