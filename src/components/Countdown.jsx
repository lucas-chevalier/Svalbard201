import { useState, useEffect } from "react";

export default function Countdown({ onFinish }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      onFinish();
      return;
    }
    const timer = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onFinish]);

  if (count === 0) return null;

  return (
    <div className="countdown-overlay">
      {count}
    </div>
  );
}
