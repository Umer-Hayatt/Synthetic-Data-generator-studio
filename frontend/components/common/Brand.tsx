import React from 'react';
import Image from 'next/image';

export function Brand() {
  return <span className="brand-lockup"><Image src="/media/data-mine-mark.png" width={40} height={40}
    alt="" className="brand-symbol" /><span className="brand-wordmark">Data Mine</span></span>;
}
