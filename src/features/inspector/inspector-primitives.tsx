import {
  CaretRightIcon,
  CrosshairIcon,
  DotsThreeVerticalIcon,
} from '@phosphor-icons/react';
import type { HTMLAttributes, ReactNode } from 'react';

export type InspectorHeaderAction = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export function InspectorShell({
  label,
  header,
  children,
}: {
  label: string;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="context-inspector inspector-shell" aria-label={label}>
      {header}
      <div className="inspector-shell__body">{children}</div>
    </section>
  );
}

export function InspectorEntityHeader({
  title,
  icon,
  tone,
  onFocus,
  focusLabel = 'Focus',
  actions = [],
  status,
  onCollapse,
}: {
  title: string;
  icon: ReactNode;
  tone: string;
  onFocus?: () => void;
  focusLabel?: string;
  actions?: readonly InspectorHeaderAction[];
  status?: ReactNode;
  onCollapse?: () => void;
}) {
  return (
    <header className="inspector-entity-header">
      <span className="inspector-entity-header__icon" data-inspector-tone={tone} aria-hidden="true">
        {icon}
      </span>
      <div className="inspector-entity-header__identity">
        <h2>{title}</h2>
        {status}
      </div>
      <div className="inspector-entity-header__utilities">
        {onFocus && (
          <button type="button" className="inspector-entity-header__focus" onClick={onFocus}>
            <CrosshairIcon size={17} weight="bold" aria-hidden="true" />
            <span>{focusLabel}</span>
          </button>
        )}
        {actions.length > 0 && (
          <details className="inspector-entity-menu">
            <summary aria-label={`More actions for ${title}`}>
              <DotsThreeVerticalIcon size={18} weight="bold" aria-hidden="true" />
            </summary>
            <div className="inspector-entity-menu__popover" role="menu">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  className={action.danger ? 'is-danger' : undefined}
                  onClick={(event) => {
                    action.onSelect();
                    event.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </details>
        )}
        {onCollapse && (
          <button type="button" className="inspector-entity-header__collapse" onClick={onCollapse} aria-label="Collapse inspector">
            <CaretRightIcon size={17} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}

export function InspectorSection({
  title,
  children,
  className = '',
  ...props
}: {
  title?: string;
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section className={`context-inspector__group inspector-section ${className}`.trim()} {...props}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

export function InspectorField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="context-inspector__field inspector-field">
      <span>{label}</span>
      <div>{children}</div>
    </label>
  );
}

export function InspectorAddModifier({
  options,
}: {
  options: readonly { id: string; label: string; onSelect: () => void }[];
}) {
  if (options.length === 0) return null;
  return (
    <details className="inspector-add-modifier">
      <summary>Add modifier</summary>
      <div className="inspector-add-modifier__popover" role="menu">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            onClick={(event) => {
              option.onSelect();
              event.currentTarget.closest('details')?.removeAttribute('open');
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}
