import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateTime } from 'luxon';
import { adminOpsApi } from '../services/api';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Users, Mail, Search, ShoppingBag, Gem, Crown, UserX, Download } from 'lucide-react';

// Tiers are derived live from real lifetime spend — nobody is assigned one,
// nothing is stored. Thresholds match the reference brief's own "Atelier =
// spend above R8,000" framing; Maison is the natural middle band above the
// entry tier. There's no points/referral system in this app (confirmed
// absent from the schema), so — unlike the reference — this only ever
// shows tier membership, never fabricated points balances.
const ATELIER_THRESHOLD = 8000;
const MAISON_THRESHOLD = 2000;
const AT_RISK_DAYS = 180;

function tierFor(spend) {
  if (spend >= ATELIER_THRESHOLD) return 'Atelier';
  if (spend >= MAISON_THRESHOLD) return 'Maison';
  return 'Découverte';
}

const TIER_PILL = { Atelier: 'gold', Maison: 'info', 'Découverte': 'mute' };

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [segment, setSegment] = useState('all');

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const data = await adminOpsApi.customers.list();
        setCustomers(data);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const enriched = useMemo(() => customers.map((c) => {
    const spend = c.lifetimeSpend || 0;
    const daysSinceOrder = c.lastOrderAt ? DateTime.now().diff(DateTime.fromISO(c.lastOrderAt), 'days').days : null;
    return {
      ...c,
      tier: tierFor(spend),
      atRisk: daysSinceOrder != null && daysSinceOrder > AT_RISK_DAYS,
    };
  }), [customers]);

  const totalCustomers = enriched.length;
  const withOrders = enriched.filter((c) => c.orderCount > 0);
  const repeatRate = withOrders.length > 0 ? (withOrders.filter((c) => c.orderCount >= 2).length / withOrders.length) * 100 : null;
  const avgLifetimeValue = totalCustomers > 0 ? enriched.reduce((s, c) => s + (c.lifetimeSpend || 0), 0) / totalCustomers : 0;
  const atelierCount = enriched.filter((c) => c.tier === 'Atelier').length;
  const maisonCount = enriched.filter((c) => c.tier === 'Maison').length;
  const decouverteCount = enriched.filter((c) => c.tier === 'Découverte').length;
  const atRiskCount = enriched.filter((c) => c.atRisk).length;
  const newThisMonth = enriched.filter((c) => c.createdAt && DateTime.fromISO(c.createdAt) >= DateTime.now().startOf('month')).length;

  const segmentFiltered = enriched.filter((c) => {
    if (segment === 'atelier') return c.tier === 'Atelier';
    if (segment === 'maison') return c.tier === 'Maison';
    if (segment === 'atrisk') return c.atRisk;
    return true;
  });

  const filteredCustomers = segmentFiltered.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportSegment = () => {
    const headers = ['Name', 'Email', 'City', 'Orders', 'Lifetime Spend', 'Tier', 'Customer Since'];
    const rows = filteredCustomers.map(c => [
      c.name || '', c.email || '', c.city || '', c.orderCount || 0, (c.lifetimeSpend || 0).toFixed(2), c.tier,
      c.createdAt ? new Date(c.createdAt).toISOString() : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${segment}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'name', label: 'Customer', render: (val, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="patron-avatar">{val?.charAt(0) || 'C'}</div>
        <div>
          <p style={{ fontWeight: 600, margin: 0 }}>{val}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <Mail size={11} />{row.email}
          </div>
        </div>
      </div>
    )},
    { key: 'city', label: 'Location', render: (val) => val || '—' },
    { key: 'orderCount', label: 'Orders', render: (val) => `${val || 0}` },
    { key: 'lifetimeSpend', label: 'Lifetime spend', render: (val) => `R${Number(val || 0).toLocaleString()}` },
    { key: 'tier', label: 'Tier', render: (val) => <span className={`pill ${TIER_PILL[val]}`}>{val}</span> },
    { key: 'createdAt', label: 'Customer Since', render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
  ];

  return (
    <div className="elite-customers-container animate-fade-in">
      <div className="page-head">
        <div>
          <ol className="crumbs"><li>Revenue</li><li aria-current="page">Customers</li></ol>
          <h1>Customers</h1>
          <p className="sub">
            {totalCustomers.toLocaleString()} account{totalCustomers === 1 ? '' : 's'}
            {repeatRate != null && ` · ${repeatRate.toFixed(1)}% purchase more than once`}
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn-outline btn-sm" onClick={handleExportSegment}>
            <Download size={14} /> Export segment
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/newsletters')}>
            <Mail size={14} /> New campaign
          </button>
        </div>
      </div>

      <div className="grid kpi-row mb-6">
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Total customers</h2><span className="ic" aria-hidden="true"><Users size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{totalCustomers.toLocaleString()}</p>
          <p className="kpi-foot"><span className="delta up">+{newThisMonth}</span> this month</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Lifetime value</h2><span className="ic" aria-hidden="true"><Gem size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>R {avgLifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="kpi-foot">Average across all accounts</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">Atelier tier</h2><span className="ic" aria-hidden="true"><Crown size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{atelierCount} <small>members</small></p>
          <p className="kpi-foot">Spend above R {ATELIER_THRESHOLD.toLocaleString()}</p>
        </article>
        <article className="kpi">
          <div className="kpi-top"><h2 className="kpi-label">At risk</h2><span className="ic" aria-hidden="true"><UserX size={16} /></span></div>
          <p className="kpi-val" style={{ fontSize: '1.9rem' }}>{atRiskCount}</p>
          <p className="kpi-foot"><span className={`delta ${atRiskCount > 0 ? 'down' : 'flat'}`}>No order in {AT_RISK_DAYS} days</span></p>
        </article>
      </div>

      <div className="grid g-83">
        <section className="card">
          <div className="card-head">
            <h3>Directory</h3>
            <div className="chips" role="group" aria-label="Segment filter">
              {[
                { v: 'all', l: 'All' },
                { v: 'atelier', l: 'Atelier' },
                { v: 'maison', l: 'Maison' },
                { v: 'atrisk', l: 'At risk' },
              ].map((c) => (
                <button key={c.v} type="button" className="chip" aria-pressed={segment === c.v} onClick={() => setSegment(c.v)}>{c.l}</button>
              ))}
            </div>
          </div>

          <div className="toolbar">
            <span className="field-inline">
              <Search size={13} aria-hidden="true" />
              <label className="vh" htmlFor="custSearch">Search customers</label>
              <input
                className="input"
                id="custSearch"
                type="search"
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </span>
            <span className="push mono">{filteredCustomers.length} result{filteredCustomers.length === 1 ? '' : 's'}</span>
          </div>

          {loading ? (
            <LoadingState label="Loading customers..." />
          ) : (
            <div className="card-body flush">
              <DataTable
                columns={columns}
                data={filteredCustomers}
                emptyState={<EmptyState icon={<ShoppingBag size={40} />} title="No customers found" description="Registered storefront accounts will appear here." />}
              />
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><div><h3>Loyalty <em>tiers</em></h3></div></div>
          <div className="card-body">
            <div className="bars">
              {[
                { label: 'Atelier', count: atelierCount },
                { label: 'Maison', count: maisonCount },
                { label: 'Découverte', count: decouverteCount },
              ].map((t) => {
                const pct = totalCustomers > 0 ? Math.round((t.count / totalCustomers) * 100) : 0;
                return (
                  <div key={t.label} className="bar-row">
                    <span className="lbl">{t.label}</span>
                    <span className="bar-track"><span className="bar-fill" style={{ width: `${pct}%` }} role="img" aria-label={`${pct} percent`} /></span>
                    <span className="num">{t.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
            <ul className="stat-list" style={{ marginTop: 'var(--sp-6)' }}>
              <li>Repeat customers <span className="v">{withOrders.filter((c) => c.orderCount >= 2).length.toLocaleString()}</span></li>
              <li>New this month <span className="v">{newThisMonth.toLocaleString()}</span></li>
              <li>Average lifetime value <span className="v">R {avgLifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></li>
            </ul>
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-customers-container { padding: 40px; max-width: 1600px; margin: 0 auto; min-height: 100vh; }

        .vh {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
        }

        .elite-customers-container .card { border-color: var(--border-low); }
        .mb-6 { margin-bottom: var(--sp-6); }

        .page-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: var(--sp-5); flex-wrap: wrap;
          padding-bottom: var(--sp-5); margin-bottom: var(--sp-6);
          border-bottom: 1px solid var(--border-low);
        }
        .page-head h1 { font-size: 2rem; }
        .page-head .sub { color: var(--text-muted); font-size: .9rem; margin-top: var(--sp-2); }
        .crumbs { display: flex; align-items: center; gap: var(--sp-2); font-size: .72rem; letter-spacing: .18em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 var(--sp-3); padding: 0; }
        .crumbs li { list-style: none; display: flex; align-items: center; gap: var(--sp-2); }
        .crumbs li + li::before { content: "/"; color: var(--border-strong); }
        .crumbs [aria-current] { color: var(--y-base); }
        .head-actions { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }

        .btn-primary, .btn-outline {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
          min-height: var(--tap); padding: 0 var(--sp-5);
          border-radius: var(--r); font-size: .86rem; font-weight: 400;
          letter-spacing: .06em; text-transform: uppercase;
          border: 1px solid transparent; cursor: pointer;
          transition: all var(--t-fast) var(--ease); white-space: nowrap;
        }
        .btn-primary { background: var(--y-base); color: var(--text-inverse); font-weight: 500; }
        .btn-primary:hover { background: var(--y-hover); box-shadow: 0 6px 22px rgba(var(--y-rgb), .3); }
        .btn-outline { border-color: var(--border-strong); color: var(--text-primary); background: none; }
        .btn-outline:hover { border-color: var(--y-base); background: var(--y-base); color: var(--text-inverse); }
        .btn-sm { min-height: 36px; padding: 0 var(--sp-4); font-size: .74rem; }
        .btn-primary:focus-visible, .btn-outline:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }

        .grid { display: grid; gap: var(--sp-5); }
        .kpi-row { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .g-83 { grid-template-columns: 2.1fr 1fr; }
        @media (max-width: 1180px) { .g-83 { grid-template-columns: 1fr; } }

        .kpi {
          position: relative; padding: var(--sp-5);
          background: var(--bg-surface); border: 1px solid var(--border-low); border-radius: var(--r);
          overflow: hidden; transition: border-color var(--t-fast) var(--ease), transform var(--t) var(--ease-out);
        }
        .kpi:hover { border-color: var(--y-dark); transform: translateY(-2px); }
        .kpi-top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
        .kpi-label { font-size: .68rem; letter-spacing: .2em; text-transform: uppercase; color: var(--text-muted); font-weight: 400; margin: 0; }
        .kpi-top .ic { color: var(--y-base); opacity: .8; display: inline-flex; }
        .kpi-val { font-family: var(--f-display); line-height: 1.05; margin: var(--sp-4) 0 var(--sp-2); letter-spacing: -.01em; color: var(--text-primary); }
        .kpi-val small { font-size: .6em; color: var(--text-muted); font-family: var(--f-body); }
        .kpi-foot { font-size: .78rem; color: var(--text-muted); margin: 0; }
        .delta { font-family: var(--f-mono); font-weight: 500; }
        .delta.up { color: var(--success); }
        .delta.down { color: var(--error); }
        .delta.flat { color: var(--text-muted); }

        .card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-5) var(--sp-5) var(--sp-4); border-bottom: 1px solid var(--border-low); flex-wrap: wrap; }
        .card-head h3 { font-size: 1.15rem; }
        .card-body { padding: var(--sp-5); }
        .card-body.flush { padding: 0; }

        .toolbar { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--border-low); }
        .field-inline { position: relative; min-width: 240px; display: inline-flex; align-items: center; }
        .field-inline svg { position: absolute; left: 12px; color: var(--text-muted); pointer-events: none; }
        .input {
          height: var(--tap); padding: 0 var(--sp-4);
          background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r);
          color: var(--text-primary); font-family: var(--f-body); font-weight: 300; font-size: .86rem;
        }
        .field-inline .input { width: 100%; padding-left: 36px; }
        .input::placeholder { color: var(--text-muted); }
        .input:hover { border-color: var(--border-strong); }
        .input:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow); }
        .push { margin-left: auto; }
        .mono { font-family: var(--f-mono); font-size: .76rem; color: var(--text-muted); }

        .chips { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
        .chip { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 var(--sp-4); border: 1px solid var(--border-default); border-radius: var(--r-pill); font-size: .76rem; color: var(--text-secondary); background: none; cursor: pointer; transition: all var(--t-fast) var(--ease); }
        .chip:hover { border-color: var(--y-dark); color: var(--text-primary); }
        .chip[aria-pressed="true"] { background: rgba(var(--y-rgb), .14); border-color: var(--y-base); color: var(--y-base); }

        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: var(--r-pill); font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; border: 1px solid; white-space: nowrap; }
        .pill::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex: none; }
        .pill.gold { color: var(--y-base); border-color: rgba(var(--y-rgb), .45); background: rgba(var(--y-rgb), .12); }
        .pill.info { color: var(--info); border-color: rgba(var(--info-rgb), .4); background: rgba(var(--info-rgb), .09); }
        .pill.mute { color: var(--text-muted); border-color: var(--border-default); }

        .bars { display: flex; flex-direction: column; gap: var(--sp-4); }
        .bar-row { display: grid; grid-template-columns: 90px 1fr 60px; align-items: center; gap: var(--sp-4); font-size: .84rem; }
        .bar-track { height: 8px; background: var(--bg-elevated); border-radius: var(--r-pill); overflow: hidden; }
        .bar-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--y-dark), var(--y-base)); border-radius: var(--r-pill); }
        .bar-row .num { text-align: right; font-family: var(--f-mono); font-size: .8rem; color: var(--text-muted); }
        .bar-row .lbl { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .stat-list { list-style: none; margin: 0; padding: 0; }
        .stat-list li { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-low); font-size: .86rem; color: var(--text-secondary); }
        .stat-list li:last-child { border-bottom: 0; }
        .stat-list .v { font-family: var(--f-mono); color: var(--text-primary); font-size: .88rem; }

        .patron-avatar { width: 36px; height: 36px; flex-shrink: 0; background: linear-gradient(135deg, var(--y-base), var(--y-dark)); color: #1a1611; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; font-family: var(--f-display); }

        @media (max-width: 768px) {
          .elite-customers-container { padding: 20px; }
        }
      `}} />
    </div>
  );
}
