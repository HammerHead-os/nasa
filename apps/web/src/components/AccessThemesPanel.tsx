import { useEffect, useId, useRef } from 'react';
import {
  ACCESS_MODES,
  THEMES,
  type AccessModeId,
  type ThemeId,
} from '../lib/preferences';

interface Props {
  open: boolean;
  theme: ThemeId;
  access: AccessModeId;
  onThemeChange: (id: ThemeId) => void;
  onAccessChange: (id: AccessModeId) => void;
  onClose: () => void;
}

export function AccessThemesPanel({
  open,
  theme,
  access,
  onThemeChange,
  onAccessChange,
  onClose,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="prefs-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="prefs-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="prefs-panel__head">
          <h2 id={titleId} className="serif prefs-panel__title">
            Access &amp; themes
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="mono prefs-panel__close"
            onClick={onClose}
            aria-label="Close access and themes"
          >
            Close
          </button>
        </div>

        <p className="prefs-panel__lead">
          Pick a disability-friendly mode, then try a visual theme. Choices save on this device.
        </p>

        <section className="prefs-section" aria-labelledby="access-heading">
          <h3 id="access-heading" className="mono prefs-section__label">
            Disability-friendly modes
          </h3>
          <ul className="prefs-list" role="listbox" aria-label="Access mode">
            {ACCESS_MODES.map((m) => {
              const selected = access === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`prefs-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => onAccessChange(m.id)}
                  >
                    <span className="prefs-option__name">{m.name}</span>
                    <span className="prefs-option__helps mono">{m.helps}</span>
                    <span className="prefs-option__blurb">{m.blurb}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="prefs-section" aria-labelledby="theme-heading">
          <h3 id="theme-heading" className="mono prefs-section__label">
            Themes to explore
          </h3>
          <ul className="prefs-themes" role="listbox" aria-label="Theme">
            {THEMES.map((t) => {
              const selected = theme === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`prefs-theme ${selected ? 'is-selected' : ''}`}
                    data-preview={t.id}
                    onClick={() => onThemeChange(t.id)}
                  >
                    <span className="prefs-theme__swatches" aria-hidden="true">
                      <span className="sw sw-bg" />
                      <span className="sw sw-ink" />
                      <span className="sw sw-accent" />
                    </span>
                    <span className="prefs-theme__text">
                      <span className="prefs-theme__name">{t.name}</span>
                      <span className="prefs-theme__blurb">{t.blurb}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
