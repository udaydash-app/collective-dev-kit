import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

type Op = '+' | '-' | '×' | '÷' | null;

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [overwrite, setOverwrite] = useState(true);

  const inputDigit = useCallback((d: string) => {
    setDisplay((cur) => {
      if (overwrite) {
        setOverwrite(false);
        return d === '.' ? '0.' : d;
      }
      if (d === '.' && cur.includes('.')) return cur;
      if (cur === '0' && d !== '.') return d;
      return cur + d;
    });
  }, [overwrite]);

  const compute = (a: number, b: number, o: Op): number => {
    switch (o) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const applyOp = useCallback((nextOp: Op) => {
    const current = parseFloat(display);
    if (prev === null) {
      setPrev(current);
    } else if (!overwrite) {
      const result = compute(prev, current, op);
      setPrev(result);
      setDisplay(String(result));
    }
    setOp(nextOp);
    setOverwrite(true);
  }, [display, prev, op, overwrite]);

  const equals = useCallback(() => {
    if (prev === null || op === null) return;
    const current = parseFloat(display);
    const result = compute(prev, current, op);
    setDisplay(String(result));
    setPrev(null);
    setOp(null);
    setOverwrite(true);
  }, [display, prev, op]);

  const clearAll = () => { setDisplay('0'); setPrev(null); setOp(null); setOverwrite(true); };
  const toggleSign = () => setDisplay((c) => c.startsWith('-') ? c.slice(1) : c === '0' ? c : '-' + c);
  const percent = () => setDisplay((c) => String(parseFloat(c) / 100));
  const backspace = () => setDisplay((c) => (c.length <= 1 || (c.length === 2 && c.startsWith('-'))) ? '0' : c.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) inputDigit(e.key);
      else if (e.key === '.') inputDigit('.');
      else if (e.key === '+') applyOp('+');
      else if (e.key === '-') applyOp('-');
      else if (e.key === '*') applyOp('×');
      else if (e.key === '/') { e.preventDefault(); applyOp('÷'); }
      else if (e.key === 'Enter' || e.key === '=') equals();
      else if (e.key === 'Escape') clearAll();
      else if (e.key === 'Backspace') backspace();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputDigit, applyOp, equals]);

  const Key = ({ children, onClick, variant = 'default', className = '' }: any) => (
    <Button
      onClick={onClick}
      variant={variant}
      className={`h-20 text-2xl font-semibold ${className}`}
    >
      {children}
    </Button>
  );

  return (
    <div className="h-full w-full flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl p-6 space-y-4">
        <div className="rounded-xl bg-muted px-6 py-8 text-right text-6xl font-mono tabular-nums truncate min-h-[120px] flex items-end justify-end">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Key onClick={clearAll} variant="secondary">AC</Key>
          <Key onClick={toggleSign} variant="secondary">±</Key>
          <Key onClick={percent} variant="secondary">%</Key>
          <Key onClick={() => applyOp('÷')} variant="default">÷</Key>

          <Key onClick={() => inputDigit('7')} variant="outline">7</Key>
          <Key onClick={() => inputDigit('8')} variant="outline">8</Key>
          <Key onClick={() => inputDigit('9')} variant="outline">9</Key>
          <Key onClick={() => applyOp('×')} variant="default">×</Key>

          <Key onClick={() => inputDigit('4')} variant="outline">4</Key>
          <Key onClick={() => inputDigit('5')} variant="outline">5</Key>
          <Key onClick={() => inputDigit('6')} variant="outline">6</Key>
          <Key onClick={() => applyOp('-')} variant="default">−</Key>

          <Key onClick={() => inputDigit('1')} variant="outline">1</Key>
          <Key onClick={() => inputDigit('2')} variant="outline">2</Key>
          <Key onClick={() => inputDigit('3')} variant="outline">3</Key>
          <Key onClick={() => applyOp('+')} variant="default">+</Key>

          <Key onClick={() => inputDigit('0')} variant="outline" className="col-span-2">0</Key>
          <Key onClick={() => inputDigit('.')} variant="outline">.</Key>
          <Key onClick={equals} variant="default">=</Key>
        </div>
      </div>
    </div>
  );
}