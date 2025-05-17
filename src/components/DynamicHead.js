import React, { useEffect } from 'react';

// This component dynamically updates the favicon and manifest links
// to work around the %PUBLIC_URL% issue in production
const DynamicHead = () => {
  useEffect(() => {
    // Fix favicon links
    const faviconLinks = document.querySelectorAll('link[rel="icon"]');
    faviconLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes('%PUBLIC_URL%')) {
        link.setAttribute('href', href.replace('%PUBLIC_URL%', '.'));
      }
    });

    // Fix manifest link
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      const href = manifestLink.getAttribute('href');
      if (href && href.includes('%PUBLIC_URL%')) {
        manifestLink.setAttribute('href', href.replace('%PUBLIC_URL%', '.'));
      }
    }

    // Fix apple touch icon
    const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (appleTouchIcon) {
      const href = appleTouchIcon.getAttribute('href');
      if (href && href.includes('%PUBLIC_URL%')) {
        appleTouchIcon.setAttribute('href', href.replace('%PUBLIC_URL%', '.'));
      }
    }
  }, []);

  return null; // This component doesn't render anything
};

export default DynamicHead; 