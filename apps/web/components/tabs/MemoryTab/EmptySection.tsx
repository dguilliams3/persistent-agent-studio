/**
 * EmptySection - Placeholder for empty memory sections
 *
 * @module components/tabs/MemoryTab/EmptySection
 * @description Consistent empty state display with icon and message.
 *
 * @upstream Called by: MemoryTab index (for cold storage, reminders, etc.)
 * @downstream Calls: None (leaf component)
 */

import type { LucideIcon } from 'lucide-react';

interface EmptySectionProps {
  title: string;
  icon: LucideIcon;
  message: string;
}

export default function EmptySection({ title, icon: IconComponent, message }: EmptySectionProps) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <IconComponent size={16} className="text-content-muted" />
        <h3 className="text-sm font-medium text-content-secondary">{title}</h3>
      </div>
      <p className="text-xs text-content-muted italic">{message}</p>
    </div>
  );
}
