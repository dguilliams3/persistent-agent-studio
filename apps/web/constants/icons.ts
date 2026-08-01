/**
 * @module icons
 * @description Centralized icon name mappings for consistent icon usage throughout the application.
 * Maps semantic icon names to Lucide icon component names.
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx, all tab components
 * @downstream Calls: None (constants only)
 *
 * @example
 * import { TAB_ICONS, STATUS_ICONS } from '../constants/icons';
 * import { Icon } from '../components/ui';
 *
 * <Icon name={TAB_ICONS.chat} />
 * <Icon name={STATUS_ICONS.success} />
 */

/**
 * @description Tab navigation icons
 */
export const TAB_ICONS = {
  chat: 'MessageCircle',
  memory: 'Brain',
  media: 'Image',
  voice: 'Mic',
  monitor: 'Activity',
  settings: 'Settings',
};

/**
 * @description Status and state indicator icons
 */
export const STATUS_ICONS = {
  success: 'Check',
  warning: 'AlertTriangle',
  danger: 'XCircle',
  info: 'Info',
  loading: 'Loader2',
  running: 'Play',
  paused: 'Pause',
  batch: 'Package',
  live: 'Zap',
};

/**
 * @description Action button icons
 */
export const ACTION_ICONS = {
  send: 'Send',
  refresh: 'RefreshCw',
  close: 'X',
  expand: 'ChevronDown',
  collapse: 'ChevronUp',
  chevronRight: 'ChevronRight',
  add: 'Plus',
  remove: 'Minus',
  delete: 'Trash2',
  edit: 'Pencil',
  save: 'Save',
  copy: 'Copy',
  download: 'Download',
  upload: 'Upload',
};

/**
 * @description Content type icons (for history entries, memory types)
 */
export const CONTENT_ICONS = {
  thought: 'Brain',
  message: 'MessageSquare',
  user_message: 'User',
  curiosity: 'Search',
  art: 'Image',
  search: 'Globe',
  searchResult: 'FileText',
  coldStorage: 'Snowflake',
  note: 'StickyNote',
  exist: 'Sparkles',
  reminder: 'Bell',
  observation: 'Eye',
  learned: 'BookOpen',
  question: 'HelpCircle',
  actionError: 'AlertOctagon',
};

/**
 * @description UI element icons
 */
export const UI_ICONS = {
  moon: 'Moon',
  sun: 'Sun',
  cache: 'HardDrive',
  prompt: 'FileText',
  folder: 'Folder',
  folderOpen: 'FolderOpen',
  clock: 'Clock',
  calendar: 'Calendar',
  filter: 'Filter',
  sort: 'ArrowUpDown',
  menu: 'Menu',
  moreHorizontal: 'MoreHorizontal',
  moreVertical: 'MoreVertical',
  external: 'ExternalLink',
  link: 'Link',
  camera: 'Camera',
  play: 'Play',
  stop: 'Square',
  volume: 'Volume2',
  volumeMute: 'VolumeX',
};

/**
 * @description All icons combined for easy lookup
 */
export const ALL_ICONS = {
  ...TAB_ICONS,
  ...STATUS_ICONS,
  ...ACTION_ICONS,
  ...CONTENT_ICONS,
  ...UI_ICONS,
};
