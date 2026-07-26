"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export const WORDBOOK_EVENTS = ["wordscape:wordbook-changed"];
export const GENERATED_COURSE_EVENTS = ["wordscape:generated-courses-changed"];
export const NO_EVENTS: string[] = [];

/**
 * SSR 安全地读取浏览器端数据（localStorage 等）。
 * 服务端/水合期间返回 serverFallback，客户端返回 read()，并在 events 触发时重新读取。
 * events 必须传模块级常量数组，read 的返回值会按版本缓存以保持快照稳定。
 */
export function useClientValue<T>(read: () => T, serverFallback: T, events: string[]): T {
  const versionRef = useRef(0);
  const cacheRef = useRef<{ version: number; value: T } | null>(null);
  const readRef = useRef(read);

  useEffect(() => {
    readRef.current = read;
  });

  const subscribe = useCallback(
    (onChange: () => void) => {
      const bump = () => {
        versionRef.current += 1;
        onChange();
      };
      events.forEach((name) => window.addEventListener(name, bump));
      return () => events.forEach((name) => window.removeEventListener(name, bump));
    },
    [events],
  );

  const getSnapshot = useCallback(() => {
    if (!cacheRef.current || cacheRef.current.version !== versionRef.current) {
      cacheRef.current = { version: versionRef.current, value: readRef.current() };
    }
    return cacheRef.current.value;
  }, []);

  const getServerSnapshot = useCallback(() => serverFallback, [serverFallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
