import { useEffect, useRef } from "react";

import lottie from "lottie-web/build/player/lottie_light";

type LottieLightProps = {
  animationData: object;
  autoplay?: boolean;
  className?: string;
  loop?: boolean;
};

export function LottieLight({
  animationData,
  autoplay = true,
  className,
  loop = false,
}: LottieLightProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const animation = lottie.loadAnimation({
      animationData,
      autoplay,
      container: containerRef.current,
      loop,
      renderer: "svg",
    });

    return () => {
      animation.destroy();
    };
  }, [animationData, autoplay, loop]);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
