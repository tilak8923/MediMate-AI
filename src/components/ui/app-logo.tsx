import { Icon } from 'lucide-react';
import React from 'react';
import logo from './logo.png'; // Assuming your logo is in the same directory
// interface AppLogoProps extends React.SVGProps<SVGSVGElement> {}

// export const AppLogo: React.FC<AppLogoProps> = ({ width = 32, height = 32, ...props }) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     width={width}
//     height={height}
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke="hsl(var(--primary))"
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//     {...props} // Spread remaining props
//     // No conditional classes needed here, visibility handled by parent
//   >
//       <path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2z"/>
//       <path d="M12 12a2 2 0 1 0-4 0v4a2 2 0 0 0 4 0Z"/>
//       <path d="M12 12a2 2 0 1 0 4 0v-4a2 2 0 0 0-4 0Z"/>
//       <path d="m16 8 4-4"/>
//       <path d="m17 17 4 4"/>
//   </svg>
// );
interface AppLogoProps extends React.SVGProps<HTMLImageElement> {
  width?: number;
  height?: number;
}

export const AppLogo: React.FC<AppLogoProps> = ({ width = 50, height = 50, ...props }) => (
  <img src="/favicon.ico" alt="App Logo" width={width} height={height} {...props} />
);
// Icon({ name: 'app-logo', 32, 32, ...props }
