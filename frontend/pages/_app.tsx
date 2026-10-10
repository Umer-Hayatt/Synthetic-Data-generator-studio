import type { AppProps } from 'next/app';
import { Manrope, JetBrains_Mono } from 'next/font/google';
import { StudioProvider } from '../context/StudioContext';
import '../styles/globals.css';
import '../styles/landing.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${manrope.variable} ${jetbrainsMono.variable} ${manrope.className}`}>
      <StudioProvider>
        <Component {...pageProps} />
      </StudioProvider>
    </div>
  );
}
