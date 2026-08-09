import { useEffect, useState } from 'react';
import { adminOpsApi } from '../services/api';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';
import { Truck, Plus, Mail, Phone, Search } from 'lucide-react';

export function Suppliers() {
  const { showMessage } = useMessaging();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', contactEmail: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      const data = await adminOpsApi.suppliers.list();
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminOpsApi.suppliers.create(newSupplier);
      setShowModal(false);
      setNewSupplier({ name: '', contactEmail: '', phone: '' });
      fetchSuppliers();
    } catch (err) {
      showMessage('error', 'Registration Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'name', label: 'Supplier', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
        <Truck size={16} color="var(--color-primary)" /> {val}
      </div>
    )},
    { key: 'contactEmail', label: 'Email', render: (val) => (
      <a href={`mailto:${val}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
        <Mail size={13} color="var(--color-text-muted)" /> {val}
      </a>
    )},
    { key: 'phone', label: 'Phone', render: (val) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Phone size={13} color="var(--color-text-muted)" /> {val || '—'}
      </div>
    )},
    { key: 'createdAt', label: 'Partner Since', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="elite-suppliers-container animate-fade-in">
      <PageHeader
        icon={<Truck size={22} />}
        title="Suppliers"
        subtitle="Distribution and raw material fulfillment partners."
        actions={(
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Register Partner
          </button>
        )}
      />

      <div className="atelier-discovery">
        <div className="search-glass-wrapper">
          <Search size={18} className="glass-icon" />
          <input
            type="text"
            className="search-glass-input"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading suppliers..." />
      ) : (
        <div className="card">
          <DataTable
            columns={columns}
            data={filteredSuppliers}
            emptyState={<EmptyState icon={<Truck size={40} />} title="No suppliers yet" description="Register your first distribution partner to get started." />}
          />
        </div>
      )}

      <Drawer isOpen={showModal} onClose={() => setShowModal(false)} title="Register Partner" width={480}>
        <form onSubmit={handleSubmit} className="elite-form">
          <FormField label="Company Name" required>
            <input
              type="text"
              value={newSupplier.name}
              onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
              required
              placeholder="e.g. Grasse Essence Co."
            />
          </FormField>
          <FormField label="Email" required>
            <input
              type="email"
              value={newSupplier.contactEmail}
              onChange={e => setNewSupplier({...newSupplier, contactEmail: e.target.value})}
              required
              placeholder="fulfillment@grasse.com"
            />
          </FormField>
          <FormField label="Phone">
            <input
              type="tel"
              value={newSupplier.phone}
              onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
              placeholder="+33 4 00 00 00 00"
            />
          </FormField>

          <div className="modal-actions-elite">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Registering...' : 'Register Partner'}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Drawer>

      <style dangerouslySetInnerHTML={{ __html: `
        .elite-suppliers-container { padding: 40px; max-width: 1400px; margin: 0 auto; min-height: 100vh; }

        .atelier-discovery { margin-bottom: 24px; }
        .search-glass-wrapper { position: relative; background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: 4px; padding: 10px 16px; display: flex; align-items: center; max-width: 500px; }
        .search-glass-input { background: none; border: none; color: var(--color-text); width: 100%; outline: none; margin-left: 12px; font-size: 0.9rem; }

        .elite-form { display: flex; flex-direction: column; }
        .modal-actions-elite { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }

        @media (max-width: 768px) {
          .atelier-discovery { flex-direction: column; align-items: stretch; }
        }
      `}} />
    </div>
  );
}
