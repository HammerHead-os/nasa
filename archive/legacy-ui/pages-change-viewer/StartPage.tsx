interface Props {
  onOpenGround: () => void;
  onOpenRadar: () => void;
}

const COLUMNS = [
  ['Column A', 'Gravel with 4% ice'],
  ['Column B', 'Peat with 48% ice'],
];

export function StartPage({ onOpenGround, onOpenRadar }: Props) {
  return (
    <div className="start-page">
      <div className="start-copy">
        <p className="mono start-kicker">Gitanjali Penumatsa, NUS · Aniket Mimani, NTU</p>
        <h1 className="serif start-title">A ground model for permafrost at Eight Mile Lake</h1>
        <p className="start-p">
          We built this for NASA Space Apps 2026. The ground at Eight Mile Lake in Alaska holds permafrost, and the ice
          in that ground controls how far the surface drops as the soil warms. You set two columns, one with little ice
          and one with a lot, and the model runs both from 2026 to 2050.
        </p>
        <p className="start-p">
          The drill page turns that result into a list of spots in the valley. The radar page holds NISAR pictures of
          the same place, because NISAR only records the surface.
        </p>
        <div className="start-actions">
          <button className="primary-btn" onClick={onOpenGround}>
            Open the ground model
          </button>
          <button className="text-btn" onClick={onOpenRadar}>
            Open the radar
          </button>
        </div>
      </div>

      <div className="start-side">
        <figure className="start-photo">
          <img src="/hires/eml_optical_1024.jpg" alt="Eight Mile Lake, Alaska" />
          <figcaption className="mono">Eight Mile Lake, the valley this model is for.</figcaption>
        </figure>
        <ul className="start-places">
          {COLUMNS.map(([name, line]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
