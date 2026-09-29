import type { AppProps } from 'next/app';
import { StudioProvider } from '../context/StudioContext';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StudioProvider>
      <Component {...pageProps} />
    </StudioProvider>
  );
}
