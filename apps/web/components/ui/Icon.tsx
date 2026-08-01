/**
 * @module Icon
 * @description Wrapper component for Lucide icons with consistent sizing, styling, and fallback handling.
 * Provides a unified interface for using icons throughout the application with sensible defaults.
 *
 * Only imports the icons actually used in the application to keep bundle size minimal.
 * Add new icons to the ICON_MAP as needed.
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx, all tab components, Select.jsx, Accordion.jsx
 * @downstream Calls: lucide-react icon components
 *
 * @example
 * // Basic usage
 * <Icon name="Settings" />
 *
 * // With custom size and color
 * <Icon name="AlertTriangle" size={20} className="text-warning" />
 *
 * // Inline with text
 * <span className="flex items-center gap-2">
 *   <Icon name="Check" size={14} /> Success
 * </span>
 */

import {
  // Tab icons
  MessageCircle,
  Brain,
  Image,
  FileEdit,
  Mic,
  Settings,
  // Status icons
  Check,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  Play,
  Pause,
  Package,
  Zap,
  // Action icons
  Send,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  Pencil,
  Save,
  Copy,
  Download,
  Upload,
  // Content type icons
  MessageSquare,
  User,
  Search,
  Globe,
  FileText,
  Snowflake,
  StickyNote,
  Sparkles,
  Bell,
  Eye,
  BookOpen,
  HelpCircle,
  // UI icons
  Moon,
  Sun,
  HardDrive,
  Folder,
  FolderOpen,
  Clock,
  Calendar,
  Filter,
  ArrowUpDown,
  Menu,
  MoreHorizontal,
  MoreVertical,
  ExternalLink,
  Link,
  Camera,
  Square,
  Volume2,
  VolumeX,
  Code,
  // History UX icons
  ArrowUp,
  List,
  Smile,
  Pin,
  CircleDot,
  Activity,
  // Gallery icons
  EyeOff,
  Lock,
  Unlock,
  // Navigation icons
  ChevronLeft,
  History,
} from 'lucide-react';
/**
 * @description Map of icon names to components. Only includes icons actually used.
 * Add new icons here as needed - importing individually enables tree-shaking.
 */
const ICON_MAP = {
  // Tab icons
  MessageCircle,
  Brain,
  Image,
  FileEdit,
  Mic,
  Settings,
  // Status icons
  Check,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  Play,
  Pause,
  Package,
  Zap,
  // Action icons
  Send,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  Pencil,
  Save,
  Copy,
  Download,
  Upload,
  // Content type icons
  MessageSquare,
  User,
  Search,
  Globe,
  FileText,
  Snowflake,
  StickyNote,
  Sparkles,
  Bell,
  Eye,
  BookOpen,
  HelpCircle,
  // UI icons
  Moon,
  Sun,
  HardDrive,
  Folder,
  FolderOpen,
  Clock,
  Calendar,
  Filter,
  ArrowUpDown,
  Menu,
  MoreHorizontal,
  MoreVertical,
  ExternalLink,
  Link,
  Camera,
  Square,
  Volume2,
  VolumeX,
  Code,
  // History UX icons
  ArrowUp,
  List,
  Smile,
  Pin,
  CircleDot,
  Activity,
  // Gallery icons
  EyeOff,
  Lock,
  Unlock,
  // Navigation icons
  ChevronLeft,
  History,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  [key: string]: unknown;
}

/**
 * @description Renders a Lucide icon by name with configurable size and styling
 *
 * @param {Object} props - Component props
 * @param {string} props.name - Name of the Lucide icon (e.g., "Settings", "ChevronDown")
 * @param {number} props.size - Icon size in pixels (default: 16)
 * @param {string} props.className - Additional CSS classes (default: '')
 * @param {Object} props.rest - Additional props passed to the icon component
 * @returns {JSX.Element|null} The icon component or null if icon name is invalid
 *
 * @note Icon names are PascalCase and must match Lucide's naming exactly
 * @see https://lucide.dev/icons for available icons
 */
export function Icon({ name, size = 16, className = '', ...props }: IconProps) {
  const LucideIcon = (ICON_MAP as any)[name];

  if (!LucideIcon) {
    // Warn in development but don't crash
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Icon "${name}" not found in ICON_MAP. Add it to src/components/ui/Icon.tsx`);
    }
    return null;
  }

  return (
    <LucideIcon
      size={size}
      className={className}
      aria-hidden="true"
      {...props}
    />
  );
}
