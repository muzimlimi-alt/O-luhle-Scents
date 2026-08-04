import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

const STAGE_LABELS = {
  PICKED_UP: 'Picked Up',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  RETURNED: 'Returned',
};

const humanize = (status) => STAGE_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/**
 * Vertical order-history timeline: synthesizes an "Order Placed" node from
 * createdAt (LogisticsEvent rows only start once fulfillment begins), then
 * renders every real LogisticsEvent in chronological order.
 */
export function OrderTracker({ events = [], createdAt }) {
  const nodes = [
    { status: 'ORDER_PLACED', message: 'Order placed', createdAt, location: null, synthetic: true },
    ...[...events].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  ];

  return (
    <div className="order-tracker">
      {nodes.map((node, idx) => {
        const isLast = idx === nodes.length - 1;
        return (
          <div className="tracker-node" key={node.id || `synthetic-${idx}`}>
            <div className="tracker-node-marker">
              {isLast ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              {!isLast && <div className="tracker-node-line" />}
            </div>
            <div className="tracker-node-content">
              <p className="tracker-node-status">{node.synthetic ? 'Order Placed' : humanize(node.status)}</p>
              {node.message && <p className="tracker-node-message">{node.message}</p>}
              <p className="tracker-node-meta">
                {new Date(node.createdAt).toLocaleString()}
                {node.location ? ` · ${node.location}` : ''}
              </p>
            </div>
          </div>
        );
      })}

      <style dangerouslySetInnerHTML={{ __html: `
        .order-tracker { display: flex; flex-direction: column; }
        .tracker-node { display: flex; gap: 14px; }
        .tracker-node-marker {
          display: flex; flex-direction: column; align-items: center; flex-shrink: 0;
          color: var(--color-primary);
        }
        .tracker-node:last-child .tracker-node-marker { color: var(--color-success-text); }
        .tracker-node-line { width: 2px; flex: 1; min-height: 24px; background: var(--color-border); margin: 4px 0; }
        .tracker-node-content { padding-bottom: 20px; }
        .tracker-node-status { font-weight: 600; color: var(--color-text-header); font-size: 0.88rem; margin: 0 0 2px; }
        .tracker-node-message { font-size: 0.82rem; color: var(--color-text); margin: 0 0 2px; }
        .tracker-node-meta { font-size: 0.75rem; color: var(--color-text-muted); margin: 0; }
      `}} />
    </div>
  );
}

export default OrderTracker;
