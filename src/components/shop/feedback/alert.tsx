import React from 'react';
import { cn } from '@/lib/utils/cn';

interface AlertProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ type = 'info', title, children, className }: AlertProps) {
  const styles = {
    info: 'bg-[#F4F0E8] text-[#0E2A22] border-[#C89B3C]/50',
    warning: 'bg-amber-50/90 text-amber-950 border-amber-300',
    error: 'bg-rose-50 text-rose-950 border-rose-300',
    success: 'bg-[#EAF4EE] text-[#14382C] border-[#B8DEC8]',
  };

  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅',
  };

  return (
    <div
      role="alert"
      className={cn(
        'p-4.5 rounded-2xl border text-sm leading-relaxed flex items-start gap-3.5 shadow-2xs',
        styles[type],
        className
      )}
    >
      <span className="text-lg select-none shrink-0 mt-0.5" aria-hidden="true">
        {icons[type]}
      </span>
      <div className="flex-1">
        {title && <h4 className="font-black text-base mb-1 tracking-tight">{title}</h4>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
