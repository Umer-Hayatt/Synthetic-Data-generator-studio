import React from 'react';
import { Database, ArrowUpRight } from 'lucide-react';

export const Header: React.FC = () => (
  <header className="landing-header">
    <a className="brand" href="#top" aria-label="Synthetic Data Studio home">
      <span className="brand-mark"><Database size={19} strokeWidth={1.7} /></span>
      <span>Synthetic Data Studio</span>
    </a>
    <nav aria-label="Main navigation">
      <a href="#workflow">How it works</a>
      <a href="#examples">Examples</a>
      <a href="#create" className="btn btn-primary">Start creating <ArrowUpRight size={15} /></a>
    </nav>
  </header>
);
