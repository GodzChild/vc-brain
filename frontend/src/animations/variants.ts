import type { Variants } from 'framer-motion'

export const pageFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } },
}

export const bloomIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.25 } },
}

export const staggerList: Variants = {
  animate: { transition: { staggerChildren: 0.08 } },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

export const cardSlide: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 80 : -80, scale: 0.98 }),
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -80 : 80,
    scale: 0.98,
    transition: { duration: 0.3, ease: 'easeIn' },
  }),
}

export const riseIn: Variants = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.3 } },
}
