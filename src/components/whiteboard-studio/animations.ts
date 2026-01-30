import { Variants } from 'framer-motion';

// Container variants for staggered children animations
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

// Overlay fade animation
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

// Panel slide-in animations
export const questionPanelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -100,
    y: -50,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      duration: 0.4,
    },
  },
  exit: {
    opacity: 0,
    x: -100,
    y: -50,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

export const chatPanelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 100,
    y: -50,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      duration: 0.4,
      delay: 0.1,
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    y: -50,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

// Canvas reveal animation
export const canvasVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
      delay: 0.2,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

// Toolbar slide-up animation
export const toolbarVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 35,
      delay: 0.3,
    },
  },
  exit: {
    opacity: 0,
    y: 50,
    transition: { duration: 0.15 },
  },
};

// Drag animation for panels
export const dragVariants = {
  idle: {
    scale: 1,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  },
  dragging: {
    scale: 1.02,
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)',
    transition: { duration: 0.15 },
  },
};

// Collapse/expand animation for panels
export const collapseVariants: Variants = {
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: 'easeOut' },
      opacity: { duration: 0.2 },
    },
  },
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: 'easeIn' },
      opacity: { duration: 0.1 },
    },
  },
};

// Button hover animation
export const buttonHoverVariants: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
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
