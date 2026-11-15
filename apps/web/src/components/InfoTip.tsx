import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title: string;
  children: React.ReactNode;
  lightTheme?: boolean;
}

export function InfoTip({ title, children, lightTheme = false }: Props) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const open = hovered || pinned;

  const updatePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popW = 280;
    const popH = 148;
    const margin = 12;

    let left = r.left + r.width * 0.5 - popW * 0.5;
    left = Math.max(margin, Math.min(window.innerWidth - popW - margin, left));

    let top = r.bottom + 8;
    if (top + popH > window.innerHeight - margin) {
      top = Math.max(margin, r.top - popH - 8);
    }
    setCoords({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setPinned(false);
      setHovered(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Explain: ${title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          updatePos();
          setPinned((v) => !v);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') {
            updatePos();
            setHovered(true);
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') {
            setHovered(false);
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: lightTheme
            ? '1px solid rgba(20, 22, 24, 0.48)'
            : '1px solid rgba(234, 230, 223, 0.45)',
          background: open
            ? 'var(--rust)'
            : lightTheme
            ? 'rgba(20, 22, 24, 0.08)'
            : 'rgba(234, 230, 223, 0.09)',
          color: open ? '#fff' : lightTheme ? '#141618' : '#EAE6DF',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1,
          padding: 0,
          marginLeft: 6,
          verticalAlign: 'middle',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        i
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 280,
              zIndex: 9999,
              background: '#16191D',
              color: '#EAE6DF',
              border: '1px solid rgba(234, 230, 223, 0.4)',
              boxShadow: '0 16px 38px rgba(0, 0, 0, 0.72)',
              padding: '12px 14px',
              pointerEvents: 'auto',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: '#8FB8C2',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 5,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#EAE6DF', fontFamily: 'var(--font-sans)' }}>
              {children}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
