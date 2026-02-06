import { Variants } from 'framer-motion';

// Overlay fade animation
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// Sidebar slide from left
export const sidebarVariants: Variants = {
  hidden: { x: -360, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    x: -360,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// Right toolbar slide from right
export const rightToolbarVariants: Variants = {
  hidden: { x: 52, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 },
  },
  exit: {
    x: 52,
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// Canvas reveal animation
export const canvasVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut', delay: 0.1 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

// Collapse/expand animation for panels
export const collapseVariants: Variants = {
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.2, ease: 'easeOut' },
      opacity: { duration: 0.15 },
    },
  },
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.15, ease: 'easeIn' },
      opacity: { duration: 0.1 },
    },
  },
};

// Loading spinner animation
export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// Drag animation for floating widgets (subtle)
export const dragVariants = {
  idle: {
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  dragging: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    transition: { duration: 0.15 },
  },
};

// Legacy exports for backwards compatibility during migration
export const questionPanelVariants = sidebarVariants;
export const chatPanelVariants = sidebarVariants;
export const toolbarVariants = rightToolbarVariants;
export const containerVariants = overlayVariants;
export const buttonHoverVariants: Variants = {
  idle: {},
  hover: {},
  tap: {},
};
