import React from 'react';
import { Brand } from '../common/Brand';
import { ArrowUpRight } from 'lucide-react';

export const Header: React.FC = () => (
  <header className="landing-header">
    <a className="brand" href="#top" aria-label="Data Mine Home">
      <Brand />
    </a>
    <nav aria-label="Main navigation">
      <a href="#workflow">How It Works</a>
      <a href="#examples">Examples</a>
      <a href="#create" className="btn btn-primary">Start Creating <ArrowUpRight size={15} /></a>
    </nav>
  </header>
);
