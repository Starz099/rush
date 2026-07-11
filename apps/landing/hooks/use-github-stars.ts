import { useState, useEffect } from 'react';

const DEFAULT_STARS = 0;

export function useGitHubStars() {
  const [stars, setStars] = useState<number>(DEFAULT_STARS);

  useEffect(() => {
    let isMounted = true;

    fetch('/api/stars')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch stars');
        return res.json();
      })
      .then((data) => {
        if (isMounted && typeof data.stars === 'number') {
          setStars(data.stars);
        }
      })
      .catch((err) => {
        console.error('Error loading GitHub stars:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const formattedStars = (() => {
    if (stars < 1000) return stars.toString();
    const formatted = (stars / 1000).toFixed(1);
    return formatted.endsWith('.0')
      ? `${formatted.slice(0, -2)}k`
      : `${formatted}k`;
  })();

  return { stars, formattedStars };
}
