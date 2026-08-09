import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadReport } from '../services/api';
import { useMessaging } from '../context/MessagingContext';

/**
 * Export Centre — the same two buttons on every exportable report (Trial
 * Balance, Ledger, Journals, Aged Reports, VAT Registers). `path` and
 * `params` mirror exactly what the on-screen report already fetched, so
 * the export always matches what's currently visible.
 */
export function ExportButtons({ path, params, filename }) {
  const { showMessage } = useMessaging();
  const [busy, setBusy] = useState(null);

  const handleExport = async (format) => {
    setBusy(format);
    try {
      await downloadReport(path, params, format, filename);
    } catch (err) {
      showMessage('error', 'Export Failed', err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-buttons">
      <button type="button" className="btn-sm" disabled={!!busy} onClick={() => handleExport('csv')}>
        <Download size={13} /> {busy === 'csv' ? 'Exporting…' : 'CSV'}
      </button>
      <button type="button" className="btn-sm" disabled={!!busy} onClick={() => handleExport('xlsx')}>
        <Download size={13} /> {busy === 'xlsx' ? 'Exporting…' : 'Excel'}
      </button>
      <style dangerouslySetInnerHTML={{ __html: `
        .export-buttons { display: flex; gap: 8px; }
        .export-buttons .btn-sm { display: inline-flex; align-items: center; gap: 5px; }
      `}} />
    </div>
  );
}

export default ExportButtons;
