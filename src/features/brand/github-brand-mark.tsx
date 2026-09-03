import type { CSSProperties } from 'react';
import Image from 'next/image';

import './github-brand-mark.css';

export function GitHubBrandMark({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={['github-brand-mark', className].filter(Boolean).join(' ')}
      style={{ '--github-brand-mark-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <Image
        className="github-brand-mark__black"
        src="/brand/github/GitHub_Invertocat_Black.svg"
        alt=""
        width={98}
        height={96}
        unoptimized
      />
      <Image
        className="github-brand-mark__white"
        src="/brand/github/GitHub_Invertocat_White.svg"
        alt=""
        width={98}
        height={96}
        unoptimized
      />
    </span>
  );
}
