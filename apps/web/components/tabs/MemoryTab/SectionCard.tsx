/**
 * SectionCard - Always-visible section wrapper (no collapse)
 *
 * @module components/tabs/MemoryTab/SectionCard
 * @description Used for Memory tab sections since sidebar provides navigation.
 *
 * @upstream Called by: SummariesSection, NotebookSection, ColdStorageSection, etc.
 * @downstream Calls: None (leaf component)
 */

import type { ReactNode } from 'react';

interface SectionCardProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function SectionCard({ title, children, className = '' }: SectionCardProps) {
  return (
    <div className={`card bg-surface border-border-subtle ${className}`}>
      <div className="px-3 py-2 border-b border-border-subtle bg-depth/30">
        <h3 className="text-sm font-medium text-content-primary flex items-center gap-2">
          {title}
        </h3>
      </div>
      <div className="p-0">
        {children}
      </div>
    </div>
  );
}
