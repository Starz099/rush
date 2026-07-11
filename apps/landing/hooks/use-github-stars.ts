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

  const formattedStars = new Intl.NumberFormat('en-US').format(stars);

  return { stars, formattedStars };
}
