import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimationConfig } from '../types';
import { ANIMATION_FPS_MULTIPLIER } from '../utils/constants';

export const useAnimation = (
  generatedFrames: string[],
  config: AnimationConfig,
  isPlaying: boolean
) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Safe index check: if generatedFrames shrinks, reset index
  useEffect(() => {
    if (generatedFrames.length > 0 && currentFrameIndex >= generatedFrames.length) {
      setCurrentFrameIndex(0);
    }
  }, [generatedFrames.length, currentFrameIndex]);

  // Animation Loop using requestAnimationFrame
  useEffect(() => {
    if (generatedFrames.length === 0 || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const fps = Math.max(1, config.speed * ANIMATION_FPS_MULTIPLIER);
    const frameInterval = 1000 / fps;

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const elapsed = currentTime - lastTimeRef.current;

      if (elapsed >= frameInterval) {
        setCurrentFrameIndex((prev) => {
          const next = prev + 1;
          return next >= generatedFrames.length ? 0 : next;
        });
        lastTimeRef.current = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimeRef.current = 0;
    };
  }, [generatedFrames.length, config.speed, isPlaying]);

  const handleFrameClick = useCallback((index: number) => {
    setCurrentFrameIndex(index);
  }, []);

  return {
    currentFrameIndex,
    setCurrentFrameIndex,
    handleFrameClick,
  };
};
