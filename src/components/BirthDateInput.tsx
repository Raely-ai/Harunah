import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { formatBirthDateInput, validateBirthDate, isoToDisplayDate, displayToIsoDate } from '../lib/dateUtils';

interface BirthDateInputProps {
  value: string; // ISO format (YYYY-MM-DD) expected from parent
  onChange: (isoValue: string) => void;
  className?: string;
  error?: string;
}

export default function BirthDateInput({ value, onChange, className = "", error: externalError }: BirthDateInputProps) {
  const [displayValue, setDisplayValue] = useState(isoToDisplayDate(value));
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync with value from parent (e.g. initial load)
  useEffect(() => {
    const formatted = isoToDisplayDate(value);
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value;
    
    // Only allow numbers and dots
    rawValue = rawValue.replace(/[^0-9.]/g, "");
    
    // If we're deleting, don't auto-add dots back immediately if we just deleted one
    const isDeleting = (e.nativeEvent as any).inputType === "deleteContentBackward";
    
    let formatted = rawValue;
    if (!isDeleting) {
      formatted = formatBirthDateInput(rawValue);
    }
    
    setDisplayValue(formatted);
    
    // If complete, validate and notify parent
    if (formatted.length === 10) {
      const validation = validateBirthDate(formatted);
      if (validation.isValid) {
        setLocalError(null);
        onChange(displayToIsoDate(formatted));
      } else {
        setLocalError(validation.error || null);
        // We still notify parent so it can handle error state if needed, 
        // or we can pass empty string to indicate invalid
        onChange(""); 
      }
    } else {
      setLocalError(null);
      onChange("");
    }
  };

  const currentError = externalError || localError;

  return (
    <div className="space-y-1.5 w-full">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Calendar size={18} />
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder="GG.AA.YYYY"
          maxLength={10}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={false}
          className={`w-full bg-slate-50 border rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none transition-all ${
            currentError 
              ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
              : 'border-slate-100 focus:ring-indigo-500/20 focus:border-indigo-500'
          } ${className}`}
        />
      </div>
      {currentError && (
        <div className="flex items-center gap-1.5 px-1 text-red-500 text-[10px] font-bold">
          <AlertCircle size={12} />
          <span>{currentError}</span>
        </div>
      )}
    </div>
  );
}
