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
    info: 'bg-[#F5F1E8] text-[#17372D] border-[#275546]/30',
    warning: 'bg-amber-50 text-amber-900 border-amber-300',
    error: 'bg-red-50 text-red-900 border-red-300',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-300',
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
        'p-4 rounded-xl border text-sm leading-relaxed flex items-start gap-3 shadow-xs',
        styles[type],
        className
      )}
    >
      <span className="text-lg select-none" aria-hidden="true">
        {icons[type]}
      </span>
      <div className="flex-1">
        {title && <h4 className="font-semibold text-base mb-1">{title}</h4>}
        <div>{children}</div>
      </div>
    </div>
  );
}
