import type { PropsWithChildren } from 'react';
import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import { pageTransition, pageVariants } from './presets';
import { useReducedMotionSafe } from './useReducedMotionSafe';

type AnimatedOutletProps = PropsWithChildren<{
  className?: string;
  hidden?: boolean;
  isActive: boolean;
  routeId: string;
}>;

export const AnimatedOutlet = ({
  children,
  className,
  hidden,
  isActive,
  routeId,
}: AnimatedOutletProps): JSX.Element => {
  const reducedMotion = useReducedMotionSafe();
  const motionState = reducedMotion
    ? isActive
      ? 'reducedActive'
      : 'reducedInactive'
    : isActive
      ? 'active'
      : 'inactive';
  const motionProps: HTMLMotionProps<'main'> = reducedMotion
    ? {
        initial: false,
      }
    : {
        initial: 'enter',
        exit: 'exit',
      };

  return (
    <motion.main
      {...motionProps}
      aria-hidden={isActive ? undefined : true}
      animate={motionState}
      className={className}
      data-motion-route="true"
      data-route-id={routeId}
      hidden={hidden}
      layout="position"
      transition={reducedMotion ? { duration: 0 } : pageTransition}
      variants={pageVariants}
    >
      {children}
    </motion.main>
  );
};
