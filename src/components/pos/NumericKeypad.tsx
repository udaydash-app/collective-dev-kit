import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NumericKeypadProps {
  onNumberClick: (value: string) => void;
  onQtyClick: () => void;
  onDiscountClick: () => void;
  onPriceClick: () => void;
  onPercentClick: () => void;
  onCartDiscountClick: () => void;
  onClear: () => void;
  onEnter: () => void;
  disabled?: boolean;
  activeMode?: 'qty' | 'discount' | 'price' | 'cartDiscount' | null;
  isPercentMode?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onNumberClick,
  onQtyClick,
  onDiscountClick,
  onPriceClick,
  onPercentClick,
  onCartDiscountClick,
  onClear,
  onEnter,
  disabled = false,
  activeMode = null,
  isPercentMode = false
}) => {
  const numberButtons = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '00'];
  
  return (
    <div className="flex gap-1.5 p-2 bg-card border rounded-lg">
      {/* Number buttons on the left - 3x4 grid */}
      <div className="grid grid-cols-3 gap-1.5 flex-1">
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
      </div>
      
      {/* Function buttons on the right */}
      <div className="flex flex-col gap-1.5">
        <Button
          onClick={onQtyClick}
          disabled={disabled}
          variant={activeMode === 'qty' ? 'default' : 'outline'}
          className="h-11 text-xs font-semibold px-4"
        >
          QTY
        </Button>
        <Button
          onClick={onDiscountClick}
          disabled={disabled}
          variant={activeMode === 'discount' ? 'default' : 'outline'}
          className="h-11 text-xs font-semibold px-4"
        >
          DISC
        </Button>
        <Button
          onClick={onPriceClick}
          disabled={disabled}
          variant={activeMode === 'price' ? 'default' : 'outline'}
          className="h-11 text-xs font-semibold px-4"
        >
          PRICE
        </Button>
        <Button
          onClick={onCartDiscountClick}
          disabled={false}
          variant={activeMode === 'cartDiscount' ? 'default' : 'outline'}
          className="h-11 text-[10px] font-semibold px-2 leading-tight"
        >
          CART<br/>DISC
        </Button>
        <Button
          onClick={onPercentClick}
          disabled={disabled || (activeMode !== 'discount' && activeMode !== 'cartDiscount')}
          variant={isPercentMode ? 'default' : 'outline'}
          className="h-11 text-xs font-semibold px-4"
          title="Use percentage for discount"
        >
          %
        </Button>
        <Button
          onClick={onClear}
          disabled={disabled && activeMode !== 'cartDiscount'}
          variant="destructive"
          className="h-11 text-xs font-semibold px-4"
        >
          CLEAR
        </Button>
        <Button
          onClick={onEnter}
          disabled={disabled && activeMode !== 'cartDiscount'}
          variant="default"
          className="h-11 text-sm font-semibold bg-primary px-4"
        >
          ENTER
        </Button>
      </div>
    </div>
  );
};
