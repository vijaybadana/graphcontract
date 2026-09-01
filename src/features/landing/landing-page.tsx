'use client';

/* eslint-disable @next/next/no-html-link-for-pages -- vinext currently intercepts Link navigation to the isolated canvas without completing the route transition. */

import {
  ArrowRightIcon,
  CheckCircleIcon,
  FileTextIcon,
  GitBranchIcon,
  LockSimpleIcon,
  PencilSimpleIcon,
  PersonSimpleIcon,
  RobotIcon,
} from '@phosphor-icons/react';

import './landing-page.css';

const steps = [
  {
    number: '01',
    title: 'Propose',
    copy: 'Agent drafts the behavior.',
    icon: RobotIcon,
    tone: 'agent',
  },
  {
    number: '02',
    title: 'Review',
    copy: 'Human changes boundaries.',
    icon: PencilSimpleIcon,
    tone: 'human',
  },
  {
    number: '03',
    title: 'Freeze',
    copy: 'Contract becomes authoritative.',
    icon: LockSimpleIcon,
    tone: 'frozen',
  },
  {
    number: '04',
    title: 'Hand off',
    copy: 'Scenarios guide implementation.',
    icon: FileTextIcon,
    tone: 'handoff',
  },
] as const;

const reasons = [
  {
    title: 'Shared visual language',
    copy: 'Humans and agents work from the same graph.',
    icon: GitBranchIcon,
  },
  {
    title: 'Human-owned approval',
    copy: 'Only a person can accept and freeze changes.',
    icon: PersonSimpleIcon,
  },
  {
    title: 'Deterministic handoff',
    copy: 'Every reachable path becomes an implementation scenario.',
    icon: CheckCircleIcon,
  },
] as const;

function BrandMark() {
  return (
    <span className="landing-brand" aria-label="GraphContract">
      <span className="landing-brand-mark" aria-hidden="true">GC</span>
      <span>GraphContract</span>
    </span>
  );
}

function HeroNode({
  id,
  type,
  label,
  icon: Icon,
}: {
  id: string;
  type: string;
  label: string;
  icon: typeof RobotIcon;
}) {
  return (
    <div className="landing-graph-node" data-node={id} data-tone={type.toLowerCase()}>
      <span className="landing-graph-icon" aria-hidden="true">
        <Icon size={18} weight="bold" />
      </span>
      <span className="landing-graph-copy">
        <span className="landing-graph-kind">{type}</span>
        <strong>{label}</strong>
      </span>
    </div>
  );
}

function LifecycleGraph() {
  return (
    <div className="landing-graph-frame">
      <div className="landing-graph-toolbar" aria-hidden="true">
        <span><i className="is-agent" /> Agent</span>
        <span><i className="is-human" /> Human</span>
        <span><i className="is-approved" /> Approved</span>
        <span className="landing-graph-live"><i /> Contract lifecycle</span>
      </div>
      <div
        className="landing-graph-stage"
        role="img"
        aria-label="GraphContract lifecycle: Start, Agent proposal, Human review, Revise or Approve, Frozen contract, then Implementation handoff. Revise loops back to Agent proposal."
      >
        <svg className="landing-graph-edges" viewBox="0 0 1100 520" aria-hidden="true">
          <defs>
            <marker id="landing-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 9 4.5 L 0 9 z" />
            </marker>
            <marker id="landing-arrow-human" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="strokeWidth">
              <path d="M 0 0 L 9 4.5 L 0 9 z" />
            </marker>
          </defs>
          <path className="landing-edge edge-1" pathLength="1" d="M164 255 L231 255" />
          <path className="landing-edge edge-2" pathLength="1" d="M391 255 L462 255" />
          <path className="landing-edge landing-edge-human edge-3" pathLength="1" d="M542 291 C542 330 537 350 537 374" />
          <path className="landing-edge landing-edge-human edge-4" pathLength="1" d="M622 245 C650 245 660 155 693 155" />
          <path className="landing-edge landing-edge-loop edge-5" pathLength="1" d="M462 410 C350 470 270 430 311 291" />
          <path className="landing-edge landing-edge-approved edge-6" pathLength="1" d="M833 155 L858 155" />
          <path className="landing-edge landing-edge-approved edge-7" pathLength="1" d="M933 191 C933 240 943 285 943 317" />
          <path className="landing-active-pulse" pathLength="1" d="M164 255 L462 255 C650 255 650 155 693 155 L858 155 C933 155 943 250 943 317" />
        </svg>

        <HeroNode id="start" type="Start" label="Start" icon={CheckCircleIcon} />
        <HeroNode id="proposal" type="Agent" label="Agent proposal" icon={RobotIcon} />
        <HeroNode id="review" type="Human" label="Human review" icon={PersonSimpleIcon} />
        <HeroNode id="revise" type="Action" label="Revise" icon={PencilSimpleIcon} />
        <HeroNode id="approve" type="Approval" label="Approve" icon={CheckCircleIcon} />
        <HeroNode id="frozen" type="Contract" label="Frozen contract" icon={LockSimpleIcon} />
        <HeroNode id="handoff" type="Output" label="Implementation handoff" icon={FileTextIcon} />

        <div className="landing-mobile-path" aria-hidden="true">
          Revise loops back · Approve moves forward
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand-link" href="#top" aria-label="GraphContract home">
          <BrandMark />
        </a>
        <nav className="landing-nav" aria-label="Landing page">
          <a href="#how-it-works">How it works</a>
          <a href="#why-graphcontract">Why GraphContract</a>
        </nav>
        <a className="landing-button landing-button-primary landing-header-cta" href="/">
          Open canvas
          <ArrowRightIcon aria-hidden="true" size={15} weight="bold" />
        </a>
      </header>

      <section className="landing-hero" id="top" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> Human-approved agent workflows</p>
          <h1 id="landing-title">Plan agent behavior before code.</h1>
          <p className="landing-hero-line">Agents propose. Humans revise. Contracts freeze.</p>
          <div className="landing-actions">
            <a className="landing-button landing-button-primary" href="/">
              Open canvas
              <ArrowRightIcon aria-hidden="true" size={16} weight="bold" />
            </a>
            <a className="landing-button landing-button-secondary" href="#how-it-works">
              See how it works
            </a>
          </div>
        </div>
        <LifecycleGraph />
      </section>

      <section className="landing-section" id="how-it-works" aria-labelledby="how-title">
        <div className="landing-section-heading">
          <p className="landing-kicker">How it works</p>
          <h2 id="how-title">One contract. Four clear moves.</h2>
        </div>
        <ol className="landing-steps">
          {steps.map(({ number, title, copy, icon: Icon, tone }) => (
            <li key={title} data-tone={tone}>
              <span className="landing-step-number">{number}</span>
              <span className="landing-step-icon" aria-hidden="true"><Icon size={18} weight="bold" /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-section landing-why" id="why-graphcontract" aria-labelledby="why-title">
        <div className="landing-section-heading">
          <p className="landing-kicker">Why GraphContract</p>
          <h2 id="why-title">Agreement is part of the architecture.</h2>
        </div>
        <div className="landing-reasons">
          {reasons.map(({ title, copy, icon: Icon }) => (
            <article key={title}>
              <span aria-hidden="true"><Icon size={21} weight="bold" /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta" aria-labelledby="final-cta-title">
        <div>
          <p className="landing-kicker">Human authority, made visible</p>
          <h2 id="final-cta-title">Agree before agents execute.</h2>
        </div>
        <a className="landing-button landing-button-primary" href="/">
          Open GraphContract
          <ArrowRightIcon aria-hidden="true" size={16} weight="bold" />
        </a>
      </section>

      <footer className="landing-footer">
        <BrandMark />
        <a href="#how-it-works">Product</a>
      </footer>
    </main>
  );
}
