import { useEffect, useState } from "react";

function currentSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

export function useTerminalSize(): { columns: number; rows: number } {
  const [size, setSize] = useState(currentSize);

  useEffect(() => {
    const onResize = () => setSize(currentSize());

    process.stdout.on("resize", onResize);

    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);

  return size;
}
