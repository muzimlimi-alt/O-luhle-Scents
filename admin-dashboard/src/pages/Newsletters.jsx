import { useState, useEffect, useCallback, useRef } from 'react';
import { newsletterApi } from '../services/api';
import { Modal } from '../components/Modal';
import { Drawer } from '../components/Drawer';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { FormField } from '../components/FormField';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { useMessaging } from '../context/MessagingContext';
import {
  Users, Mail, Plus, Search, Filter, Trash2,
  RefreshCw, XCircle, Send, Paperclip, Edit2
} from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    ['link', 'image'],
    ['clean']
  ],
};

const SUB_STATUS_TONE = { active: 'success', unsubscribed: 'neutral' };
const CAMP_STATUS_TONE = { sent: 'success', sending: 'info', draft: 'neutral' };

export function Newsletters() {
  const { showMessage } = useMessaging();
  const [activeTab, setActiveTab] = useState('subscribers'); // subscribers | campaigns

  // SUBSCRIBERS STATE
  const [subscribers, setSubscribers] = useState([]);
  const [subLoading, setSubLoading] = useState(true);
  const [subSearch, setSubSearch] = useState('');
  const [subStatus, setSubStatus] = useState('all');
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);
  const [subTotal, setSubTotal] = useState(0);
  const [subStartDate, setSubStartDate] = useState('');
  const [subEndDate, setSubEndDate] = useState('');

  // CAMPAIGNS STATE
  const [campaigns, setCampaigns] = useState([]);
  const [campLoading, setCampLoading] = useState(true);
  const [campPage, setCampPage] = useState(1);
  const [campTotalPages, setCampTotalPages] = useState(1);
  const [campTotal, setCampTotal] = useState(0);
  const [campStartDate, setCampStartDate] = useState('');
  const [campEndDate, setCampEndDate] = useState('');

  // MODALS STATE
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubEmail, setNewSubEmail] = useState('');
  const [subError, setSubError] = useState(null);
  const [selectedSubscribers, setSelectedSubscribers] = useState(new Set());
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  const [isCampModalOpen, setIsCampModalOpen] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [campForm, setCampForm] = useState({ id: null, subject: '', contentHtml: '', attachments: [] });
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const quillRef = useRef(null);
  const quillInstance = useRef(null);

  /* --- SUBSCRIBERS LOGIC --- */
  const fetchSubscribers = useCallback(async () => {
    setSubLoading(true);
    try {
      const response = await newsletterApi.subscribers.list({
        page: subPage,
        limit: 15,
        status: subStatus !== 'all' ? subStatus : undefined,
        startDate: subStartDate || undefined,
        endDate: subEndDate || undefined,
      });
      // Basic Frontend filtering for search since backend doesn't have search query built in
      let filtered = response.subscribers || [];
      if (subSearch) {
        filtered = filtered.filter(s => s.email.toLowerCase().includes(subSearch.toLowerCase()));
      }
      setSubscribers(filtered);
      setSubTotalPages(Math.ceil((response.total || 0) / 15) || 1);
      setSubTotal(response.total || 0);
    } catch (err) {
      console.error('Failed to load subscribers:', String(err));
    } finally {
      setSubLoading(false);
    }
  }, [subPage, subStatus, subSearch, subStartDate, subEndDate]);

  useEffect(() => {
    if (activeTab === 'subscribers') {
      const timer = setTimeout(() => fetchSubscribers(), 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchSubscribers]);

  const handleAddSubscriber = async (e) => {
    e.preventDefault();
    setSubError(null);
    try {
      const resp = await newsletterApi.subscribers.create({ email: newSubEmail, source: 'admin', addedBy: 'Dashboard Admin' });
      if (resp && (resp.type === 'warning' || resp.type === 'error')) {
        setSubError(resp.message);
        return;
      }
      setIsSubModalOpen(false);
      setNewSubEmail('');
      fetchSubscribers();
    } catch (error) {
      setSubError(error.message || 'Failed to add subscriber');
    }
  };

  const handleToggleSubStatus = async (sub) => {
    try {
      const newStatus = sub.status === 'active' ? 'unsubscribed' : 'active';
      await newsletterApi.subscribers.updateStatus(sub.id, newStatus);
      showMessage('success', 'Status Updated', `${sub.email} is now ${newStatus}.`);
      fetchSubscribers();
    } catch (err) {
      showMessage('error', 'Update Failed', err.message || 'Unable to update subscriber status.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { id, type } = deleteConfirmTarget;
    try {
      if (type === 'subscriber') {
        await newsletterApi.subscribers.delete(id);
        showMessage('success', 'Subscriber Deleted', 'The entry has been permanently removed.');
        fetchSubscribers();
      } else if (type === 'campaign') {
        await newsletterApi.campaigns.delete(id);
        showMessage('success', 'Campaign Deleted', 'The draft has been cleared.');
        fetchCampaigns();
      }
      setDeleteConfirmTarget(null);
    } catch (err) {
      showMessage('error', 'Deletion Error', err.message || 'Something went wrong during deletion.');
    }
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) setSelectedSubscribers(new Set(subscribers.map(s => s.id)));
    else setSelectedSubscribers(new Set());
  };

  const handleToggleSelect = (id) => {
    const nextState = new Set(selectedSubscribers);
    if (nextState.has(id)) nextState.delete(id);
    else nextState.add(id);
    setSelectedSubscribers(nextState);
  };

  const handleBulkAction = async (action) => {
    if (selectedSubscribers.size === 0) return;
    if (!window.confirm(`Are you sure you want to mass-${action} ${selectedSubscribers.size} subscribers?`)) return;
    try {
      await newsletterApi.subscribers.bulkAction({ ids: Array.from(selectedSubscribers), action });
      showMessage('success', 'Bulk Action Complete', `Successfully ${action}d ${selectedSubscribers.size} subscribers.`);
      setSelectedSubscribers(new Set());
      fetchSubscribers();
    } catch (err) {
      showMessage('error', 'Bulk Action Failed', err.message);
    }
  };

  /* --- CAMPAIGNS LOGIC --- */
  const fetchCampaigns = useCallback(async () => {
    setCampLoading(true);
    try {
      const response = await newsletterApi.campaigns.list({
        page: campPage,
        limit: 15,
        startDate: campStartDate || undefined,
        endDate: campEndDate || undefined,
      });
      setCampaigns(response.campaigns || []);
      setCampTotalPages(Math.ceil((response.total || 0) / 15) || 1);
      setCampTotal(response.total || 0);
    } catch (err) {
      console.error('Failed to load campaigns:', String(err));
    } finally {
      setCampLoading(false);
    }
  }, [campPage, campStartDate, campEndDate]);

  useEffect(() => {
    if (activeTab === 'campaigns') {
      fetchCampaigns();
    }
  }, [activeTab, fetchCampaigns]);

  useEffect(() => {
    if (isCampModalOpen) {
      const timer = setTimeout(() => setEditorReady(true), 200);
      return () => clearTimeout(timer);
    } else {
      setEditorReady(false);
      quillInstance.current = null; // Reset instance on close
    }
  }, [isCampModalOpen]);

  useEffect(() => {
    if (editorReady && quillRef.current && !quillInstance.current) {
      quillInstance.current = new Quill(quillRef.current, {
        theme: 'snow',
        modules: quillModules
      });

      if (campForm.contentHtml) {
        quillInstance.current.root.innerHTML = campForm.contentHtml;
      }

      quillInstance.current.getModule('toolbar').addHandler('image', () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;

          try {
            const res = await newsletterApi.campaigns.uploadImage(file);
            const range = quillInstance.current.getSelection();
            quillInstance.current.insertEmbed(range.index, 'image', res.url);
            showMessage('success', 'Image Uploaded', 'Embedded image has been optimized and added.');
          } catch (error) {
            console.error('Image upload failed:', error);
            showMessage('error', 'Image Failed', 'Could not upload the embedded image.');
          }
        };
      });

      quillInstance.current.on('text-change', () => {
        const html = quillInstance.current.root.innerHTML;
        setCampForm(prev => {
          if (prev.contentHtml === html) return prev;
          return { ...prev, contentHtml: html };
        });
      });
    }
  }, [editorReady, campForm.contentHtml, showMessage]);

  const handleOpenCampModal = (camp = null) => {
    if (camp) {
      setCampForm({ id: camp.id, subject: camp.subject, contentHtml: camp.contentHtml || '', attachments: camp.attachments || [] });
    } else {
      setCampForm({ id: null, subject: '', contentHtml: '', attachments: [] });
    }
    setIsCampModalOpen(true);
  };

  const validateCampaignForm = () => {
    if (!campForm.subject || campForm.subject.trim().length < 3) {
      showMessage('warning', 'Subject Required', 'Please provide a descriptive subject line (min 3 chars).');
      return false;
    }
    const cleanContent = campForm.contentHtml.replace(/<[^>]*>/g, '').trim();
    if (!cleanContent || cleanContent.length < 10) {
      if (!campForm.contentHtml.includes('<img')) {
        showMessage('warning', 'Content Too Short', 'Email content must contain at least some meaningful text.');
        return false;
      }
    }
    return true;
  };

  const handleSaveCampaign = async () => {
    if (!validateCampaignForm()) return;
    setIsSaving(true);
    try {
      // Auto-format plain text to HTML if no markup is found
      let finalHtml = campForm.contentHtml;
      if (finalHtml && !finalHtml.includes('<') && !finalHtml.includes('>')) {
        finalHtml = finalHtml.split(/\n\n+/).map(p => `<p style="margin-bottom:1em;">${p.replace(/\n/g, '<br/>')}</p>`).join('\n');
      }

      const payload = { ...campForm, contentHtml: finalHtml };

      if (campForm.id) {
        await newsletterApi.campaigns.update(campForm.id, payload);
        showMessage('success', 'Campaign Updated', 'Your changes have been saved to the draft.');
      } else {
        const resp = await newsletterApi.campaigns.create(payload);
        setCampForm(prev => ({ ...prev, id: resp.campaign.id }));
        showMessage('success', 'Campaign Created', 'New draft has been successfully initiated.');
      }
      fetchCampaigns();
    } catch (err) {
      showMessage('error', 'Save Failed', err.message || 'The server rejected the campaign payload.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendCampaign = async (id) => {
    // If id is not provided, we are sending the currently open campModal
    const targetId = id || campForm.id;
    if (!targetId) {
      // If no ID yet (new campaign), we must save it first
      await handleSaveCampaign();
      return;
    }

    // Secondary validation for open modal
    if (!id && !validateCampaignForm()) return;

    if (window.confirm('Are you sure you want to broadcast this to ALL ACTIVE subscribers now?')) {
      setIsSending(true);
      try {
        const res = await newsletterApi.campaigns.send(targetId);
        showMessage('success', 'Broadcast Initiated', `${res.message} Targeted recipients: ${res.targetCount}`);
        setIsCampModalOpen(false);
        fetchCampaigns();
      } catch (err) {
        showMessage('error', 'Broadcast Failed', err.message || 'Unable to queue the campaign for sending.');
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleDeleteCampaign = async (id) => {
    setDeleteConfirmTarget({ id, type: 'campaign' });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFiles(true);
    try {
      const res = await newsletterApi.campaigns.uploadAttachment(file);
      setCampForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, res]
      }));
    } catch (err) {
      showMessage('error', 'Upload Failed', err.message);
    } finally {
      setUploadingFiles(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setCampForm(prev => {
      const atts = [...prev.attachments];
      atts.splice(index, 1);
      return { ...prev, attachments: atts };
    });
  };

  const subscriberColumns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          aria-label="Select all subscribers"
          onChange={handleToggleSelectAll}
          checked={subscribers.length > 0 && selectedSubscribers.size === subscribers.length}
        />
      ),
      render: (_val, row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.email}`}
          checked={selectedSubscribers.has(row.id)}
          onChange={() => handleToggleSelect(row.id)}
        />
      )
    },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (val) => (
      <StatusBadge tone={SUB_STATUS_TONE[val] || 'neutral'} label={val.toUpperCase()} />
    )},
    { key: 'source', label: 'Source', render: (val, row) => `${val.toUpperCase()}${row.addedBy ? ` (${row.addedBy})` : ''}` },
    { key: 'createdAt', label: 'Added', render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="newsletters-page animate-fade-in">
      <PageHeader
        icon={<Mail size={22} />}
        title="Newsletters"
        subtitle="Manage your audience and send email broadcasts."
      />

      <div className="tab-glass-panel">
        <button
          className={`tab-glass-btn ${activeTab === 'subscribers' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscribers')}
        >
          <Users size={18} /> Subscribers
        </button>
        <button
          className={`tab-glass-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          <Send size={18} /> Campaigns
        </button>
      </div>

      {/* SUBSCRIBERS TAB */}
      {activeTab === 'subscribers' && (
        <div className="tab-pane">
          <div className="atelier-discovery">
            <div className="search-glass-wrapper">
              <Search size={18} className="glass-icon" />
              <input
                type="text"
                className="search-glass-input"
                placeholder="Search by email..."
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
              />
            </div>
            <div className="filter-glass-matrix">
              <FormField label="Start Date">
                <input type="date" value={subStartDate} onChange={e => { setSubStartDate(e.target.value); setSubPage(1); }} />
              </FormField>
              <FormField label="End Date">
                <input type="date" value={subEndDate} onChange={e => { setSubEndDate(e.target.value); setSubPage(1); }} />
              </FormField>
              <div className="select-glass-wrapper">
                <Filter size={14} className="glass-icon" />
                <select value={subStatus} onChange={(e) => { setSubStatus(e.target.value); setSubPage(1); }}>
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="unsubscribed">Unsubscribed</option>
                </select>
              </div>
              <button onClick={() => setIsSubModalOpen(true)} className="btn btn--primary">
                <Plus size={16} /> Add Subscriber
              </button>
            </div>
          </div>

          {selectedSubscribers.size > 0 && (
            <div className="bulk-action-bar">
              <span>{selectedSubscribers.size} subscriber(s) selected</span>
              <div className="bulk-action-buttons">
                <button className="btn btn--outline btn--sm" onClick={() => handleBulkAction('unsubscribe')}>Unsubscribe Selected</button>
                <button className="btn btn--outline btn--sm btn--danger-outline" onClick={() => handleBulkAction('delete')}>Delete Selected</button>
              </div>
            </div>
          )}

          <div className="card">
            <DataTable
              loading={subLoading}
              columns={subscriberColumns}
              data={subscribers}
              page={subPage}
              totalPages={subTotalPages}
              onPageChange={setSubPage}
              emptyState={<EmptyState icon={<Users size={40} />} title="No subscribers found" description="Adjust your search or filters." />}
              actions={(row) => (
                <>
                  <button onClick={() => handleToggleSubStatus(row)} className="icon-btn" title="Toggle status">
                    <RefreshCw size={14} />
                  </button>
                  <button onClick={() => setDeleteConfirmTarget({ id: row.id, type: 'subscriber' })} className="icon-btn danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            />
          </div>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div className="tab-pane">
          <div className="atelier-discovery">
            <div className="filter-glass-matrix">
              <FormField label="Start Date">
                <input type="date" value={campStartDate} onChange={e => { setCampStartDate(e.target.value); setCampPage(1); }} />
              </FormField>
              <FormField label="End Date">
                <input type="date" value={campEndDate} onChange={e => { setCampEndDate(e.target.value); setCampPage(1); }} />
              </FormField>
            </div>
            <button onClick={() => handleOpenCampModal()} className="btn btn--primary">
              <Plus size={16} /> Compose New Campaign
            </button>
          </div>

          {campLoading ? (
            <LoadingState label="Loading campaigns..." />
          ) : campaigns.length === 0 ? (
            <EmptyState icon={<Send size={40} />} title="No campaigns yet" description="Compose your first newsletter to get started." />
          ) : (
            <div className="campaign-grid">
              {campaigns.map(c => (
                <div key={c.id} className="card campaign-card">
                  <div className="campaign-card-top">
                    <div>
                      <StatusBadge tone={CAMP_STATUS_TONE[c.status] || 'neutral'} label={c.status.toUpperCase()} />
                      <h3 className="campaign-subject">{c.subject}</h3>
                    </div>
                    {c.status !== 'sent' && (
                      <div className="campaign-card-actions">
                        <button onClick={() => handleOpenCampModal(c)} className="icon-btn" title="Edit"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteCampaign(c.id)} className="icon-btn danger" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>

                  <div className="campaign-meta">
                    <div className="campaign-meta-item"><span>Sent Count:</span> {c.sentCount}</div>
                    {c.sentAt && <div className="campaign-meta-item"><span>Sent At:</span> {new Date(c.sentAt).toLocaleString()}</div>}
                  </div>

                  {c.status !== 'sent' && c.status !== 'sending' && (
                    <button onClick={() => handleSendCampaign(c.id)} className="btn btn--primary campaign-send-btn">
                      <Send size={16} /> Broadcast Now
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="table-footer campaign-pagination">
            <div className="pagination">
              <button className="page-btn" disabled={campPage <= 1} onClick={() => setCampPage(campPage - 1)} aria-label="Previous page">Previous</button>
              <span className="page-info">Page {campPage} of {campTotalPages || 1}</span>
              <button className="page-btn" disabled={campPage >= campTotalPages} onClick={() => setCampPage(campPage + 1)} aria-label="Next page">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* SUBSCRIBER DRAWER */}
      <Drawer isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} title="Add Subscriber" width={440}>
        <form onSubmit={handleAddSubscriber} className="newsletter-form">
          <FormField label="Email Address" required error={subError}>
            <input
              type="email"
              required
              value={newSubEmail}
              onChange={e => setNewSubEmail(e.target.value)}
            />
          </FormField>
          <div className="drawer-actions">
            <button type="button" className="btn btn--outline" onClick={() => setIsSubModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn--primary">Add Subscriber</button>
          </div>
        </form>
      </Drawer>

      {/* CAMPAIGN DRAWER — raw mode: Quill's own layout/toolbar don't fit the generic title/body chrome */}
      <Drawer isOpen={isCampModalOpen} onClose={() => setIsCampModalOpen(false)} raw>
        <div className="campaign-drawer-panel">
          <h2 className="campaign-drawer-title">
            {campForm.id ? 'Edit Campaign' : 'Compose Newsletter'}
          </h2>
          <div className="newsletter-form">
            <FormField label="Subject Line">
              <input
                type="text"
                value={campForm.subject}
                onChange={e => setCampForm({...campForm, subject: e.target.value})}
                placeholder="e.g. The Spring Collection is Here"
              />
            </FormField>
            <FormField label="Email Content (Rich Text)">
              <div className="quill-container-override">
                {!editorReady && (
                  <div className="quill-loading">
                    <RefreshCw className="spin" size={24} />
                    <span>Loading editor...</span>
                  </div>
                )}
                <div
                  ref={quillRef}
                  style={{ display: editorReady ? 'block' : 'none', height: '300px', color: 'var(--color-text)' }}
                />
              </div>
            </FormField>
            <p className="campaign-hint">
              Click the image icon inside the toolbar above to embed images directly into the text layout. Attachments can still be appended silently below.
            </p>
            <FormField label="Attachments">
              <div>
                <div className="attachment-list">
                  {campForm.attachments.map((att, i) => (
                    <div key={i} className="attachment-chip">
                      <Paperclip size={12}/>
                      <span>{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        aria-label={`Remove attachment ${att.filename}`}
                      >
                        <XCircle size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="btn btn--outline btn--sm attachment-upload-label">
                  {uploadingFiles ? 'Uploading...' : 'Add Attachment'}
                  <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingFiles} />
                </label>
              </div>
            </FormField>
          </div>

          <div className="drawer-actions campaign-drawer-actions">
            <button type="button" className="btn btn--outline" onClick={() => setIsCampModalOpen(false)}>Close</button>
            <button type="button" className="btn btn--outline" onClick={handleSaveCampaign} disabled={isSaving || isSending}>
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => handleSendCampaign()} disabled={isSaving || isSending}>
              {isSending ? 'Sending...' : 'Send Campaign'}
            </button>
          </div>
        </div>
      </Drawer>

      {/* CONFIRMATION MODAL — stays centered: a destructive confirm needs to feel like a stop */}
      <Modal isOpen={!!deleteConfirmTarget} onClose={() => setDeleteConfirmTarget(null)} title="Are you sure?" maxWidth={400}>
        {deleteConfirmTarget && (
          <div style={{ textAlign: 'center' }}>
            <Trash2 size={40} color="var(--color-error-text)" style={{ margin: '0 auto 20px auto' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '30px' }}>
              This action cannot be undone. This {deleteConfirmTarget.type} will be permanently deleted from the database.
            </p>
            <div className="drawer-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn--outline" onClick={() => setDeleteConfirmTarget(null)}>Cancel</button>
              <button type="button" className="btn btn--danger" onClick={confirmDelete}>Yes, Delete It</button>
            </div>
          </div>
        )}
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .newsletters-page { padding: var(--sp-7); max-width: 1400px; margin: 0 auto; min-height: 100vh; }

        .tab-glass-panel { background: var(--bg-section); border: 1.5px solid var(--border-default); border-radius: var(--r); padding: var(--sp-1); display: inline-flex; gap: var(--sp-1); margin-bottom: var(--sp-5); }
        .tab-glass-btn { background: none; border: none; color: var(--text-muted); padding: var(--sp-2) var(--sp-4); border-radius: var(--r); font-weight: 500; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: var(--sp-2); transition: all var(--t-fast, .18s) var(--ease, ease); }
        .tab-glass-btn.active { background: var(--y-base); color: var(--text-inverse); }
        .tab-glass-btn:hover:not(.active) { color: var(--text-secondary); background: var(--border-low); }

        .atelier-discovery { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: var(--sp-5); gap: var(--sp-5); flex-wrap: wrap; }
        .search-glass-wrapper { position: relative; background: var(--bg-elevated); border: 1.5px solid var(--border-default); border-radius: var(--r); padding: 10px var(--sp-4); display: flex; align-items: center; flex: 1; max-width: 400px; height: var(--tap); }
        .search-glass-input { background: none; border: none; color: var(--text-primary); width: 100%; outline: none; margin-left: var(--sp-3); font-size: 0.9rem; font-family: var(--f-body); font-weight: 300; }
        .filter-glass-matrix { display: flex; gap: var(--sp-3); align-items: flex-end; flex-wrap: wrap; }
        .filter-glass-matrix .form-field { margin-bottom: 0; }
        .filter-glass-matrix input[type="date"] { height: var(--tap); width: 150px; }
        .select-glass-wrapper { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--r); padding: var(--sp-2) var(--sp-4); display: flex; align-items: center; gap: var(--sp-3); height: var(--tap); }
        .select-glass-wrapper select { background: none; border: none; color: var(--text-primary); outline: none; cursor: pointer; font-size: 0.85rem; font-family: var(--f-body); font-weight: 300; }

        .bulk-action-bar { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-3) var(--sp-5); margin-bottom: var(--sp-5); background: var(--border-low); border: 1px solid var(--y-base); border-radius: var(--r); font-size: 0.85rem; font-weight: 400; color: var(--y-base); flex-wrap: wrap; gap: var(--sp-3); }
        .bulk-action-buttons { display: flex; gap: var(--sp-2); }
        .btn--danger-outline { color: var(--error); border-color: var(--error); }

        .campaign-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--sp-5); margin-bottom: var(--sp-5); }
        .campaign-card { display: flex; flex-direction: column; gap: var(--sp-4); }
        .campaign-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-3); }
        .campaign-subject { font-size: 1.1rem; font-weight: 400; color: var(--text-primary); margin: var(--sp-2) 0 0 0; }
        .campaign-card-actions { display: flex; gap: var(--sp-2); flex-shrink: 0; }
        .campaign-meta { display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--text-muted); }
        .campaign-meta-item span { font-weight: 500; margin-right: 6px; }
        .campaign-send-btn { justify-content: center; }

        .table-footer.campaign-pagination { border: none; padding: 0; justify-content: flex-start; }
        .pagination { display: flex; align-items: center; gap: var(--sp-3); }
        .page-btn { background: none; border: 1px solid var(--border-default); color: var(--text-secondary); padding: 6px 14px; border-radius: var(--r); cursor: pointer; font-size: 0.8rem; transition: all var(--t-fast, .18s) var(--ease, ease); }
        .page-btn:hover:not(:disabled) { border-color: var(--y-base); color: var(--y-base); }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--y-glow, var(--color-border-focus)); }
        .page-info { font-size: 0.8rem; color: var(--text-muted); }

        .newsletter-form { display: flex; flex-direction: column; gap: var(--sp-5); }
        .drawer-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; flex-wrap: wrap; margin-top: var(--sp-2); }

        .campaign-drawer-panel { padding: var(--sp-7); width: 800px; max-width: 90vw; height: 100%; overflow-y: auto; background: var(--bg-surface); display: flex; flex-direction: column; gap: var(--sp-5); }
        .campaign-drawer-title { font-family: var(--f-display); font-size: 1.8rem; font-weight: 400; color: var(--text-primary); margin: 0; }
        .campaign-drawer-actions { border-top: 1px solid var(--border-default); padding-top: var(--sp-5); }

        .quill-container-override { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--r); overflow: hidden; min-height: 340px; }
        .quill-loading { height: 300px; display: flex; align-items: center; justify-content: center; gap: var(--sp-2); color: var(--text-muted); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }

        .campaign-hint { font-size: 0.75rem; color: var(--text-muted); margin: -8px 0 0 0; }

        .attachment-list { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-2); }
        .attachment-chip { display: flex; align-items: center; gap: 6px; background: var(--bg-section); border: 1px solid var(--border-default); border-radius: var(--r); padding: 6px 10px; font-size: 0.75rem; }
        .attachment-chip span { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .attachment-chip button { background: none; border: none; padding: 0; display: inline-flex; cursor: pointer; color: var(--error); }
        .attachment-upload-label { display: inline-flex; cursor: pointer; }

        @media (max-width: 768px) {
          .newsletters-page { padding: var(--sp-4); }
          .atelier-discovery { flex-direction: column; align-items: stretch; }
          .search-glass-wrapper { max-width: none; }
          .filter-glass-matrix { flex-direction: column; align-items: stretch; }
          .filter-glass-matrix input[type="date"] { width: 100%; }
          .campaign-grid { grid-template-columns: 1fr; }
          .campaign-drawer-panel { padding: var(--sp-5); width: 100vw; max-width: 100vw; }
        }

        @media (max-width: 480px) {
          .tab-glass-panel { width: 100%; }
          .tab-glass-btn { flex: 1; justify-content: center; }
          .bulk-action-bar { flex-direction: column; align-items: stretch; text-align: center; }
          .bulk-action-buttons { justify-content: center; }
          .pagination { flex-wrap: wrap; justify-content: center; }
        }
      `}} />
    </div>
  );
}
