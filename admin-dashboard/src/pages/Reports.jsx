import React, { useState } from 'react';
import { adminOpsApi } from '../services/api';
import { FileBarChart, Download, Calendar, Loader2 } from 'lucide-react';

export function Reports() {
  const [loading, setLoading] = useState(false);
  const [monthOffset, setMonthOffset] = useState(1);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const response = await adminOpsApi.reports.generate(monthOffset);
      const url = window.URL.createObjectURL(new Blob([response]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `O_luhle_Executive_Report_Month_${monthOffset}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Report Generation Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reports-page">
      <div className="content-header">
        <h2 className="page-title">Executive Intelligence</h2>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
             <FileBarChart size={24} color="var(--color-primary)" />
             <h3 style={{ margin: 0 }}>Monthly Performance Report</h3>
          </div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Generate a high-fidelity executive report containing revenue analytics, best-selling fragrance variants, and customer acquisition metrics for any previous month.
          </p>
          
          <div className="form-group" style={{ marginBottom: '20px' }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={14} /> Select Previous Month
             </label>
             <select 
               value={monthOffset} 
               onChange={(e) => setMonthOffset(parseInt(e.target.value))}
               className="admin-input"
               style={{ marginTop: '8px' }}
             >
                <option value={1}>Last Month</option>
                <option value={2}>2 Months Ago</option>
                <option value={3}>3 Months Ago</option>
             </select>
          </div>

          <button 
            className="btn btn--primary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            disabled={loading}
            onClick={handleGenerate}
          >
             {loading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
             {loading ? 'Generating Report...' : 'Download PDF Report'}
          </button>
        </div>

        <div className="card" style={{ opacity: 0.7 }}>
           <h3 style={{ marginBottom: '12px' }}>Inventory Health Forecast</h3>
           <p style={{ fontSize: '0.85rem' }}>Automated daily replenishment analysis available in Dashboard overview.</p>
           <div style={{ padding: '20px', border: '1px dashed var(--color-border)', borderRadius: '8px', textAlign: 'center', marginTop: '20px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Advanced AI Predictions coming soon.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
