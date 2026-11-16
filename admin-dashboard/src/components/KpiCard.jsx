import { TrendingUp, TrendingDown } from 'lucide-react';

function sparkPoints(values) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => `${(i / (values.length - 1)) * 120},${38 - ((v - min) / range) * 34}`)
    .join(' ');
}

export function KpiCard({
  label,
  value,
  icon,
  delta,
  footnote,
  sparkline,
  sparkTone = 'accent',
  onClick,
}) {
  const Tag = onClick ? 'button' : 'article';
  const interactiveProps = onClick
    ? { type: 'button', onClick, className: 'kpi-card kpi-card--interactive' }
    : { className: 'kpi-card' };

  const points = sparkPoints(sparkline);

  return (
    <Tag {...interactiveProps}>
      <div className="kpi-card__top">
        <h2 className="kpi-card__label">{label}</h2>
        {icon && <span className="kpi-card__icon" aria-hidden="true">{icon}</span>}
      </div>
      <p className="kpi-card__value">{value}</p>
      {(delta || footnote) && (
        <p className="kpi-card__foot">
          {delta && (
            <span className={`kpi-card__delta kpi-card__delta--${delta.direction || 'flat'}`}>
              {delta.direction === 'up' && <TrendingUp size={12} />}
              {delta.direction === 'down' && <TrendingDown size={12} />}
              {delta.value}
            </span>
          )}
          {footnote && <span>{footnote}</span>}
        </p>
      )}
      {sparkline && sparkline.length >= 2 ? (
        <svg className="kpi-card__spark" viewBox="0 0 120 38" role="img" aria-label={`${label} trend`}>
          <polyline
            points={points}
            fill="none"
            className={sparkTone === 'accent' ? 'kpi-card__spark-accent' : 'kpi-card__spark-mute'}
            strokeWidth="1.6"
          />
        </svg>
      ) : sparkline ? (
        <div className="kpi-card__spark kpi-card__spark--empty" aria-hidden="true" />
      ) : null}
    </Tag>
  );
}

export default KpiCard;
