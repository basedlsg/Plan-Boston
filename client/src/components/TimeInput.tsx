import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { isValidTime, convertTo24Hour, TimeFormat } from '@/lib/dateUtils';

interface TimeInputProps {
  value: string | undefined;
  onChange: (value: string) => void;
  timeFormat?: TimeFormat;
  className?: string;
}

export function TimeInput({ value, onChange, timeFormat = '12h', className }: TimeInputProps) {
  const [inputType, setInputType] = useState<'text' | 'time'>('text');
  const [displayValue, setDisplayValue] = useState(value || "");

  // Check if the device supports time input
  useEffect(() => {
    const input = document.createElement('input');
    input.type = 'time';
    const supportsTime = input.type === 'time';
    setInputType(supportsTime ? 'time' : 'text');
  }, []);

  const handleChange = (newValue: string) => {
    setDisplayValue(newValue);
    
    if (inputType === 'time') {
      // Native time picker always returns 24h format
      onChange(newValue);
    } else if (isValidTime(newValue)) {
      // Convert to 24h format for consistency
      onChange(convertTo24Hour(newValue));
    }
  };

  return (
    <div className="relative">
      <Input
        type={inputType}
        value={displayValue || ""}
        onChange={(e) => handleChange(e.target.value)}
        className={className}
        placeholder={timeFormat === '12h' ? "12:00 PM" : "14:00"}
      />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        onClick={() => setInputType(inputType === 'text' ? 'time' : 'text')}
      >
        <Clock className="h-4 w-4" />
      </Button>
    </div>
  );
}
