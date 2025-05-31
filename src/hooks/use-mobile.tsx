import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Initialize state to a default (e.g., false) to ensure consistency
  // between server and initial client render before useEffect runs.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after initial hydration.
    const checkDevice = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Perform the check immediately on the client after mount.
    checkDevice();

    // Add resize listener for dynamic changes.
    window.addEventListener("resize", checkDevice);

    // Cleanup listener on component unmount.
    return () => window.removeEventListener("resize", checkDevice);
  }, []); // Empty dependency array ensures this runs once on mount (client-side).

  // Return the determined state (or the initial default state during SSR/initial render).
  return isMobile;
}
