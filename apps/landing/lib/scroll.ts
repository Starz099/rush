/**
 * Custom kinetic smooth scrolling helper using requestAnimationFrame.
 * Employs a cubic easing-out curve (fast start, slow deceleration) for a snappy, premium feel.
 */
export function customSmoothScroll(targetId: string, duration: number = 600) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const targetPosition =
    target.getBoundingClientRect().top + window.pageYOffset;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime: number | null = null;

  function animation(currentTime: number) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    } else {
      window.scrollTo(0, targetPosition); // Lock precision at completion
    }
  }

  // Cubic easing out curve
  function ease(t: number, b: number, c: number, d: number) {
    t /= d;
    t--;
    return c * (t * t * t + 1) + b;
  }

  requestAnimationFrame(animation);
}

export function customSmoothScrollToTop(duration: number = 600) {
  const startPosition = window.pageYOffset;
  const distance = -startPosition;
  let startTime: number | null = null;

  function animation(currentTime: number) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    } else {
      window.scrollTo(0, 0); // Lock precision
    }
  }

  // Cubic easing out curve
  function ease(t: number, b: number, c: number, d: number) {
    t /= d;
    t--;
    return c * (t * t * t + 1) + b;
  }

  requestAnimationFrame(animation);
}
